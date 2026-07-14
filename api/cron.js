export default async function handler(req, res) {
  // Verificar se é chamada do Vercel Cron
  const authHeader = req.headers['authorization'];
  const secret = req.query.secret;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isManual = secret === process.env.REPROCESSAR_SECRET;
  if (!isVercelCron && !isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    // Buscar leads pelo Set (novo formato sem duplicatas)
    const listaResp = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SMEMBERS', 'leads-set']])
    });
    const listaData = await listaResp.json();
    const ids = (Array.isArray(listaData) && listaData[0]?.result) ? listaData[0].result : [];

    let atualizados = 0;

    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const d = await r.json();
        if (!d.result) continue;

        let lead = d.result;
        while (typeof lead === 'string') {
          try { lead = JSON.parse(lead); } catch(e) { break; }
        }
        if (lead && lead.value) {
          let inner = lead.value;
          while (typeof inner === 'string') {
            try { inner = JSON.parse(inner); } catch(e) { break; }
          }
          lead = inner;
        }

        // Verificar leads pagamento_pendente com mais de 10 minutos
        if (lead && lead.estagio === 'pagamento_pendente' && lead.atualizado_em) {
          const agora = new Date();
          const atualizado = new Date(lead.atualizado_em);
          const minutos = (agora - atualizado) / 1000 / 60;

          if (minutos >= 10) {
            // Marcar como abandonou no pagamento
            lead.estagio = 'abandonou_pagamento';
            lead.atualizado_em = new Date().toISOString();

            await fetch(`${KV_URL}/set/${id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 })
            });

            atualizados++;
            console.log(`Lead ${id} marcado como abandonou_pagamento`);
          }
        }
      } catch(e) {
        console.log('Erro ao processar lead:', id, e.message);
      }
    }

    // Verificar rastreios do Melhor Envio e atualizar Shopify + WhatsApp cliente
    let rastreiosEnviados = 0;
    try {
      const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
      const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
      const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
      const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
      const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
      const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

      // Buscar pedidos do Melhor Envio com tracking
      const pages = await Promise.all([1,2,3,4,5].map(page =>
        fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${page}`, {
          headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
        }).then(r => r.json()).catch(() => ({ data: [] }))
      ));

      const purchases = pages.flatMap(p => p.data || []);

      for (const purchase of purchases) {
        for (const order of (purchase.orders || [])) {
          if (order.status !== 'released' || !order.tracking) continue;

          const tracking = order.tracking;
          const chave = `rastreio-enviado-${tracking}`;

          // Já enviado antes?
          const check = await fetch(`${KV_URL}/get/${encodeURIComponent(chave)}`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
          }).then(r => r.json()).catch(() => ({}));
          if (check.result) continue;

          const nomeDestinatario = order.to?.name || '';
          const emailDestinatario = order.to?.email || '';
          let telefone = (order.to?.phone || '').replace(/[^0-9]/g, '');

          // Buscar telefone no Shopify se não tiver
          if (!telefone && emailDestinatario) {
            const shopResp = await fetch(
              `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(emailDestinatario)}&limit=3&financial_status=paid`,
              { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
            ).then(r => r.json()).catch(() => ({ orders: [] }));
            const pedido = (shopResp.orders || [])[0];
            if (pedido) {
              telefone = ((pedido.shipping_address?.phone) || pedido.phone || (pedido.billing_address?.phone) || '').replace(/[^0-9]/g, '');
            }
          }

          // 1. Enviar WhatsApp pro cliente
          if (telefone) {
            if (!telefone.startsWith('55')) telefone = '55' + telefone;
            const primeiroNome = nomeDestinatario.split(' ')[0] || 'cliente';
            const mensagem = `Olá ${primeiroNome}! 😊

Seu pedido da *Kcique Relógios* foi enviado! ⌚📦

🔍 *Código de rastreio:*
${tracking}

📦 *Acompanhe aqui:*
https://www.melhorrastreio.com.br/rastreio/${tracking}

Qualquer dúvida estamos aqui! 😊`;
            await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8', 'client-token': ZAPI_CLIENT_TOKEN },
              body: JSON.stringify({ phone: telefone, message: mensagem })
            }).catch(e => console.error('Erro WhatsApp rastreio:', e.message));
            console.log('WhatsApp rastreio enviado:', telefone, tracking);
          }

          // 2. Marcar como enviado no Redis
          await fetch(`${KV_URL}/set/${encodeURIComponent(chave)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: '1', ex: 2592000 })
          });

          // 3. Atualizar fulfillment no Shopify
          if (emailDestinatario && SHOPIFY_STORE && SHOPIFY_TOKEN) {
            try {
              const shopResp = await fetch(
                `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(emailDestinatario)}&limit=10&financial_status=paid&status=any`,
                { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
              ).then(r => r.json()).catch(() => ({ orders: [] }));

              const pedidos = shopResp.orders || [];
              const shopPedido = pedidos.find(p => !p.fulfillment_status || p.fulfillment_status === 'unfulfilled')
                || pedidos.find(p => p.fulfillment_status === 'partial')
                || pedidos[0];

              if (shopPedido) {
                const jaTemTracking = (shopPedido.fulfillments || []).some(f => (f.tracking_numbers || []).includes(tracking));
                if (!jaTemTracking) {
                  const foResp = await fetch(
                    `https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${shopPedido.id}/fulfillment_orders.json`,
                    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
                  ).then(r => r.json()).catch(() => ({}));

                  const fo = (foResp.fulfillment_orders || []).find(f => f.status === 'open');
                  if (fo) {
                    const fulfillResp = await fetch(
                      `https://${SHOPIFY_STORE}/admin/api/2026-04/fulfillments.json`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
                        body: JSON.stringify({
                          fulfillment: {
                            line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                            tracking_info: {
                              number: tracking,
                              url: `https://www.melhorrastreio.com.br/rastreio/${tracking}`,
                              company: 'Correios'
                            },
                            notify_customer: false
                          }
                        })
                      }
                    ).then(r => r.json()).catch(() => ({}));
                    console.log('Shopify fulfillment criado:', shopPedido.order_number, tracking, fulfillResp.fulfillment?.id || 'erro');
                  }
                }
              }
            } catch(e) { console.error('Erro Shopify fulfillment:', e.message); }
          }

          rastreiosEnviados++;
        }
      }
    } catch(e) { console.error('Erro verificarRastreios cron:', e.message); }

    return res.status(200).json({ ok: true, atualizados, rastreiosEnviados });
  } catch(e) {
    return res.status(500).json({ erro: e.message });
  }
}
