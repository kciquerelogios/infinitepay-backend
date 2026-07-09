const GRUPOS_VIP = [
  '120363407575718083-group',
  '120363407700341013-group',
  '120363407514192649-group',
  '120363406939167357-group',
  '120363425311709688-group',
  '120363407634566182-group',
  '120363426601689014-group',
  '120363407550597963-group',
  '120363424221379294-group',
  '120363425206908330-group',
  '120363409632620470-group',
  '120363426115032457-group',
  '120363426651817338-group',
  '120363406708968616-group',
  '120363425674177408-group',
  '120363428180805162-group',
  '120363406426269657-group',
];

const GRUPOS_INFO = [
  { nome: '#1', id: '120363407575718083-group' },
  { nome: '#2', id: '120363407700341013-group' },
  { nome: '#3', id: '120363407514192649-group' },
  { nome: '#4', id: '120363406939167357-group' },
  { nome: '#5', id: '120363425311709688-group' },
  { nome: '#6', id: '120363407634566182-group' },
  { nome: '#7', id: '120363426601689014-group' },
  { nome: '#8', id: '120363407550597963-group' },
  { nome: '#9', id: '120363424221379294-group' },
  { nome: '#10', id: '120363425206908330-group' },
  { nome: '#11', id: '120363409632620470-group' },
  { nome: '#12', id: '120363426115032457-group' },
  { nome: '#13', id: '120363426651817338-group' },
  { nome: '#14', id: '120363406708968616-group' },
  { nome: '#15', id: '120363425674177408-group' },
  { nome: '#16', id: '120363428180805162-group' },
  { nome: '#17', id: '120363406426269657-group' },
];

async function listarOfertas(KV_URL, KV_TOKEN) {
  const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const listaData = await listaResp.json();
  const ids = listaData.result || [];
  // Buscar apenas as 60 mais recentes para evitar timeout no Vercel
  const idsRecentes = ids.slice(-60);
  console.log('Total IDs:', ids.length, '| Processando últimos:', idsRecentes.length);
  const ofertas = [];
  for (const id of idsRecentes) {
    try {
      const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      if (d.result === null || d.result === undefined) continue;
      let oferta = d.result;
      while (typeof oferta === 'string') { try { oferta = JSON.parse(oferta); } catch(e) { break; } }
      if (oferta && oferta.id) ofertas.push(oferta);
    } catch(e) {}
  }
  return ofertas.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
}

