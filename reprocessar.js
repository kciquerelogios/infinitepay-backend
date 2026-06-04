export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { order_nsu, secret } = req.query;

  // Proteção básica
  if (secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  if (!order_nsu) {
    return res.status(400).json({ erro: 'order_nsu obrigatório' });
  }

  try {
    // Buscar dados no Redis
    const redisResp = await fetch(`${process.env.KV_REST_API_URL}/get/${order_nsu}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    const redisData = await redisResp.json();

    if (!redisData || !redisData.result) {
      return res.status(404).json({ erro: 'Pedido não encontrado no Redis. Pode ter expirado (24h).' });
    }

    let parsed = redisData.result;
    while (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (parsed && parsed.value) {
      let inner = parsed.value;
      while (typeof inner === 'string') inner = JSON.parse(inner);
      parsed = inner;
    }

    const dadosPedido = parsed;
    const cliente = dadosPedido.cliente;
    const frete = dadosPedido.frete;

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
    const MELHORENVIO_TOKEN = process.env.MELHORENVIO_TOKEN;

    const primeiroNome = cliente.nome.split(' ')[0] || '';
    const sobrenome = cliente.nome.split(' ').slice(1).join(' ') || '';

    // Buscar cliente existente pelo email
    let customerData = {};
    try {
      const clienteResp = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=email:${encodeURIComponent(cliente.email)}`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      );
      const clienteData = await clienteResp.json();
      if (clienteData.customers && clienteData.customers.length > 0) {
        customerData = { id: clienteData.customers[0].id };
      } else {
        customerData = { first_name: primeiroNome, last_name: sobrenome, email: cliente.email };
      }
    } catch(e) {
      customerData = { first_name: primeiroNome, last_name: sobrenome, email: cliente.email };
    }

    const orderData = {
      order: {
        line_items: [{
          title: dadosPedido.descricao,
          quantity: 1,
          price: (dadosPedido.preco / 100).toFixed(2),
          requires_shipping: true
        }],
        financial_status: 'paid',
        currency: 'BRL',
        note: `Pago via InfinitePay | NSU: ${order_nsu} | Telefone: ${cliente.telefone} | Reprocessado manualmente`,
        tags: 'InfinitePay',
        customer: customerData,
        shipping_address: {
          first_name: primeiroNome,
          last_name: sobrenome,
          address1: `${cliente.rua}, ${cliente.numero}`,
          address2: cliente.complemento || '',
          zip: cliente.cep.replace(/\D/g, ''),
          city: cliente.cidade,
          province: cliente.estado,
          country: 'BR',
          phone: cliente.telefone || ''
        },
        shipping_lines: frete ? [{
          title: frete.nome,
          price: frete.preco.toFixed(2),
          code: frete.id === 1 ? 'PAC' : 'SEDEX'
        }] : [],
        transactions: [{
          kind: 'sale',
          status: 'success',
          amount: ((dadosPedido.preco / 100) + (frete ? frete.preco : 0)).toFixed(2),
          gateway: 'InfinitePay'
        }]
      }
    };

    const shopifyResp = await fetch(
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

    const shopifyData = await shopifyResp.json();

    if (!shopifyData.order) {
      return res.status(400).json({ erro: 'Erro Shopify', detalhe: shopifyData });
    }

    // Adicionar no Melhor Envio
    let melhorEnvioResult = null;
    if (frete && MELHORENVIO_TOKEN) {
      try {
        const meResp = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MELHORENVIO_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)'
          },
          body: JSON.stringify({
            service: frete.id === 1 ? 1 : 2,
            from: {
              name: 'Kcique Relógios',
              phone: '11000000000',
              email: 'kciqueadm@gmail.com',
              document: process.env.MELHORENVIO_CPF,
              company_document: '66609452000183',
              address: 'Rua São Francisco',
              complement: 'Ap 804',
              number: '98',
              district: 'Se',
              city: 'São Paulo',
              country_id: 'BR',
              postal_code: '01005020'
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
              postal_code: cliente.cep.replace(/\D/g, '')
            },
            products: [{
              name: dadosPedido.descricao,
              quantity: 1,
              unitary_value: (dadosPedido.preco / 100).toFixed(2),
              weight: 0.5
            }],
            volumes: [{ height: 10, width: 12, length: 18, weight: 0.5 }],
            tag: shopifyData.order.id.toString(),
            platform: 'Shopify',
            options: {
              insurance_value: (dadosPedido.preco / 100).toFixed(2),
              receipt: false,
              own_hand: false,
              collect: false,
              reverse: false,
              non_commercial: false
            }
          })
        });
        melhorEnvioResult = await meResp.json();
      } catch(e) {
        melhorEnvioResult = { erro: e.message };
      }
    }

    return res.status(200).json({
      sucesso: true,
      shopify_order_id: shopifyData.order.id,
      melhor_envio: melhorEnvioResult
    });

  } catch (error) {
    return res.status(500).json({ erro: error.message });
  }
}
