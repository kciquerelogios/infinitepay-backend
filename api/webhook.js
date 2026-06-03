export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('=== PAYLOAD INFINITEPAY ===', JSON.stringify(payload));

    if (!payload || !payload.items) {
      return res.status(400).json({ success: false, message: 'Payload inválido' });
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

    // Buscar dados do cliente no Redis
    let dadosPedido = null;
    if (payload.order_nsu && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const redisResp = await fetch(`${process.env.KV_REST_API_URL}/get/${payload.order_nsu}`, {
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
        const redisData = await redisResp.json();

        // Upstash retorna { result: string }
        // O string pode ter múltiplos níveis de JSON aninhado
        if (redisData && redisData.result) {
          let parsed = redisData.result;

          // Desencapsular até chegar no objeto com "cliente"
          while (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }

          // Se ainda tiver um "value" dentro, desencapsular mais
          if (parsed && parsed.value) {
            let inner = parsed.value;
            while (typeof inner === 'string') {
              inner = JSON.parse(inner);
            }
            parsed = inner;
          }

          dadosPedido = parsed;
          console.log('=== DADOS CLIENTE FINAL ===', JSON.stringify(dadosPedido));
        }
      } catch (e) {
        console.log('Erro ao buscar Redis:', e.message);
      }
    }

    const cliente = dadosPedido ? dadosPedido.cliente : null;
    const frete = dadosPedido ? dadosPedido.frete : null;

    const items = payload.items || [];
    const lineItems = items.map(item => ({
      title: item.description || 'Produto',
      quantity: item.quantity || 1,
      price: ((item.price || 0) / 100).toFixed(2),
      requires_shipping: true
    }));

    const orderData = {
      order: {
        line_items: lineItems,
        financial_status: 'paid',
        fulfillment_status: null,
        currency: 'BRL',
        note: `Pago via InfinitePay | NSU: ${payload.order_nsu || ''} | Método: ${payload.capture_method || ''} | Comprovante: ${payload.receipt_url || ''}`,
        tags: 'InfinitePay',
        transactions: [{
          kind: 'sale',
          status: 'success',
          amount: ((payload.paid_amount || payload.amount || 0) / 100).toFixed(2),
          gateway: 'InfinitePay'
        }]
      }
    };

    if (cliente) {
      const primeiroNome = cliente.nome.split(' ')[0] || '';
      const sobrenome = cliente.nome.split(' ').slice(1).join(' ') || '';

      orderData.order.customer = {
        first_name: primeiroNome,
        last_name: sobrenome,
        email: cliente.email || '',
        phone: cliente.telefone || ''
      };

      orderData.order.shipping_address = {
        first_name: primeiroNome,
        last_name: sobrenome,
        address1: `${cliente.rua}, ${cliente.numero}`,
        address2: cliente.complemento || '',
        zip: cliente.cep.replace(/\D/g, ''),
        city: cliente.cidade,
        province: cliente.estado,
        country: 'BR',
        phone: cliente.telefone || ''
      };

      orderData.order.billing_address = orderData.order.shipping_address;
    }

    if (frete) {
      orderData.order.shipping_lines = [{
        title: frete.nome,
        price: frete.preco.toFixed(2),
        code: frete.id === 1 ? 'PAC' : 'SEDEX'
      }];
    }

    const shopifyResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_TOKEN
        },
        body: JSON.stringify(orderData)
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (shopifyData.order) {
      console.log('Pedido criado no Shopify:', shopifyData.order.id);

      // Deletar do Redis após usar
      if (payload.order_nsu && process.env.KV_REST_API_URL) {
        await fetch(`${process.env.KV_REST_API_URL}/del/${payload.order_nsu}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
      }

      return res.status(200).json({ success: true, message: null });
    } else {
      console.error('Erro Shopify:', JSON.stringify(shopifyData));
      return res.status(400).json({ success: false, message: 'Erro ao criar pedido' });
    }

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
