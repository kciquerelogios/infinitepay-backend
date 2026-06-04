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
    const MELHORENVIO_TOKEN = process.env.MELHORENVIO_TOKEN;

    // Buscar dados do cliente no Redis
    let dadosPedido = null;
    if (payload.order_nsu && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const redisResp = await fetch(`${process.env.KV_REST_API_URL}/get/${payload.order_nsu}`, {
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
        const redisData = await redisResp.json();

        if (redisData && redisData.result) {
          let parsed = redisData.result;
          while (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (parsed && parsed.value) {
            let inner = parsed.value;
            while (typeof inner === 'string') inner = JSON.parse(inner);
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

    // Filtrar frete dos line_items
    const items = payload.items || [];
    const lineItems = items
      .filter(item => !item.description.toLowerCase().startsWith('frete'))
      .map(item => ({
        title: item.description || 'Produto',
        quantity: item.quantity || 1,
        price: ((item.price || 0) / 100).toFixed(2),
        requires_shipping: true
      }));

    // Montar pedido Shopify
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

      // Buscar cliente existente pelo email
      try {
        const clienteResp = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=email:${encodeURIComponent(cliente.email)}`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        );
        const clienteData = await clienteResp.json();
        if (clienteData.customers && clienteData.customers.length > 0) {
          orderData.order.customer = { id: clienteData.customers[0].id };
        } else {
          orderData.order.customer = {
            first_name: primeiroNome,
            last_name: sobrenome,
            email: cliente.email || '',
            phone: cliente.telefone || ''
          };
        }
      } catch(e) {
        orderData.order.customer = {
          first_name: primeiroNome,
          last_name: sobrenome,
          email: cliente.email || ''
        };
      }

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

    // Criar pedido no Shopify
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

    if (!shopifyData.order) {
      console.error('Erro Shopify:', JSON.stringify(shopifyData));
      return res.status(400).json({ success: false, message: 'Erro ao criar pedido no Shopify' });
    }

    console.log('Pedido criado no Shopify:', shopifyData.order.id);

    // Adicionar no carrinho do Melhor Envio
    if (cliente && frete && MELHORENVIO_TOKEN) {
      try {
        const cepLimpo = cliente.cep.replace(/\D/g, '');
        const produtoDescricao = lineItems[0] ? lineItems[0].title : 'Produto';

        // Serviço: 1 = PAC, 2 = SEDEX
        const serviceId = frete.id === 1 ? 1 : 2;

        const melhorEnvioBody = {
          service: serviceId,
          agency: null,
          from: {
            name: 'Kcique Relógios',
            phone: '11000000000',
            email: 'kciqueadm@gmail.com',
            document: process.env.MELHORENVIO_CPF,
            company_document: '66609452000183',
            state_register: null,
            address: 'Rua São Francisco',
            complement: 'Ap 804',
            number: '98',
            district: 'Se',
            city: 'São Paulo',
            country_id: 'BR',
            postal_code: '01005020',
            note: ''
          },
          to: {
            name: cliente.nome,
            phone: cliente.telefone.replace(/\D/g, ''),
            email: cliente.email,
            document: cliente.cpf ? cliente.cpf.replace(/\D/g, '') : '',
            address: cliente.rua,
            complement: cliente.complemento || '',
            number: cliente.numero,
            district: cliente.bairro,
            city: cliente.cidade,
            country_id: 'BR',
            postal_code: cepLimpo,
            note: ''
          },
          products: [{
            name: produtoDescricao,
            quantity: 1,
            unitary_value: ((payload.paid_amount || payload.amount || 0) / 100 - frete.preco).toFixed(2),
            weight: 0.5
          }],
          volumes: [{
            height: 10,
            width: 12,
            length: 18,
            weight: 0.5
          }],
          tag: shopifyData.order.id.toString(),
          platform: 'Shopify',
          invoice: {
            key: null
          },
          options: {
            insurance_value: ((payload.paid_amount || payload.amount || 0) / 100 - frete.preco).toFixed(2),
            receipt: false,
            own_hand: false,
            collect: false,
            reverse: false,
            non_commercial: false
          }
        };

        const meResp = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MELHORENVIO_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)'
          },
          body: JSON.stringify(melhorEnvioBody)
        });

        const meData = await meResp.json();
        console.log('=== MELHOR ENVIO CART ===', JSON.stringify(meData));

        if (meData.id) {
          console.log('Etiqueta adicionada ao carrinho do Melhor Envio:', meData.id);
        } else {
          console.log('Erro ao adicionar no Melhor Envio:', JSON.stringify(meData));
        }
      } catch (e) {
        console.log('Erro Melhor Envio:', e.message);
      }
    }

    // Deletar do Redis após usar
    if (payload.order_nsu && process.env.KV_REST_API_URL) {
      await fetch(`${process.env.KV_REST_API_URL}/del/${payload.order_nsu}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
    }

    return res.status(200).json({ success: true, message: null });

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