async function salvarOferta(KV_URL, KV_TOKEN, dados) {
  const { texto, imagem, link, dataHora, grupos } = dados;
  if (!texto || !dataHora) throw new Error('Texto e data obrigatorios');
  const id = `oferta_${Date.now()}`;
  const oferta = { id, texto, imagem: imagem || '', link: link || '', dataHora, grupos: grupos || 'todos', status: 'agendada', criado_em: new Date().toISOString() };
  await fetch(`${KV_URL}/set/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(oferta)
  });
  const rpushResp = await fetch(`${KV_URL}/rpush/ofertas-lista/${id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const rpushData = await rpushResp.json();
  console.log('rpush result:', JSON.stringify(rpushData));
  return id;
}

async function verificarEDisparar(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN) {
  const ofertas = await listarOfertas(KV_URL, KV_TOKEN);
  const agora = new Date();
  const disparadas = [];
  console.log('Verificando ofertas:', ofertas.length, '| Agora UTC:', agora.toISOString());

  for (const oferta of ofertas) {
    console.log('Oferta:', oferta.id, '| status:', oferta.status, '| dataHora:', oferta.dataHora, '| imagem:', oferta.imagem ? 'sim' : 'nao');
    if (oferta.status !== 'agendada') { console.log('  -> PULANDO: status=' + oferta.status); continue; }
    const dataEnvio = new Date(oferta.dataHora);
    const diffMin = (agora - dataEnvio) / 1000 / 60;
    console.log('  -> diffMin:', diffMin.toFixed(1), '| agoraUTC:', agora.toISOString(), '| dataEnvioUTC:', dataEnvio.toISOString());
    if (diffMin < 0 || diffMin > 2) { console.log('  -> PULANDO: fora da janela'); continue; }

    let gruposEnviar = GRUPOS_VIP;
    if (oferta.grupos && oferta.grupos !== 'todos') {
      gruposEnviar = oferta.grupos.split(',').filter(Boolean);
    }

    let erros = 0;
    for (const grupo of gruposEnviar) {
      try {
        const isVideo = oferta.imagem && /\.(mp4|mov|avi|webm)(\?|$)/i.test(oferta.imagem);
        const endpoint = oferta.imagem ? (isVideo ? 'send-video' : 'send-image') : 'send-text';
        const caption = oferta.texto + (oferta.link ? '\n\n\uD83D\uDD17 ' + oferta.link : '');
        const body = oferta.imagem
          ? (isVideo
            ? { phone: grupo, video: oferta.imagem, caption }
            : { phone: grupo, image: oferta.imagem, caption })
          : { phone: grupo, message: caption };
        const zapiResult = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'client-token': process.env.ZAPI_CLIENT_TOKEN }, body: JSON.stringify(body)
        });
        const zapiJson = await zapiResult.json().catch(()=>({}));
        // Verificar se Z-API retornou erro na resposta
        const zapiOk = zapiResult.ok && !zapiJson.error && zapiJson.zaapId !== undefined || zapiJson.messageId !== undefined || zapiJson.id !== undefined;
        console.log('Z-API grupo', grupo.substring(0,20), '| status:', zapiResult.status, '| ok:', zapiOk, '| resp:', JSON.stringify(zapiJson).substring(0,120));
        if (!zapiOk) erros++;
        await new Promise(r => setTimeout(r, 1500));
      } catch(e) { erros++; console.log('Z-API erro catch:', e.message); }
    }

    oferta.status = erros === 0 ? 'enviada' : 'erro';
    oferta.enviada_em = new Date().toISOString();
    await fetch(`${KV_URL}/set/${oferta.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(oferta)
    });
    disparadas.push({ id: oferta.id, grupos: gruposEnviar.length, erros });
  }
  return disparadas;
}

async function verificarRastreios(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, ME_TOKEN, SHOPIFY_STORE, SHOPIFY_TOKEN) {
  const pages = await Promise.all([1,2,3,4,5].map(page =>
    fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + page, {
      headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
    }).then(r => r.json()).catch(() => ({ data: [] }))
  ));

  const purchases = pages.flatMap(p => p.data || []);
  let enviados = 0;

  console.log('Total purchases carregadas:', purchases.length);
  let totalReleased = 0, totalComTracking = 0;
  for (const purchase of purchases) {
    for (const order of (purchase.orders || [])) {
      if (order.status === 'released') totalReleased++;
      if (order.status === 'released' && order.tracking) totalComTracking++;
      if (order.status !== 'released' || !order.tracking) continue;

      const tracking = order.tracking;
      const chave = 'rastreio-enviado-' + tracking;

      try {
        const r = await fetch(`${KV_URL}/get/${chave}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d = await r.json();
        if (d.result) continue;
      } catch(e) { continue; }

      const nomeDestinatario = order.to?.name || '';
      const emailDestinatario = order.to?.email || '';
      let telefone = (order.to?.phone || '').replace(/[^0-9]/g, '');

      if (!telefone && emailDestinatario) {
        try {
          const shopResp = await fetch(
            `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(emailDestinatario)}&limit=3&financial_status=paid`,
            { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
          );
          const shopData = await shopResp.json();
          const pedidos = shopData.orders || [];
          const pedido = pedidos[0];
          if (pedido) {
            telefone = ((pedido.shipping_address && pedido.shipping_address.phone) || pedido.phone || (pedido.billing_address && pedido.billing_address.phone) || '').replace(/[^0-9]/g, '');
          }
        } catch(e) {}
      }

      if (!telefone) {
        await fetch(`${KV_URL}/set/${chave}/sem-tel/EX/2592000`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        continue;
      }

      if (!telefone.startsWith('55')) telefone = '55' + telefone;

      const primeiroNome = nomeDestinatario.split(' ')[0] || 'cliente';
      const mensagem = 'Ola ' + primeiroNome + '! \uD83D\uDE0A\n\nSeu pedido da *Kcique Relogios* foi enviado! \u231A\uD83D\uDCE6\n\n\uD83D\uDD0D *Codigo de rastreio:*\n' + tracking + '\n\n\uD83D\uDCE6 *Acompanhe aqui:*\nhttps://www.melhorrastreio.com.br/rastreio/' + tracking + '\n\nQualquer duvida estamos aqui! \uD83D\uDE0A';

      try {
        await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'client-token': ZAPI_CLIENT_TOKEN },
          body: JSON.stringify({ phone: telefone, message: mensagem })
        });
        console.log('WhatsApp enviado para:', telefone, '| Tracking:', tracking);
      } catch(e) { console.error('Erro WhatsApp:', e.message); }

      await fetch(`${KV_URL}/set/${chave}/1/EX/2592000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      enviados++;

      if (SHOPIFY_STORE && SHOPIFY_TOKEN) {
        try {
          let shopPedido = null;
          if (emailDestinatario) {
            const r1 = await fetch(
              `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(emailDestinatario)}&limit=10&financial_status=paid&status=any`,
              { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
            );
            const d1 = await r1.json().catch(()=>({}));
            const pp = d1.orders || [];
            shopPedido = pp.find(p => !p.fulfillment_status || p.fulfillment_status === 'unfulfilled');
            if (!shopPedido) shopPedido = pp.find(p => p.fulfillment_status === 'partial');
            if (!shopPedido) shopPedido = pp[0];
            if (shopPedido) console.log('Shopify encontrou por email:', emailDestinatario, '| pedido:', shopPedido.order_number, '| fulfillment:', shopPedido.fulfillment_status);
          }

          if (!shopPedido) {
            console.log('Pedido nao encontrado no Shopify | email:', emailDestinatario, '| tracking:', tracking);
          } else {
            const jaTemTracking = (shopPedido.fulfillments||[]).some(f => (f.tracking_numbers||[]).includes(tracking));
            if (jaTemTracking) {
              console.log('Tracking ja existe no Shopify:', tracking);
            } else {
              const foResp = await fetch(
                `https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${shopPedido.id}/fulfillment_orders.json`,
                { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
              );
              const foData = await foResp.json().catch(()=>({}));
              const fo = (foData.fulfillment_orders || []).find(f => f.status === 'open');
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
                          url: 'https://www.melhorrastreio.com.br/rastreio/' + tracking,
                          company: 'Correios'
                        },
                        notify_customer: false
                      }
                    })
                  }
                );
                const fulfillData = await fulfillResp.json().catch(()=>({}));
                if (fulfillData.fulfillment) {
                  console.log('Fulfillment criado no Shopify:', shopPedido.order_number, '|', tracking);
                } else {
                  console.log('Erro fulfillment Shopify:', JSON.stringify(fulfillData).substring(0,200));
                }
              } else {
                console.log('Sem fulfillment_order aberto para pedido:', shopPedido.order_number);
              }
            }
          }
        } catch(e) { console.error('Erro fulfillment Shopify:', e.message); }
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('Rastreios verificados. Released:', totalReleased, '| Com tracking:', totalComTracking, '| Enviados:', enviados);
}

async function salvarSnapshotGrupos(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN) {
  try {
    const GRUPOS_VIP_SNAP = [
      {nome:'#1',id:'120363407575718083-group'},{nome:'#2',id:'120363407700341013-group'},
      {nome:'#3',id:'120363407514192649-group'},{nome:'#4',id:'120363406939167357-group'},
      {nome:'#5',id:'120363425311709688-group'},{nome:'#6',id:'120363407634566182-group'},
      {nome:'#7',id:'120363426601689014-group'},{nome:'#8',id:'120363407550597963-group'},
      {nome:'#9',id:'120363424221379294-group'},{nome:'#10',id:'120363425206908330-group'},
      {nome:'#11',id:'120363409632620470-group'},{nome:'#12',id:'120363426115032457-group'},
      {nome:'#13',id:'120363426651817338-group'},{nome:'#14',id:'120363406708968616-group'},
      {nome:'#15',id:'120363425674177408-group'},{nome:'#16',id:'120363428180805162-group'},
      {nome:'#17',id:'120363406426269657-group'},
    ];
    const membros = await Promise.all(GRUPOS_VIP_SNAP.map(async g => {
      try {
        const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-metadata/${g.id}`, { headers: { 'client-token': ZAPI_CLIENT_TOKEN } });
        const d = await r.json();
        return { nome: g.nome, membros: d.participants ? d.participants.length : 0 };
      } catch(e) { return { nome: g.nome, membros: 0 }; }
    }));
    const total = membros.reduce((s, g) => s + g.membros, 0);
    const hoje = new Date();
    const hojeBR = new Date(hoje.getTime() - 3 * 60 * 60 * 1000);
    const hojeStr = hojeBR.toISOString().split('T')[0];
    const chave = `vip-snapshot-${hojeStr}`;
    await fetch(`${KV_URL}/set/${chave}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ total, grupos: membros, ts: new Date().toISOString() })
    });
    await fetch(`${KV_URL}/expire/${chave}/5184000`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    console.log('Snapshot grupos VIP salvo:', hojeStr, '| Total:', total);
  } catch(e) { console.error('Erro snapshot grupos:', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { secret, action } = req.query;
  if (secret !== process.env.REPROCESSAR_SECRET) {
    if (action !== 'dashboard') return res.status(401).json({ error: 'Unauthorized' });
    return res.status(401).send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h2>Acesso Restrito</h2><form onsubmit="window.location.href='/api/ofertas?action=dashboard&secret='+document.getElementById('s').value;return false" style="margin-top:20px"><input id="s" type="password" placeholder="Senha" style="padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px"><button type="submit" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;margin-left:8px;font-size:15px;cursor:pointer">Entrar</button></form></div></body></html>`);
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

  if (action === 'reset-rastreios') {
    try {
      const lista = await fetch(`${KV_URL}/keys/rastreio-enviado-*`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r=>r.json()).catch(()=>({result:[]}));
      const keys = lista.result || [];
      let deletados = 0;
      for (const key of keys) {
        await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        deletados++;
      }
      return res.status(200).json({ success: true, deletados });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'debug-fulfillment') {
    try {
      const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
      const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
      const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
      const tracking = req.query.tracking;
      if (!tracking) return res.status(400).json({ error: 'tracking required' });
      const pages = await Promise.all([1,2,3].map(p =>
        fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${p}`, {
          headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
        }).then(r=>r.json()).catch(()=>({data:[]}))
      ));
      const allOrders = pages.flatMap(p => (p.data||[]).flatMap(pu => pu.orders||[]));
      const order = allOrders.find(o => o.tracking === tracking);
      if (!order) return res.status(404).json({ error: 'tracking nao encontrado no ME', tracking });
      const email = order.to && order.to.email;
      const nome = order.to && order.to.name;
      const tel = order.to && order.to.phone;
      let shopResult = null;
      if (email) {
        const r = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(email)}&limit=10&financial_status=paid&status=any`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        );
        const d = await r.json().catch(()=>({}));
        shopResult = (d.orders||[]).map(p => ({ id: p.id, order_number: p.order_number, email: p.email, fulfillment_status: p.fulfillment_status, created_at: p.created_at }));
      }
      return res.status(200).json({ tracking, me_email: email, me_nome: nome, me_tel: tel, shopify_pedidos: shopResult });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'sync-fulfillments') {
    try {
      const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
      const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
      const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
      const pages = await Promise.all([1,2,3,4,5].map(page =>
        fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + page, {
          headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
        }).then(r => r.json()).catch(() => ({ data: [] }))
      ));
      const purchases = pages.flatMap(p => p.data || []);
      let criados = 0, erros = 0, semPedido = 0;
      for (const purchase of purchases) {
        for (const order of (purchase.orders || [])) {
          if (order.status !== 'released' || !order.tracking) continue;
          const email = order.to?.email || '';
          if (!email) { semPedido++; continue; }
          try {
            const telOrder = ((order.to && order.to.phone) || '').replace(/[^0-9]/g, '').replace(/^55/, '');
            let pedido = null;
            if (telOrder) {
              const r1 = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?phone=%2B55${telOrder}&limit=5&financial_status=paid&status=any`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
              const d1 = await r1.json().catch(()=>({}));
              const pp1 = d1.orders || [];
              pedido = pp1.find(p => !(p.fulfillments||[]).some(f => (f.tracking_numbers||[]).includes(order.tracking)));
              if (!pedido) pedido = pp1[0];
            }
            if (!pedido && email) {
              const r2 = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(email)}&limit=5&financial_status=paid&status=any`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
              const d2 = await r2.json().catch(()=>({}));
              const pp2 = d2.orders || [];
              pedido = pp2.find(p => !(p.fulfillments||[]).some(f => (f.tracking_numbers||[]).includes(order.tracking)));
              if (!pedido) pedido = pp2[0];
            }
            if (!pedido || !pedido.id) { semPedido++; continue; }
            const jaTemTracking = (pedido.fulfillments||[]).some(f => (f.tracking_numbers||[]).includes(order.tracking));
            if (jaTemTracking) { semPedido++; continue; }
            const foResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${pedido.id}/fulfillment_orders.json`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
            const foData = await foResp.json().catch(()=>({}));
            const fo = (foData.fulfillment_orders || []).find(f => f.status === 'open');
            if (!fo) { semPedido++; continue; }
            const fulfillResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/fulfillments.json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
              body: JSON.stringify({ fulfillment: { line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }], tracking_info: { number: order.tracking, url: 'https://www.melhorrastreio.com.br/rastreio/' + order.tracking, company: 'Correios' }, notify_customer: false } })
            });
            const fulfillData = await fulfillResp.json().catch(()=>({}));
            if (fulfillData.fulfillment) { criados++; } else { erros++; }
          } catch(e) { erros++; }
          await new Promise(r => setTimeout(r, 300));
        }
      }
      return res.status(200).json({ success: true, criados, erros, semPedido });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'verificar') {
    try {
      const disparadas = await verificarEDisparar(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN);
      try {
        await verificarRastreios(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN, process.env.ZAPI_CLIENT_TOKEN, process.env.MELHORENVIO_TOKEN, process.env.SHOPIFY_STORE, process.env.SHOPIFY_TOKEN);
      } catch(e) { console.error('Erro rastreios:', e.message); }
      try {
        // Salvar snapshot uma vez por dia — verifica se já existe hoje
        const agora = new Date();
        const agoraBR = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
        const hojeStr = agoraBR.toISOString().split('T')[0];
        const snapCheck = await fetch(`${KV_URL}/get/vip-snapshot-${hojeStr}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r => r.json()).catch(() => ({}));
        if (!snapCheck.result) {
          await salvarSnapshotGrupos(KV_URL, KV_TOKEN, ZAPI_INSTANCE, ZAPI_TOKEN, process.env.ZAPI_CLIENT_TOKEN);
        }
      } catch(e) { console.error('Erro snapshot:', e.message); }
      return res.status(200).json({ success: true, disparadas, total: disparadas.length });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  // Endpoint JSON para dashboard SPA
  if (action === 'listar-json') {
    try {
      const ofertas = await listarOfertas(KV_URL, KV_TOKEN);
      return res.status(200).json({ ok: true, ofertas });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (action === 'salvar' && req.method === 'POST') {
    try {
      const id = await salvarOferta(KV_URL, KV_TOKEN, req.body);
      const oferta = { id, ...req.body, status: 'agendada', criado_em: new Date().toISOString() };
      return res.status(200).json({ success: true, id, oferta });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.query.del) {
    await fetch(`${KV_URL}/del/${req.query.del}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/ofertas-lista/0/${req.query.del}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/ofertas?action=dashboard&secret=${secret}"></head><body>Redirecionando...</body></html>`);
  }

  // Limpar ofertas enviadas em batch
  if (req.query.action === 'limpar_enviadas') {
    try {
      // Buscar TODOS os IDs da lista (sem limite)
      const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const listaData = await listaResp.json();
      const todosIds = listaData.result || [];

      // Buscar cada oferta e separar agendadas das enviadas
      const agendadasIds = [];
      let deletadas = 0;

      for (const id of todosIds) {
        try {
          const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
          const d = await r.json();
          if (!d.result) { deletadas++; continue; } // chave orphan - remover
          let oferta = d.result;
          while (typeof oferta === 'string') { try { oferta = JSON.parse(oferta); } catch(e) { break; } }
          if (oferta && oferta.status === 'agendada') {
            agendadasIds.push(id);
          } else {
            // Deletar chave da oferta enviada/erro
            await fetch(`${KV_URL}/del/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
            deletadas++;
          }
        } catch(e) { deletadas++; }
      }

      // Reescrever a lista só com as agendadas
      await fetch(`${KV_URL}/del/ofertas-lista`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      for (const id of agendadasIds) {
        await fetch(`${KV_URL}/rpush/ofertas-lista/${id}`, {
          method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([id])
        });
      }

      return res.status(200).json({ ok: true, deletadas, agendadasMantidas: agendadasIds.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Action invalida. Use ?action=dashboard, ?action=salvar ou ?action=verificar' });
}
