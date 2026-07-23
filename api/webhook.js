export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // ── REPROCESSAR pedido do Redis ────────────────────────────
  if (req.method === 'GET' && req.query.reprocessar && req.query.secret === process.env.REPROCESSAR_SECRET) {
    const nsu = req.query.reprocessar;
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const redisResp = await fetch(`${KV_URL}/get/${nsu}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const redisData = await redisResp.json();
    if (!redisData || !redisData.result) return res.status(404).json({ erro: 'NSU não encontrado no Redis' });
    let dadosSalvos = redisData.result;
    while (typeof dadosSalvos === 'string') dadosSalvos = JSON.parse(dadosSalvos);
    if (dadosSalvos && dadosSalvos.value) { let inner = dadosSalvos.value; while (typeof inner === 'string') inner = JSON.parse(inner); dadosSalvos = inner; }
    // Montar payload fake igual ao InfinitePay
    const carrinho = dadosSalvos.carrinho || [];
    const freteSalvo = dadosSalvos.frete;
    const fakeItems = carrinho.map(i => ({ price: i.preco, quantity: i.quantidade || 1, description: i.nome + (i.cor && i.cor !== 'Default Title' ? ' - Cor: ' + i.cor : '') }));
    if (freteSalvo) fakeItems.push({ price: Math.round(freteSalvo.preco * 100), quantity: 1, description: `Frete ${freteSalvo.nome}` });
    const fakePayload = {
      items: fakeItems,
      amount: carrinho.reduce((s, i) => s + i.preco * (i.quantidade || 1), 0) + (freteSalvo ? Math.round(freteSalvo.preco * 100) : 0),
      paid_amount: carrinho.reduce((s, i) => s + i.preco * (i.quantidade || 1), 0) + (freteSalvo ? Math.round(freteSalvo.preco * 100) : 0),
      order_nsu: nsu,
      capture_method: 'reprocessado',
      receipt_url: dadosSalvos.receipt_url || ''
    };
    req.body = fakePayload;
    req.method = 'POST';
    // cai no fluxo normal abaixo
  }

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
    const carrinhoSalvo = dadosPedido ? dadosPedido.carrinho : null;
    const cupomAplicado = dadosPedido ? dadosPedido.cupom : null;
    const valorOriginal = dadosPedido ? dadosPedido.valorOriginal : null;

    // Usar carrinho salvo se disponível, senão usar payload
    let lineItems;
    if (carrinhoSalvo && carrinhoSalvo.length > 0) {
      lineItems = carrinhoSalvo.map(item => ({
        title: item.nome + (item.cor && item.cor !== 'Default Title' ? ' - Cor: ' + item.cor : ''),
        quantity: item.quantidade || 1,
        price: (item.preco / 100).toFixed(2),
        requires_shipping: true
      }));
    } else {
      const items = payload.items || [];
      lineItems = items
        .filter(item => !item.description.toLowerCase().startsWith('frete'))
        .map(item => ({
          title: item.description || 'Produto',
          quantity: item.quantity || 1,
          price: ((item.price || 0) / 100).toFixed(2),
          requires_shipping: true
        }));
    }

    // Montar pedido Shopify
    const orderData = {
      order: {
        line_items: lineItems,
        financial_status: 'paid',
        fulfillment_status: null,
        currency: 'BRL',
        note: `Pago via InfinitePay | NSU: ${payload.order_nsu || ''} | Método: ${payload.capture_method || ''} | Telefone: ${cliente ? cliente.telefone : ''} | Comprovante: ${payload.receipt_url || ''} | Origem: ${dadosPedido?.ref || 'direto'}${cupomAplicado ? ' | Cupom: ' + cupomAplicado.codigo + ' (' + cupomAplicado.tipo + ' -' + (cupomAplicado.tipo === 'percentual' ? cupomAplicado.valor + '%)' : 'R$' + cupomAplicado.valor + ')') : ''}${valorOriginal ? ' | Valor original: R$' + parseFloat(valorOriginal).toFixed(2) : ''}`,
        tags: 'InfinitePay',
        discount_codes: (() => {
          if (!cupomAplicado) return [];
          let discountAmount = 0;
          if (cupomAplicado.tipo === 'frete_gratis') {
            // Desconto = valor do frete
            discountAmount = frete ? parseFloat(frete.preco || 0) : 0;
          } else if (valorOriginal) {
            discountAmount = Math.max(0, parseFloat(valorOriginal) - parseFloat(payload.amount || 0) / 100);
          }
          if (discountAmount <= 0) return [];
          return [{ code: cupomAplicado.codigo, amount: discountAmount.toFixed(2), type: 'fixed_amount' }];
        })(),
        transactions: [{
          kind: 'sale',
          status: 'success',
          amount: ((payload.paid_amount || payload.amount || 0) / 100).toFixed(2),
          gateway: 'InfinitePay'
        }]
      }
    };

    if (cliente) {
      const partesNome = (cliente.nome || '').trim().split(/\s+/);
      const primeiroNome = partesNome[0] || 'Cliente';
      const sobrenome = partesNome.length > 1 ? partesNome.slice(1).join(' ') : primeiroNome;

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
            email: cliente.email || ''
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
      console.error('Erro Shopify 422:', JSON.stringify(shopifyData));
      console.error('OrderData enviado:', JSON.stringify(orderData));
      return res.status(400).json({ success: false, message: 'Erro ao criar pedido no Shopify', shopify_errors: shopifyData.errors });
    }

    console.log('Pedido criado no Shopify:', shopifyData.order.id);

    // ===== META CAPI: Purchase =====
    try {
      const valorTotal = parseFloat(payload.amount || 0) / 100;
      const refOrigem = dadosPedido?.ref || 'direto';
      const metaPayload = {
        event_name: 'Purchase',
        event_id: 'purchase_' + (shopifyData.order.id || Date.now()),
        event_source_url: 'https://kcique.com.br/pages/checkout',
        email: cliente?.email,
        phone: cliente?.telefone,
        nome: cliente?.nome,
        ip: req.headers['x-forwarded-for'] || '',
        user_agent: req.headers['user-agent'] || '',
        cidade: cliente?.cidade,
        estado: cliente?.estado,
        cep: cliente?.cep,
        pais: 'BR',
        custom_data: {
          value: valorTotal,
          currency: 'BRL',
          order_id: String(shopifyData.order.id),
          content_ids: lineItems.map(i => String(i.variant_id || i.product_id || '')),
          contents: lineItems.map(i => ({ id: String(i.variant_id || ''), quantity: i.quantity, item_price: parseFloat(i.price) })),
          num_items: lineItems.reduce((s, i) => s + i.quantity, 0),
        }
      };
      await fetch('https://infinitepay-backend.vercel.app/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload)
      });
      console.log('Meta CAPI Purchase enviado:', valorTotal, 'BRL');
    } catch(e) {
      console.error('Meta CAPI erro:', e.message);
    }
    // ===== FIM META CAPI =====

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
            unitary_value: Math.max(1, ((payload.paid_amount || payload.amount || 0) / 100 - (frete ? frete.preco : 0))).toFixed(2),
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

    // Deletar dados do pedido do Redis após usar
    if (payload.order_nsu && process.env.KV_REST_API_URL) {
      await fetch(`${process.env.KV_REST_API_URL}/del/${payload.order_nsu}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
    }

    // Deletar lead de abandono se existir (cliente pagou!)
    if (cliente && cliente.email && process.env.KV_REST_API_URL) {
      const emailSlug = cliente.email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const leadIdNovo = `lead:${emailSlug}`;   // formato novo
      const leadIdAntigo = `lead-${emailSlug}`; // formato antigo (compatibilidade)
      const kvUrl = process.env.KV_REST_API_URL;
      const kvToken = process.env.KV_REST_API_TOKEN;
      const headers = { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' };

      // Deletar ambos os formatos
      await Promise.all([
        fetch(`${kvUrl}/del/${encodeURIComponent(leadIdNovo)}`, { method: 'POST', headers }),
        fetch(`${kvUrl}/del/${leadIdAntigo}`, { method: 'POST', headers }),
        // Remover do Set (novo sistema)
        fetch(`${kvUrl}/pipeline`, {
          method: 'POST', headers,
          body: JSON.stringify([['SREM', 'leads-set', leadIdNovo]])
        }),
        // Remover da lista antiga
        fetch(`${kvUrl}/lrem/leads-lista/0/${leadIdAntigo}`, { method: 'POST', headers }),
      ]);
      console.log('Lead removido após pagamento:', leadIdNovo);
    }

    return res.status(200).json({ success: true, message: null });

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
