async function buscarLinkConviteZapi(groupId, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN) {
  try {
    const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-invitation-link/${groupId}`, {
      headers: { 'client-token': ZAPI_CLIENT_TOKEN }
    });
    const d = await r.json();
    const link = d.invitationLink || d.link || d.url || d.inviteLink || null;
    return (link && link.startsWith('http')) ? link : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const { secret } = req.query;

  // ===== ACTION: BUNDLE COMPLETO - retorna produtos prontos para exibir (público) =====
  if (req.query.action === 'bundle-lista') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const _shopifyStore = process.env.SHOPIFY_STORE;
      const _shopifyToken = process.env.SHOPIFY_TOKEN;

      // Buscar config do bundle
      const configResp = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const configData = await configResp.json();
      let config = configData.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config || !config.produtoIds || config.produtoIds.length === 0) {
        return res.status(200).json({ produtos: [], desconto: 50 });
      }

      // Buscar detalhes dos produtos selecionados no Shopify
      const produtos = await Promise.all(config.produtoIds.map(async id => {
        try {
          const r = await fetch(`https://${_shopifyStore}/admin/api/2026-04/products/${id}.json`, {
            headers: { 'X-Shopify-Access-Token': _shopifyToken }
          });
          const d = await r.json();
          const p = d.product;
          if (!p) return null;
          return {
            id: String(p.id),
            nome: p.title,
            preco: p.variants && p.variants[0] ? Math.round(parseFloat(p.variants[0].price) * 100) : 0,
            imagem: p.image ? p.image.src : '',
            variantes: (p.variants || []).filter(v => v.inventory_quantity > 0 || v.inventory_policy === 'continue').map(v => ({
              titulo: v.title,
              preco: Math.round(parseFloat(v.price) * 100),
              imagem: v.featured_image ? v.featured_image.src : (p.image ? p.image.src : ''),
              disponivel: v.available !== false
            }))
          };
        } catch(e) { return null; }
      }));

      return res.status(200).json({
        produtos: produtos.filter(Boolean),
        desconto: config.desconto || 50
      });
    } catch(e) {
      return res.status(200).json({ produtos: [], desconto: 50 });
    }
  }

  // ===== ACTION: BUNDLE - LISTA COMPLETA PARA PÁGINA DO PRODUTO (público) =====
  if (req.query.action === 'bundle-lista') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const _shopStore = process.env.SHOPIFY_STORE;
      const _shopToken = process.env.SHOPIFY_TOKEN;

      // Buscar config do bundle
      const r = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const d = await r.json();
      let config = d.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config || !config.produtoIds || config.produtoIds.length === 0) {
        return res.status(200).json({ produtos: [], desconto: 50 });
      }

      // Buscar detalhes dos produtos selecionados no Shopify
      const produtosDetalhes = await Promise.all(config.produtoIds.map(async id => {
        try {
          const r2 = await fetch(`https://${_shopStore}/admin/api/2026-04/products/${id}.json`, {
            headers: { 'X-Shopify-Access-Token': _shopToken }
          });
          const d2 = await r2.json();
          const p = d2.product;
          if (!p) return null;
          return {
            id: String(p.id),
            nome: p.title,
            preco: p.variants && p.variants[0] ? Math.round(parseFloat(p.variants[0].price) * 100) : 0,
            imagem: p.image ? p.image.src : '',
            variantes: (p.variants || []).map(v => ({
              titulo: v.title,
              preco: Math.round(parseFloat(v.price) * 100),
              imagem: v.featured_image ? v.featured_image.src : (p.image ? p.image.src : ''),
              disponivel: v.available !== false
            }))
          };
        } catch(e) { return null; }
      }));

      return res.status(200).json({
        produtos: produtosDetalhes.filter(Boolean),
        desconto: config.desconto || 50
      });
    } catch(e) {
      return res.status(200).json({ produtos: [], desconto: 50 });
    }
  }

  // ===== ACTION: BUNDLE - LISTAR PRODUTOS SELECIONADOS (público, com CORS) =====
  if (req.query.action === 'bundle-produtos') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const r = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const d = await r.json();
      let config = d.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config) config = { produtoIds: [], desconto: 50 };
      return res.status(200).json(config);
    } catch(e) {
      return res.status(200).json({ produtoIds: [], desconto: 50 });
    }
  }

  // ===== ACTION: GRUPO VIP ATIVO (público, sem secret) =====
  if (req.query.action === 'grupo-vip-ativo') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
    const GRUPOS_LINKS = [
      {nome:'#1',id:'120363407575718083-group',link:'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1'},
      {nome:'#2',id:'120363407700341013-group',link:'https://chat.whatsapp.com/GtwnsNKOBhBFphx80IbGRi'},
      {nome:'#3',id:'120363407514192649-group',link:'https://chat.whatsapp.com/Gp0z5rooPJn4xJ9vMuu5mq'},
      {nome:'#4',id:'120363406939167357-group',link:'https://chat.whatsapp.com/CwNI8EJ4YYE3l87dnkPsfF'},
      {nome:'#5',id:'120363425311709688-group',link:'https://chat.whatsapp.com/Gdm2fldetx4CgQTlXIU4Hr'},
      {nome:'#6',id:'120363407634566182-group',link:'https://chat.whatsapp.com/FqcXp5lj5Iv6fln8aOls41'},
      {nome:'#7',id:'120363426601689014-group',link:'https://chat.whatsapp.com/IsQ8zsma0e83xULh9GoSf2'},
      {nome:'#8',id:'120363407550597963-group',link:'https://chat.whatsapp.com/DfaAcQXJdBqH8NiEJoRxmH'},
      {nome:'#9',id:'120363424221379294-group',link:'https://chat.whatsapp.com/H86IAANo3wC5vJLpGLruN5'},
      {nome:'#10',id:'120363425206908330-group',link:'https://chat.whatsapp.com/EKL8Pi3nSDFEnfFysWd6vV'},
      {nome:'#11',id:'120363409632620470-group',link:'https://chat.whatsapp.com/LUekubqMZ1fFBzNc6nr1eh'},
      {nome:'#12',id:'120363426115032457-group',link:'https://chat.whatsapp.com/DiCkqI5M1rc9fD4Uo0Uhpb'},
      {nome:'#13',id:'120363426651817338-group',link:'https://chat.whatsapp.com/JcmJFfNeCTxFCqhNaTK3UL?s=cl&p=a&ilr=1'},
      {nome:'#14',id:'120363406708968616-group',link:'https://chat.whatsapp.com/EZqlQfswqOvCSJgWmP8TpZ'},
      {nome:'#15',id:'120363425674177408-group',link:'https://chat.whatsapp.com/KWGkIwonwYVClO5y44DJPh?s=cl&p=a&ilr=1'},
      {nome:'#16',id:'120363428180805162-group',link:'https://chat.whatsapp.com/EsAXwsLfNQ4BIKHWF20Gxh?s=cl&p=a&ilr=1'},
      {nome:'#17',id:'120363406426269657-group',link:'https://chat.whatsapp.com/Ln7miz76B0BH8EjvaN57YC'},
    ];
    // Busca o link de convite na hora via Z-API; se falhar, usa o link fixo salvo como respaldo
    const resolverLink = async (nome, linkFixo) => {
      const info = GRUPOS_LINKS.find(x => x.nome === nome);
      if (!info) return linkFixo || GRUPOS_LINKS[0].link;
      if (ZAPI_INSTANCE && ZAPI_TOKEN) {
        const link = await buscarLinkConviteZapi(info.id, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN);
        if (link) return link;
      }
      return info.link;
    };
    try {
      const LIMITE = 1000;

      // PRIORIDADE 1: verificar grupo definido manualmente no dashboard
      const manualResp = await fetch(`${KV_URL}/get/grupo-ativo-manual`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const manualData = await manualResp.json();
      let manual = manualData.result;
      while (typeof manual === 'string') { try { manual = JSON.parse(manual); } catch(e) { break; } }
      if (manual && manual.link) {
        return res.status(200).json({ grupo: manual.nome, link: manual.link, membros: 0, vagas: 1000, fonte: 'manual' });
      }

      // PRIORIDADE 2: snapshot automático dos últimos 3 dias
      const hoje = new Date();
      const hojeBR = new Date(hoje.getTime() - 3*60*60*1000);

      // Tentar snapshot dos últimos 3 dias
      let grupos = null;
      for (let i = 0; i <= 2; i++) {
        const d = new Date(hojeBR); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const r = await fetch(`${KV_URL}/get/vip-snapshot-${ds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const j = await r.json();
        let snap = j.result;
        while (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch(e) { break; } }
        if (snap && snap.grupos && Array.isArray(snap.grupos)) { grupos = snap.grupos; break; }
        // Compatibilidade: snapshot pode ser array direto
        if (snap && Array.isArray(snap)) { grupos = snap; break; }
      }

      if (!grupos) throw new Error('sem snapshot');

      // Encontrar o PRIMEIRO grupo em ordem que ainda tem vagas
      let ativo = grupos[grupos.length - 1];
      for (const g of grupos) {
        if (g.membros < LIMITE) { ativo = g; break; }
      }
      const link = await resolverLink(ativo.nome);
      return res.status(200).json({ grupo: ativo.nome, link, membros: ativo.membros, vagas: LIMITE - ativo.membros, fonte: 'snapshot' });
    } catch(e) {
      // Sem snapshot — buscar ao vivo no Z-API
      try {
        const membrosArr = await Promise.all(GRUPOS_LINKS.map(async g => {
          try {
            const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-metadata/${g.id}`, { headers: { 'client-token': ZAPI_CLIENT_TOKEN } });
            const d = await r.json();
            return { nome: g.nome, membros: d.participants ? d.participants.length : 0 };
          } catch(e) { return { nome: g.nome, membros: 0 }; }
        }));
        let ativo = null; let menorMembros = Infinity;
        for (const g of membrosArr) {
          if (g.membros < 1000 && g.membros < menorMembros) { menorMembros = g.membros; ativo = g; }
        }
        if (!ativo) ativo = membrosArr[membrosArr.length - 1];
        const link = await resolverLink(ativo.nome);
        return res.status(200).json({ grupo: ativo.nome, link, membros: ativo.membros, vagas: 1000 - ativo.membros, fonte: 'live' });
      } catch(e2) {
        return res.status(200).json({ grupo: '#1', link: GRUPOS_LINKS[0].link, membros: 0, vagas: 1000, fonte: 'fallback' });
      }
    }
  }

  if (secret !== process.env.REPROCESSAR_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kcique Admin</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0f0f0f;display:flex;align-items:center;justify-content:center;height:100vh;color:#fff}
.login{text-align:center;background:#1a1a1a;padding:40px;border-radius:16px;border:1px solid #333;width:320px}
h1{font-size:24px;margin-bottom:8px}p{color:#888;font-size:13px;margin-bottom:24px}
input{width:100%;padding:12px 16px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:15px;outline:none;margin-bottom:12px}
input:focus{border-color:#25d366}button{width:100%;padding:12px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body><div class="login"><h1>⌚ Kcique Admin</h1><p>Painel de controle da loja</p>
<form onsubmit="window.location.href='/api/admin?secret='+document.getElementById('s').value;return false">
<input id="s" type="password" placeholder="Senha de acesso"><button type="submit">Entrar</button></form></div></body></html>`);
  }

  // CORS global
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // ── PEDIDOS UNFULFILLED ─────────────────────────────────────
  if (req.query.action === 'pedidos-unfulfilled') {
    try {
      let all = [];
      for (let page = 1; page <= 5; page++) {
        const r = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=open&fulfillment_status=unfulfilled&financial_status=paid&limit=250&page=${page}`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        ).then(r => r.json()).catch(() => ({ orders: [] }));
        const orders = r.orders || [];
        all = all.concat(orders.map(o => ({ id: o.id, number: o.order_number, email: o.email, name: o.shipping_address?.name || o.email })));
        if (orders.length < 250) break;
      }
      return res.status(200).json({ pedidos: all, total: all.length });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── FULFILLMENT EM MASSA ─────────────────────────────────────
  if (req.query.action === 'fulfillment-massa' && req.method === 'POST') {
    const ids = req.body?.pedidos || [];
    let atualizados = 0, erros = 0;
    for (const orderId of ids) {
      try {
        // Buscar fulfillment_orders do pedido
        const foResp = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${orderId}/fulfillment_orders.json`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        ).then(r => r.json()).catch(() => ({}));
        const fo = (foResp.fulfillment_orders || []).find(f => f.status === 'open');
        if (!fo) continue;
        const fulfillResp = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/fulfillments.json`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
            body: JSON.stringify({
              fulfillment: {
                line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
                notify_customer: false
              }
            })
          }
        ).then(r => r.json()).catch(() => ({}));
        if (fulfillResp.fulfillment?.id) atualizados++;
        else erros++;
        // Pequena pausa para não sobrecarregar a API do Shopify
        await new Promise(r => setTimeout(r, 200));
      } catch(e) { erros++; }
    }
    return res.status(200).json({ ok: true, atualizados, erros });
  }

  // ── RECUPERAÇÃO CONFIG (precisa de KV_URL) ───────────────────
  if (req.query.action === 'recuperacao-config') {
    try {
      const r = await fetch(`${KV_URL}/get/recuperacao-config`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      let config = d.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (config && typeof config === 'object' && config.value) {
        try { config = JSON.parse(config.value); } catch(e) {}
      }
      return res.status(200).json({ ok: true, config: config || {} });
    } catch(e) { return res.status(200).json({ ok: true, config: {} }); }
  }

  if (req.query.action === 'recuperacao-config-salvar' && req.method === 'POST') {
    try {
      await fetch(`${KV_URL}/set/recuperacao-config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(req.body || {}) })
      });
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  }
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

  // ===== JSON: DASHBOARD HOME =====
  if (req.query.action === 'dashboard-home') {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Cache Redis por 10 minutos
    const cacheKey = 'cache-dashboard-home';
    if (!req.query.refresh) {
      try {
        const cacheResp = await fetch(`${KV_URL}/get/${cacheKey}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const cacheData = await cacheResp.json();
        if (cacheData.result) {
          let cached = cacheData.result;
          while (typeof cached === 'string') { try { cached = JSON.parse(cached); } catch(e) { break; } }
          if (cached && cached.vendas) {
            return res.status(200).json({ ...cached, fromCache: true });
          }
        }
      } catch(e) {}
    }

    const hoje = new Date();
    const hojeBR = new Date(hoje.getTime() - 3 * 60 * 60 * 1000);
    const hojeStr = hojeBR.toISOString().split('T')[0];
    const inicioDia = hojeStr + 'T00:00:00-03:00';
    const fimDia = hojeStr + 'T23:59:59-03:00';
    const inicioMes = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0') + '-01T00:00:00-03:00';
    const mesAnt = new Date(hoje); mesAnt.setMonth(hoje.getMonth()-1);
    const inicioMesAnt = mesAnt.getFullYear() + '-' + String(mesAnt.getMonth()+1).padStart(2,'0') + '-01T00:00:00-03:00';
    const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0] + 'T00:00:00-03:00';
    const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const inicioSemanaStr = inicioSemana.toISOString().split('T')[0] + 'T00:00:00-03:00';

    const [oH, oS, oM, oMA, saldoME, prodShopify, leadsR, pedPendentes] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioDia}&created_at_max=${fimDia}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioSemanaStr}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioMes}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioMesAnt}&created_at_max=${fimMesAnt}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch('https://melhorenvio.com.br/api/v2/me/balance', { headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(r=>r.json()).catch(()=>({})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=100`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({products:[]})),
      fetch(`https://infinitepay-backend.vercel.app/api/leads?secret=${secret}`).then(r=>r.json()).catch(()=>({leads:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=open&fulfillment_status=unfulfilled&financial_status=paid&limit=250&created_at_min=${hojeStr}T00:00:00-03:00`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    ]);

    const calc = (orders) => ({ count: (orders||[]).length, valor: (orders||[]).reduce((s,o) => s + parseFloat(o.total_price||0), 0) });
    const vM = calc(oM.orders);

    // Top produtos
    const prodContagem = {};
    (oM.orders||[]).forEach(order => {
      (order.line_items||[]).forEach(item => {
        if (!prodContagem[item.title]) prodContagem[item.title] = { count: 0, valor: 0 };
        prodContagem[item.title].count += item.quantity;
        prodContagem[item.title].valor += parseFloat(item.price) * item.quantity;
      });
    });
    const prods = prodShopify.products || [];

    // Mapa variant_id -> imagem exata
    const varImgMap = {};
    prods.forEach(p => {
      (p.variants||[]).forEach(v => {
        if (v.featured_image?.src) varImgMap[String(v.id)] = v.featured_image.src;
        else if (v.image_id) {
          const img = (p.images||[]).find(i => i.id === v.image_id);
          if (img) varImgMap[String(v.id)] = img.src;
        }
        if (!varImgMap[String(v.id)] && p.image) varImgMap[String(v.id)] = p.image.src;
      });
    });

    const getImg = (nome) => {
      if (!nome) return '';
      const base = nome.split(' - Cor:')[0].trim(); // preserva variante do produto
      const baseNorm2 = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/  +/g,' ').trim();
      const bn = baseNorm2(base);
      let best = null, bestPts = 0;
      for (const p of prods) {
        const pt = baseNorm2(p.title);
        let pts = 0;
        if (pt === bn) pts = 200;
        else if (pt.includes(bn) || bn.includes(pt)) pts = 50;
        if (pts > bestPts) { bestPts = pts; best = p; }
      }
      return (best && bestPts >= 20) ? (best.image?.src || '') : '';
    };
    const topProdutos = Object.entries(prodContagem)
      .filter(([n]) => !n.toLowerCase().includes('frete') && n.length > 5)
      .map(([nome, d]) => ({ nome, ...d, imagem: getImg(nome) }))
      .sort((a,b) => b.valor - a.valor).slice(0, 5);

    // Método de pagamento (do mês)
    const pagamentos = {};
    (oM.orders||[]).forEach(order => {
      const nota = order.note || '';
      const metodo = nota.match(/Método: ([^|]+)/)?.[1]?.trim() || 'outro';
      const label = metodo === 'pix' ? 'PIX' : metodo === 'credit_card' ? 'Cartão' : metodo === 'debit_card' ? 'Débito' : 'Outro';
      if (!pagamentos[label]) pagamentos[label] = { count: 0, valor: 0 };
      pagamentos[label].count++;
      pagamentos[label].valor += parseFloat(order.total_price || 0);
    });
    const pagamentosArr = Object.entries(pagamentos)
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a,b) => b.valor - a.valor);

    // Comparativo mês anterior %
    const crescimento = vM.valor > 0 && calc(oMA.orders).valor > 0
      ? ((vM.valor - calc(oMA.orders).valor) / calc(oMA.orders).valor * 100).toFixed(1)
      : null;

    // Últimos 5 pedidos
    const ultimosPedidos = (oM.orders||[]).slice(0,5).map(o => ({
      numero: o.order_number,
      cliente: o.customer ? (o.customer.first_name||'') + ' ' + (o.customer.last_name||'') : 'Cliente',
      valor: parseFloat(o.total_price||0),
      metodo: (o.note||'').match(/Método: ([^|]+)/)?.[1]?.trim() || '',
      criado_em: o.created_at,
    }));

    const result = {
      vendas: {
        hoje: calc(oH.orders), semana: calc(oS.orders), mes: vM, mesAnt: calc(oMA.orders),
        pendentes: (pedPendentes.orders||[]).length,
        ticketMedio: vM.count > 0 ? vM.valor / vM.count : 0,
        crescimento,
      },
      melhorEnvio: { saldo: parseFloat(saldoME.balance || 0) },
      leads: { total: (leadsR.leads||[]).length },
      topProdutos,
      pagamentos: pagamentosArr,
      ultimosPedidos,
    };

    // Salvar no cache por 10 minutos
    fetch(`${KV_URL}/set/${cacheKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(result), ex: 600 })
    }).catch(()=>{});

    return res.status(200).json(result);
  }

  // ===== JSON: RELATÓRIOS (filtro de data) =====
  if (req.query.action === 'relatorios-json') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const dataInicio = req.query.dataInicio || new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dataFim = req.query.dataFim || dataInicio;
      const inicioISO = dataInicio + 'T00:00:00-03:00';
      const fimISO = dataFim + 'T23:59:59-03:00';

      // Pedidos pagos no período (com paginação)
      let orders = [];
      { let pageInfo = null, pages = 0;
        while (pages < 20) {
          const url = pageInfo
            ? `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?limit=250&page_info=${pageInfo}`
            : `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&financial_status=paid&limit=250&created_at_min=${inicioISO}&created_at_max=${fimISO}`;
          const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
          const d = await r.json().catch(() => ({ orders: [] }));
          orders = orders.concat(d.orders || []);
          const link = r.headers.get('link') || '';
          const m = link.match(/<[^>]*page_info=([^&>]*)[^>]*>;\s*rel="next"/);
          pageInfo = m ? m[1] : null;
          pages++;
          if (!pageInfo) break;
        }
      }

      // Clientes novos no período
      let customers = [];
      { let pageInfo = null, pages = 0;
        while (pages < 10) {
          const url = pageInfo
            ? `https://${SHOPIFY_STORE}/admin/api/2026-04/customers.json?limit=250&page_info=${pageInfo}`
            : `https://${SHOPIFY_STORE}/admin/api/2026-04/customers.json?limit=250&created_at_min=${inicioISO}&created_at_max=${fimISO}`;
          const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
          const d = await r.json().catch(() => ({ customers: [] }));
          customers = customers.concat(d.customers || []);
          const link = r.headers.get('link') || '';
          const m = link.match(/<[^>]*page_info=([^&>]*)[^>]*>;\s*rel="next"/);
          pageInfo = m ? m[1] : null;
          pages++;
          if (!pageInfo) break;
        }
      }

      const totalVendas = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
      const totalPedidos = orders.length;
      const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
      const totalFrete = orders.reduce((s, o) => s + parseFloat(o.total_shipping_price_set?.shop_money?.amount || 0), 0);
      const ticketMedioFrete = totalPedidos > 0 ? totalFrete / totalPedidos : 0;

      // Relógios vendidos + produtos mais vendidos (ignora linha de frete)
      let relogiosVendidos = 0;
      const prodContagem = {};
      orders.forEach(o => {
        (o.line_items || []).forEach(item => {
          if ((item.title || '').toLowerCase().startsWith('frete')) return;
          relogiosVendidos += item.quantity || 0;
          if (!prodContagem[item.title]) prodContagem[item.title] = { count: 0, valor: 0 };
          prodContagem[item.title].count += item.quantity || 0;
          prodContagem[item.title].valor += parseFloat(item.price || 0) * (item.quantity || 0);
        });
      });
      const produtosMaisVendidos = Object.entries(prodContagem)
        .map(([nome, d]) => ({ nome, ...d }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // Forma de pagamento
      const pagamentos = {};
      orders.forEach(o => {
        const nota = o.note || '';
        const metodo = nota.match(/Método: ([^|]+)/)?.[1]?.trim() || 'outro';
        const label = metodo === 'pix' ? 'PIX' : metodo === 'credit_card' ? 'Cartão' : metodo === 'debit_card' ? 'Débito' : 'Outro';
        if (!pagamentos[label]) pagamentos[label] = { count: 0, valor: 0 };
        pagamentos[label].count++;
        pagamentos[label].valor += parseFloat(o.total_price || 0);
      });
      const pagamentosArr = Object.entries(pagamentos).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor);

      // Origem: venda manual (WhatsApp) vs site/checkout
      const origens = { 'WhatsApp': { count: 0, valor: 0 }, 'Site': { count: 0, valor: 0 } };
      orders.forEach(o => {
        const isWhats = (o.tags || '').includes('WhatsApp') || (o.note || '').includes('Origem: whatsapp-manual');
        const key = isWhats ? 'WhatsApp' : 'Site';
        origens[key].count++;
        origens[key].valor += parseFloat(o.total_price || 0);
      });

      // Leads no grupo VIP: soma das entradas diárias (snapshot a snapshot) no período
      let leadsGrupo = 0;
      let leadsGrupoIndisponivel = false;
      const diasRange = [];
      {
        const dIni = new Date(dataInicio + 'T12:00:00-03:00');
        const dFim = new Date(dataFim + 'T12:00:00-03:00');
        for (let d = new Date(dIni); d <= dFim; d.setDate(d.getDate() + 1)) diasRange.push(d.toISOString().split('T')[0]);
      }
      if (diasRange.length > 62) {
        leadsGrupoIndisponivel = true;
      } else {
        const snapCache = {};
        const getSnap = async (ds) => {
          if (snapCache[ds] !== undefined) return snapCache[ds];
          const r = await fetch(`${KV_URL}/get/vip-snapshot-${ds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
          const j = await r.json();
          let snap = j.result;
          while (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { break; } }
          snapCache[ds] = (snap && Array.isArray(snap.grupos)) ? snap : null;
          return snapCache[ds];
        };
        for (const ds of diasRange) {
          const ant = new Date(ds + 'T12:00:00-03:00'); ant.setDate(ant.getDate() - 1);
          const dsAnt = ant.toISOString().split('T')[0];
          const [snapHoje, snapOntem] = await Promise.all([getSnap(ds), getSnap(dsAnt)]);
          if (!snapHoje || !snapOntem) continue;
          snapHoje.grupos.forEach(g => {
            if (g.falhou || g.membros <= 0) return;
            const a = snapOntem.grupos.find(x => x.nome === g.nome);
            if (!a || a.falhou || a.membros <= 0) return;
            const diff = g.membros - a.membros;
            if (diff > 0 && diff <= 1000) leadsGrupo += diff;
          });
        }
      }

      return res.status(200).json({
        periodo: { dataInicio, dataFim },
        vendas: totalVendas,
        pedidos: totalPedidos,
        relogiosVendidos,
        clientesNovos: customers.length,
        leadsGrupo: leadsGrupoIndisponivel ? null : leadsGrupo,
        ticketMedio,
        ticketMedioFrete,
        pagamentos: pagamentosArr,
        origens: Object.entries(origens).map(([nome, d]) => ({ nome, ...d })),
        produtosMaisVendidos,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== JSON: PEDIDOS =====
  if (req.query.action === 'pedidos-json') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const cachePedidos = 'cache-pedidos-json';
    try {
      const cr = await fetch(`${KV_URL}/get/${cachePedidos}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const cd = await cr.json();
      if (cd.result) {
        let cached = cd.result;
        while (typeof cached === 'string') { try { cached = JSON.parse(cached); } catch(e) { break; } }
        if (cached && cached.pedidos) return res.status(200).json({ ...cached, fromCache: true });
      }
    } catch(e) {}
    const [pedidosR, prodShopify] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=50&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      // Buscar todos os produtos com paginação
      (async () => {
        let all = [], pageInfo = null, pages = 0;
        while (pages < 10) {
          const url = pageInfo
            ? `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants&page_info=${pageInfo}`
            : `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants`;
          const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
          const d = await r.json().catch(()=>({products:[]}));
          all = all.concat(d.products || []);
          const link = r.headers.get('link') || '';
          const m = link.match(/<[^>]*page_info=([^&>]*)[^>]*>;\s*rel="next"/);
          pageInfo = m ? m[1] : null;
          pages++;
          if (!pageInfo) break;
        }
        return { products: all };
      })(),
    ]);
    const prods = prodShopify.products || [];

    // Mapa variant_id -> imagem exata da variante
    const variantImgMap = {};
    prods.forEach(p => {
      (p.variants||[]).forEach(v => {
        if (v.featured_image && v.featured_image.src) {
          variantImgMap[String(v.id)] = v.featured_image.src;
        } else if (v.image_id) {
          const img = (p.images||[]).find(i => i.id === v.image_id);
          if (img) variantImgMap[String(v.id)] = img.src;
        }
        if (!variantImgMap[String(v.id)] && p.image) {
          variantImgMap[String(v.id)] = p.image.src;
        }
      });
    });

    const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/  +/g,' ').trim();

    const getImg = (nome) => {
      if (!nome) return '';
      // Usar título completo antes de "- Cor:" como base (inclui variante do produto ex: "DOURADO")
      const base = nome.split(' - Cor:')[0].trim();
      const baseNorm = norm(base);
      const modelo = (nome.match(/[A-Z]{1,5}-[0-9]{3,5}[A-Z0-9]*/i)||[])[0]?.toUpperCase() || '';

      // Extrair cor do título: "Pro Trek GA-1017 - Cor: Preto pulseira verde" -> "Preto pulseira verde"
      const corMatch = nome.match(/Cor:\s*(.+?)(?:\s*-\s*|$)/i);
      const corTitulo = corMatch ? norm(corMatch[1]) : '';

      let melhor = null, melhorPts = 0;
      const palavrasBase = baseNorm.split(' ').filter(w=>w.length>2);
      for (const p of prods) {
        const pt = norm(p.title);
        let pts = 0;
        if (pt === baseNorm) pts = 200;
        else if (modelo && p.title.toUpperCase().includes(modelo)) pts = 100;
        else if (pt.includes(baseNorm) || baseNorm.includes(pt)) pts = 50;
        else {
          // Pontuação proporcional: precisa de pelo menos 50% das palavras
          const matches = palavrasBase.filter(w=>pt.includes(w)).length;
          if (matches > 0 && palavrasBase.length > 0) {
            const pct = matches / palavrasBase.length;
            if (pct >= 0.5) pts = Math.round(pct * 40); // máx 40 pts para match parcial
          }
        }
        if (pts > melhorPts) { melhorPts = pts; melhor = p; }
      }
      // Só usar match se tiver pontuação mínima razoável
      if (!melhor || melhorPts < 20) return '';

      // Tentar imagem da variante pela cor extraída do título
      if (corTitulo) {
        const varianteImg = (v) => {
          if (v.featured_image?.src) return v.featured_image.src;
          if (v.image_id) {
            const img = (melhor.images||[]).find(i => i.id === v.image_id);
            if (img) return img.src;
          }
          return '';
        };

        const variants = melhor.variants || [];

        // 1. Match exato da cor
        const exato = variants.find(v => norm(v.title) === corTitulo);
        if (exato) { const img = varianteImg(exato); if (img) return img; }

        // 2. Variante cujo título está CONTIDO na cor (ex: variante "Preto" dentro de "Preto")
        // Ordenar por comprimento decrescente para pegar o match mais específico primeiro
        const porLen = [...variants].sort((a,b) => b.title.length - a.title.length);
        const contido = porLen.find(v => {
          const vt = norm(v.title);
          // Evitar match de "Preto" em "Branco com Preto" quando a cor é apenas "Preto"
          // Só aceitar se a variante inteira está na cor OU a cor inteira está na variante
          return corTitulo === vt || corTitulo.startsWith(vt + ' ') || corTitulo.endsWith(' ' + vt);
        });
        if (contido) { const img = varianteImg(contido); if (img) return img; }

        // 3. Todas as palavras da variante aparecem na cor (match mais específico)
        const melhorVar = porLen.find(v => {
          const palavrasVar = norm(v.title).split(' ').filter(w => w.length > 2);
          return palavrasVar.length > 0 && palavrasVar.every(w => corTitulo.includes(w));
        });
        if (melhorVar) { const img = varianteImg(melhorVar); if (img) return img; }
      }

      // Fallback: primeira imagem do produto
      return melhor.image?.src || '';
    };

    // Buscar imagem exata por variant_id do line_item
    const getImgVariant = (lineItem) => {
      if (lineItem.image?.src) return lineItem.image.src;
      if (lineItem.variant_id && variantImgMap[String(lineItem.variant_id)]) {
        return variantImgMap[String(lineItem.variant_id)];
      }
      return getImg(lineItem.title);
    };

    const pedidos = (pedidosR.orders||[]).map(o => ({
      id: o.id,
      numero: o.order_number,
      cliente: o.customer ? `${o.customer.first_name||''} ${o.customer.last_name||''}`.trim() : 'Sem nome',
      email: o.customer?.email || o.email || '',
      telefone: o.shipping_address?.phone || o.billing_address?.phone || o.customer?.phone || o.phone || '',
      endereco: o.shipping_address ? `${o.shipping_address.address1||''}, ${o.shipping_address.city||''} - ${o.shipping_address.province_code||''}, ${o.shipping_address.zip||''}` : '',
      produto: (o.line_items||[]).map(i => i.title + (i.variant_title&&i.variant_title!=='Default Title'?' - '+i.variant_title:'')).join(', '),
      itens: (o.line_items||[]).map(i => ({ nome: i.title, variante: i.variant_title, quantidade: i.quantity, preco: i.price, variant_id: String(i.variant_id||'') })),
      subtotal: o.subtotal_price,
      frete_valor: o.total_shipping_price_set?.shop_money?.amount || '0',
      desconto: o.total_discounts,
      valor: o.total_price,
      financeiro: o.financial_status,
      fulfillment: o.fulfillment_status || 'unfulfilled',
      tracking: (o.fulfillments||[])[0]?.tracking_number || '',
      tracking_url: (o.fulfillments||[])[0]?.tracking_url || '',
      nota: o.note || '',
      tags: o.tags || '',
      cupom: (o.discount_codes||[]).map(d => d.code).join(', '),
      meOrderId: '',
      criado_em: o.created_at,
      imagem: (o.line_items||[])[0]?.image?.src || getImgVariant((o.line_items||[])[0] || {}),
      imagens: (o.line_items||[]).map(i => ({
        nome: i.title,
        variante: i.variant_title||'',
        variant_id: String(i.variant_id||''),
        img: i.image?.src || getImgVariant(i)
      })),
    }));
    const pedResult = { pedidos };
    fetch(`${KV_URL}/set/${cachePedidos}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(pedResult), ex: 60 })
    }).catch(()=>{});
    return res.status(200).json(pedResult);
  }

  // ===== DEFINIR GRUPO ATIVO MANUAL =====
  if (req.query.action === 'set-grupo-ativo') {
    const { nome, link } = req.body || {};
    if (!nome || !link) return res.status(400).json({ error: 'nome e link obrigatórios' });
    await fetch(`${KV_URL}/set/grupo-ativo-manual`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, link, atualizado_em: new Date().toISOString() })
    });
    return res.status(200).json({ ok: true, nome, link });
  }

  // ===== REMOVER TRAVA MANUAL: volta a escolher o grupo ativo automaticamente por vaga =====
  if (req.query.action === 'limpar-grupo-manual' && req.method === 'POST') {
    await fetch(`${KV_URL}/del/grupo-ativo-manual`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.status(200).json({ ok: true });
  }

  // ===== ACTION: ENVIAR PARA FORNECEDOR =====
  if (req.query.action === 'enviar-fornecedor') {
    const { clienteNome, tracking, imgUrl } = req.query;
    let meOrderId = req.query.meOrderId || null;
    let trackingFinal = tracking || '';
    const GRUPO_FORNECEDOR = '120363426285950378-group';
    const zapiBase = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

    try {
      // 1. Buscar meOrderId se não veio
      if (!meOrderId) {
        const pages = await Promise.all([1,2,3].map(p =>
          fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${p}`, {
            headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
          }).then(r=>r.json()).catch(()=>({data:[]}))
        ));
        const allOrders = pages.flatMap(p => (p.data||[]).flatMap(pu => pu.orders||[]));
        const found = trackingFinal
          ? allOrders.find(o => o.tracking === trackingFinal)
          : allOrders.find(o => {
              const toName = (o.to&&o.to.name||'').toLowerCase().trim();
              const cn = (clienteNome||'').toLowerCase().trim();
              return toName === cn || toName.includes(cn.split(' ')[0]);
            });
        if (found) {
          meOrderId = found.id;
          trackingFinal = found.tracking || trackingFinal;
          console.log('Encontrado:', found.to&&found.to.name, '| tracking:', trackingFinal);
        }
      }

      // 2. Buscar URL do PDF no S3 (etiqueta + DACE juntos via endpoint de impressão)
      let allPdfUrls = [];
      if (meOrderId) {
        try {
          // Tentar endpoint que gera etiqueta + DACE juntos
          const pdfResp = await fetch(`https://melhorenvio.com.br/api/v2/me/shipment/print`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
            body: JSON.stringify({ orders: [meOrderId] })
          });
          const pdfData = await pdfResp.json();
          console.log('shipment/print:', JSON.stringify(pdfData).substring(0,200));
          
          // Baixar PDF completo (etiqueta + DACE) via serviço Railway
          const PDF_SERVICE = 'https://kcique-pdf-service-production.up.railway.app';
          const PDF_SECRET = 'kcique2026';

          try {
            // Pegar link de impressão do Melhor Envio
            const printResp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/print', {
              method: 'POST',
              headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
              body: JSON.stringify({ orders: [meOrderId] })
            });
            const printData = await printResp.json();
            const printUrl = printData.url || '';
            const printHash = printUrl.split('/imprimir/')[1] || meOrderId;
            console.log('Print hash:', printHash);

            // Chamar Railway para baixar PDF completo com DACE
            const pdfServiceResp = await fetch(`${PDF_SERVICE}/pdf/${printHash}?secret=${PDF_SECRET}`);
            console.log('PDF service status:', pdfServiceResp.status);

            if (pdfServiceResp.ok) {
              const pdfBuf = await pdfServiceResp.arrayBuffer();
              console.log('PDF completo tamanho:', pdfBuf.byteLength, 'bytes');
              allPdfUrls = [{ tipo: 'base64', data: Buffer.from(pdfBuf).toString('base64') }];
            } else {
              throw new Error('PDF service retornou ' + pdfServiceResp.status);
            }
          } catch(e) {
            console.log('Erro PDF service Railway:', e.message);
            // Fallback: URL S3 via API (só etiqueta sem DACE)
            const pdfResp2 = await fetch(`https://melhorenvio.com.br/api/v2/me/imprimir/pdf/${meOrderId}`, {
              headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
            });
            const pdfData2 = await pdfResp2.json();
            const s3Urls = Array.isArray(pdfData2) ? pdfData2 : [];
            allPdfUrls = s3Urls.map(u => ({ tipo: 'url', data: u }));
            console.log('Fallback S3 urls:', s3Urls.length);
          }
        } catch(e) { console.log('Erro PDF:', e.message); }
      }
      const pdfS3Url = allPdfUrls[0] || '';

      // 3. Enviar mensagens em sequência
      // Foguetes iniciais
      await fetch(`${zapiBase}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: GRUPO_FORNECEDOR, message: '\uD83D\uDE80\n\uD83D\uDE80' })
      });
      await new Promise(r => setTimeout(r, 800));

      // Foto com legenda
      if (imgUrl) {
        await fetch(`${zapiBase}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
          body: JSON.stringify({ phone: GRUPO_FORNECEDOR, image: decodeURIComponent(imgUrl), caption: 'pedido ' + clienteNome + '\nETIQUETA PDF' })
        });
      } else {
        await fetch(`${zapiBase}/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
          body: JSON.stringify({ phone: GRUPO_FORNECEDOR, message: 'pedido ' + clienteNome + '\nETIQUETA PDF' })
        });
      }
      await new Promise(r => setTimeout(r, 800));

      // Foguetes finais
      await fetch(`${zapiBase}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: GRUPO_FORNECEDOR, message: '\uD83D\uDE80\n\uD83D\uDE80' })
      });
      await new Promise(r => setTimeout(r, 800));

      // PDFs (etiqueta + DACE se houver)
      if (pdfS3Url) {
        // Buscar todos os PDFs do order (etiqueta + DACE)
        let allPdfUrls = [pdfS3Url];
        try {
          const pdfResp2 = await fetch(`https://melhorenvio.com.br/api/v2/me/imprimir/pdf/${meOrderId}`, {
            headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
          });
          const pdfData2 = await pdfResp2.json();
          if (Array.isArray(pdfData2) && pdfData2.length > 0) {
            allPdfUrls = pdfData2;
            console.log('Total PDFs encontrados:', allPdfUrls.length);
          }
        } catch(e) {}

        for (let i = 0; i < allPdfUrls.length; i++) {
          const item = allPdfUrls[i];
          const fileName = i === 0
            ? 'etiqueta-' + (trackingFinal||meOrderId||'') + '.pdf'
            : 'dace-' + (trackingFinal||meOrderId||'') + '.pdf';
          
          let body;
          if (typeof item === 'string') {
            body = { phone: GRUPO_FORNECEDOR, document: item, fileName, caption: '' };
          } else if (item.tipo === 'base64') {
            body = { phone: GRUPO_FORNECEDOR, base64: 'data:application/pdf;base64,' + item.data, fileName, caption: '' };
          } else {
            body = { phone: GRUPO_FORNECEDOR, document: item.data, fileName, caption: '' };
          }
          
          const endpoint = (item.tipo === 'base64') ? `${zapiBase}/send-document/base64` : `${zapiBase}/send-document/pdf`;
          const zapiDocResp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
            body: JSON.stringify(body)
          });
          const zapiDocData = await zapiDocResp.json();
          console.log('PDF', i+1, 'enviado:', JSON.stringify(zapiDocData).substring(0,100));
          await new Promise(r => setTimeout(r, 1000));
        }
      } else if (trackingFinal) {
        await fetch(`${zapiBase}/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
          body: JSON.stringify({ phone: GRUPO_FORNECEDOR, message: 'Rastreio: ' + trackingFinal })
        });
      }

      return res.status(200).json({ ok: true, pdfPending: false });
    } catch(e) {
      console.error('Erro fornecedor:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== ACTION: LISTAR TODOS OS PRODUTOS (para selecao de bundle) =====
  if (req.query.action === 'produtos-lista') {
    try {
      let allProducts = [];
      let pageInfo = null;
      let hasMore = true;
      let pages = 0;
      while (hasMore && pages < 10) {
        const url = pageInfo
          ? `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&page_info=${pageInfo}`
          : `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250`;
        const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
        const d = await r.json();
        allProducts = allProducts.concat(d.products || []);
        const linkHeader = r.headers.get('link') || '';
        const match = linkHeader.match(/<[^>]*page_info=([^&>]*)[^>]*>;\s*rel="next"/);
        pageInfo = match ? match[1] : null;
        hasMore = !!pageInfo;
        pages++;
      }
      const produtos = allProducts.filter(p => p.status === 'active').map(p => ({
        id: String(p.id),
        titulo: p.title,
        imagem: p.image ? p.image.src : '',
        preco: p.variants && p.variants[0] ? p.variants[0].price : '0',
        variantes: (p.variants || []).map(v => ({
          id: String(v.id),
          titulo: v.title,
          preco: v.price,
          disponivel: v.available !== false
        }))
      }));
      return res.status(200).json({ produtos, total: produtos.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== CRIAR PEDIDO MANUAL (venda fechada no WhatsApp) =====
  if (req.query.action === 'criar-pedido-manual' && req.method === 'POST') {
    try {
      const { cliente, itens, frete, pagamento, peso, valorTotal, observacao } = req.body || {};
      if (!cliente || !cliente.nome || !cliente.telefone || !cliente.cep || !cliente.rua || !cliente.numero || !cliente.cidade || !cliente.estado) {
        return res.status(400).json({ ok: false, erro: 'Preencha os dados do cliente e o endereço completo' });
      }
      if (!itens || !itens.length) {
        return res.status(400).json({ ok: false, erro: 'Adicione pelo menos um produto' });
      }
      if (!frete || frete.preco === undefined || frete.preco === null) {
        return res.status(400).json({ ok: false, erro: 'Selecione a forma de envio' });
      }

      const freteValor = parseFloat(frete.preco || 0);
      const subtotalCatalogo = itens.reduce((s, i) => s + parseFloat(i.preco) * (i.quantidade || 1), 0);
      const totalCatalogo = subtotalCatalogo + freteValor;

      // Valor final: usa o informado manualmente (pode ter desconto combinado no WhatsApp) ou o calculado pelo catálogo.
      // Os produtos ficam no preço de catálogo; o ajuste entra só como desconto/acréscimo separado,
      // assim o total do pedido bate exatamente com o valor pago pelo cliente (sem descontar em dobro).
      const totalFinal = (typeof valorTotal === 'number' && valorTotal > 0) ? valorTotal : totalCatalogo;
      const ajuste = totalCatalogo - totalFinal; // > 0 = desconto dado; < 0 = cobrado a mais
      const subtotalFinal = Math.max(0.01, totalFinal - freteValor);

      const lineItems = itens.map(i => {
        const li = {
          title: i.nome + (i.variante && i.variante !== 'Default Title' ? ' - Cor: ' + i.variante : ''),
          quantity: i.quantidade || 1,
          price: parseFloat(i.preco).toFixed(2),
          requires_shipping: true
        };
        if (i.variantId) li.variant_id = parseInt(i.variantId);
        return li;
      });
      // Se o valor combinado for MAIOR que o catálogo (raro), soma a diferença como um item à parte
      if (ajuste < 0) {
        lineItems.push({ title: 'Ajuste no valor combinado', quantity: 1, price: (-ajuste).toFixed(2), requires_shipping: false });
      }

      const partesNome = (cliente.nome || '').trim().split(/\s+/);
      const primeiroNome = partesNome[0] || 'Cliente';
      const sobrenome = partesNome.length > 1 ? partesNome.slice(1).join(' ') : primeiroNome;
      const metodoLabel = ['pix', 'credit_card', 'debit_card'].includes(pagamento) ? pagamento : 'outro';

      const orderData = {
        order: {
          line_items: lineItems,
          financial_status: 'paid',
          fulfillment_status: null,
          currency: 'BRL',
          note: `Pedido manual (WhatsApp) | Método: ${metodoLabel} | Telefone: ${cliente.telefone} | Origem: whatsapp-manual${ajuste > 0 ? ' | Desconto combinado: R$' + ajuste.toFixed(2) + ' (catálogo R$' + totalCatalogo.toFixed(2) + ')' : ''}${observacao ? ' | Obs: ' + observacao : ''}`,
          tags: 'WhatsApp,Manual',
          discount_codes: ajuste > 0 ? [{ code: 'WHATSAPP', amount: ajuste.toFixed(2), type: 'fixed_amount' }] : [],
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
          shipping_lines: [{ title: frete.nome, price: freteValor.toFixed(2), code: frete.id === 1 ? 'PAC' : 'SEDEX' }],
          transactions: [{ kind: 'sale', status: 'success', amount: totalFinal.toFixed(2), gateway: 'Manual - WhatsApp' }]
        }
      };
      orderData.order.billing_address = orderData.order.shipping_address;

      if (cliente.email) {
        try {
          const cResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=email:${encodeURIComponent(cliente.email)}`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
          const cData = await cResp.json();
          orderData.order.customer = (cData.customers && cData.customers.length)
            ? { id: cData.customers[0].id }
            : { first_name: primeiroNome, last_name: sobrenome, email: cliente.email };
        } catch (e) {
          orderData.order.customer = { first_name: primeiroNome, last_name: sobrenome, email: cliente.email };
        }
      } else {
        orderData.order.customer = { first_name: primeiroNome, last_name: sobrenome };
      }

      const shopifyResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
        body: JSON.stringify(orderData)
      });
      const shopifyData = await shopifyResp.json();
      if (!shopifyData.order) {
        return res.status(400).json({ ok: false, erro: 'Erro ao criar pedido no Shopify', detalhe: shopifyData.errors });
      }

      // Adicionar etiqueta no carrinho do Melhor Envio, igual a uma compra real no site
      let melhorEnvioResult = null;
      if (ME_TOKEN) {
        try {
          const cepLimpo = cliente.cep.replace(/\D/g, '');
          const serviceId = frete.id === 1 ? 1 : 2;
          const pesoKg = parseFloat(peso) > 0 ? parseFloat(peso) : 0.5;
          const meBody = {
            service: serviceId,
            agency: null,
            from: {
              name: 'Kcique Relógios', phone: '11000000000', email: 'kciqueadm@gmail.com',
              document: process.env.MELHORENVIO_CPF, company_document: '66609452000183', state_register: null,
              address: 'Rua São Francisco', complement: 'Ap 804', number: '98', district: 'Se',
              city: 'São Paulo', country_id: 'BR', postal_code: '01005020', note: ''
            },
            to: {
              name: cliente.nome, phone: cliente.telefone.replace(/\D/g, ''), email: cliente.email || '',
              document: cliente.cpf ? cliente.cpf.replace(/\D/g, '') : '',
              address: cliente.rua, complement: cliente.complemento || '', number: cliente.numero,
              district: cliente.bairro || '', city: cliente.cidade, country_id: 'BR', postal_code: cepLimpo, note: ''
            },
            products: [{ name: lineItems[0].title, quantity: 1, unitary_value: subtotalFinal.toFixed(2), weight: pesoKg }],
            volumes: [{ height: 10, width: 12, length: 18, weight: pesoKg }],
            tag: shopifyData.order.id.toString(),
            platform: 'Shopify',
            invoice: { key: null },
            options: { insurance_value: subtotalFinal.toFixed(2), receipt: false, own_hand: false, collect: false, reverse: false, non_commercial: false }
          };
          const meResp = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ME_TOKEN}`, 'Accept': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
            body: JSON.stringify(meBody)
          });
          melhorEnvioResult = await meResp.json();
        } catch (e) {
          melhorEnvioResult = { erro: e.message };
        }
      }

      // Invalidar caches para o pedido aparecer na hora
      Promise.all([
        fetch(`${KV_URL}/del/cache-pedidos-json`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } }),
        fetch(`${KV_URL}/del/cache-dashboard-home`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } })
      ]).catch(() => {});

      return res.status(200).json({
        ok: true,
        pedido: { id: shopifyData.order.id, numero: shopifyData.order.order_number },
        melhorEnvio: melhorEnvioResult && melhorEnvioResult.id ? { ok: true, id: melhorEnvioResult.id } : { ok: false, detalhe: melhorEnvioResult }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  }

  // ===== ACTION: BUNDLE COMPLETO - retorna produtos prontos para exibir (público) =====
  if (req.query.action === 'bundle-lista') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const _shopifyStore = process.env.SHOPIFY_STORE;
      const _shopifyToken = process.env.SHOPIFY_TOKEN;

      // Buscar config do bundle
      const configResp = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const configData = await configResp.json();
      let config = configData.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config || !config.produtoIds || config.produtoIds.length === 0) {
        return res.status(200).json({ produtos: [], desconto: 50 });
      }

      // Buscar detalhes dos produtos selecionados no Shopify
      const produtos = await Promise.all(config.produtoIds.map(async id => {
        try {
          const r = await fetch(`https://${_shopifyStore}/admin/api/2026-04/products/${id}.json`, {
            headers: { 'X-Shopify-Access-Token': _shopifyToken }
          });
          const d = await r.json();
          const p = d.product;
          if (!p) return null;
          return {
            id: String(p.id),
            nome: p.title,
            preco: p.variants && p.variants[0] ? Math.round(parseFloat(p.variants[0].price) * 100) : 0,
            imagem: p.image ? p.image.src : '',
            variantes: (p.variants || []).filter(v => v.inventory_quantity > 0 || v.inventory_policy === 'continue').map(v => ({
              titulo: v.title,
              preco: Math.round(parseFloat(v.price) * 100),
              imagem: v.featured_image ? v.featured_image.src : (p.image ? p.image.src : ''),
              disponivel: v.available !== false
            }))
          };
        } catch(e) { return null; }
      }));

      return res.status(200).json({
        produtos: produtos.filter(Boolean),
        desconto: config.desconto || 50
      });
    } catch(e) {
      return res.status(200).json({ produtos: [], desconto: 50 });
    }
  }

  // ===== ACTION: BUNDLE - LISTA COMPLETA PARA PÁGINA DO PRODUTO (público) =====
  if (req.query.action === 'bundle-lista') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const _shopStore = process.env.SHOPIFY_STORE;
      const _shopToken = process.env.SHOPIFY_TOKEN;

      // Buscar config do bundle
      const r = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const d = await r.json();
      let config = d.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config || !config.produtoIds || config.produtoIds.length === 0) {
        return res.status(200).json({ produtos: [], desconto: 50 });
      }

      // Buscar detalhes dos produtos selecionados no Shopify
      const produtosDetalhes = await Promise.all(config.produtoIds.map(async id => {
        try {
          const r2 = await fetch(`https://${_shopStore}/admin/api/2026-04/products/${id}.json`, {
            headers: { 'X-Shopify-Access-Token': _shopToken }
          });
          const d2 = await r2.json();
          const p = d2.product;
          if (!p) return null;
          return {
            id: String(p.id),
            nome: p.title,
            preco: p.variants && p.variants[0] ? Math.round(parseFloat(p.variants[0].price) * 100) : 0,
            imagem: p.image ? p.image.src : '',
            variantes: (p.variants || []).map(v => ({
              titulo: v.title,
              preco: Math.round(parseFloat(v.price) * 100),
              imagem: v.featured_image ? v.featured_image.src : (p.image ? p.image.src : ''),
              disponivel: v.available !== false
            }))
          };
        } catch(e) { return null; }
      }));

      return res.status(200).json({
        produtos: produtosDetalhes.filter(Boolean),
        desconto: config.desconto || 50
      });
    } catch(e) {
      return res.status(200).json({ produtos: [], desconto: 50 });
    }
  }

  // ===== ACTION: BUNDLE - LISTAR PRODUTOS SELECIONADOS (público, com CORS) =====
  if (req.query.action === 'bundle-produtos') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      const _kvUrl = process.env.KV_REST_API_URL;
      const _kvToken = process.env.KV_REST_API_TOKEN;
      const r = await fetch(`${_kvUrl}/get/bundle-config`, { headers: { Authorization: `Bearer ${_kvToken}` } });
      const d = await r.json();
      let config = d.result;
      while (typeof config === 'string') { try { config = JSON.parse(config); } catch(e) { break; } }
      if (!config) config = { produtoIds: [], desconto: 50 };
      return res.status(200).json(config);
    } catch(e) {
      return res.status(200).json({ produtoIds: [], desconto: 50 });
    }
  }

  // ===== ACTION: BUNDLE - SALVAR CONFIG (admin) =====
  if (req.query.action === 'bundle-salvar' && req.method === 'POST') {
    try {
      const { produtoIds, desconto } = req.body;
      const config = { produtoIds: produtoIds || [], desconto: parseFloat(desconto) || 50 };
      await fetch(`${KV_URL}/set/bundle-config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return res.status(200).json({ ok: true, config });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== ACTION: GRUPO VIP ATIVO (público, com CORS) =====


  if (req.query.action === 'grupos-vip-dashboard') {
    try {
      const GRUPOS_LINKS = [
        {nome:'#1',link:'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1'},
        {nome:'#2',link:'https://chat.whatsapp.com/GtwnsNKOBhBFphx80IbGRi'},
        {nome:'#3',link:'https://chat.whatsapp.com/Gp0z5rooPJn4xJ9vMuu5mq'},
        {nome:'#4',link:'https://chat.whatsapp.com/CwNI8EJ4YYE3l87dnkPsfF'},
        {nome:'#5',link:'https://chat.whatsapp.com/Gdm2fldetx4CgQTlXIU4Hr'},
        {nome:'#6',link:'https://chat.whatsapp.com/FqcXp5lj5Iv6fln8aOls41'},
        {nome:'#7',link:'https://chat.whatsapp.com/IsQ8zsma0e83xULh9GoSf2'},
        {nome:'#8',link:'https://chat.whatsapp.com/DfaAcQXJdBqH8NiEJoRxmH'},
        {nome:'#9',link:'https://chat.whatsapp.com/H86IAANo3wC5vJLpGLruN5'},
        {nome:'#10',link:'https://chat.whatsapp.com/EKL8Pi3nSDFEnfFysWd6vV'},
        {nome:'#11',link:'https://chat.whatsapp.com/LUekubqMZ1fFBzNc6nr1eh'},
        {nome:'#12',link:'https://chat.whatsapp.com/DiCkqI5M1rc9fD4Uo0Uhpb'},
        {nome:'#13',link:'https://chat.whatsapp.com/JcmJFfNeCTxFCqhNaTK3UL?s=cl&p=a&ilr=1'},
        {nome:'#14',link:'https://chat.whatsapp.com/EZqlQfswqOvCSJgWmP8TpZ'},
        {nome:'#15',link:'https://chat.whatsapp.com/KWGkIwonwYVClO5y44DJPh?s=cl&p=a&ilr=1'},
        {nome:'#16',link:'https://chat.whatsapp.com/EsAXwsLfNQ4BIKHWF20Gxh?s=cl&p=a&ilr=1'},
        {nome:'#17',link:'https://chat.whatsapp.com/Ln7miz76B0BH8EjvaN57YC'},
      ];
      const LIMITE = 1000;

      // Usar snapshot do Redis (instantâneo) em vez de buscar ao vivo
      const hoje = new Date();
      const hojeBR = new Date(hoje.getTime() - 3*60*60*1000);
      let grupos = null;
      let grupoDataUsada = null;
      for (let i = 0; i <= 2; i++) {
        const d = new Date(hojeBR); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const r = await fetch(`${KV_URL}/get/vip-snapshot-${ds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const j = await r.json();
        let snap = j.result;
        while (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch(e) { break; } }
        if (snap && snap.grupos) { grupos = snap.grupos; grupoDataUsada = ds; break; }
      }
      // Se não tem snapshot, retornar erro amigável
      if (!grupos) {
        return res.status(200).json({ grupos: GRUPOS_LINKS.map(g=>({...g,membros:0})), grupoAtivo: GRUPOS_LINKS[0], entradasHoje: null, historico: [], totalMembros: 0, aviso: 'Snapshot não disponível. Aguarde o cron rodar.' });
      }
      // Adicionar links aos grupos do snapshot
      grupos = grupos.map(g => ({ ...g, link: (GRUPOS_LINKS.find(l=>l.nome===g.nome)||{}).link||'' }));

      // Verificar se há grupo definido manualmente
      const manualR = await fetch(`${KV_URL}/get/grupo-ativo-manual`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const manualJ = await manualR.json();
      let manualGrupo = manualJ.result;
      while (typeof manualGrupo === 'string') { try { manualGrupo = JSON.parse(manualGrupo); } catch(e) { break; } }
      let grupoAtivo;
      const travadoManual = !!(manualGrupo && manualGrupo.link);
      if (travadoManual) {
        const gSnap = grupos.find(g => g.nome === manualGrupo.nome);
        grupoAtivo = gSnap ? { ...gSnap, link: manualGrupo.link } : { nome: manualGrupo.nome, link: manualGrupo.link, membros: 0 };
      } else {
        grupoAtivo = grupos[grupos.length - 1];
        for (const g of grupos) {
          if (g.membros < LIMITE) { grupoAtivo = g; break; }
        }
      }

      const hojeStr = hojeBR.toISOString().split('T')[0];
      const totalAtual = grupos.reduce((s,g) => s+g.membros, 0);

      // Buscar o snapshot de HOJE especificamente (pode ainda não existir, se o cron não rodou hoje)
      const chaveHoje = `vip-snapshot-${hojeStr}`;
      const snapHojeResp = await fetch(`${KV_URL}/get/${chaveHoje}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const snapHojeData = await snapHojeResp.json();
      let snapHoje = snapHojeData.result;
      while (typeof snapHoje === 'string') { try { snapHoje = JSON.parse(snapHoje); } catch(e) { break; } }

      // Calcular entradas de hoje comparando com snapshot de ontem
      const ontemStr = new Date(hojeBR.getTime() - 86400000).toISOString().split('T')[0];
      const chaveOntem = `vip-snapshot-${ontemStr}`;
      const snapOntemResp = await fetch(`${KV_URL}/get/${chaveOntem}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const snapOntemData = await snapOntemResp.json();
      let snapOntem = null;
      if (snapOntemData.result) {
        try {
          snapOntem = typeof snapOntemData.result === 'string' ? JSON.parse(snapOntemData.result) : snapOntemData.result;
          if (typeof snapOntem === 'string') snapOntem = JSON.parse(snapOntem);
        } catch(e) {}
      }
      // Calcular entradas comparando snapshots — só quando ambos existem e diferença é razoável
      const calcEntradas = (snapNovo, snapVelho) => {
        if (!snapNovo || !snapVelho) return null; // null = sem dados suficientes
        if (!snapNovo.grupos || !snapVelho.grupos) {
          const diff = (snapNovo.total || 0) - (snapVelho.total || 0);
          return (diff > 0 && diff <= 17000) ? diff : null; // máx 17 grupos x 1000
        }
        let entradas = 0;
        snapNovo.grupos.forEach(g => {
          if (g.falhou || g.membros <= 0) return;
          const ant = snapVelho.grupos.find(x => x.nome === g.nome);
          if (!ant || ant.falhou || ant.membros <= 0) return;
          const diff = g.membros - ant.membros;
          if (diff > 0 && diff <= 1000) entradas += diff; // máx 1000 por grupo (capacidade máxima)
        });
        return entradas;
      };

      // Só calcula "entradas hoje" com um snapshot de hoje de verdade — comparar o fallback
      // (que pode ser de ontem/anteontem) com o snapshot de ontem daria sempre 0, mesmo
      // havendo entradas reais, por comparar o mesmo dia consigo mesmo.
      const entradasHoje = snapHoje ? calcEntradas(snapHoje, snapOntem) : null;

      // Histórico dos últimos 7 dias
      const historico = [];
      for (let i = 6; i >= 0; i--) {
        const d1 = new Date(hojeBR); d1.setDate(d1.getDate() - i);
        const d0 = new Date(hojeBR); d0.setDate(d0.getDate() - i - 1);
        const ds1 = d1.toISOString().split('T')[0];
        const ds0 = d0.toISOString().split('T')[0];
        const [r1, r0] = await Promise.all([
          fetch(`${KV_URL}/get/vip-snapshot-${ds1}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r=>r.json()).catch(()=>({})),
          fetch(`${KV_URL}/get/vip-snapshot-${ds0}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r=>r.json()).catch(()=>({}))
        ]);
        let snap1 = r1.result || null;
        let snap0 = r0.result || null;
        while (typeof snap1 === 'string') { try { snap1 = JSON.parse(snap1); } catch(e) { break; } }
        while (typeof snap0 === 'string') { try { snap0 = JSON.parse(snap0); } catch(e) { break; } }
        const entradas = i === 0 ? (entradasHoje || 0) : (calcEntradas(snap1, snap0) || 0);
        historico.push({ data: ds1, entradas });
      }

      const aviso = grupoDataUsada !== hojeStr
        ? `Números por grupo são do snapshot de ${grupoDataUsada} — o de hoje ainda não foi gerado.`
        : null;

      return res.status(200).json({ grupos, grupoAtivo, entradasHoje, historico, totalMembros: totalAtual, aviso, travadoManual });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== ACTION: BUSCAR GRUPO =====
  if (req.query.action === 'buscar-grupo') {
    const nome = req.query.nome || '';
    try {
      const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/chats?page=1&pageSize=100`, {
        headers: { 'client-token': ZAPI_CLIENT_TOKEN }
      });
      const d = await r.json();
      const chats = Array.isArray(d) ? d : (d.chats || d.result || []);
      const grupos = chats.filter(c => (c.isGroup || (c.id && c.id.includes('-group'))) && (!nome || (c.name||c.title||c.subject||'').toLowerCase().includes(nome.toLowerCase())));
      return res.status(200).json({ total: grupos.length, grupos: grupos.map(g => ({ id: g.id, phone: g.phone, chatId: g.chatId, nome: g.name||g.title||g.subject||'—', raw_keys: Object.keys(g) })) });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== ACTION: DEBUG VARIANTES =====
  if (req.query.action === 'variantes-debug') {
    const titulo = req.query.titulo || '';
    // Busca exata por titulo
    const r1 = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?title=${encodeURIComponent(titulo)}&fields=id,title,variants,images&limit=5`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
    const d1 = await r1.json();
    // Busca geral nos produtos já carregados (busca parcial)
    let produtos = (d1.products||[]);
    if (!produtos.length) {
      // Tentar busca com primeiras palavras
      const palavras = titulo.split(' ').slice(0,2).join(' ');
      const r2 = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?title=${encodeURIComponent(palavras)}&fields=id,title,variants,images&limit=10`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
      const d2 = await r2.json();
      produtos = (d2.products||[]).filter(p => p.title.toLowerCase().includes(titulo.toLowerCase().split(' ')[0].toLowerCase()));
    }
    const result = produtos.map(p => ({
      id: p.id,
      title: p.title,
      imagens: (p.images||[]).map(i => ({ id: i.id, src: i.src.split('/').pop().split('?')[0] })),
      variantes: (p.variants||[]).map(v => ({ id: v.id, title: v.title, image_id: v.image_id, tem_imagem: !!(v.image_id || (v.featured_image && v.featured_image.src)) }))
    }));
    return res.status(200).json({ produtos: result });
  }

  // ===== ACTION: DEBUG LINE ITEMS =====
  if (req.query.action === 'lineitems-debug') {
    const r = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=2&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
    const d = await r.json();
    const items = (d.orders||[]).map(o => ({
      order: o.order_number,
      line_items: (o.line_items||[]).map(i => ({
        title: i.title,
        variant_id: i.variant_id,
        variant_title: i.variant_title,
        image: i.image,
        properties: i.properties,
      }))
    }));
    return res.status(200).json({ items });
  }

  // ===== ACTION: DEBUG PRODUTOS =====
  if (req.query.action === 'prod-debug') {
    const r = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=5`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch(e) { d = {}; }
    return res.status(200).json({ 
      http_status: r.status,
      store: SHOPIFY_STORE,
      total: (d.products||[]).length,
      raw: text.substring(0, 300),
      produtos: (d.products||[]).map(p => ({ title: p.title, tem_imagem: !!p.image, img: p.image?.src?.substring(0,80) }))
    });
  }

  // ===== ACTION: RASTREAR LOTE =====
  if (req.query.action === 'rastrear-lote') {
    const codigos = (req.query.codigos || '').split(',').filter(Boolean);
    if (!codigos.length) return res.status(400).json({ error: 'codigos required' });
    try {
      const resp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify({ orders: codigos })
      });
      const data = await resp.json();
      const resultado = codigos.map(c => {
        const info = data[c] || {};
        return { codigo: c, status: info.status || '?', entregue: !!info.delivered_at, postado: !!info.posted_at, ultima_atualizacao: info.updated_at || '' };
      });
      return res.status(200).json({ resultado });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  // ===== ACTION: DEBUG MELHOR ENVIO =====
  // ===== DEBUG: testar busca do link de convite por ID do grupo (Z-API) =====
  if (req.query.action === 'debug-invite-link') {
    const groupId = req.query.id || '120363407575718083-group'; // padrão: grupo #1
    try {
      const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-invitation-link/${groupId}`, {
        headers: { 'client-token': ZAPI_CLIENT_TOKEN }
      });
      const d = await r.json();
      return res.status(200).json({ status: r.status, groupId, resposta: d });
    } catch (e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  if (req.query.action === 'me-debug') {
    const ME_TOKEN2 = process.env.MELHORENVIO_TOKEN;
    try {
      // Buscar todas as purchases e ver todos os status dos orders
      const r1 = await fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100', { headers: { Authorization: `Bearer ${ME_TOKEN2}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } });
      const d1 = await r1.json();
      const lastPage = d1.last_page || 1;
      const allPages = await Promise.all(
        Array.from({length: lastPage}, (_, i) =>
          fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + (i+1), { headers: { Authorization: `Bearer ${ME_TOKEN2}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(r=>r.json()).catch(()=>({data:[]}))
        )
      );
      const allPurchases = allPages.flatMap(p => p.data || []);
      const statusMap = {};
      const releasedIds = [];
      allPurchases.forEach(p => {
        (p.orders||[]).forEach(o => {
          statusMap[o.status] = (statusMap[o.status] || 0) + 1;
          if (o.status === 'released') releasedIds.push(o.id);
        });
      });
      // Consultar tracking dos released
      const trackResp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ME_TOKEN2}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify({ orders: releasedIds })
      });
      const trackData = await trackResp.json();
      const trackStatusMap = {};
      Object.values(trackData).forEach(o => {
        const s = o.tracking ? (o.delivered_at ? 'entregue' : 'em_transito') : 'sem_rastreio';
        trackStatusMap[s] = (trackStatusMap[s] || 0) + 1;
      });
      return res.status(200).json({ status_orders: statusMap, released_total: releasedIds.length, track_status: trackStatusMap });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== ACTION: GRUPOS (AJAX) =====
  if (req.query.action === 'grupos') {
    const GRUPOS_VIP = [
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
    const resultados = [];
    let total = 0;
    await Promise.all(GRUPOS_VIP.map(async g => {
      try {
        const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-metadata/${g.id}`, {
          headers: { 'client-token': ZAPI_CLIENT_TOKEN }
        });
        const d = await r.json();
        const membros = d.participants ? d.participants.length : 0;
        total += membros;
        resultados.push({ nome: g.nome, membros });
      } catch(e) {
        resultados.push({ nome: g.nome, membros: 0 });
      }
    }));
    resultados.sort((a,b) => a.nome.localeCompare(b.nome, undefined, {numeric:true}));
    return res.status(200).json({ grupos: resultados, total });
  }

  // ===== DELETAR LEAD =====
  if (req.query.del_lead) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    await fetch(`${KV_URL}/del/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/leads-lista/0/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_lead]) });
    return res.status(200).json({ ok: true });
  }

  // ===== DELETAR OFERTA =====
  if (req.query.del_oferta) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    await fetch(`${KV_URL}/del/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/ofertas-lista/0/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_oferta]) });
    return res.status(200).json({ ok: true });
  }

  // ===== DATAS =====
  const hoje = new Date();
  // Ajustar para horário de Brasília (UTC-3)
  const hojeBR = new Date(hoje.getTime() - 3 * 60 * 60 * 1000);
  const hojeStr = hojeBR.toISOString().split('T')[0];
  const inicioDia = hojeStr + 'T00:00:00-03:00';
  const fimDia = hojeStr + 'T23:59:59-03:00';
  const inicioMes = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0') + '-01T00:00:00-03:00';
  const mesAnteriorDate = new Date(hoje); mesAnteriorDate.setMonth(hoje.getMonth()-1);
  const inicioMesAnt = mesAnteriorDate.getFullYear() + '-' + String(mesAnteriorDate.getMonth()+1).padStart(2,'0') + '-01T00:00:00-03:00';
  const fimMesAnt = hojeStr.substring(0,8).replace(/\d{2}$/, '01') + 'T00:00:00-03:00';
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0] + 'T00:00:00-03:00';

  // ===== CARREGAR TUDO EM PARALELO =====
  let leads = [], ofertas = [], totalValorLeads = 0;
  let vendas = { hoje: {count:0,valor:0}, semana: {count:0,valor:0}, mes: {count:0,valor:0}, mesAnt: {count:0,valor:0} };
  let topProdutos = [], novosClientes = 0, semEstoque = [], pedidosPendentes = 0, pedidosTransito = 0, devolucoes = 0, ticketMedio = 0;
  let saldoME = 0, etiquetasHoje = 0, prontoPostar = 0, emTransito = 0, problemaEntrega = 0, entregues = 0, cancelados = 0, cartME = 0;

  const [leadsResult, ofertasLista, ordersHoje, ordersSemana, ordersMes, ordersMesAnt, clientesHoje, pedidosPagar, produtosSemEstoque, pedidosRecentes, saldoMelhorEnvio, etiquetasME] = await Promise.all([
    // Redis leads
    fetch(`https://infinitepay-backend.vercel.app/api/leads?secret=${secret}`).then(r=>r.json()).catch(()=>({leads:[]})),
    // Redis ofertas
    fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r=>r.json()).catch(()=>({result:[]})),
    // Shopify pedidos hoje
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioDia}&created_at_max=${fimDia}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Shopify pedidos semana
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioSemanaStr}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Shopify pedidos mês
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioMes}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Shopify pedidos mês anterior
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioMesAnt}&created_at_max=${fimMesAnt}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Shopify novos clientes hoje
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/customers.json?created_at_min=${inicioDia}&limit=250`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({customers:[]})),
    // Shopify pedidos de hoje aguardando envio
    (() => {
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const hojeISO = hoje.toISOString();
      return fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=open&fulfillment_status=unfulfilled&financial_status=paid&limit=250&created_at_min=${encodeURIComponent(hojeISO)}`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]}));
    })(),
    // Shopify produtos (estoque + imagens) — incluir variantes e imagens
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants,inventory_management`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({products:[]})),
    // Shopify pedidos recentes com fulfillment
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=50&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Melhor Envio saldo
    fetch('https://melhorenvio.com.br/api/v2/me/balance', { headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(r=>r.json()).catch(()=>({})),
    // Melhor Envio - carrinho (pending) e purchases (em trânsito)
    Promise.all([
      fetch('https://melhorenvio.com.br/api/v2/me/cart?limit=100', { headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(r=>r.json()).catch(()=>({})),
      fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100', { headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(async r => {
        const d = await r.json();
        const lastPage = d.last_page || 1;
        const extras = lastPage > 1 ? await Promise.all(
          Array.from({length: lastPage - 1}, (_, i) =>
            fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + (i+2), { headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' } }).then(r=>r.json()).catch(()=>({data:[]}))
          )
        ) : [];
        return { purchases: [...(d.data||[]), ...extras.flatMap(e=>e.data||[])], total_cart: 0 };
      }).catch(()=>({ purchases: [], total_cart: 0 })),
    ]).then(([cart, purchasesResult]) => ({
      cart: cart.data || [],
      purchases: purchasesResult.purchases || [],
      total_cart: cart.total || 0,
    })).catch(()=>({ cart: [], purchases: [], total_cart: 0 })),
  ]);

  // Processar leads
  try {
    leads = leadsResult.leads || [];
    leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
    totalValorLeads = leads.reduce((s, l) => s + (l.carrinho || []).reduce((cs, i) => cs + (i.preco * i.quantidade / 100), 0), 0);
  } catch(e) {}

  // Processar ofertas
  try {
    const ids = ofertasLista.result || [];
    const results = await Promise.all(ids.map(id =>
      fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } })
        .then(r=>r.json()).then(d => {
          if (!d.result) return null;
          let o = d.result;
          while (typeof o === 'string') { try { o = JSON.parse(o); } catch(e) { break; } }
          return (o && o.id) ? o : null;
        }).catch(()=>null)
    ));
    ofertas = results.filter(Boolean).sort((a,b) => new Date(a.dataHora) - new Date(b.dataHora));
  } catch(e) {}

  // Processar vendas Shopify
  try {
    const calc = (orders) => ({
      count: (orders||[]).length,
      valor: (orders||[]).reduce((s,o) => s + parseFloat(o.total_price||0), 0)
    });
    vendas.hoje = calc(ordersHoje.orders);
    vendas.semana = calc(ordersSemana.orders);
    vendas.mes = calc(ordersMes.orders);
    vendas.mesAnt = calc(ordersMesAnt.orders);
    novosClientes = (clientesHoje.customers||[]).length;
    pedidosPendentes = (pedidosPagar.orders||[]).length;
    ticketMedio = vendas.mes.count > 0 ? vendas.mes.valor / vendas.mes.count : 0;

    // Devoluções
    devolucoes = (ordersMes.orders||[]).filter(o => o.refunds && o.refunds.length > 0).length;

    // Top produtos
    const prodContagem = {};
    (ordersMes.orders||[]).forEach(order => {
      (order.line_items||[]).forEach(item => {
        if (!prodContagem[item.title]) prodContagem[item.title] = { count: 0, valor: 0 };
        prodContagem[item.title].count += item.quantity;
        prodContagem[item.title].valor += parseFloat(item.price) * item.quantity;
      });
    });
    // Mapa de imagens por título do produto (busca parcial)
    const produtosShopify = produtosSemEstoque.products || [];
    const getImagem = (nomeOrder) => {
      // Remove variante " - Cor: X" para comparar só o título base
      const nomeBase = nomeOrder.split(' - Cor:')[0].split(' - ')[0].trim();
      // Tenta match exato
      const exato = produtosShopify.find(p => p.title === nomeOrder || p.title === nomeBase);
      if (exato && exato.image) return exato.image.src;
      // Tenta match parcial
      const parcial = produtosShopify.find(p => p.title.includes(nomeBase) || nomeBase.includes(p.title));
      if (parcial && parcial.image) return parcial.image.src;
      return '';
    };

    topProdutos = Object.entries(prodContagem)
      .filter(([nome, dados]) => 
        !nome.toLowerCase().includes('frete') && 
        !nome.toLowerCase().includes('sedex') && 
        !nome.toLowerCase().includes('pac') && 
        nome.length > 5 &&
        dados.valor / dados.count > 10  // filtra produtos com valor muito baixo (pedidos teste)
      )
      .sort((a,b) => b[1].count - a[1].count).slice(0, 5)
      .map(([nome, dados]) => [nome, dados, getImagem(nome)]);

    // Sem estoque
    (produtosSemEstoque.products||[]).forEach(p => {
      (p.variants||[]).forEach(v => {
        if (v.inventory_quantity <= 0 && v.inventory_management === 'shopify') {
          semEstoque.push({ produto: p.title, variante: v.title });
        }
      });
    });
  } catch(e) { console.error('Shopify error:', e.message); }

  // Processar Melhor Envio
  try {
    saldoME = parseFloat(saldoMelhorEnvio.balance || saldoMelhorEnvio?.data?.balance || 0);
    const hojeDate = new Date().toISOString().split('T')[0];
    const cart = etiquetasME.cart || [];
    // Etiquetas hoje = pedidos pagos hoje no Shopify
    etiquetasHoje = vendas.hoje.count || (ordersHoje.orders || []).length;
    // Carrinho = etiquetas não pagas ainda
    cartME = etiquetasME.total_cart || cart.length;
    // Contar por status real dos orders
    const purchases = etiquetasME.purchases || [];
    purchases.forEach(p => {
      (p.orders||[]).forEach(o => {
        if (o.status === 'posted') emTransito++;
        if (o.status === 'released') prontoPostar++;
        if (o.status === 'undelivered') problemaEntrega++;
        if (o.status === 'delivered') entregues++;
        if (o.status === 'canceled') cancelados++;
      });
    });
  } catch(e) { console.error('ME error:', e.message); }

  // Comparativo mês
  const variacaoMes = vendas.mesAnt.valor > 0 ? ((vendas.mes.valor - vendas.mesAnt.valor) / vendas.mesAnt.valor * 100).toFixed(1) : null;
  const variacaoSinal = variacaoMes > 0 ? '▲' : '▼';
  const variacaoCor = variacaoMes > 0 ? '#10b981' : '#ef4444';

  // ===== ABA HOME =====
  const abaHome = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">💰 Vendas Hoje</div><div class="stat-value">R$ ${vendas.hoje.valor.toFixed(2).replace('.',',')}</div><div class="stat-sub">${vendas.hoje.count} pedido${vendas.hoje.count!==1?'s':''}</div></div>
      <div class="stat-card"><div class="stat-label">📅 Esta Semana</div><div class="stat-value">R$ ${vendas.semana.valor.toFixed(2).replace('.',',')}</div><div class="stat-sub">${vendas.semana.count} pedidos</div></div>
      <div class="stat-card"><div class="stat-label">📆 Este Mês</div><div class="stat-value">R$ ${vendas.mes.valor.toFixed(2).replace('.',',')}</div><div class="stat-sub">${variacaoMes !== null ? `<span style="color:${variacaoCor}">${variacaoSinal} ${Math.abs(variacaoMes)}% vs mês ant.</span>` : `${vendas.mes.count} pedidos`}</div></div>
      <div class="stat-card"><div class="stat-label">🎯 Ticket Médio</div><div class="stat-value">R$ ${ticketMedio.toFixed(2).replace('.',',')}</div><div class="stat-sub">${vendas.mes.count} pedidos no mês</div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">📦 Aguardando Envio</div><div class="stat-value" style="color:${pedidosPendentes>0?'#f59e0b':'#10b981'}">${pedidosPendentes}</div><div class="stat-sub">pedidos de hoje</div></div>
      <div class="stat-card"><div class="stat-label">↩️ Devoluções no Mês</div><div class="stat-value" style="color:${devolucoes>0?'#ef4444':'#10b981'}">${devolucoes}</div><div class="stat-sub">pedidos com reembolso</div></div>
      <div class="stat-card"><div class="stat-label">👥 Novos Clientes Hoje</div><div class="stat-value">${novosClientes}</div><div class="stat-sub">cadastros hoje</div></div>
      <div class="stat-card"><div class="stat-label">🛒 Carrinhos Abandonados</div><div class="stat-value">${leads.length}</div><div class="stat-sub">R$ ${totalValorLeads.toFixed(2).replace('.',',')} potencial</div></div>
    </div>

    <div class="section-divider">📦 Melhor Envio</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:12px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">💳 Saldo</div><div class="stat-value" style="font-size:18px;color:${saldoME<50?'#ef4444':'#10b981'}">R$ ${saldoME.toFixed(2).replace('.',',')}</div><div class="stat-sub">${saldoME<50?'⚠️ Baixo!':'disponível'}</div></div>
      <div class="stat-card"><div class="stat-label">📬 Etiquetas Hoje</div><div class="stat-value" style="font-size:22px">${etiquetasHoje}</div><div class="stat-sub">vendas de hoje</div></div>
      <div class="stat-card"><div class="stat-label">🛒 Pra Gerar</div><div class="stat-value" style="font-size:22px;color:#9333ea">${cartME}</div><div class="stat-sub">no carrinho ME</div></div>
      <div class="stat-card" style="border-color:#fef3c7"><div class="stat-label">📦 Pronto p/ Postar</div><div class="stat-value" style="font-size:22px;color:#f59e0b">${prontoPostar}</div><div class="stat-sub">geradas, aguardando postagem</div></div>
      <div class="stat-card" style="border-color:#dbeafe"><div class="stat-label">🚚 Em Trânsito</div><div class="stat-value" style="font-size:22px;color:#2563eb">${emTransito}</div><div class="stat-sub">postados</div></div>
      <div class="stat-card" style="border-color:#dcfce7"><div class="stat-label">✅ Entregues</div><div class="stat-value" style="font-size:22px;color:#16a34a">${entregues}</div><div class="stat-sub">total entregue</div></div>
      <div class="stat-card" style="${problemaEntrega>0?'border-color:#fecaca;background:#fef2f2':''}"><div class="stat-label">⚠️ Não Entregue</div><div class="stat-value" style="font-size:22px;color:${problemaEntrega>0?'#ef4444':'#6b7280'}">${problemaEntrega}</div><div class="stat-sub">${cancelados} cancelados</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="stat-card">
        <div class="stat-label" style="margin-bottom:16px">🏆 Top Produtos do Mês</div>
        ${topProdutos.length === 0 ? '<div style="color:#9ca3af;font-size:13px">Nenhum pedido este mês</div>' : topProdutos.map(([nome, dados, img], i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6">
            ${img ? `<img src="${img}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">` : `<span style="font-size:18px;width:40px;text-align:center">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>`}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome.substring(0,35)}${nome.length>35?'...':''}</div>
              <div style="font-size:12px;color:#6b7280">${dados.count} unid. — R$ ${dados.valor.toFixed(2).replace('.',',')}</div>
            </div>
          </div>`).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="stat-card">
          <div class="stat-label" style="margin-bottom:12px">⚠️ Produtos Sem Estoque</div>
          ${semEstoque.length === 0
            ? '<div style="color:#10b981;font-size:13px;font-weight:600">✅ Tudo em estoque!</div>'
            : `<div style="max-height:120px;overflow-y:auto">${semEstoque.slice(0,10).map(p => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #f3f4f6;color:#dc2626">${p.produto}${p.variante!=='Default Title'?' — '+p.variante:''}</div>`).join('')}${semEstoque.length>10?`<div style="font-size:11px;color:#9ca3af;margin-top:4px">+${semEstoque.length-10} outros</div>`:''}</div>`}
        </div>

        <div class="stat-card">
          <div class="stat-label" style="margin-bottom:12px">📣 Grupos VIP WhatsApp</div>
          <div style="font-size:32px;font-weight:700">17 grupos</div>
          <div id="grupos-membros" style="margin-top:8px;font-size:13px;color:#6b7280">Carregando membros...</div>
          <button onclick="mudarAba('ofertas')" style="margin-top:12px;padding:8px 16px;background:#f0fff4;color:#16a34a;border:1px solid #16a34a;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">Agendar oferta →</button>
        </div>
      </div>
    </div>`;

  // ===== ABA CARRINHOS =====
  const agora = new Date();
  const badgeMap = {
    'email': '<span class="badge" style="background:#f3f4f6;color:#374151">⚪ Só email</span>',
    'dados_parciais': '<span class="badge" style="background:#fef3c7;color:#92400e">🟡 Dados parciais</span>',
    'endereco': '<span class="badge" style="background:#dbeafe;color:#1e40af">🔵 Endereço</span>',
    'pagamento_pendente': '<span class="badge" style="background:#fef3c7;color:#92400e">⏳ Aguardando</span>',
    'abandonou_pagamento': '<span class="badge" style="background:#fee2e2;color:#991b1b">🔴 Abandonou</span>'
  };
  const abandonouCount = leads.filter(l => {
    let e = l.estagio;
    if (e === 'pagamento_pendente' && (l.atualizado_em || l.criado_em)) {
      if ((agora - new Date(l.atualizado_em || l.criado_em)) / 60000 >= 10) e = 'abandonou_pagamento';
    }
    return e === 'abandonou_pagamento';
  }).length;

  const leadsRows = leads.map(lead => {
    const valor = (lead.carrinho || []).reduce((s, i) => s + (i.preco * i.quantidade / 100), 0);
    const tel = (lead.telefone || '').replace(/\D/g, '');
    const produtos = (lead.carrinho || []).map(i => `<div>• ${i.nome}${i.cor && i.cor !== 'Default Title' ? ' — ' + i.cor : ''} (x${i.quantidade})</div>`).join('') || '<div style="color:#9ca3af">Sem produtos</div>';
    const data = new Date(new Date(lead.criado_em).getTime() - 3 * 60 * 60 * 1000);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const msg = encodeURIComponent(`Olá ${(lead.nome||'').split(' ')[0]}! 😊 Vi que você estava olhando nossos relógios na Kcique. Posso te ajudar?`);
    let estagio = lead.estagio;
    if (estagio === 'pagamento_pendente' && (lead.atualizado_em || lead.criado_em)) {
      if ((agora - new Date(lead.atualizado_em || lead.criado_em)) / 60000 >= 10) estagio = 'abandonou_pagamento';
    }
    return `<tr>
      <td><div style="font-weight:600">${lead.nome||'—'}</div><div style="font-size:12px;color:#6b7280">${lead.email}</div><div style="font-size:12px;color:#6b7280">${lead.telefone||'—'}</div></td>
      <td>${badgeMap[estagio]||`<span class="badge">${estagio}</span>`}</td>
      <td style="font-size:13px">${produtos}</td>
      <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong>${lead.frete?`<br><span style="font-size:11px;color:#6b7280">+ ${lead.frete.nome}</span>`:''}</td>
      <td style="font-size:12px;color:#9ca3af;white-space:nowrap">${dataStr}</td>
      <td style="white-space:nowrap">
        ${tel?`<a href="https://wa.me/55${tel}?text=${msg}" target="_blank" class="btn-wpp">💬 WPP</a>`:''}
        <button onclick="delLead(this,'${lead.id}')" class="btn-del">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const abaCarrinhos = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div class="stat-card"><div class="stat-label">Total de Leads</div><div class="stat-value">${leads.length}</div></div>
      <div class="stat-card"><div class="stat-label">Abandonaram Pagamento</div><div class="stat-value">${abandonouCount}</div></div>
      <div class="stat-card"><div class="stat-label">Valor Potencial</div><div class="stat-value">R$ ${totalValorLeads.toFixed(2).replace('.',',')}</div></div>
    </div>
    ${leads.length === 0 ? '<div class="vazio">Nenhum carrinho abandonado ainda! 🎉</div>' : `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Estágio</th><th>Produtos</th><th>Valor</th><th>Data</th><th>Ação</th></tr></thead><tbody>${leadsRows}</tbody></table></div>`}`;

  // ===== ABA OFERTAS =====
  const GRUPOS_INFO = [
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
  const gruposCheckboxes = GRUPOS_INFO.map(g => `<label class="grupo-label"><input type="checkbox" value="${g.id}" checked> ${g.nome}</label>`).join('');
  const ofertasRows = ofertas.map(o => {
    const dataStr = new Date(o.dataHora).toLocaleDateString('pt-BR') + ' ' + new Date(o.dataHora).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    const sc = o.status==='enviada'?'#10b981':o.status==='erro'?'#ef4444':'#f59e0b';
    const sl = o.status==='enviada'?'✅ Enviada':o.status==='erro'?'❌ Erro':'⏳ Agendada';
    return `<tr>
      <td>${o.imagem?`<img src="${o.imagem}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;display:block;margin-bottom:4px">`:''}
        <div style="font-weight:600;font-size:13px">${(o.texto||'').substring(0,60)}${o.texto&&o.texto.length>60?'...':''}</div>
        ${o.link?`<a href="${o.link}" target="_blank" style="font-size:11px;color:#2563eb">${o.link.substring(0,40)}</a>`:''}
      </td>
      <td style="white-space:nowrap;font-size:13px">${dataStr}</td>
      <td style="font-size:13px">${o.grupos==='todos'?'Todos (#1-#17)':o.grupos}</td>
      <td><span style="background:${sc}20;color:${sc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${sl}</span></td>
      <td><button onclick="delOferta(this,'${o.id}')" class="btn-del">🗑</button></td>
    </tr>`;
  }).join('');

  const abaOfertas = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${ofertas.length}</div></div>
      <div class="stat-card"><div class="stat-label">Agendadas</div><div class="stat-value">${ofertas.filter(o=>o.status==='agendada').length}</div></div>
      <div class="stat-card"><div class="stat-label">Enviadas</div><div class="stat-value">${ofertas.filter(o=>o.status==='enviada').length}</div></div>
    </div>
    <div class="form-card">
      <div class="form-title">➕ Agendar Nova Oferta</div>
      <div class="field"><label>Texto da mensagem</label><textarea id="f-texto" rows="4" placeholder="🔥 OFERTA RELÂMPAGO!&#10;&#10;Relógio X por R$ 199,90"></textarea></div>
      <div class="row-2">
        <div class="field"><label>URL de imagem ou vídeo (opcional)</label><input type="url" id="f-imagem" placeholder="https://cdn.shopify.com/... ou .mp4"></div>
        <div class="field"><label>Link do produto (opcional)</label><input type="url" id="f-link" placeholder="https://kcique.com.br/..."></div>
      </div>
      <div class="field"><label>Data e hora (Brasília)</label><input type="datetime-local" id="f-data"></div>
      <div class="field">
        <label>Grupos</label>
        <div style="margin-bottom:8px"><label style="cursor:pointer;font-size:13px"><input type="checkbox" id="sel-todos" onchange="toggleTodos(this)" checked> Selecionar todos</label></div>
        <div class="grupos-wrap" id="grupos-wrap">${gruposCheckboxes}</div>
      </div>
      <button class="btn-green" onclick="salvarOferta()">📅 Agendar Oferta</button>
      <div id="form-msg" style="margin-top:10px;font-size:13px"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button onclick="limparOfertas()" style="padding:8px 16px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🗑 Limpar todas enviadas</button>
    </div>
    ${ofertas.length === 0 ? '<div class="vazio">Nenhuma oferta agendada ainda!</div>' : `<div class="table-wrap"><table id="tab-ofertas"><thead><tr><th>Oferta</th><th>Data/Hora</th><th>Grupos</th><th>Status</th><th>Ação</th></tr></thead><tbody>${ofertasRows}</tbody></table></div>`}`;

  // ===== ABA PEDIDOS =====
  const pedidosList = (pedidosRecentes.orders || []);

  // Mapa tracking -> meOrderId das purchases já carregadas
  const trackingToMeId = {};
  (etiquetasME.purchases || []).forEach(p => {
    (p.orders || []).forEach(o => {
      if (o.tracking && o.id) trackingToMeId[o.tracking] = o.id;
    });
  });

  const getImgPedido = (titulo, varianteTitulo) => {
    if (!titulo) return '';
    const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();

    // Extrair nome base — remover tudo após " - Cor:", " - ", etc
    const tituloBase = titulo.split(' - Cor:')[0].trim(); // título completo antes da cor
    const baseNorm = norm(tituloBase);

    // Extrair código do modelo (ex: "GA-1017", "GBX-100", "GXW-56")
    const modeloMatch = titulo.match(/[A-Z]{1,5}-?\d{3,5}[A-Z0-9]*/i);
    const modelo = modeloMatch ? modeloMatch[0].toUpperCase() : '';

    const prds = produtosSemEstoque.products || [];
    let melhor = null, melhorPontos = 0;

    for (const p of prds) {
      const pt = norm(p.title);
      let pontos = 0;

      // Match exato do base
      if (pt === baseNorm) { pontos = 200; }
      // Match do código do modelo (mais confiável)
      else if (modelo && p.title.toUpperCase().includes(modelo)) { pontos = 100; }
      // Match parcial por palavras — exige mínimo 50% das palavras
      else {
        const palavras = baseNorm.split(' ').filter(w => w.length > 2);
        const matches = palavras.filter(w => pt.includes(w)).length;
        if (palavras.length > 0 && matches / palavras.length >= 0.5) {
          pontos = Math.round((matches / palavras.length) * 40);
        }
      }

      if (pontos > melhorPontos) { melhorPontos = pontos; melhor = p; }
    }

    if (!melhor || melhorPontos < 20) return '';

    // Tentar imagem da variante pela cor
    if (varianteTitulo && varianteTitulo !== 'Default Title') {
      const normV = norm(varianteTitulo);
      const v = (melhor.variants||[]).find(v => norm(v.title) === normV || norm(v.title).includes(normV) || normV.includes(norm(v.title)));
      if (v && v.featured_image && v.featured_image.src) return v.featured_image.src;
      if (v && v.image_id) {
        const img = (melhor.images||[]).find(i => i.id === v.image_id);
        if (img) return img.src;
      }
    }

    // Tentar encontrar imagem pela cor no título (ex: "Preto pulseira verde")
    const corMatch = titulo.match(/Cor:\s*(.+?)(?:\s*-|$)/i);
    if (corMatch) {
      const cor = norm(corMatch[1]);
      const v = (melhor.variants||[]).find(v => {
        const vt = norm(v.title);
        return cor.split(' ').some(w => w.length > 2 && vt.includes(w));
      });
      if (v && v.featured_image && v.featured_image.src) return v.featured_image.src;
      if (v && v.image_id) {
        const img = (melhor.images||[]).find(i => i.id === v.image_id);
        if (img) return img.src;
      }
    }

    // Fallback: primeira imagem do produto
    return melhor.image ? melhor.image.src : '';
  };

  // Construir variantImgMap para a aba pedidos (mesmo do pedidos-json)
  const variantImgMap = {};
  (produtosSemEstoque.products || []).forEach(p => {
    (p.variants||[]).forEach(v => {
      if (v.featured_image && v.featured_image.src) variantImgMap[String(v.id)] = v.featured_image.src;
      else if (v.image_id) {
        const img = (p.images||[]).find(i => i.id === v.image_id);
        if (img) variantImgMap[String(v.id)] = img.src;
      }
      if (!variantImgMap[String(v.id)] && p.image) variantImgMap[String(v.id)] = p.image.src;
    });
  });

  const pedidosFulfilled = pedidosList.filter(o => o.fulfillment_status === 'fulfilled').length;
  const pedidosPagosNaoEnviados = pedidosList.filter(o => o.financial_status === 'paid' && !o.fulfillment_status).length;

  const pedidosCards = pedidosList.map(order => {
    const data = new Date(new Date(order.created_at).getTime() - 3*60*60*1000);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    const tel = ((order.shipping_address && order.shipping_address.phone) || order.phone || (order.billing_address && order.billing_address.phone) || '').replace(/[^0-9]/g,'');
    const rastreios = (order.fulfillments||[]).flatMap(f => f.tracking_numbers||[]);
    const nome = (order.customer ? ((order.customer.first_name||'') + ' ' + (order.customer.last_name||'')).trim() : '') || 'Cliente';
    const addr = order.shipping_address;
    const endStr = addr ? (addr.address1||'') + (addr.address2 ? ' '+addr.address2 : '') + ', ' + (addr.city||'') + '/' + (addr.province_code||'') + ' — CEP ' + (addr.zip||'') : '—';
    const financial = order.financial_status;
    const fulfillment = order.fulfillment_status;
    const notaPedido = order.note || '';
    const origemMatch = notaPedido.match(/Origem: ([^|\n]+)/);
    const origem = origemMatch ? origemMatch[1].trim() : '—';

    let statusColor = '#f59e0b', statusLabel = 'Pago';
    if (fulfillment === 'fulfilled') { statusColor = '#16a34a'; statusLabel = '✅ Enviado'; }
    else if (financial === 'refunded') { statusColor = '#ef4444'; statusLabel = '↩️ Reembolso'; }
    else if (financial === 'pending') { statusColor = '#9ca3af'; statusLabel = 'Pendente'; }
    else { statusLabel = '💳 Pago'; }

    const msgRastreio = rastreios.length > 0
      ? encodeURIComponent('Olá ' + nome.split(' ')[0] + '! 😊 Boa notícia! Seu pedido já está em preparação para envio! 🚀\n\n📦 Rastreie aqui: https://rastreamento.correios.com.br/app/index.php?objetos=' + rastreios[0] + '\n\nQualquer dúvida estamos aqui! — Kcique Relógios ⌚')
      : '';
    const msgWpp = encodeURIComponent('Olá ' + nome.split(' ')[0] + '! Aqui é da Kcique Relógios. Posso te ajudar?');

    const produtosHtml = (order.line_items||[]).map(item => {
      const img = item.image?.src
        || (String(item.variant_id||'') && variantImgMap[String(item.variant_id||'')])
        || getImgPedido(item.title, item.variant_title);
      const varLabel = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
      return '<div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid #f3f4f6">'
        + (img
          ? '<img src="' + img + '" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1)" onclick="abrirFoto(this.src)">'
          : '<div style="width:90px;height:90px;background:#f3f4f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:36px">⌚</div>')
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:700;line-height:1.4">' + item.title + '</div>'
        + (varLabel ? '<div style="font-size:12px;color:#6b7280;margin-top:4px;background:#f3f4f6;display:inline-block;padding:2px 8px;border-radius:20px">' + varLabel + '</div>' : '')
        + '<div style="font-size:13px;color:#374151;margin-top:6px;font-weight:600">x' + item.quantity + ' &nbsp;·&nbsp; R$ ' + parseFloat(item.price||0).toFixed(2).replace('.',',') + ' cada</div>'
        + '<div style="font-size:13px;color:#16a34a;font-weight:700;margin-top:2px">Total: R$ ' + (parseFloat(item.price||0) * (item.quantity||1)).toFixed(2).replace('.',',') + '</div>'
        + '</div></div>';
    }).join('');

    return '<div style="background:#fff;border-radius:12px;border:1px solid #e8eaf0;margin-bottom:12px;overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fafafa;cursor:pointer;border-bottom:1px solid #f3f4f6" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">'
        + '<div style="display:flex;align-items:center;gap:12px">'
          + '<span style="font-weight:700;font-size:15px">#' + order.order_number + '</span>'
          + '<span style="font-size:12px;color:#9ca3af">' + dataStr + '</span>'
          + '<span style="font-size:13px;color:#1a1a2e;font-weight:500">' + nome + '</span>'
          + '<span style="background:' + statusColor + '20;color:' + statusColor + ';padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">' + statusLabel + '</span>'
          + (rastreios.length > 0 ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:6px;font-size:11px">📦 ' + rastreios[0] + '</span>' : '')
          + (origem !== '—' ? '<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">📍 ' + origem + '</span>' : '')
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px">'
          + '<span style="font-weight:700;font-size:16px">R$ ' + parseFloat(order.total_price||0).toFixed(2).replace('.',',') + '</span>'
          + '<span style="color:#9ca3af;font-size:12px">▼</span>'
        + '</div>'
      + '</div>'
      + '<div id="p' + order.id + '" style="display:none;padding:20px">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px">'
          + '<div><div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">👤 Cliente</div>'
            + '<div style="font-weight:600">' + nome + '</div>'
            + '<div style="font-size:13px;color:#6b7280">' + (order.email||'') + '</div>'
            + '<div style="font-size:13px;color:#6b7280">' + (tel ? '+55 '+tel : '—') + '</div>'
          + '</div>'
          + '<div><div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">📍 Entrega</div>'
            + '<div style="font-size:13px;line-height:1.7">' + endStr + '</div>'
          + '</div>'
        + '</div>'
        + '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:8px">🛍 Produtos</div>' + produtosHtml + '</div>'
        + (rastreios.length > 0
          ? '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:8px">📦 Rastreio</div>'
            + rastreios.map(r => '<a href="https://www.melhorrastreio.com.br/rastreio/'+r+'" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#dbeafe;color:#1e40af;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;margin-right:6px">'+r+' →</a>').join('')
            + '</div>'
          : '<div style="margin-bottom:16px;padding:10px 14px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">⚠️ Sem código de rastreio ainda</div>')
        + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
          + (tel ? '<a href="https://wa.me/55'+tel+'?text='+msgWpp+'" target="_blank" class="btn-wpp">💬 WhatsApp</a>' : '')
          + (tel && msgRastreio && rastreios.length > 0
            ? '<button onclick="enviarRastreioCliente(this,\'' + order.id + '\',\'' + rastreios[0] + '\',\'55' + tel + '\',\'' + msgRastreio + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">' + (order.fulfillment_status === 'fulfilled' ? '✅ Rastreio Enviado' : '📦 Enviar Rastreio') + '</button>'
            : '')
          + '<button onclick="enviarFornecedor(\'' + nome.replace(/'/g,"\'") + '\',\'' + (rastreios[0]||'') + '\',\'' + getImgPedido((order.line_items&&order.line_items[0]&&order.line_items[0].title)||'').replace(/'/g,"\'") + '\',\'' + (trackingToMeId[rastreios[0]]||'') + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">🚀 Fornecedor</button>'
          + (order.fulfillment_status !== 'fulfilled'
            ? '<button id="btn-fulfil-' + order.id + '" onclick="marcarEnviado(' + JSON.stringify(String(order.id)) + ',' + JSON.stringify(rastreios[0]||'') + ',' + JSON.stringify(order.email||'') + ')" style="display:inline-flex;align-items:center;gap:4px;padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">✅ Marcar Enviado no Shopify</button>'
            : '<span style="padding:8px 14px;background:#f0fdf4;color:#16a34a;border-radius:6px;font-size:13px;font-weight:600">✅ Já enviado no Shopify</span>')
        + '</div>'
      + '</div>'
    + '</div>'
    + '</div>';
  }).join('');

  const abaPedidos = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Últimos 50 Pedidos</div><div class="stat-value">${pedidosList.length}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Enviados</div><div class="stat-value" style="color:#16a34a">${pedidosFulfilled}</div></div>
      <div class="stat-card"><div class="stat-label">⏳ Pagos Não Enviados</div><div class="stat-value" style="color:#f59e0b">${pedidosPagosNaoEnviados}</div></div>
    </div>
    <div>${pedidosCards}</div>`;

  // Carregar cupons
  let cupons = [];
  try {
    const cuponsResp = await fetch(`https://infinitepay-backend.vercel.app/api/cupons?action=listar&secret=${secret}`);
    const cuponsData = await cuponsResp.json();
    cupons = cuponsData.cupons || [];
  } catch(e) {}

  const tipoLabel = { percentual: '% Desconto', fixo: 'R$ Fixo', frete_gratis: 'Frete Grátis', percentual_frete: '% + Frete Grátis' };
  const tipoColor = { percentual: '#2563eb', fixo: '#16a34a', frete_gratis: '#9333ea', percentual_frete: '#f59e0b' };

  const cuponsRows = cupons.map(c => {
    const validade = c.validade ? new Date(c.validade).toLocaleDateString('pt-BR') : 'Sem validade';
    const expirado = c.validade && new Date() > new Date(c.validade);
    const usos = c.limiteUsos ? (c.usosAtuais || 0) + '/' + c.limiteUsos : 'Ilimitado';
    return `<tr>
      <td><span style="font-family:monospace;font-size:15px;font-weight:700;background:#f3f4f6;padding:4px 10px;border-radius:6px">${c.codigo}</span></td>
      <td><span style="background:${tipoColor[c.tipo]}20;color:${tipoColor[c.tipo]};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${tipoLabel[c.tipo]||c.tipo}</span></td>
      <td style="font-size:13px">${c.tipo === 'frete_gratis' ? '—' : (c.tipo === 'percentual' || c.tipo === 'percentual_frete' ? c.valor + '%' : 'R$ ' + (c.valor||0).toFixed(2).replace('.',','))}</td>
      <td style="font-size:13px;${expirado?'color:#ef4444':''}">${validade}${expirado?' ⚠️':''}</td>
      <td style="font-size:13px">${usos}</td>
      <td style="font-size:13px">${c.produto === 'todos' ? 'Todos' : c.produto}${c.qtdMinima ? '<br><span style="font-size:11px;color:#6b7280">Mín: ' + c.qtdMinima + ' itens</span>' : ''}</td>
      <td>
        <button onclick="toggleCupom('${c.id}')" style="padding:4px 10px;background:${c.ativo?'#dcfce7':'#fee2e2'};color:${c.ativo?'#16a34a':'#dc2626'};border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">${c.ativo?'✅ Ativo':'❌ Inativo'}</button>
        <button onclick="deletarCupom('${c.id}','${c.codigo}')" style="margin-left:6px;padding:4px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:12px;cursor:pointer">🗑</button>
      </td>
    </tr>`;
  }).join('');

  const abaCupons = `
    <div class="form-card">
      <div class="form-title">➕ Criar Novo Cupom</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="field"><label>Código do Cupom</label><input type="text" id="c-codigo" placeholder="ex: KCIQUE10" style="text-transform:uppercase"></div>
        <div class="field">
          <label>Tipo de Desconto</label>
          <select id="c-tipo" onchange="atualizarCampoValor()" style="width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
            <option value="percentual">% de Desconto</option>
            <option value="fixo">Valor Fixo (R$)</option>
            <option value="frete_gratis">Frete Grátis</option>
            <option value="percentual_frete">% Desconto + Frete Grátis</option>
          </select>
        </div>
        <div class="field" id="campo-valor"><label>Valor do Desconto</label><input type="number" id="c-valor" placeholder="ex: 10" min="0" step="0.01"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
        <div class="field"><label>Validade (opcional)</label><input type="date" id="c-validade"></div>
        <div class="field"><label>Limite de Usos (opcional)</label><input type="number" id="c-limite" placeholder="Ilimitado" min="1"></div>
        <div class="field"><label>Qtd. Mínima de Itens</label><input type="number" id="c-qtd-minima" placeholder="Ex: 3" min="1"></div>
        <div class="field"><label>Produto (palavra-chave)</label><input type="text" id="c-produto" placeholder="Ex: G-SHOCK ou deixe vazio"></div>
      </div>
      <button class="btn-green" onclick="salvarCupom()">💾 Criar Cupom</button>
      <div id="cupom-msg" style="margin-top:10px;font-size:13px"></div>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button onclick='limparCupons()' style='padding:8px 16px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer'>🗑 Limpar todos os cupons</button>
    </div>
    ${cupons.length === 0
      ? '<div class="vazio">Nenhum cupom cadastrado ainda!</div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Validade</th><th>Usos</th><th>Produto</th><th>Ações</th></tr></thead>
          <tbody>${cuponsRows}</tbody>
        </table></div>`
    }`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kcique Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f8fa;color:#1a1a2e;display:flex;min-height:100vh}
/* Sidebar */
.sidebar{width:220px;background:#111;color:#fff;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:10;transition:width .2s}
.logo{padding:20px;font-size:15px;font-weight:700;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px}
.nav{flex:1;padding:12px 0;overflow-y:auto}
.nav-item{display:flex;align-items:center;gap:10px;padding:11px 20px;color:#999;font-size:13px;font-weight:500;cursor:pointer;border:none;background:none;width:100%;text-align:left;border-left:3px solid transparent;transition:all .15s}
.nav-item:hover{background:#1a1a1a;color:#fff}
.nav-item.active{background:#1a1a1a;color:#fff;border-left-color:#25d366}
.nav-icon{font-size:17px;width:22px;text-align:center;flex-shrink:0}
.nav-label{white-space:nowrap}
.sidebar-foot{padding:14px 20px;font-size:11px;color:#444;border-top:1px solid #222}
/* Main */
.main{margin-left:220px;flex:1;min-height:100vh;display:flex;flex-direction:column}
.topbar{background:#fff;border-bottom:1px solid #e8eaf0;padding:14px 28px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:5}
.topbar-title{font-size:16px;font-weight:700;flex:1}
.content{padding:28px;flex:1}
/* Cards */
.card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.stat-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:18px}
.stat-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.stat-value{font-size:24px;font-weight:700;color:#111}
.stat-sub{font-size:12px;color:#9ca3af;margin-top:3px}
/* Table */
.tbl-wrap{overflow-x:auto;border-radius:12px;border:1px solid #e8eaf0}
table{width:100%;border-collapse:collapse;background:#fff}
th{background:#f9f9fb;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e8eaf0;white-space:nowrap}
td{padding:11px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#fafafa}
/* Badges */
.badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:inherit}
.btn-primary{background:#25d366;color:#fff}.btn-primary:hover{background:#1da851}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}.btn-ghost:hover{background:#e5e7eb}
.btn-danger{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}.btn-danger:hover{background:#fee2e2}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-del{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}
/* Forms */
.form-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px;margin-bottom:20px}
.form-title{font-size:14px;font-weight:700;margin-bottom:14px;color:#111}
.field{margin-bottom:12px}
.field label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px}
.field input,.field textarea,.field select{width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;outline:none;transition:border .15s}
.field input:focus,.field textarea:focus,.field select:focus{border-color:#25d366}
.field textarea{resize:vertical;min-height:72px}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
/* Misc */
.section-title{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e8eaf0}
.vazio{text-align:center;padding:48px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}
.chip{display:inline-block;padding:2px 7px;background:#f3f4f6;border-radius:4px;font-size:11px;color:#374151;margin:1px}
.loading-box{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;gap:12px;color:#9ca3af;font-size:13px}
.spin{width:28px;height:28px;border:3px solid #e8eaf0;border-top-color:#25d366;border-radius:50%;animation:spin .6s linear infinite}
.refresh-btn{background:#f3f4f6;border:1px solid #e8eaf0;border-radius:8px;padding:7px 14px;font-size:12px;color:#374151;cursor:pointer}
.cache-bar{font-size:11px;color:#9ca3af;text-align:right;margin-bottom:8px}
.cache-bar button{background:none;border:none;color:#2563eb;cursor:pointer;font-size:11px;padding:0}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){
  .sidebar{width:56px}.nav-label,.logo span,.sidebar-foot{display:none}
  .nav-item{padding:13px;justify-content:center}.main{margin-left:56px}
  .stat-grid{grid-template-columns:1fr 1fr}.content{padding:16px}.row-2,.row-3{grid-template-columns:1fr}
}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="logo">⌚ <span>Kcique Admin</span></div>
  <nav class="nav" id="nav">
    <button class="nav-item active" data-aba="home"><span class="nav-icon">📊</span><span class="nav-label">Visão Geral</span></button>
    <button class="nav-item" data-aba="relatorios"><span class="nav-icon">📑</span><span class="nav-label">Relatórios</span></button>
    <button class="nav-item" data-aba="carrinhos"><span class="nav-icon">🛒</span><span class="nav-label">Carrinhos</span></button>
    <button class="nav-item" data-aba="ofertas"><span class="nav-icon">📣</span><span class="nav-label">Ofertas</span></button>
    <button class="nav-item" data-aba="pedidos"><span class="nav-icon">📦</span><span class="nav-label">Pedidos</span></button>
    <button class="nav-item" data-aba="pedido-manual"><span class="nav-icon">🧾</span><span class="nav-label">Criar Pedido</span></button>
    <button class="nav-item" data-aba="cupons"><span class="nav-icon">🎟</span><span class="nav-label">Cupons</span></button>
    <button class="nav-item" data-aba="grupos"><span class="nav-icon">📲</span><span class="nav-label">Grupos VIP</span></button>
    <button class="nav-item" data-aba="bundle"><span class="nav-icon">🎁</span><span class="nav-label">Bundle</span></button>
    <button class="nav-item" data-aba="recuperacao"><span class="nav-icon">💬</span><span class="nav-label">Recuperação</span></button>
    <button class="nav-item" data-aba="roleta"><span class="nav-icon">🎡</span><span class="nav-label">Roleta</span></button>
    <button class="nav-item" data-aba="atendimento"><span class="nav-icon">🎧</span><span class="nav-label">Atendimento</span></button>
    <button class="nav-item" data-aba="inbox"><span class="nav-icon">📱</span><span class="nav-label">Inbox</span></button>
  </nav>
  <div class="sidebar-foot">Kcique © 2026</div>
</aside>

<div class="main">
  <div class="topbar">
    <span class="topbar-title" id="topbar-title">📊 Visão Geral</span>
    <button class="refresh-btn" id="btn-refresh">↻ Atualizar</button>
  </div>
  <div class="content" id="content">
    <div class="loading-box"><div class="spin"></div>Carregando...</div>
  </div>
</div>

<script>
const S = '${secret}';
const API = '';
const TITLES = {home:'📊 Visão Geral',relatorios:'📑 Relatórios',carrinhos:'🛒 Carrinhos',ofertas:'📣 Ofertas WhatsApp',pedidos:'📦 Pedidos','pedido-manual':'🧾 Criar Pedido (venda WhatsApp)',cupons:'🎟 Cupons',grupos:'📲 Grupos VIP',bundle:'🎁 Bundle',recuperacao:'💬 Recuperação de Carrinhos',atendimento:'🎧 Atendimento',inbox:'📱 Inbox — Conversas'};
const GRUPOS_NOMES = ['#1','#2','#3','#4','#5','#6','#7','#8','#9','#10','#11','#12','#13','#14','#15','#16','#17'];
const fmt = v => 'R$ '+(v||0).toFixed(2).replace('.',',');
const fmtN = v => new Intl.NumberFormat('pt-BR').format(v||0);
const fmtDate = d => d ? new Date(d).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
const ct = () => document.getElementById('content');
const loading = () => ct().innerHTML = '<div class="loading-box"><div class="spin"></div>Carregando...</div>';
const errMsg = m => ct().innerHTML = '<div class="vazio">⚠️ '+m+'</div>';
const get = id => document.getElementById(id);
const val = id => (get(id)||{}).value || '';

var currentAba = 'home';
var _leads = [], _ofertas = [], _produtos = [], _selecionados = [], _desconto = 50;

// NAV
document.getElementById('nav').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-aba]');
  if (!btn) return;
  var aba = btn.getAttribute('data-aba');
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('topbar-title').textContent = TITLES[aba] || aba;
  currentAba = aba;
  renderAba(aba);
});

document.getElementById('btn-refresh').addEventListener('click', function() {
  renderAba(currentAba, true);
});

function renderAba(aba, force) {
  var fns = {home:renderHome, relatorios:renderRelatorios, carrinhos:renderCarrinhos, ofertas:renderOfertas, pedidos:renderPedidos, 'pedido-manual':renderPedidoManual, cupons:renderCupons, grupos:renderGrupos, bundle:renderBundle, recuperacao:renderRecuperacao, roleta:renderRoleta, atendimento:renderAtendimento,inbox:renderInbox};
  if (fns[aba]) fns[aba](force);
}

// ===== HOME =====
var _homeCache = null;
async function renderHome(force) {
  if (_homeCache && !force) { renderHomeHtml(_homeCache); return; }
  loading();
  try {
    var [d, presenca, grupos, ofertasData] = await Promise.all([
      fetch(API+'/api/admin?secret='+S+'&action=dashboard-home'+(force?'&refresh=1':'')).then(r=>r.json()),
      fetch(API+'/api/checkout?action=contar').then(r=>r.json()).catch(function(){return {ativos:0,totalDia:0};}),
      fetch(API+'/api/admin?secret='+S+'&action=grupos-vip-dashboard').then(r=>r.json()).catch(function(){return {};}),
      fetch(API+'/api/ofertas?action=listar-json&secret='+S).then(r=>r.json()).catch(function(){return {ofertas:[]};})
    ]);
    d.presenca = presenca;
    d.gruposVip = { total: grupos.totalMembros||0, entradasHoje: grupos.entradasHoje||0, grupoAtivo: grupos.grupoAtivo||{} };

    // Processar ofertas — hoje e amanhã
    var agora = new Date();
    var hoje = agora.toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'});
    var amanha = new Date(agora.getTime() + 86400000).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'});
    var ofertas = ofertasData.ofertas || [];
    var ofertasHoje = ofertas.filter(function(o){
      if (o.status === 'enviada') return false;
      var d = new Date(o.dataHora).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'});
      return d === hoje;
    });
    var ofertasAmanha = ofertas.filter(function(o){
      if (o.status === 'enviada') return false;
      var d = new Date(o.dataHora).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'});
      return d === amanha;
    });
    d.ofertasHoje = ofertasHoje.length;
    d.ofertasAmanha = ofertasAmanha.length;

    _homeCache = d;
    renderHomeHtml(d);
  } catch(e) { errMsg('Erro: '+e.message); }
}
function renderHomeHtml(d) {
  var v = d.vendas||{}, me = d.melhorEnvio||{}, lds = d.leads||{}, top = d.topProdutos||[], pags = d.pagamentos||[], ults = d.ultimosPedidos||[];
  var html = '';
  if (d.fromCache) html += '<div class="cache-bar">⚡ Dados em cache <button onclick="renderHome(true)">↻ Atualizar</button></div>';

  // Widget presença
  var pres = d.presenca || {};
  if (pres.ativos !== undefined) {
    html += '<div style="display:flex;gap:10px;margin-bottom:16px">';
    html += '<div style="flex:1;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px">';
    html += '<div style="width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2);animation:pulse 2s infinite"></div>';
    html += '<div><div id="pres-ativos" style="font-size:22px;font-weight:800;color:#16a34a">'+pres.ativos+'</div><div style="font-size:12px;color:#166534;font-weight:500">pessoas no checkout agora</div></div>';
    html += '</div>';
    html += '<div style="position:relative;flex:1;background:#f8faff;border:1px solid #dbeafe;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px">';
    html += '<div style="font-size:22px">🛒</div>';
    html += '<div><div id="pres-total" style="font-size:22px;font-weight:800;color:#1d4ed8">'+pres.totalDia+'</div><div style="font-size:12px;color:#1e40af;font-weight:500">acessos ao checkout hoje</div></div>';
    html += '</div>';
    html += '</div>';
    html += '<style>@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,.2)}50%{box-shadow:0 0 0 6px rgba(34,197,94,.1)}}</style>';
    html += '<div style="text-align:right;font-size:10px;color:#9ca3af;margin-top:-4px;margin-bottom:8px">🔄 Atualiza automaticamente a cada 30s</div>';
  }

  // KPIs principais
  var mesAnt = v.mesAnt||{};
  var cresc = v.crescimento;
  html += '<div class="stat-grid" style="margin-bottom:20px">';
  // Hoje
  html += '<div class="stat-card" style="border-left:3px solid #25d366">';
  html += '<div class="stat-label">📈 Hoje</div>';
  html += '<div class="stat-value">'+fmt(((v.hoje||{}).valor)||0)+'</div>';
  html += '<div class="stat-sub">'+(((v.hoje||{}).count)||0)+' pedidos</div>';
  html += '</div>';
  // Semana
  html += '<div class="stat-card" style="border-left:3px solid #3b82f6">';
  html += '<div class="stat-label">📅 Esta Semana</div>';
  html += '<div class="stat-value">'+fmt(((v.semana||{}).valor)||0)+'</div>';
  html += '<div class="stat-sub">'+(((v.semana||{}).count)||0)+' pedidos</div>';
  html += '</div>';
  // Mês com crescimento
  html += '<div class="stat-card" style="border-left:3px solid #8b5cf6">';
  html += '<div class="stat-label">🗓 Este Mês</div>';
  html += '<div class="stat-value">'+fmt(((v.mes||{}).valor)||0)+'</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:3px">';
  html += '<span class="stat-sub">'+(((v.mes||{}).count)||0)+' pedidos</span>';
  if (cresc !== null) {
    var cor = parseFloat(cresc)>=0?'#16a34a':'#dc2626';
    var seta = parseFloat(cresc)>=0?'↑':'↓';
    html += '<span style="font-size:12px;font-weight:700;color:'+cor+'">'+seta+' '+Math.abs(cresc)+'%</span>';
  }
  html += '</div></div>';
  // Ticket médio
  html += '<div class="stat-card" style="border-left:3px solid #f59e0b">';
  html += '<div class="stat-label">🎯 Ticket Médio</div>';
  html += '<div class="stat-value">'+fmt(v.ticketMedio||0)+'</div>';
  html += '<div class="stat-sub">vs '+fmt((mesAnt.valor||0)/(mesAnt.count||1))+' mês ant.</div>';
  html += '</div>';
  html += '</div>';

  // Linha 2: Operação + Método de Pagamento
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">';

  // Operação
  html += '<div class="card" style="padding:18px">';
  html += '<div class="section-title" style="margin-bottom:14px">Operação</div>';
  [
    {i:'⏳',l:'Aguardando Envio',v:v.pendentes||0,w:v.pendentes>0,fmt:false},
    {i:'💰',l:'Saldo Melhor Envio',v:fmt(me.saldo||0),w:(me.saldo||0)<50,fmt:true},
    {i:'🛒',l:'Carrinhos Abertos',v:lds.total||0,w:false,fmt:false},
    {i:'📲',l:'Membros VIP (17 grupos)',v:fmtN((d.gruposVip||{}).total||0),w:false,fmt:false},
  ].forEach(function(c){
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6">';
    html += '<div style="display:flex;align-items:center;gap:8px"><span>'+c.i+'</span><span style="font-size:13px;color:#374151">'+c.l+'</span></div>';
    html += '<span style="font-size:15px;font-weight:700;color:'+(c.w?'#f59e0b':'#111')+'">'+c.v+'</span>';
    html += '</div>';
  });
  // Alerta saldo baixo
  if ((me.saldo||0) < 50) html += '<div style="margin-top:10px;padding:8px 10px;background:#fef3c7;border-radius:6px;font-size:12px;color:#92400e">⚠️ Saldo baixo! Recarregue o Melhor Envio.</div>';
  html += '</div>';

  // Métodos de pagamento
  html += '<div class="card" style="padding:18px">';
  html += '<div class="section-title" style="margin-bottom:14px">💳 Pagamentos do Mês</div>';
  if (!pags.length) {
    html += '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:20px">Sem dados</div>';
  } else {
    var totalPag = pags.reduce(function(s,p){return s+p.valor;},0);
    pags.forEach(function(p){
      var pct = totalPag > 0 ? Math.round(p.valor/totalPag*100) : 0;
      var cor = p.nome==='PIX'?'#25d366':p.nome==='Cartão'?'#3b82f6':p.nome==='Débito'?'#8b5cf6':'#9ca3af';
      html += '<div style="margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
      html += '<span style="font-size:13px;font-weight:600">'+p.nome+'</span>';
      html += '<span style="font-size:13px;color:#6b7280">'+p.count+' · '+fmt(p.valor)+' ('+pct+'%)</span>';
      html += '</div>';
      html += '<div style="background:#f3f4f6;border-radius:4px;height:6px"><div style="width:'+pct+'%;height:6px;border-radius:4px;background:'+cor+';transition:width .5s"></div></div>';
      html += '</div>';
    });
  }
  html += '</div>';
  html += '</div>'; // fim grid 2 colunas

  // Ofertas widget
  var ofHoje = d.ofertasHoje || 0;
  var ofAmanha = d.ofertasAmanha || 0;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">';
  // Card Hoje
  html += '<div style="background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:14px 18px;display:flex;align-items:center;gap:12px">';
  html += '<span style="font-size:22px">📣</span>';
  html += '<div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Ofertas hoje</div>';
  html += '<div style="font-size:22px;font-weight:700;color:'+(ofHoje>0?'#16a34a':'#9ca3af')+'">'+ofHoje+'</div></div>';
  html += '</div>';
  // Card Amanhã
  html += '<div style="background:'+(ofAmanha===0?'#fef9c3':'#fff')+';border-radius:12px;border:1.5px solid '+(ofAmanha===0?'#fde68a':'#e8eaf0')+';padding:14px 18px;display:flex;align-items:center;gap:12px">';
  html += '<span style="font-size:22px">📅</span>';
  html += '<div style="flex:1"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Ofertas amanhã</div>';
  html += '<div style="font-size:22px;font-weight:700;color:'+(ofAmanha>0?'#16a34a':'#f59e0b')+'">'+ofAmanha+'</div>';
  if (ofAmanha === 0) html += '<div style="font-size:11px;color:#92400e;margin-top:2px">⚠️ Nenhuma oferta programada</div>';
  html += '</div>';
  if (ofAmanha === 0) html += '<button id="btn-prog-amanha" style="padding:6px 12px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">Programar →</button>';
  html += '</div>';
  html += '</div>';

  // Top produtos + Últimos pedidos
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // Top produtos
  html += '<div class="card">';
  html += '<div style="padding:16px 18px;border-bottom:1px solid #f3f4f6"><span style="font-size:13px;font-weight:700">🏆 Top Produtos do Mês</span></div>';
  if (!top.length) {
    html += '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px">Sem vendas no período</div>';
  } else {
    top.forEach(function(p, i){
      html += '<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid #f9f9f9">';
      html += '<span style="font-size:16px;font-weight:700;color:#d1d5db;width:18px">'+(i+1)+'</span>';
      html += (p.imagem?'<img src="'+p.imagem+'" style="width:36px;height:36px;object-fit:cover;border-radius:8px;flex-shrink:0">':'<div style="width:36px;height:36px;background:#f3f4f6;border-radius:8px;flex-shrink:0"></div>');
      html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.nome+'</div><div style="font-size:11px;color:#9ca3af">'+p.count+' vendas</div></div>';
      html += '<div style="font-size:13px;font-weight:700;color:#111;flex-shrink:0">'+fmt(p.valor)+'</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Últimos pedidos
  html += '<div class="card">';
  html += '<div style="padding:16px 18px;border-bottom:1px solid #f3f4f6"><span style="font-size:13px;font-weight:700">🕐 Pedidos Recentes</span></div>';
  if (!ults.length) {
    html += '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px">Sem pedidos recentes</div>';
  } else {
    ults.forEach(function(p){
      var metLabel = p.metodo==='pix'?'PIX':p.metodo==='credit_card'?'Cartão':p.metodo==='debit_card'?'Débito':'';
      var metCor = p.metodo==='pix'?'#dcfce7':p.metodo==='credit_card'?'#dbeafe':'#f3f4f6';
      var metTxt = p.metodo==='pix'?'#16a34a':p.metodo==='credit_card'?'#1d4ed8':'#374151';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid #f9f9f9">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:13px;font-weight:600">#'+p.numero+' · '+p.cliente.trim()+'</div>';
      html += '<div style="font-size:11px;color:#9ca3af">'+fmtDate(p.criado_em)+'</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0">';
      html += '<div style="font-size:13px;font-weight:700">'+fmt(p.valor)+'</div>';
      if(metLabel)html += '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:'+metCor+';color:'+metTxt+'">'+metLabel+'</span>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  html += '</div>'; // fim grid top+últimos



  ct().innerHTML = html;



  // Botão programar ofertas amanhã
  var btnProg = get('btn-prog-amanha');
  if (btnProg) btnProg.addEventListener('click', function() { renderAba('ofertas'); });



  // Live update da presença a cada 30s
  if (window._presencaInterval) clearInterval(window._presencaInterval);
  window._presencaInterval = setInterval(function() {
    if (currentAba !== 'home') { clearInterval(window._presencaInterval); return; }
    fetch(API+'/api/checkout?action=contar').then(function(r){return r.json();}).then(function(p){
      var ativos = document.getElementById('pres-ativos');
      var total = document.getElementById('pres-total');
      if (ativos) ativos.textContent = p.ativos;
      if (total) total.textContent = p.totalDia;
    }).catch(function(){});
  }, 30000);
}

// ===== RELATÓRIOS =====
function _relHojeStr(offsetDias) {
  var d = new Date(Date.now() - 3*60*60*1000 + (offsetDias||0)*86400000);
  return d.toISOString().split('T')[0];
}
async function renderRelatorios() {
  var di = get('rel-di') ? val('rel-di') : _relHojeStr(0);
  var df = get('rel-df') ? val('rel-df') : _relHojeStr(0);
  _renderRelatoriosShell(di, df);
  await _buscarRelatorios(di, df);
}
function _renderRelatoriosShell(di, df) {
  var html = '<div class="form-card">';
  html += '<div class="form-title">📑 Relatórios</div>';
  html += '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">';
  html += '<div class="field" style="margin-bottom:0"><label>De</label><input type="date" id="rel-di" value="'+di+'"></div>';
  html += '<div class="field" style="margin-bottom:0"><label>Até</label><input type="date" id="rel-df" value="'+df+'"></div>';
  html += '<button class="btn btn-primary" id="rel-buscar">Buscar</button>';
  html += '<button class="btn btn-ghost btn-sm" id="rel-hoje">Hoje</button>';
  html += '<button class="btn btn-ghost btn-sm" id="rel-7d">Últimos 7 dias</button>';
  html += '<button class="btn btn-ghost btn-sm" id="rel-mes">Este mês</button>';
  html += '</div></div>';
  html += '<div id="rel-conteudo"></div>';
  ct().innerHTML = html;
  var bb = get('rel-buscar');
  if (bb) bb.addEventListener('click', function(){ _buscarRelatorios(val('rel-di'), val('rel-df')); });
  var bh = get('rel-hoje');
  if (bh) bh.addEventListener('click', function(){ var h=_relHojeStr(0); get('rel-di').value=h; get('rel-df').value=h; _buscarRelatorios(h,h); });
  var b7 = get('rel-7d');
  if (b7) b7.addEventListener('click', function(){ var ini=_relHojeStr(-6), fim=_relHojeStr(0); get('rel-di').value=ini; get('rel-df').value=fim; _buscarRelatorios(ini,fim); });
  var bm = get('rel-mes');
  if (bm) bm.addEventListener('click', function(){ var hoje=new Date(Date.now()-3*60*60*1000); var ini=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-01'; var fim=_relHojeStr(0); get('rel-di').value=ini; get('rel-df').value=fim; _buscarRelatorios(ini,fim); });
}
async function _buscarRelatorios(di, df) {
  var cont = get('rel-conteudo');
  if (cont) cont.innerHTML = '<div class="loading-box"><div class="spin"></div>Carregando...</div>';
  try {
    var d = await fetch(API+'/api/admin?secret='+S+'&action=relatorios-json&dataInicio='+di+'&dataFim='+df).then(function(r){return r.json();});
    _renderRelatoriosConteudo(d);
  } catch(e) {
    if (cont) cont.innerHTML = '<div class="vazio">⚠️ Erro: '+e.message+'</div>';
  }
}
function _renderRelatoriosConteudo(d) {
  var cont = get('rel-conteudo');
  if (!cont) return;
  if (d.error) { cont.innerHTML = '<div class="vazio">⚠️ '+d.error+'</div>'; return; }
  var html = '';

  html += '<div class="stat-grid" style="margin-top:16px">';
  html += '<div class="stat-card"><div class="stat-label">💰 Vendas</div><div class="stat-value">'+fmt(d.vendas||0)+'</div><div class="stat-sub">'+(d.pedidos||0)+' pedidos</div></div>';
  html += '<div class="stat-card"><div class="stat-label">⌚ Relógios vendidos</div><div class="stat-value">'+fmtN(d.relogiosVendidos||0)+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">🎯 Ticket médio</div><div class="stat-value">'+fmt(d.ticketMedio||0)+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">🚚 Ticket médio do frete</div><div class="stat-value">'+fmt(d.ticketMedioFrete||0)+'</div></div>';
  html += '</div>';

  html += '<div class="stat-grid" style="grid-template-columns:1fr 1fr">';
  html += '<div class="stat-card"><div class="stat-label">🆕 Clientes novos</div><div class="stat-value">'+fmtN(d.clientesNovos||0)+'</div></div>';
  html += '<div class="stat-card"><div class="stat-label">📲 Leads no grupo (entraram no período)</div><div class="stat-value">'+(d.leadsGrupo===null||d.leadsGrupo===undefined?'—':fmtN(d.leadsGrupo))+'</div>'+(d.leadsGrupo===null?'<div class="stat-sub">Período longo demais p/ calcular (máx. 62 dias)</div>':'')+'</div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">';
  // Pagamentos
  html += '<div class="card" style="padding:18px">';
  html += '<div class="section-title" style="margin-bottom:14px">💳 Por forma de pagamento</div>';
  var pags = d.pagamentos||[];
  if (!pags.length) { html += '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px">Sem dados</div>'; }
  else {
    var totalPag = pags.reduce(function(s,p){return s+p.valor;},0);
    pags.forEach(function(p){
      var pct = totalPag>0 ? Math.round(p.valor/totalPag*100) : 0;
      var cor = p.nome==='PIX'?'#25d366':p.nome==='Cartão'?'#3b82f6':p.nome==='Débito'?'#8b5cf6':'#9ca3af';
      html += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;font-weight:600">'+p.nome+'</span><span style="font-size:13px;color:#6b7280">'+p.count+' · '+fmt(p.valor)+' ('+pct+'%)</span></div>';
      html += '<div style="background:#f3f4f6;border-radius:4px;height:6px"><div style="width:'+pct+'%;height:6px;border-radius:4px;background:'+cor+'"></div></div></div>';
    });
  }
  html += '</div>';
  // Origem
  html += '<div class="card" style="padding:18px">';
  html += '<div class="section-title" style="margin-bottom:14px">📍 Por origem</div>';
  var orgs = d.origens||[];
  var totalOrg = orgs.reduce(function(s,o){return s+o.valor;},0);
  if (!totalOrg) { html += '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px">Sem dados</div>'; }
  else {
    orgs.forEach(function(o){
      var pct = totalOrg>0 ? Math.round(o.valor/totalOrg*100) : 0;
      var cor = o.nome==='WhatsApp'?'#25d366':'#3b82f6';
      html += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;font-weight:600">'+(o.nome==='WhatsApp'?'💬 WhatsApp/Manual':'🛒 Site/Checkout')+'</span><span style="font-size:13px;color:#6b7280">'+o.count+' · '+fmt(o.valor)+' ('+pct+'%)</span></div>';
      html += '<div style="background:#f3f4f6;border-radius:4px;height:6px"><div style="width:'+pct+'%;height:6px;border-radius:4px;background:'+cor+'"></div></div></div>';
    });
  }
  html += '</div>';
  html += '</div>';

  // Produtos mais vendidos
  html += '<div class="card">';
  html += '<div style="padding:16px 18px;border-bottom:1px solid #f3f4f6"><span style="font-size:13px;font-weight:700">🏆 Produtos mais vendidos</span></div>';
  var prods = d.produtosMaisVendidos||[];
  if (!prods.length) { html += '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px">Sem vendas no período</div>'; }
  else {
    html += '<div class="tbl-wrap" style="border:none"><table><thead><tr><th>Produto</th><th>Qtd</th><th>Valor</th></tr></thead><tbody>';
    prods.forEach(function(p){
      html += '<tr><td>'+p.nome+'</td><td>'+p.count+'</td><td>'+fmt(p.valor)+'</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  cont.innerHTML = html;
}

// ===== CARRINHOS =====
async function renderCarrinhos() {
  loading();
  try {
    var d = await fetch(API+'/api/leads?secret='+S+'&ts='+Date.now()).then(r=>r.json());
    _leads = (d.leads||[])
      .filter(function(l){ return l.email && l.email.includes('@'); }) // só leads com email válido
      .sort(function(a,b){return new Date(b.atualizado_em||b.criado_em)-new Date(a.atualizado_em||a.criado_em);});
    renderLeadsList(_leads);
  } catch(e) { errMsg('Erro: '+e.message); }
}
function renderLeadsList(leads) {
  var ec={
    cep_produto:'#d1fae5',
    identificacao:'#dbeafe',
    endereco:'#ede9fe',
    calculou_frete:'#fef9c3',
    frete_selecionado:'#fde68a',
    pagamento_pendente:'#fca5a5',
    // legado
    dados:'#e5e7eb',
    sem_info:'#f3f4f6'
  };
  var et={
    cep_produto:'📦 CEP produto',
    identificacao:'📋 Identificação',
    endereco:'📍 Endereço',
    calculou_frete:'🔍 Calc. frete',
    frete_selecionado:'🚚 Frete',
    pagamento_pendente:'💳 No pagamento',
    // legado
    dados:'📋 Identificação',
    sem_info:'?'
  };
  var total = leads.reduce(function(s,l){return s+(l.carrinho||[]).reduce(function(sv,i){return sv+(i.preco*i.quantidade/100);},0);},0);
  var html = '<div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">';
  html += '<span style="font-size:13px;color:#6b7280">'+leads.length+' carrinhos · '+fmt(total)+' em aberto</span>';
  html += '<input id="lead-search" style="flex:1;min-width:160px;padding:8px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;outline:none" placeholder="Buscar...">';
  html += '<button id="btn-limpar-leads" class="btn btn-danger btn-sm">🗑 Limpar todos</button>';
  html += '</div>';
  if (!leads.length) { html += '<div class="vazio">Nenhum carrinho abandonado</div>'; ct().innerHTML=html; _attachLeadSearch(); return; }
  html += '<div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>Etapa</th><th>Produtos</th><th>Valor</th><th>Atualizado</th><th></th></tr></thead><tbody>';
  leads.forEach(function(l){
    var val=(l.carrinho||[]).reduce(function(s,i){return s+(i.preco*i.quantidade/100);},0);
    var chips=(l.carrinho||[]).map(function(i){return '<span class="chip">'+(i.nome||'').split(' ').slice(0,3).join(' ')+(i.cor&&i.cor!=='Default Title'?' · '+i.cor:'')+'</span>';}).join('');
    html += '<tr>';
    html += '<td><div style="font-weight:600;font-size:13px">'+(l.nome||'Sem nome')+'</div><div style="font-size:11px;color:#9ca3af">'+(l.email||'')+'</div></td>';
    var tagsList = l.tags && l.tags.length ? l.tags : [l.estagio||'?'];
  html += '<td style="display:flex;gap:3px;flex-wrap:wrap">';
  tagsList.forEach(function(t){
    html += '<span class="badge" style="background:'+(ec[t]||'#e5e7eb')+';font-size:10px">'+(et[t]||t)+'</span>';
  });
  html += '</td>';
    html += '<td>'+chips+'</td>';
    html += '<td><strong>'+fmt(val)+'</strong></td>';
    html += '<td style="font-size:11px;color:#9ca3af">'+fmtDate(l.atualizado_em||l.criado_em)+'</td>';
    html += '<td><button class="btn-del" data-lid="'+l.id+'">🗑</button></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  ct().innerHTML = html;
  _attachLeadSearch();
  ct().addEventListener('click', function handler(e) {
    var b = e.target.closest('[data-lid]');
    if (!b) return;
    if (!confirm('Remover carrinho?')) return;
    var tr=b.closest('tr'); if(tr)tr.style.opacity='0.4';
    fetch(API+'/api/leads?secret='+S+'&id='+encodeURIComponent(b.getAttribute('data-lid')), {method:'DELETE'})
      .then(function(){if(tr)tr.remove(); _leads=_leads.filter(function(l){return l.id!==b.getAttribute('data-lid');});});
  }, {once:true});
}
function _attachLeadSearch() {
  var inp = get('lead-search');
  if (inp) inp.addEventListener('input', function(){
    var q = this.value.toLowerCase();
    var f = q ? _leads.filter(function(l){return (l.nome||l.email||'').toLowerCase().includes(q);}) : _leads;
    renderLeadsList(f);
  });
  var bl = get('btn-limpar-leads');
  if (bl) bl.addEventListener('click', function(){
    if (!confirm('Deletar TODOS os carrinhos abandonados?')) return;
    bl.disabled = true; bl.textContent = 'Limpando...';
    fetch(API+'/api/leads', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action:'limpar_todos', secret:S})
    }).then(function(r){return r.json();}).then(function(d){
      if (d.ok) { alert('✅ '+d.deletados+' carrinhos removidos'); renderCarrinhos(); }
      else { alert('❌ Erro'); bl.disabled=false; bl.textContent='🗑 Limpar todos'; }
    }).catch(function(){ bl.disabled=false; bl.textContent='🗑 Limpar todos'; });
  });
}

// ===== OFERTAS =====
async function renderOfertas() {
  loading();
  try {
    var d = await fetch(API+'/api/ofertas?action=listar-json&secret='+S).then(r=>r.json());
    _ofertas = d.ofertas || [];
    renderOfertasHtml();
  } catch(e) { errMsg('Erro: '+e.message); }
}
function renderOfertasHtml() {
  var sc={agendada:'#bfdbfe',enviada:'#bbf7d0',erro:'#fca5a5'};
  var html = '<div class="form-card">';
  html += '<div class="form-title">📅 Agendar nova oferta</div>';
  html += '<div class="field"><label>Texto da oferta</label><textarea id="of-texto" placeholder="Digite o texto..."></textarea></div>';
  html += '<div class="field"><label>Mídias (opcional) — selecione uma ou mais imagens/vídeos</label>';
  html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">';
  html += '<input type="file" id="of-arquivo" accept="image/*,video/*" multiple style="display:none">📎 Selecionar arquivos (múltiplos)</label>';
  html += '<div id="of-upload-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px"></div>';
  html += '<input type="hidden" id="of-imagem" value="">';
  html += '</div>';
  html += '<div class="field"><label>Link (opcional)</label><input id="of-link" placeholder="https://kcique.com.br/..."></div></div>';
  html += '<div class="row-2"><div class="field"><label>Data e hora (Brasília)</label><input type="datetime-local" id="of-data"></div>';
  html += '<div class="field"><label>Grupos</label>';
  html += '<div style="border:1.5px solid #d1d5db;border-radius:8px;overflow:hidden">';
  // Opção todos
  html += '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f0fdf4;border-bottom:1px solid #d1d5db;cursor:pointer;font-weight:600">';
  html += '<input type="checkbox" id="of-grupos-todos" style="width:15px;height:15px;accent-color:#25d366"> Todos os grupos (1-17)</label>';
  // Grid de grupos
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);max-height:180px;overflow-y:auto">';
  GRUPOS_NOMES.forEach(function(g){
    html += '<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid #f3f4f6">';
    html += '<input type="checkbox" class="of-grupo-check" value="'+g+'" style="width:13px;height:13px;accent-color:#25d366"> '+g+'</label>';
  });
  html += '</div></div></div></div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
  html += '<input type="checkbox" id="of-mention" checked style="width:16px;height:16px;cursor:pointer;accent-color:#25d366">';
  html += '<label for="of-mention" style="font-size:13px;font-weight:600;cursor:pointer;color:#374151">Marcar todos (@all) no grupo</label>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:#fef9c3;border:1px solid #fde68a;border-radius:8px">';
  html += '<input type="checkbox" id="of-teste" style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b">';
  html += '<label for="of-teste" style="font-size:13px;font-weight:600;cursor:pointer;color:#92400e">🧪 Enviar só no grupo de teste</label>';
  html += '</div>';
  html += '<div class="row-2"><div class="field"><label>📱 Contato — Nome <span style="font-size:10px;color:#9ca3af;font-weight:400">(opcional)</span></label><input id="of-contato-nome" placeholder="Ex: Kcique Relógios"></div>';
  html += '<div class="field"><label>📱 Contato — Telefone <span style="font-size:10px;color:#9ca3af;font-weight:400">(opcional, com DDI: 5545...)</span></label><input id="of-contato-tel" placeholder="5545999999999" type="tel"></div></div>';
  html += '<div style="display:flex;align-items:center;gap:10px"><button class="btn btn-primary" id="btn-agendar">📅 Agendar</button><span id="of-msg" style="font-size:13px"></span></div>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<span style="font-size:13px;color:#6b7280">'+_ofertas.length+' ofertas</span>';
  html += '<button class="btn btn-danger btn-sm" id="btn-limpar-of">🗑 Limpar enviadas</button></div>';
  if (!_ofertas.length) { html += '<div class="vazio">Nenhuma oferta agendada</div>'; ct().innerHTML=html; _attachOfertas(); return; }
  html += '<div class="tbl-wrap"><table><thead><tr><th>Imagem</th><th>Texto</th><th>Data/Hora</th><th>Grupos</th><th>Status</th><th></th></tr></thead><tbody>';
  _ofertas.slice().reverse().forEach(function(o){
    html += '<tr>';
    html += '<td>'+(o.imagem?'<img src="'+o.imagem+'" style="width:38px;height:38px;object-fit:cover;border-radius:6px">':'—')+'</td>';
    html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(o.texto||'')+'</td>';
    html += '<td style="white-space:nowrap">'+fmtDate(o.dataHora)+'</td>';
    html += '<td style="font-size:11px">'+(o.grupos||'todos')+'</td>';
    html += '<td><span class="badge" style="background:'+(sc[o.status]||'#e5e7eb')+'">'+(o.status||'?')+'</span></td>';
    html += '<td><button class="btn-del" data-oid="'+o.id+'">🗑</button></td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  ct().innerHTML = html;
  _attachOfertas();
}
function _attachOfertas() {
  var btn = get('btn-agendar');
  if (btn) btn.addEventListener('click', salvarOferta);


  // Toggle "Todos" — marca/desmarca todos
  var todosCheck = get('of-grupos-todos');
  if (todosCheck) todosCheck.addEventListener('change', function() {
    document.querySelectorAll('.of-grupo-check').forEach(function(c){ c.checked = todosCheck.checked; });
  });

  // Se desmarcar qualquer um, desmarca "Todos"
  ct().addEventListener('change', function(e) {
    if (e.target.classList.contains('of-grupo-check')) {
      var todos = document.querySelectorAll('.of-grupo-check');
      var marcados = document.querySelectorAll('.of-grupo-check:checked');
      var todosEl = get('of-grupos-todos');
      if (todosEl) todosEl.checked = todos.length === marcados.length;
    }
  });
  var bl = get('btn-limpar-of');
  if (bl) bl.addEventListener('click', limparOfertas);
  // Upload múltiplo direto pro Cloudinary
  window._ofMidias = window._ofMidias || [];
  var arq = get('of-arquivo');
  if (arq) arq.addEventListener('change', async function() {
    var files = Array.from(this.files); if (!files.length) return;
    var prev = get('of-upload-preview');
    var imgInput = get('of-imagem');
    var creds = null;
    try {
      var cr = await fetch(API+'/api/fornecedor?action=cloudinary-config&secret='+S).then(function(r){return r.json();});
      creds = cr;
    } catch(e) {}
    if (!creds || !creds.cloudName || !creds.uploadPreset) {
      if (prev) prev.innerHTML = '<div style="color:#ef4444;font-size:12px">❌ Cloudinary não configurado</div>';
      return;
    }
    var placeholders = files.map(function(f) {
      var el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;background:#f9fafb;border:1px solid #e8eaf0;border-radius:8px;font-size:12px;color:#9ca3af;margin-bottom:4px';
      el.innerHTML = '⏳ '+f.name+' ('+Math.round(f.size/1024/1024*10)/10+'MB)';
      if (prev) prev.appendChild(el);
      return el;
    });
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var ph = placeholders[i];
      var isVideo = file.type.startsWith('video');
      var resourceType = isVideo ? 'video' : 'image';
      try {
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', creds.uploadPreset);
        fd.append('folder', 'kcique-ofertas');
        var cloudResp = await fetch('https://api.cloudinary.com/v1_1/'+creds.cloudName+'/'+resourceType+'/upload', { method:'POST', body:fd });
        var d2 = await cloudResp.json();
        if (d2.secure_url) {
          var midIdx = window._ofMidias.length;
          window._ofMidias.push({ url: d2.secure_url, tipo: resourceType });
          if (ph) ph.innerHTML = isVideo
            ? '🎥 <a href="'+d2.secure_url+'" target="_blank" style="color:#2563eb">'+file.name+'</a> <button data-idx="'+midIdx+'" onclick="window._ofMidias[+this.dataset.idx]=null;this.parentNode.remove()" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:14px">×</button>'
            : '<img src="'+d2.secure_url+'" style="height:48px;width:48px;object-fit:cover;border-radius:6px;margin-right:4px"><span style="color:#374151">'+file.name+'</span> <button data-idx="'+midIdx+'" onclick="window._ofMidias[+this.dataset.idx]=null;this.parentNode.remove()" style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:14px">×</button>';
          if (imgInput) imgInput.value = window._ofMidias.filter(Boolean).map(function(m){return m.url;}).join('|');
        } else {
          if (ph) { ph.textContent = '❌ '+file.name+': '+(d2.error&&d2.error.message||'erro'); ph.style.color='#ef4444'; }
        }
      } catch(e) {
        if (ph) { ph.textContent = '❌ '+file.name+': '+e.message; ph.style.color='#ef4444'; }
      }
    }
    arq.value = '';
  });
  ct().addEventListener('click', function(e) {
    var b = e.target.closest('[data-oid]');
    if (!b) return;
    if (!confirm('Remover oferta?')) return;
    var tr=b.closest('tr'); if(tr)tr.style.opacity='0.4';
    fetch(API+'/api/admin?secret='+S+'&del_oferta='+b.getAttribute('data-oid')).then(function(){if(tr)tr.remove();_ofertas=_ofertas.filter(function(o){return o.id!==b.getAttribute('data-oid');});});
  }, {once:true});
}
async function salvarOferta() {
  var texto=val('of-texto').trim(), data=val('of-data'), msg=get('of-msg');
  if (!texto||!data){if(msg)msg.textContent='⚠️ Preencha texto e data';return;}
  var btn=get('btn-agendar');btn.disabled=true;btn.textContent='Agendando...';
  try {
    // Ler grupos selecionados
    var todosChecked = get('of-grupos-todos') && get('of-grupos-todos').checked;
    var gruposSel = [];
    if (!todosChecked) {
      document.querySelectorAll('.of-grupo-check:checked').forEach(function(c){ gruposSel.push(c.value); });
    }
    var gruposVal = todosChecked ? 'todos' : (gruposSel.length ? gruposSel.join(',') : 'todos');
    var midia = val('of-imagem') || '';
    var midias = window._ofMidias && window._ofMidias.length ? window._ofMidias : (midia ? [{url:midia,tipo:'image'}] : []);
    var midia = val('of-imagem') || '';
    var midias = window._ofMidias && window._ofMidias.length ? window._ofMidias.filter(Boolean) : (midia ? [{url:midia,tipo:'image'}] : []);
    var isTeste = !!(get('of-teste') && get('of-teste').checked);
    var gruposFinais = isTeste ? '120363411835027246-group' : gruposVal;
    var contatoNome = (get('of-contato-nome') ? get('of-contato-nome').value.trim() : '');
    var contatoTel = (get('of-contato-tel') ? get('of-contato-tel').value.replace(/\D/g,'') : '');
    var r = await fetch(API+'/api/ofertas?action=salvar&secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto,imagem:midias[0]?midias[0].url:'',midias:midias,link:val('of-link'),dataHora:data+':00-03:00',grupos:gruposFinais,mentionEveryOne:!!(get('of-mention')&&get('of-mention').checked),teste:isTeste,contatoNome:contatoNome||null,contatoTel:contatoTel||null})});
    var d = await r.json();
    if(d.success){if(msg){msg.textContent='✅ Agendada!';msg.style.color='#16a34a';}window._ofMidias=[];setTimeout(function(){renderOfertas();},1000);}
    else{if(msg){msg.textContent='❌ '+(d.error||'Erro');msg.style.color='#ef4444';}}
  }catch(e){if(msg)msg.textContent='❌ '+e.message;}
  btn.disabled=false;btn.textContent='📅 Agendar';
}
async function limparOfertas(){
  if(!confirm('Deletar todas as enviadas e com erro?'))return;
  var r=await fetch(API+'/api/ofertas?action=limpar_enviadas&secret='+S);
  var d=await r.json();
  if(d.ok){alert('✅ '+d.deletadas+' removidas');renderOfertas();}
}

// ===== PEDIDOS =====
var _pedidos = [];
async function renderPedidos(force) {
  loading();
  try {
    var d = await fetch(API+'/api/admin?secret='+S+'&action=pedidos-json'+(force?'&refresh=1':'')).then(r=>r.json());
    _pedidos = d.pedidos||[];
    var fc={paid:'#bbf7d0',pending:'#fde68a',refunded:'#fca5a5'};
    var fu={fulfilled:'#bbf7d0',unfulfilled:'#fde68a',partial:'#bfdbfe'};
    var html = d.fromCache ? '<div class="cache-bar">⚡ Cache <button onclick="renderPedidos(true)">Atualizar</button></div>' : '';
    if(!_pedidos.length){ct().innerHTML=html+'<div class="vazio">Nenhum pedido</div>';return;}
    html+='<div class="tbl-wrap"><table><thead><tr><th></th><th>Pedido</th><th>Cliente</th><th>Produto</th><th>Valor</th><th>Pagamento</th><th>Envio</th><th>Tracking</th><th>Origem</th><th></th></tr></thead><tbody>';
    _pedidos.forEach(function(p,i){
      var origem=(p.nota||'').split('Origem: ')[1];if(origem)origem=origem.split('|')[0].trim();
      html+='<tr style="cursor:pointer" data-pi="'+i+'">';
      // Show all item images (up to 3) in the list using pre-computed imagens array
      var imgsHtml = (p.imagens||[{img:p.imagem}]).slice(0,3).map(function(it){
        return it.img ? '<img src="'+it.img+'" title="'+((it.nome||'')+(it.variante&&it.variante!=='Default Title'?' - '+it.variante:'')).substring(0,40)+'" style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #e8eaf0">' : '';
      }).filter(Boolean).join('');
      html+='<td><div style="display:flex;gap:2px;align-items:center">'+(imgsHtml||'<span style="color:#d1d5db;font-size:16px">⌚</span>')+'</div></td>';
      html+='<td><strong>#'+p.numero+'</strong><div style="font-size:11px;color:#9ca3af">'+fmtDate(p.criado_em)+'</div></td>';
      html+='<td>'+p.cliente+'</td>';
      html+='<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.produto+'</td>';
      html+='<td><strong>'+fmt(parseFloat(p.valor||0))+'</strong></td>';
      html+='<td><span class="badge" style="background:'+(fc[p.financeiro]||'#e5e7eb')+'">'+p.financeiro+'</span></td>';
      html+='<td><span class="badge" style="background:'+(fu[p.fulfillment]||'#e5e7eb')+'">'+p.fulfillment+'</span></td>';
      html+='<td style="font-size:11px;font-family:monospace">'+(p.tracking||'—')+'</td>';
      html+='<td>'+(origem?'<span class="badge" style="background:#dcfce7;color:#16a34a">📍'+origem+'</span>':'—')+'</td>';
      html+='<td><button class="btn-del btn-forn" data-pi="'+i+'">📦</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
    // Modal
    html+='<div id="modal-ped" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;align-items:center;justify-content:center">';
    html+='<div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:90%;max-height:85vh;overflow-y:auto;position:relative">';
    html+='<button onclick="fecharModal()" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af">×</button>';
    html+='<div id="modal-content"></div></div></div>';
    ct().innerHTML = html;
    ct().addEventListener('click', function(e) {
      // Botão fornecedor
      var bf = e.target.closest('.btn-forn');
      if (bf) { e.stopPropagation(); enviarFornecedorPed(bf, parseInt(bf.getAttribute('data-pi'))); return; }
      // Clique na linha - abrir modal
      var tr = e.target.closest('tr[data-pi]');
      if (tr) abrirModalPedido(parseInt(tr.getAttribute('data-pi')));
    });
  }catch(e){errMsg('Erro: '+e.message);}
}
function abrirModalPedido(i) {
  var p = _pedidos[i]; if (!p) return;
  var fc={paid:'✅ Pago',pending:'⏳ Pendente',refunded:'↩️ Reembolsado'};
  var fu={fulfilled:'✅ Enviado',unfulfilled:'⏳ Aguardando',partial:'🔄 Parcial'};
  var origem=(p.nota||'').split('Origem: ')[1];if(origem)origem=origem.split('|')[0].trim();
  var html='';
  // Header
  html+='<div style="display:flex;gap:14px;margin-bottom:20px;align-items:flex-start">';
  html+=(p.imagem?'<img src="'+p.imagem+'" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0">':'');
  html+='<div><div style="font-size:20px;font-weight:700">#'+p.numero+'</div>';
  html+='<div style="color:#9ca3af;font-size:12px">'+fmtDate(p.criado_em)+'</div>';
  html+='<div style="font-size:22px;font-weight:700;color:#16a34a;margin-top:3px">'+fmt(parseFloat(p.valor||0))+'</div></div></div>';
  // Status
  html+='<div style="display:flex;gap:8px;margin-bottom:16px">';
  html+='<span class="badge" style="background:#bbf7d0">'+(fc[p.financeiro]||p.financeiro)+'</span>';
  html+='<span class="badge" style="background:#bfdbfe">'+(fu[p.fulfillment]||p.fulfillment)+'</span>';
  if(origem)html+='<span class="badge" style="background:#dcfce7;color:#16a34a">📍'+origem+'</span>';
  html+='</div>';
  // Cliente
  html+='<div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Cliente</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  [{l:'Nome',v:p.cliente},{l:'Email',v:p.email||'—'},{l:'Telefone',v:p.telefone||'—'},{l:'Endereço',v:p.endereco||'—'}].forEach(function(c){
    html+='<div style="background:#f9fafb;border-radius:8px;padding:10px"><div style="font-size:10px;color:#9ca3af;margin-bottom:2px">'+c.l+'</div><div style="font-size:13px;font-weight:600;word-break:break-word">'+c.v+'</div></div>';
  });
  html+='</div>';
  // Itens
  if (p.itens && p.itens.length) {
    html+='<div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Itens do Pedido</div>';
    html+='<div style="margin-bottom:16px">';
    p.itens.forEach(function(it, idx){
      var imgObj = p.imagens && p.imagens[idx];
      var img = imgObj ? imgObj.img : (p.imagem||'');
      html+='<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f3f4f6">';
      html+=(img
        ? '<img src="'+img+'" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1)" onclick="abrirFoto(this.src)">'
        : '<div style="width:90px;height:90px;background:#f3f4f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:36px">⌚</div>');
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="font-size:14px;font-weight:700;line-height:1.4">'+it.nome+'</div>';
      if(it.variante&&it.variante!=='Default Title')html+='<div style="font-size:12px;color:#6b7280;margin-top:4px;background:#f3f4f6;display:inline-block;padding:2px 8px;border-radius:20px">'+it.variante+'</div>';
      html+='<div style="font-size:13px;color:#374151;margin-top:6px;font-weight:600">x'+it.quantidade+' &nbsp;·&nbsp; R$ '+parseFloat(it.preco||0).toFixed(2).replace('.',',')+'</div>';
      html+='<div style="font-size:13px;color:#16a34a;font-weight:700;margin-top:2px">Total: R$ '+(parseFloat(it.preco||0)*it.quantidade).toFixed(2).replace('.',',')+'</div>';
      html+='</div></div>';
    });
    html+='</div>';
  }
  // Financeiro
  html+='<div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px">';
  html+='<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#6b7280">Subtotal</span><span>'+fmt(parseFloat(p.subtotal||0))+'</span></div>';
  if(parseFloat(p.frete_valor||0)>0)html+='<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:#6b7280">Frete</span><span>+'+fmt(parseFloat(p.frete_valor||0))+'</span></div>';
  if(parseFloat(p.desconto||0)>0){
    var cupomLabel = p.cupom ? ' ('+p.cupom+')' : ''; html+='<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:#16a34a"><span>🎟 Desconto'+cupomLabel+'</span><span>-'+fmt(parseFloat(p.desconto||0))+'</span></div>';
  }
  html+='<div style="border-top:1px solid #e8eaf0;margin:8px 0"></div>';
  html+='<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700"><span>Total pago</span><span style="color:#16a34a">'+fmt(parseFloat(p.valor||0))+'</span></div>';
  html+='</div>';
  // Tracking + Cupom
  if(p.tags)html+='<div style="font-size:11px;color:#9ca3af;margin-bottom:12px">Tags: '+p.tags+'</div>';
  if(p.cupom&&!parseFloat(p.desconto||0))html+='<div style="background:#fef9c3;border-radius:8px;padding:8px 12px;font-size:13px;margin-bottom:12px">🎟 Cupom: <strong>'+p.cupom+'</strong></div>';
  if(p.tracking){
    html+='<div style="background:#f0f9ff;border-radius:8px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
    html+='<div><div style="font-size:10px;color:#9ca3af">Tracking</div><div style="font-size:13px;font-weight:700;font-family:monospace">'+p.tracking+'</div></div>';
    if(p.tracking_url)html+='<a href="'+p.tracking_url+'" target="_blank" style="font-size:12px;color:#2563eb">Rastrear →</a>';
    html+='</div>';
  }

  if(p.nota)html+='<div style="background:#f9fafb;border-radius:8px;padding:10px;font-size:12px;color:#6b7280;word-break:break-word;margin-bottom:12px">'+p.nota+'</div>';
  html+='<div style="display:flex;gap:8px;margin-top:8px">';
  html+='<button class="btn btn-ghost btn-sm" id="modal-forn-btn">📦 Enviar para Fornecedor</button>';
  html+='</div>';
  var mc=get('modal-content');if(mc)mc.innerHTML=html;
  var m=get('modal-ped');if(m)m.style.display='flex';
  var mf=get('modal-forn-btn');
  if(mf)mf.addEventListener('click',function(){enviarFornecedorPed(mf,i);});
}
function fecharModal() {
  var m = get('modal-ped'); if (m) m.style.display = 'none';
}
async function enviarFornecedorPed(btn, i) {
  var p = _pedidos[i]; if (!p) return;
  btn.disabled=true; btn.textContent='Enviando...';
  await fetch(API+'/api/admin?secret='+S+'&action=enviar-fornecedor&clienteNome='+encodeURIComponent(p.cliente)+'&tracking='+(p.tracking||'')+'&imgUrl='+encodeURIComponent(p.imagem||'')+'&meOrderId='+(p.meOrderId||''));
  btn.textContent='✅ Enviado';
}

// ===== CRIAR PEDIDO MANUAL (venda fechada no WhatsApp) =====
var _pmItens = [], _pmFrete = null, _pmFreteOpcoes = [], _pmTotalTocado = false;
function renderPedidoManual(){
  loading();
  var html = '';
  html += '<div class="form-card"><div class="form-title">🧾 Dados do Cliente</div>';
  html += '<div class="row-2"><div class="field"><label>Nome completo</label><input id="pm-nome" placeholder="Nome do cliente"></div>';
  html += '<div class="field"><label>Telefone (WhatsApp)</label><input id="pm-tel" placeholder="(11) 91234-5678"></div></div>';
  html += '<div class="row-2"><div class="field"><label>Email (opcional)</label><input id="pm-email" type="email" placeholder="cliente@email.com"></div>';
  html += '<div class="field"><label>CPF (obrigatório p/ etiqueta)</label><input id="pm-cpf" placeholder="000.000.000-00"></div></div>';
  html += '</div>';

  html += '<div class="form-card"><div class="form-title">📍 Endereço de Entrega</div>';
  html += '<div class="row-3"><div class="field"><label>CEP</label><input id="pm-cep" placeholder="00000-000"></div>';
  html += '<div class="field"><label>Número</label><input id="pm-numero" placeholder="123"></div>';
  html += '<div class="field"><label>Complemento</label><input id="pm-compl" placeholder="Apto, bloco..."></div></div>';
  html += '<div class="field"><label>Rua</label><input id="pm-rua" placeholder="Rua / Avenida"></div>';
  html += '<div class="row-3"><div class="field"><label>Bairro</label><input id="pm-bairro" placeholder="Bairro"></div>';
  html += '<div class="field"><label>Cidade</label><input id="pm-cidade" placeholder="Cidade"></div>';
  html += '<div class="field"><label>Estado (UF)</label><input id="pm-estado" maxlength="2" placeholder="SP" oninput="this.value=this.value.toUpperCase()"></div></div>';
  html += '<span id="pm-cep-msg" style="font-size:12px;color:#9ca3af"></span>';
  html += '</div>';

  html += '<div class="form-card"><div class="form-title">📦 Produtos</div>';
  html += '<button type="button" id="pm-toggle-prods" class="btn btn-ghost btn-sm">▶ Adicionar produto</button>';
  html += '<div id="pm-prod-grid" style="display:none;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;max-height:260px;overflow-y:auto;margin-top:10px;padding:2px"></div>';
  html += '<div id="pm-carrinho" style="margin-top:16px"></div>';
  html += '</div>';

  html += '<div class="form-card"><div class="form-title">🚚 Frete</div>';
  html += '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">';
  html += '<button type="button" id="pm-calc-frete" class="btn btn-ghost btn-sm">📮 Calcular frete pelo CEP</button>';
  html += '<span id="pm-frete-msg" style="font-size:12px;color:#9ca3af"></span></div>';
  html += '<div id="pm-frete-opcoes"></div>';
  html += '</div>';

  html += '<div class="form-card"><div class="form-title">💳 Pagamento e Envio</div>';
  html += '<div class="row-3"><div class="field"><label>Forma de pagamento</label><select id="pm-pagamento"><option value="pix">PIX</option><option value="credit_card">Cartão de Crédito</option><option value="debit_card">Cartão de Débito</option><option value="outro">Outro</option></select></div>';
  html += '<div class="field"><label>Peso do pacote (kg)</label><input id="pm-peso" type="number" step="0.1" value="0.5"></div>';
  html += '<div class="field"><label>Valor total do pedido (R$)</label><input id="pm-total" type="number" step="0.01" min="0" placeholder="0,00"></div></div>';
  html += '<div style="font-size:11px;color:#9ca3af;margin:-4px 0 12px">Preenchido automático pela soma dos produtos + frete — edite se combinou outro valor/desconto no WhatsApp. Subtotal calculado: <span id="pm-subtotal-auto">R$ 0,00</span></div>';
  html += '<div class="field"><label>Observação (opcional)</label><textarea id="pm-obs" placeholder="Ex: combinado no WhatsApp, entregar após 18h..."></textarea></div>';
  html += '<div style="display:flex;align-items:center;gap:12px"><button class="btn btn-primary" id="pm-criar">✅ Criar Pedido e Gerar Etiqueta</button><span id="pm-msg" style="font-size:13px"></span></div>';
  html += '</div>';

  ct().innerHTML = html;
  _pmItens = []; _pmFrete = null; _pmFreteOpcoes = []; _pmTotalTocado = false;
  _attachPedidoManual();
  _renderPmCarrinho();
}
function _attachPedidoManual(){
  var btp = get('pm-toggle-prods');
  var _pmLoaded = false;
  if (btp) btp.addEventListener('click', function(){
    var g = get('pm-prod-grid'); if (!g) return;
    var open = g.style.display !== 'none';
    if (open) { g.style.display = 'none'; btp.textContent = '▶ Adicionar produto'; return; }
    g.style.display = 'grid';
    btp.textContent = '▼ Fechar seletor';
    if (_pmLoaded) return;
    _pmLoaded = true;
    var prom = _produtos.length ? Promise.resolve({produtos:_produtos}) : fetch(API+'/api/admin?secret='+S+'&action=produtos-lista').then(function(r){return r.json();}).catch(function(){return {produtos:[]};});
    prom.then(function(pp){
      if (pp.produtos) _produtos = pp.produtos;
      var h = '';
      _produtos.forEach(function(p, idx){
        var nome = p.titulo || p.nome || '';
        var preco = parseFloat(p.preco) || 0;
        h += '<div class="pm-prod-card" data-pidx="'+idx+'" style="border:1.5px solid #e8eaf0;border-radius:8px;padding:8px;cursor:pointer;text-align:center" title="'+nome.replace(/"/g,'')+'">';
        h += (p.imagem ? '<img src="'+p.imagem+'" style="width:100%;height:70px;object-fit:cover;border-radius:6px;margin-bottom:6px">' : '<div style="width:100%;height:70px;background:#f3f4f6;border-radius:6px;margin-bottom:6px"></div>');
        h += '<div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+nome+'</div>';
        h += '<div style="font-size:11px;color:#16a34a;font-weight:700">R$ '+preco.toFixed(2).replace('.',',')+'</div>';
        h += '</div>';
      });
      g.innerHTML = h || '<div style="padding:12px;color:#9ca3af;font-size:13px">Nenhum produto encontrado</div>';
    });
  });

  var g = get('pm-prod-grid');
  if (g) g.addEventListener('click', function(e){
    var card = e.target.closest('.pm-prod-card'); if (!card) return;
    var p = _produtos[parseInt(card.getAttribute('data-pidx'))]; if (!p) return;
    var variantes = (p.variantes||[]).filter(function(v){return v.titulo && v.titulo !== 'Default Title';});
    var variante = '', variantId = (p.variantes||[])[0] ? p.variantes[0].id : '', preco = parseFloat(p.preco)||0;
    if (variantes.length) {
      var opcoes = variantes.map(function(v,i){return (i+1)+') '+v.titulo+' — R$ '+parseFloat(v.preco).toFixed(2).replace('.',',');}).join('\\n');
      var escolha = prompt('Escolha a variante de "'+(p.titulo||'')+'":\\n'+opcoes);
      var i = parseInt(escolha) - 1;
      if (isNaN(i) || !variantes[i]) return;
      variante = variantes[i].titulo;
      variantId = variantes[i].id;
      preco = parseFloat(variantes[i].preco) || preco;
    }
    _pmItens.push({ produtoId: p.id, variantId: variantId, nome: p.titulo, variante: variante, preco: preco, quantidade: 1 });
    _renderPmCarrinho();
  });

  var cepEl = get('pm-cep');
  if (cepEl) cepEl.addEventListener('blur', function(){
    var v = cepEl.value.replace(/\\D/g,'');
    var msg = get('pm-cep-msg');
    if (v.length !== 8) return;
    if (msg) msg.textContent = 'Buscando endereço...';
    fetch('https://viacep.com.br/ws/'+v+'/json/').then(function(r){return r.json();}).then(function(d){
      if (d.erro) { if (msg) msg.textContent = '⚠️ CEP não encontrado'; return; }
      if (get('pm-rua')) get('pm-rua').value = d.logradouro || '';
      if (get('pm-bairro')) get('pm-bairro').value = d.bairro || '';
      if (get('pm-cidade')) get('pm-cidade').value = d.localidade || '';
      if (get('pm-estado')) get('pm-estado').value = d.uf || '';
      if (msg) msg.textContent = '✅ Endereço preenchido automaticamente';
    }).catch(function(){ if (msg) msg.textContent = ''; });
  });

  var bf = get('pm-calc-frete');
  if (bf) bf.addEventListener('click', function(){
    var v = val('pm-cep').replace(/\\D/g,'');
    var msg = get('pm-frete-msg');
    if (v.length !== 8) { if (msg) msg.textContent = '⚠️ Informe um CEP válido'; return; }
    if (msg) msg.textContent = 'Calculando...';
    bf.disabled = true;
    fetch(API+'/api/frete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cep_destino:v}) })
      .then(function(r){return r.json();})
      .then(function(d){
        bf.disabled = false;
        if (!d.opcoes || !d.opcoes.length) { if (msg) msg.textContent = '⚠️ '+(d.erro||'Frete indisponível para este CEP'); return; }
        if (msg) msg.textContent = '';
        _pmFreteOpcoes = d.opcoes;
        var h = '';
        d.opcoes.forEach(function(o, i){
          h += '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid #e8eaf0;border-radius:8px;margin-bottom:6px;cursor:pointer">';
          h += '<input type="radio" name="pm-frete-radio" value="'+i+'" style="accent-color:#111">';
          h += '<span style="flex:1;font-size:13px"><strong>'+o.nome+'</strong> — '+o.prazo+' dias úteis</span>';
          h += '<span style="font-weight:700">R$ '+o.preco.toFixed(2).replace('.',',')+'</span></label>';
        });
        var fo = get('pm-frete-opcoes'); if (fo) fo.innerHTML = h;
      }).catch(function(e){ bf.disabled = false; if (msg) msg.textContent = '❌ '+e.message; });
  });

  var fo = get('pm-frete-opcoes');
  if (fo) fo.addEventListener('change', function(e){
    if (e.target.name !== 'pm-frete-radio') return;
    _pmFrete = _pmFreteOpcoes[parseInt(e.target.value)];
    _atualizarPmTotal();
  });

  var bc = get('pm-criar');
  if (bc) bc.addEventListener('click', _criarPedidoManual);

  var pt = get('pm-total');
  if (pt) pt.addEventListener('input', function(){
    _pmTotalTocado = pt.value.trim() !== '';
    if (!_pmTotalTocado) _atualizarPmTotal();
  });
}
function _renderPmCarrinho(){
  var c = get('pm-carrinho'); if (!c) return;
  if (!_pmItens.length) { c.innerHTML = '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px">Nenhum produto adicionado</div>'; _atualizarPmTotal(); return; }
  var h = '<table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th><th></th></tr></thead><tbody>';
  _pmItens.forEach(function(it, i){
    h += '<tr><td>'+it.nome+(it.variante?' <span class="chip">'+it.variante+'</span>':'')+'</td>';
    h += '<td><input type="number" min="1" value="'+it.quantidade+'" data-qidx="'+i+'" style="width:56px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px"></td>';
    h += '<td>R$ '+it.preco.toFixed(2).replace('.',',')+'</td>';
    h += '<td>R$ '+(it.preco*it.quantidade).toFixed(2).replace('.',',')+'</td>';
    h += '<td><button class="btn-del" data-ridx="'+i+'">🗑</button></td></tr>';
  });
  h += '</tbody></table>';
  c.innerHTML = h;
  c.querySelectorAll('[data-qidx]').forEach(function(inp){
    inp.addEventListener('change', function(){
      var i = parseInt(inp.getAttribute('data-qidx'));
      var q = parseInt(inp.value) || 1;
      _pmItens[i].quantidade = q;
      _renderPmCarrinho();
    });
  });
  c.querySelectorAll('[data-ridx]').forEach(function(btn){
    btn.addEventListener('click', function(){
      _pmItens.splice(parseInt(btn.getAttribute('data-ridx')), 1);
      _renderPmCarrinho();
    });
  });
  _atualizarPmTotal();
}
function _atualizarPmTotal(){
  var subtotal = _pmItens.reduce(function(s,i){return s+i.preco*i.quantidade;}, 0);
  var frete = _pmFrete ? _pmFrete.preco : 0;
  var sa = get('pm-subtotal-auto'); if (sa) sa.textContent = fmt(subtotal+frete);
  var t = get('pm-total');
  if (t && !_pmTotalTocado) t.value = (subtotal+frete).toFixed(2);
}
async function _criarPedidoManual(){
  var msg = get('pm-msg');
  var nome = val('pm-nome').trim(), tel = val('pm-tel').trim();
  var cpf = val('pm-cpf').replace(/\\D/g,'');
  var cep = val('pm-cep').replace(/\\D/g,''), rua = val('pm-rua').trim(), numero = val('pm-numero').trim();
  var bairro = val('pm-bairro').trim(), cidade = val('pm-cidade').trim(), estado = val('pm-estado').trim();
  if (!nome || !tel) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = '⚠️ Preencha nome e telefone do cliente'; } return; }
  if (cpf.length !== 11) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = '⚠️ Informe um CPF válido (11 dígitos) — o Melhor Envio exige o documento do destinatário pra gerar a etiqueta'; } return; }
  if (cep.length !== 8 || !rua || !numero || !bairro || !cidade || !estado) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = '⚠️ Preencha o endereço completo (inclusive bairro)'; } return; }
  if (!_pmItens.length) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = '⚠️ Adicione ao menos um produto'; } return; }
  if (!_pmFrete) { if (msg) { msg.style.color = '#ef4444'; msg.textContent = '⚠️ Calcule e selecione o frete'; } return; }

  var btn = get('pm-criar'); btn.disabled = true; btn.textContent = 'Criando pedido...';
  if (msg) { msg.style.color = '#6b7280'; msg.textContent = ''; }

  var valorTotalInput = parseFloat(val('pm-total').replace(',','.'));

  var payload = {
    cliente: { nome: nome, telefone: tel, email: val('pm-email').trim(), cpf: cpf, cep: cep, rua: rua, numero: numero, complemento: val('pm-compl').trim(), bairro: bairro, cidade: cidade, estado: estado },
    itens: _pmItens,
    frete: _pmFrete,
    pagamento: val('pm-pagamento'),
    peso: val('pm-peso'),
    valorTotal: isNaN(valorTotalInput) ? null : valorTotalInput,
    observacao: val('pm-obs').trim()
  };

  try {
    var d = await fetch(API+'/api/admin?secret='+S+'&action=criar-pedido-manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(function(r){return r.json();});
    if (d.ok) {
      var meOk = d.melhorEnvio && d.melhorEnvio.ok;
      var meDetalhe = '';
      if (!meOk && d.melhorEnvio) {
        try { meDetalhe = JSON.stringify(d.melhorEnvio.detalhe); } catch(e) { meDetalhe = String(d.melhorEnvio.detalhe); }
      }
      ct().innerHTML = '<div class="vazio" style="background:#f0fdf4;border-color:#bbf7d0">'
        + '<div style="font-size:40px;margin-bottom:10px">✅</div>'
        + '<div style="font-size:18px;font-weight:700;color:#16a34a">Pedido #'+d.pedido.numero+' criado!</div>'
        + '<div style="font-size:13px;color:#6b7280;margin-top:6px">'+(meOk ? 'Etiqueta adicionada ao carrinho do Melhor Envio ✅' : '⚠️ Pedido criado, mas houve um problema ao adicionar no Melhor Envio — adicione manualmente.')+'</div>'
        + (meDetalhe ? '<pre style="text-align:left;background:#fff;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:11px;color:#991b1b;margin-top:10px;white-space:pre-wrap;word-break:break-word;max-width:480px">'+meDetalhe.replace(/</g,'&lt;')+'</pre>' : '')
        + '<button class="btn btn-primary" id="pm-novo" style="margin-top:16px">➕ Criar outro pedido</button>'
        + '</div>';
      var bn = get('pm-novo'); if (bn) bn.addEventListener('click', function(){ renderAba('pedido-manual'); });
    } else {
      btn.disabled = false; btn.textContent = '✅ Criar Pedido e Gerar Etiqueta';
      if (msg) { msg.style.color = '#ef4444'; msg.textContent = '❌ '+(d.erro||'Erro ao criar pedido'); }
    }
  } catch (e) {
    btn.disabled = false; btn.textContent = '✅ Criar Pedido e Gerar Etiqueta';
    if (msg) { msg.style.color = '#ef4444'; msg.textContent = '❌ '+e.message; }
  }
}

// ===== CUPONS =====
async function renderCupons(){
  loading();
  try{
    var d=await fetch(API+'/api/cupons?secret='+S+'&action=listar').then(r=>r.json());
    var cupons=d.cupons||[];
    var html='<div class="form-card"><div class="form-title">🎟 Criar novo cupom</div>';
    html+='<div class="row-3"><div class="field"><label>Código</label><input id="c-cod" placeholder="KCIQUE10" oninput="this.value=this.value.toUpperCase()"></div>';
    html+='<div class="field"><label>Tipo</label><select id="c-tipo"><option value="percentual">% Percentual</option><option value="fixo">R$ Fixo</option><option value="frete_gratis">Frete Grátis</option><option value="percentual_frete">% no Frete</option><option value="percentual_mais_frete">% Desconto + Frete Grátis</option></select></div>';
    html+='<div class="field" id="campo-val"><label>Valor</label><input type="number" id="c-val" placeholder="10" min="0" step="0.01"></div></div>';
    html+='<div class="row-3"><div class="field"><label>Validade (opcional)</label><input type="datetime-local" id="c-valid"></div>';
    html+='<div class="field"><label>Limite de usos (opcional)</label><input type="number" id="c-limite" placeholder="100"></div>';
    html+='<div class="field"><label>Produto específico (opcional)</label>';
    html+='<button type="button" id="btn-toggle-prods" style="margin-top:4px;padding:6px 14px;border:1.5px solid #e8eaf0;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:13px;font-weight:600;width:100%;text-align:left;color:#374151">▶ Clique para selecionar produto</button>';
    html+='<div id="cprod-grid" style="display:none;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px;max-height:220px;overflow-y:auto;margin-top:6px;padding:2px"><div style="padding:12px;color:#9ca3af;font-size:13px">Carregando...</div></div>';
    html+='</div></div>';
    html+='<div style="display:flex;align-items:center;gap:10px"><button class="btn btn-primary" id="btn-criar-cupom">💾 Criar Cupom</button><span id="c-msg" style="font-size:13px"></span></div></div>';
    var agora=Date.now();
    var nExp=cupons.filter(function(c){return c.validade&&new Date(c.validade).getTime()<agora;}).length;
    html+='<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
    if(nExp>0)html+='<button class="btn btn-danger btn-sm" id="btn-exp-cupons">🗑 Expirados ('+nExp+')</button>';
    html+='<button class="btn btn-danger btn-sm" id="btn-del-sel-c" style="display:none">🗑 Excluir selecionados (<span id="n-sel-c">0</span>)</button>';
    html+='<button class="btn btn-danger btn-sm" id="btn-limpar-cupons">🗑 Limpar todos</button>';
    html+='</div>';
    if(!cupons.length){html+='<div class="vazio">Nenhum cupom cadastrado</div>';ct().innerHTML=html;_attachCupons();return;}
    html+='<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" id="sel-all-c"></th><th>Código</th><th>Tipo</th><th>Valor</th><th>Produto</th><th>Validade</th><th>Usos</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
    cupons.forEach(function(c){
      var exp=c.validade&&new Date(c.validade).getTime()<agora;
      html+='<tr style="'+(exp?'opacity:.6':'')+'"><td><input type="checkbox" class="cchk" data-cid="'+c.id+'" data-ccod="'+c.codigo+'"></td>';
      html+='<td><strong style="font-family:monospace">'+c.codigo+'</strong>'+(exp?' <span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:4px">Expirado</span>':'')+'</td>';
      html+='<td>'+c.tipo+'</td>';
      html+='<td>'+(c.tipo==='percentual'?c.valor+'%':c.tipo==='fixo'?fmt(c.valor):c.tipo==='frete_gratis'?'Grátis':c.tipo==='percentual_mais_frete'?c.valor+'% + Frete Grátis':c.valor+'%')+'</td>';
      html+='<td style="font-size:12px;color:#6b7280">'+(c.produto&&c.produto!=='todos'?c.produto:'Todos')+'</td>';
      html+='<td style="font-size:12px">'+(c.validade?fmtDate(c.validade):'Sem validade')+'</td>';
      html+='<td>'+(c.usos||0)+(c.limite?'/'+c.limite:'')+'</td>';
      html+='<td><span class="badge" style="background:'+(c.ativo&&!exp?'#bbf7d0':'#f3f4f6')+';color:'+(c.ativo&&!exp?'#16a34a':'#6b7280')+'">'+(c.ativo&&!exp?'Ativo':exp?'Expirado':'Inativo')+'</span></td>';
      html+='<td style="display:flex;gap:4px"><button class="btn-del" data-cid="'+c.id+'" data-action="toggle">⟳</button><button class="btn-del" data-cid="'+c.id+'" data-ccod="'+c.codigo+'" data-action="del">🗑</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
    ct().innerHTML=html;
    _attachCupons();
  }catch(e){errMsg('Erro: '+e.message);}
}
function _attachCupons(){
  var bc=get('btn-criar-cupom');if(bc)bc.addEventListener('click',salvarCupom);
  var bl=get('btn-limpar-cupons');if(bl)bl.addEventListener('click',limparCupons);
  var be=get('btn-exp-cupons');if(be)be.addEventListener('click',limparExpiradosCupons);
  var sa=get('sel-all-c');
  if(sa)sa.addEventListener('change',function(){document.querySelectorAll('.cchk').forEach(function(c){c.checked=sa.checked;});_atualizarSelCupons();});
  var bds=get('btn-del-sel-c');if(bds)bds.addEventListener('click',_delCuponsSel);
  var tipo=get('c-tipo');if(tipo)tipo.addEventListener('change',function(){var cv=get('campo-val');if(cv)cv.style.display=this.value==='frete_gratis'?'none':'block';});
  // Toggle produto grid lazy
  var btp=get('btn-toggle-prods');
  var _cpLoaded=false;
  if(btp)btp.addEventListener('click',function(){
    var g=get('cprod-grid');if(!g)return;
    var open=g.style.display!=='none';
    if(open){g.style.display='none';btp.textContent='▶ Clique para selecionar produto';return;}
    g.style.display='grid';
    var sel=Array.from(document.querySelectorAll('input[name="c-prod-chk"]:checked')).map(function(i){return i.value;});
    btp.textContent='▼ '+(sel.length?sel.length+' produto(s) selecionado(s) — fechar':'Fechar seletor');
    if(_cpLoaded)return;
    _cpLoaded=true;
    var prom=_produtos.length?Promise.resolve({produtos:_produtos}):fetch(API+'/api/admin?secret='+S+'&action=produtos-lista').then(function(r){return r.json();}).catch(function(){return {produtos:[]};});
    prom.then(function(pp){
      if(pp.produtos)_produtos=pp.produtos;
      var h2='';
      _produtos.forEach(function(p){
        var nome=p.titulo||p.nome||p.title||'';
        var preco=parseFloat(p.preco)||0;
        h2+='<label style="display:flex;align-items:center;gap:7px;padding:8px;border-radius:8px;cursor:pointer;border:1.5px solid #e8eaf0;background:#fff" class="cprod-lbl">';
        h2+='<input type="checkbox" name="c-prod-chk" value="'+nome+'" style="width:14px;height:14px;accent-color:#111;flex-shrink:0">';
        h2+=(p.imagem?'<img src="'+p.imagem+'" style="width:28px;height:28px;object-fit:cover;border-radius:5px;flex-shrink:0">':'');
        h2+='<div style="min-width:0"><div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+nome+'</div>'+(preco>0?'<div style="font-size:10px;color:#9ca3af">R$ '+preco+'</div>':'')+'</div></label>';
      });
      if(g)g.innerHTML=h2||'<div style="padding:12px;color:#9ca3af;font-size:13px">Nenhum produto</div>';
    });
  });
  // Eventos de change (checkbox cchk e cprod) e click (toggle/del)
  // Usando AbortController para remover listeners antigos ao re-renderizar
  var _ac=new AbortController();
  var _sig={signal:_ac.signal};
  ct().addEventListener('change',function(e){
    if(e.target.classList.contains('cchk'))_atualizarSelCupons();
    if(e.target.name==='c-prod-chk'){
      var lbl=e.target.closest('.cprod-lbl');
      if(lbl){lbl.style.border='1.5px solid '+(e.target.checked?'#111':'#e8eaf0');lbl.style.background=e.target.checked?'#f3f4f6':'#fff';}
      var sel=Array.from(document.querySelectorAll('input[name="c-prod-chk"]:checked')).map(function(i){return i.value;});
      var b=get('btn-toggle-prods');if(b)b.textContent='▼ '+(sel.length?sel.length+' produto(s) selecionado(s) — fechar':'Fechar seletor');
    }
  },_sig);
  ct().addEventListener('click',function(e){
    var b=e.target.closest('[data-cid]');if(!b)return;
    var act=b.getAttribute('data-action');
    if(act==='toggle'){fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle',secret:S,id:b.getAttribute('data-cid')})}).then(function(){renderCupons();});}
    if(act==='del'){if(!confirm('Deletar cupom '+b.getAttribute('data-ccod')+'?'))return;var tr=b.closest('tr');if(tr)tr.style.opacity='0.4';fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deletar',secret:S,id:b.getAttribute('data-cid')})}).then(function(){if(tr)tr.remove();});}
  },_sig);
  // Guardar abort no elemento para cancelar na próxima renderização
  var ctEl=ct();if(ctEl._cuponsAC)ctEl._cuponsAC.abort();ctEl._cuponsAC=_ac;
}
async function salvarCupom(){
  var cod=val('c-cod').trim().toUpperCase(),tipo=val('c-tipo'),v=parseFloat(val('c-val')||0),msg=get('c-msg');
  if(!cod){if(msg)msg.textContent='⚠️ Digite o código';return;}
  var btn=get('btn-criar-cupom');btn.disabled=true;btn.textContent='Salvando...';
  try{
    var prods=Array.from(document.querySelectorAll('input[name="c-prod-chk"]:checked')).map(function(i){return i.value;});
    var prodVal=prods.length?prods.join(','):null;
    var d=await fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'salvar',secret:S,codigo:cod,tipo,valor:v,ativo:true,validade:val('c-valid')||null,limiteUsos:parseInt(val('c-limite'))||null,produto:prodVal})}).then(r=>r.json());
    if(d.ok){if(msg){msg.textContent='✅ Criado!';msg.style.color='#16a34a';}setTimeout(function(){renderCupons();},800);}
    else{if(msg){msg.textContent='❌ '+(d.erro||d.error||'Erro');msg.style.color='#ef4444';}}
  }catch(e){if(msg)msg.textContent='❌ '+e.message;}
  btn.disabled=false;btn.textContent='💾 Criar Cupom';
}
function _atualizarSelCupons(){
  var sels=document.querySelectorAll('.cchk:checked');
  var btn=get('btn-del-sel-c');var n=get('n-sel-c');
  if(btn)btn.style.display=sels.length?'inline-flex':'none';
  if(n)n.textContent=sels.length;
}
async function _delCuponsSel(){
  var sels=Array.from(document.querySelectorAll('.cchk:checked'));
  if(!sels.length)return;
  if(!confirm('Excluir '+sels.length+' cupom(ns) selecionado(s)?'))return;
  for(var i=0;i<sels.length;i++){
    await fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deletar',secret:S,id:sels[i].getAttribute('data-cid')})});
  }
  renderCupons();
}
async function limparExpiradosCupons(){
  if(!confirm('Excluir todos os cupons expirados?'))return;
  var r=await fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'limpar_expirados',secret:S})});
  var d=await r.json();
  if(d.ok){alert('✅ '+d.deletados+' expirados removidos');renderCupons();}
  else{alert('❌ Erro ao remover expirados');}
}
async function limparCupons(){
  if(!confirm('Deletar TODOS os cupons?'))return;
  var r=await fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'limpar_todos',secret:S})});
  var d=await r.json();
  if(d.ok){alert('✅ '+d.deletados+' removidos');renderCupons();}
}

// ===== GRUPOS VIP =====
async function renderGrupos(){
  loading();
  try{
    var d=await fetch(API+'/api/admin?secret='+S+'&action=grupos-vip-dashboard').then(r=>r.json());
    var grupos=d.grupos||[],ga=d.grupoAtivo||{},LIMITE=1000;
    var html='<div class="form-card"><div class="form-title">🟢 Grupo Ativo: <strong>'+ga.nome+'</strong>'+(d.travadoManual?' <span class="badge" style="background:#fef3c7;color:#92400e">🔒 travado manualmente</span>':' <span class="badge" style="background:#dcfce7;color:#16a34a">🔄 automático (por vaga)</span>')+'</div>';
    if(d.travadoManual)html+='<div style="font-size:12px;color:#92400e;background:#fef9c3;border-radius:8px;padding:8px 12px;margin-bottom:10px">⚠️ O grupo ativo foi fixado manualmente e não muda sozinho mesmo se lotar. <button id="btn-destravar-grupo" style="background:none;border:none;color:#92400e;text-decoration:underline;cursor:pointer;font-weight:700;padding:0">Voltar para automático</button></div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:13px;color:#6b7280">';
    html += '<span>'+fmtN(ga.membros||0)+' membros no grupo ativo</span>';
    html += '<span style="color:#d1d5db">·</span>';
    html += '<span><strong style="color:#111">'+fmtN(d.totalMembros||0)+'</strong> total em 17 grupos</span>';
    html += '<span style="color:#d1d5db">·</span>';
    html += '<span>📈 Entradas hoje: <strong style="color:#16a34a">'+(d.entradasHoje===null||d.entradasHoje===undefined?'—':d.entradasHoje)+'</strong></span>';
    html += '</div>';
    html+='<div style="display:flex;gap:8px;margin-bottom:6px">';
    html+='<input id="inp-link" value="'+(ga.link||'')+'" style="flex:1;padding:8px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:12px;outline:none" placeholder="Novo link do grupo">';
    html+='<button class="btn btn-ghost btn-sm" id="btn-salvar-link">Salvar link</button>';
    html+='<button class="btn btn-ghost btn-sm" id="btn-copiar-link">📋 Copiar /api/grupo</button>';
    html+='<button class="btn btn-ghost btn-sm" id="btn-atualizar-contagem">🔄 Atualizar contagem agora</button>';
    html+='</div>';
    if(d.historico&&d.historico.length){
      html+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
      d.historico.forEach(function(h){html+='<div style="text-align:center;padding:8px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e8eaf0"><div style="font-size:10px;color:#9ca3af">'+h.data+'</div><div style="font-size:16px;font-weight:700">'+h.entradas+'</div></div>';});
      html+='</div>';
    }
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">';
    grupos.forEach(function(g){
      var isAtivo=g.nome===ga.nome,pct=Math.min(100,Math.round(((g.membros||0)/LIMITE)*100));
      var cor=pct>90?'#ef4444':pct>70?'#f59e0b':'#25d366';
      html+='<div style="background:#fff;border-radius:10px;border:1.5px solid '+(isAtivo?'#25d366':'#e8eaf0')+';padding:12px;'+(isAtivo?'background:#f0fff4;':'')+'">';
      html+='<div style="font-size:11px;font-weight:700;margin-bottom:3px">Grupo '+g.nome+(isAtivo?' 🟢':'')+'</div>';
      html+='<div style="font-size:17px;font-weight:700">'+fmtN(g.membros||0)+'</div>';
      html+='<div style="background:#f3f4f6;border-radius:3px;height:4px;margin:5px 0"><div style="width:'+pct+'%;height:4px;border-radius:3px;background:'+cor+'"></div></div>';
      html+='<div style="font-size:10px;color:#9ca3af">'+(LIMITE-(g.membros||0))+' vagas</div>';
      if(!isAtivo)html+='<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;font-size:10px" data-gnom="'+g.nome+'" data-glink="'+encodeURIComponent(g.link||'')+'">Definir ativo</button>';
      html+='</div>';
    });
    html+='</div>';
    if(d.aviso)html+='<div style="margin-top:12px;padding:10px;background:#fef9c3;border-radius:8px;font-size:13px;color:#92400e">⚠️ '+d.aviso+'</div>';
    ct().innerHTML=html;
    // Eventos
    var bsl=get('btn-salvar-link');
    if(bsl)bsl.addEventListener('click',function(){
      var link=val('inp-link').trim();if(!link)return;
      fetch(API+'/api/admin?secret='+S+'&action=set-grupo-ativo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:ga.nome,link})}).then(function(r){return r.json();}).then(function(d){if(d.ok){alert('✅ Link atualizado!');renderGrupos();}});
    });
    var bcl=get('btn-copiar-link');
    if(bcl)bcl.addEventListener('click',function(){navigator.clipboard.writeText('https://infinitepay-backend.vercel.app/api/grupo').then(function(){alert('Link copiado!');});});
    var bdg=get('btn-destravar-grupo');
    if(bdg)bdg.addEventListener('click',function(){
      if(!confirm('Voltar a escolher o grupo ativo automaticamente (pelo primeiro com vaga)?'))return;
      fetch(API+'/api/admin?secret='+S+'&action=limpar-grupo-manual',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(r){return r.json();}).then(function(d){if(d.ok){alert('✅ Voltou pro automático!');renderGrupos();}});
    });
    var bac=get('btn-atualizar-contagem');
    if(bac)bac.addEventListener('click',function(){
      bac.disabled=true;bac.textContent='Atualizando...';
      fetch(API+'/api/ofertas?secret='+S+'&action=snapshot-grupos').then(function(r){return r.json();}).then(function(d){
        if(d.ok){renderGrupos();}else{bac.disabled=false;bac.textContent='🔄 Atualizar contagem agora';alert('❌ '+(d.error||'Erro ao atualizar'));}
      }).catch(function(e){bac.disabled=false;bac.textContent='🔄 Atualizar contagem agora';alert('❌ '+e.message);});
    });
    ct().addEventListener('click',function(e){
      var b=e.target.closest('[data-gnom]');if(!b)return;
      var nome=b.getAttribute('data-gnom'),link=decodeURIComponent(b.getAttribute('data-glink'));
      var novoLink=prompt('Novo link para o grupo '+nome+':',link);if(!novoLink)return;
      fetch(API+'/api/admin?secret='+S+'&action=set-grupo-ativo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,link:novoLink})}).then(function(r){return r.json();}).then(function(d){if(d.ok){alert('✅ Grupo '+nome+' ativo!');renderGrupos();}});
    },{once:true});
  }catch(e){errMsg('Erro: '+e.message);}
}

// ===== BUNDLE =====
async function renderBundle(){
  loading();
  try{
    var [b,p]=await Promise.all([
      fetch(API+'/api/admin?action=bundle-lista').then(r=>r.json()),
      fetch(API+'/api/admin?secret='+S+'&action=produtos-lista').then(r=>r.json())
    ]);
    _produtos=p.produtos||[];
    _selecionados=(b.produtos||[]).map(function(x){return (x.id||x).toString();});
    _desconto=b.desconto||50;
    renderBundleHtml();
  }catch(e){errMsg('Erro: '+e.message);}
}
function renderBundleHtml(){
  var html='<div class="form-card"><div class="form-title">🎁 Configurar Bundle</div>';
  html+='<div class="field" style="width:140px"><label>Desconto em R$</label><input type="number" id="b-desc" value="'+_desconto+'"></div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:420px;overflow-y:auto;margin:14px 0">';
  _produtos.forEach(function(p){
    var sel=_selecionados.includes(p.id.toString());
    html+='<label style="display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;cursor:pointer;border:1.5px solid '+(sel?'#25d366':'#e8eaf0')+';background:'+(sel?'#f0fff4':'#fff')+'">';
    html+='<input type="checkbox" data-bid="'+p.id+'" '+(sel?'checked':'')+' style="width:15px;height:15px;accent-color:#25d366;flex-shrink:0">';
    html+=(p.imagem?'<img src="'+p.imagem+'" style="width:34px;height:34px;object-fit:cover;border-radius:6px;flex-shrink:0">':'');
    html+='<div style="min-width:0"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.nome+'</div><div style="font-size:11px;color:#9ca3af">'+fmt(p.preco/100)+'</div></div></label>';
  });
  html+='</div>';
  html+='<div style="display:flex;align-items:center;gap:10px"><button class="btn btn-primary" id="btn-salvar-bundle">💾 Salvar</button><span id="b-msg" style="font-size:13px"></span><span id="b-sel" style="font-size:13px;color:#9ca3af">'+_selecionados.length+' selecionados</span></div></div>';
  ct().innerHTML=html;
  // Checkboxes
  ct().addEventListener('change',function(e){
    var inp=e.target.closest('input[data-bid]');if(!inp)return;
    var id=inp.getAttribute('data-bid');
    if(inp.checked)_selecionados.push(id);else _selecionados=_selecionados.filter(function(x){return x!==id;});
    var lbl=inp.closest('label');
    if(lbl){lbl.style.border='1.5px solid '+(inp.checked?'#25d366':'#e8eaf0');lbl.style.background=inp.checked?'#f0fff4':'#fff';}
    var sel=get('b-sel');if(sel)sel.textContent=_selecionados.length+' selecionados';
  });
  var bs=get('btn-salvar-bundle');
  if(bs)bs.addEventListener('click',async function(){
    var desc=parseFloat(val('b-desc')||50),msg=get('b-msg');
    bs.disabled=true;bs.textContent='Salvando...';
    var d=await fetch(API+'/api/admin?action=bundle-salvar&secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produtos:_selecionados,desconto:desc})}).then(r=>r.json());
    if(msg){msg.textContent=d.ok?'✅ Salvo!':'❌ Erro';msg.style.color=d.ok?'#16a34a':'#ef4444';}
    bs.disabled=false;bs.textContent='💾 Salvar';
  });
}

// ===== RECUPERAÇÃO =====
async function renderRecuperacao() {
  loading();
  try {
    var config = await fetch(API+'/api/admin?secret='+S+'&action=recuperacao-config').then(r=>r.json()).catch(function(){return {};});
    var c = config.config || {};

    var regras = [
      { key: 'regra_identificacao', label: '📋 Preencheu identificação (nome/email)', desc: 'Pessoa preencheu dados pessoais mas não foi ao endereço' },
      { key: 'regra_frete',         label: '🚚 Abandonou no frete',                  desc: 'Pessoa calculou ou selecionou frete mas não foi ao pagamento' },
      { key: 'regra_pagamento',     label: '💳 Abandonou no pagamento',               desc: 'Pessoa clicou em pagar mas não completou' },
    ];

    var html = '';

    // Status global
    var ativo = c.ativo !== false;
    html += '<div class="form-card" style="margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between">';
    html += '<div><div class="form-title">💬 Recuperação Automática de Carrinhos</div>';
    html += '<div style="font-size:13px;color:#6b7280">Mensagens automáticas via WhatsApp para recuperar carrinhos abandonados</div></div>';
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">';
    html += '<span style="font-size:13px;font-weight:600">'+(ativo?'Ativo':'Inativo')+'</span>';
    html += '<div style="position:relative;width:44px;height:24px"><input type="checkbox" id="rec-ativo" '+(ativo?'checked':'')+'style="opacity:0;position:absolute;width:100%;height:100%;margin:0;cursor:pointer;z-index:2">';
    html += '<div id="rec-ativo-bg" style="position:absolute;inset:0;border-radius:12px;background:'+(ativo?'#25d366':'#d1d5db')+';transition:background .2s"></div>';
    html += '<div id="rec-ativo-dot" style="position:absolute;top:3px;left:'+(ativo?'23':'3')+'px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div></div></label>';
    html += '</div></div>';

    // Variáveis disponíveis
    html += '<div style="margin-bottom:16px;padding:12px 16px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;font-size:12px;color:#0369a1">';
    html += '<strong>Variáveis disponíveis nas mensagens:</strong> ';
    html += '<code>{nome}</code> · <code>{produtos}</code> · <code>{link}</code> · <code>{email}</code>';
    html += '</div>';

    // Regras
    regras.forEach(function(regra) {
      var r = c[regra.key] || {};
      var rAtivo = r.ativo !== false;
      html += '<div class="form-card" style="margin-bottom:12px">';
      html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">';
      html += '<div><div style="font-size:14px;font-weight:700">'+regra.label+'</div>';
      html += '<div style="font-size:12px;color:#9ca3af;margin-top:2px">'+regra.desc+'</div></div>';
      html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">';
      html += '<input type="checkbox" class="rec-regra-ativo" data-regra="'+regra.key+'" '+(rAtivo?'checked':'')+' style="width:16px;height:16px;accent-color:#25d366">';
      html += '<span style="font-size:12px">'+(rAtivo?'On':'Off')+'</span></label>';
      html += '</div>';
      html += '<div class="row-2">';
      html += '<div class="field"><label>Aguardar (minutos) antes de enviar</label>';
      html += '<input type="number" class="rec-delay" data-regra="'+regra.key+'" value="'+(r.delay_minutos||30)+'" min="1" max="10080" style="width:100%"></div>';
      html += '<div class="field"><label>Enviar apenas uma vez por lead</label>';
      html += '<select class="rec-reenvio" data-regra="'+regra.key+'" style="width:100%">';
      html += '<option value="1" '+(r.reenviar!==false?'selected':'')+'>Sim — não reenviar</option>';
      html += '</select></div></div>';
      html += '<div class="field"><label>Mensagem WhatsApp</label>';
      html += '<textarea class="rec-mensagem" data-regra="'+regra.key+'" rows="4" placeholder="Ex: Olá {nome}! Vi que você deixou {produtos} no carrinho...">'+(r.mensagem||'')+'</textarea></div>';
      html += '</div>';
    });

    html += '<div style="display:flex;gap:10px;align-items:center">';
    html += '<button class="btn btn-primary" id="btn-salvar-rec">💾 Salvar configurações</button>';
    html += '<button class="btn btn-ghost" id="btn-testar-rec">▶ Disparar agora</button>';
    html += '<span id="rec-msg" style="font-size:13px"></span>';
    html += '</div>';

    ct().innerHTML = html;

    // Toggle global
    var recAtivoBg = document.getElementById('rec-ativo-bg');
    var recAtivoDot = document.getElementById('rec-ativo-dot');
    document.getElementById('rec-ativo').addEventListener('change', function() {
      recAtivoBg.style.background = this.checked ? '#25d366' : '#d1d5db';
      recAtivoDot.style.left = this.checked ? '23px' : '3px';
    });

    // Salvar
    document.getElementById('btn-salvar-rec').addEventListener('click', async function() {
      var btn = this; btn.disabled=true; btn.textContent='Salvando...';
      var novaConfig = { ativo: document.getElementById('rec-ativo').checked };
      regras.forEach(function(regra) {
        novaConfig[regra.key] = {
          ativo: ct().querySelector('.rec-regra-ativo[data-regra="'+regra.key+'"]').checked,
          delay_minutos: parseInt(ct().querySelector('.rec-delay[data-regra="'+regra.key+'"]').value) || 30,
          mensagem: ct().querySelector('.rec-mensagem[data-regra="'+regra.key+'"]').value.trim(),
        };
      });
      var r = await fetch(API+'/api/admin?secret='+S+'&action=recuperacao-config-salvar', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(novaConfig)
      }).then(function(r){return r.json();});
      var msg = document.getElementById('rec-msg');
      if (r.ok) { msg.textContent='✅ Salvo!'; msg.style.color='#16a34a'; }
      else { msg.textContent='❌ Erro'; msg.style.color='#ef4444'; }
      btn.disabled=false; btn.textContent='💾 Salvar configurações';
      setTimeout(function(){ msg.textContent=''; }, 3000);
    });

    // Disparar agora
    document.getElementById('btn-testar-rec').addEventListener('click', async function() {
      var btn=this; btn.disabled=true; btn.textContent='Disparando...';
      var r = await fetch(API+'/api/recuperacao?secret='+S, {method:'POST'}).then(function(r){return r.json();}).catch(function(){return {ok:false};});
      var msg = document.getElementById('rec-msg');
      if (r.ok) { msg.textContent='✅ '+r.disparos+' mensagens enviadas'; msg.style.color='#16a34a'; }
      else { msg.textContent='❌ Erro ao disparar'; msg.style.color='#ef4444'; }
      btn.disabled=false; btn.textContent='▶ Disparar agora';
    });

  } catch(e) { errMsg('Erro: '+e.message); }
}



// Popup de foto
function abrirFoto(src) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  overlay.onclick = function() { document.body.removeChild(overlay); };
  var img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.6);object-fit:contain';
  img.onclick = function(e) { e.stopPropagation(); };
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

// ===== ROLETA =====
async function renderRoleta(force) {
  loading();
  try {
    var [cfg, hist] = await Promise.all([
      fetch(API+'/api/roleta?action=config').then(function(r){return r.json();}),
      fetch(API+'/api/roleta?action=historico&secret='+S).then(function(r){return r.json();}).catch(function(){return {historico:[]};})
    ]);
    var itens = cfg.itens || [];
    var historico = hist.historico || [];
    var aberta = cfg.aberta !== false;
    window._rkItens = JSON.parse(JSON.stringify(itens));

    var itensHtml = itens.map(function(it, i) {
      var row = '<tr>';
      row += '<td style="padding:8px 4px"><input type="color" value="'+(it.cor||'#333')+'" data-i="'+i+'" data-f="cor" onchange="rkUpd(this)" style="width:36px;height:28px;padding:0;border:1px solid #e8eaf0;border-radius:4px;cursor:pointer"></td>';
      row += '<td style="padding:8px 4px"><input type="text" value="'+(it.label||'')+'" data-i="'+i+'" data-f="label" onchange="rkUpd(this)" placeholder="Ex: 10% OFF" style="width:130px;padding:6px 8px;border:1px solid #e8eaf0;border-radius:6px;font-size:13px"></td>';
      row += '<td style="padding:8px 4px"><input type="number" value="'+(it.prob||10)+'" data-i="'+i+'" data-f="prob" onchange="rkUpd(this)" min="1" max="100" style="width:60px;padding:6px 8px;border:1px solid #e8eaf0;border-radius:6px;font-size:13px"></td>';
      row += '<td style="padding:8px 4px"><input type="text" value="'+(it.cupom||'')+'" data-i="'+i+'" data-f="cupom" onchange="rkUpd(this)" placeholder="Ex: SPIN10" style="width:110px;padding:6px 8px;border:1px solid #e8eaf0;border-radius:6px;font-size:13px;text-transform:uppercase"></td>';
      row += '<td style="padding:8px 4px"><input type="text" value="'+(it.mensagem||'')+'" data-i="'+i+'" data-f="mensagem" onchange="rkUpd(this)" placeholder="(sem cupom)" style="width:140px;padding:6px 8px;border:1px solid #e8eaf0;border-radius:6px;font-size:13px"></td>';
      row += '<td style="padding:8px 4px"><button onclick="rkRemove('+i+')" style="padding:4px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">&#10005;</button></td>';
      row += '</tr>';
      return row;
    }).join('');

    var histHtml = historico.length ? historico.slice(0,50).map(function(h){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px">'
        + '<span style="font-weight:600">'+(h.premio||'')+'</span>'
        + '<span style="color:#6b7280;font-size:12px">'+(h.ts ? new Date(h.ts).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : (h.data||''))+'</span>'
        + '<span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:#374151">'+(h.cupom||'sem cupom')+'</span>'
        + '</div>';
    }).join('')
    : '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:13px">Nenhum giro registrado ainda</div>';

    var html = '<div style="padding:24px;max-width:900px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      + '<h2 style="font-size:20px;font-weight:700">&#127905; Roleta de Prêmios</h2>'
      + '<button onclick="rkToggle()" id="rk-toggle-btn" style="padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;'+(aberta?'background:#fee2e2;color:#dc2626':'background:#dcfce7;color:#16a34a')+'">'+(aberta?'&#128274; Fechar Roleta':'&#128275; Abrir Roleta')+'</button>'
      + '</div>'
      + '<div id="rk-status-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:20px;'+(aberta?'background:#dcfce7;color:#16a34a':'background:#fee2e2;color:#dc2626')+'">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:'+(aberta?'#16a34a':'#dc2626')+'"></span>'
      + (aberta?'Roleta aberta ao público':'Roleta fechada')
      + '</div>'
      + '<p style="color:#6b7280;font-size:13px;margin-bottom:24px">Configure os itens da roleta. A probabilidade é relativa — os valores não precisam somar 100.</p>'
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px;margin-bottom:20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<span style="font-size:14px;font-weight:700">Itens da Roleta</span>'
      + '<button onclick="rkAdd()" style="padding:7px 16px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">+ Adicionar item</button>'
      + '</div>'
      + '<div style="overflow-x:auto">'
      + '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">'
      + '<th style="padding:4px;text-align:left;font-weight:600">Cor</th>'
      + '<th style="padding:4px;text-align:left;font-weight:600">Label</th>'
      + '<th style="padding:4px;text-align:left;font-weight:600">Chance</th>'
      + '<th style="padding:4px;text-align:left;font-weight:600">Cupom</th>'
      + '<th style="padding:4px;text-align:left;font-weight:600">Mensagem</th>'
      + '<th></th>'
      + '</tr></thead>'
      + '<tbody id="rk-tbody">' + itensHtml + '</tbody>'
      + '</table></div>'
      + '<div style="margin-top:16px;display:flex;gap:12px;align-items:center">'
      + '<button onclick="rkSalvar()" id="rk-save-btn" style="padding:10px 24px;background:#111;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Salvar configuração</button>'
      + '<a href="https://kcique.com.br/pages/roleta" target="_blank" style="font-size:13px;color:#2563eb;text-decoration:none">Ver roleta ao vivo &#8594;</a>'
      + '</div></div>'
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px">'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:16px">Últimos giros ('+historico.length+')</div>'
      + histHtml
      + '</div></div>';

    document.getElementById('content').innerHTML = html;
  } catch(e) {
    document.getElementById('content').innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Erro: ' + e.message + '</div>';
  }
}
window.rkToggle = async function() {
  var btn = document.getElementById('rk-toggle-btn');
  var badge = document.getElementById('rk-status-badge');
  if (!btn) return;
  var isOpen = btn.innerHTML.includes('Fechar');
  var novaSituacao = !isOpen;
  btn.disabled = true;
  try {
    var r = await fetch(API+'/api/roleta?action=toggle-status&secret='+S, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ aberta: novaSituacao })
    });
    var d = await r.json();
    if (d.ok) {
      if (novaSituacao) {
        btn.style.background='#fee2e2'; btn.style.color='#dc2626';
        btn.innerHTML='&#128274; Fechar Roleta';
        badge.style.background='#dcfce7'; badge.style.color='#16a34a';
        badge.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;margin-right:6px"></span>Roleta aberta ao público';
      } else {
        btn.style.background='#dcfce7'; btn.style.color='#16a34a';
        btn.innerHTML='&#128275; Abrir Roleta';
        badge.style.background='#fee2e2'; badge.style.color='#dc2626';
        badge.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#dc2626;display:inline-block;margin-right:6px"></span>Roleta fechada';
      }
    } else { alert('Erro ao alterar status'); }
  } catch(e) { alert('Erro: '+e.message); }
  btn.disabled = false;
};
window.rkUpd = function(el) {
  var i=parseInt(el.dataset.i), f=el.dataset.f;
  if (!window._rkItens||!window._rkItens[i]) return;
  window._rkItens[i][f] = f==='prob' ? parseInt(el.value)||1 : el.value;
};
window.rkAdd = function() {
  if (!window._rkItens) window._rkItens=[];
  var colors=['#1a1a1a','#2d6a4f','#1d4e89','#5c2a8c','#b5451b','#d35400'];
  window._rkItens.push({label:'Novo item',cor:colors[window._rkItens.length%colors.length],fg:'#fff',prob:10,cupom:'',mensagem:''});
  renderRoleta();
};
window.rkRemove = function(i) {
  if (!window._rkItens) return;
  window._rkItens.splice(i,1);
  renderRoleta();
};
window.rkSalvar = async function() {
  var btn = document.getElementById('rk-save-btn');
  if (!btn) return;
  btn.textContent = 'Salvando...'; btn.disabled = true;
  try {
    var r = await fetch(API+'/api/roleta?action=salvar-config&secret='+S, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: window._rkItens })
    });
    var d = await r.json();
    btn.textContent = d.ok ? '✅ Salvo!' : '❌ Erro';
    setTimeout(function(){ btn.textContent='Salvar configuração'; btn.disabled=false; }, 2000);
  } catch(e) {
    btn.textContent = '❌ Erro'; btn.disabled = false;
  }
};

// ===== ATENDIMENTO =====
async function renderAtendimento() {
  loading();
  try {
    var [ticketsR, statsR] = await Promise.all([
      fetch(API+'/api/bot?action=listar-tickets&secret='+S).then(r=>r.json()).catch(()=>({tickets:[]})),
      fetch(API+'/api/bot?action=stats&secret='+S).then(r=>r.json()).catch(()=>({ativos:0,problemas:0,trocas:0}))
    ]);
    var tickets = ticketsR.tickets || [];
    var stats = statsR;
    var html = '';

    // Stats
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">';
    html += '<div class="stat-card"><div class="stat-label">🎧 Total Tickets</div><div class="stat-value">'+tickets.length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">🔴 Abertos</div><div class="stat-value" style="color:#ef4444">'+tickets.filter(function(t){return t.status==='aberto';}).length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">🔄 Em Atendimento</div><div class="stat-value" style="color:#f59e0b">'+tickets.filter(function(t){return t.status==='em_atendimento';}).length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">✅ Resolvidos</div><div class="stat-value" style="color:#16a34a">'+tickets.filter(function(t){return t.status==='resolvido';}).length+'</div></div>';
    html += '</div>';

    // Filtros
    html += '<div id="ticket-filtros" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="btn btn-ghost btn-sm" style="background:#1a1a2e;color:#fff" data-f="todos">Todos</button>';
    html += '<button class="btn btn-ghost btn-sm" data-f="aberto">🔴 Abertos</button>';
    html += '<button class="btn btn-ghost btn-sm" data-f="em_atendimento">🔄 Em Atendimento</button>';
    html += '<button class="btn btn-ghost btn-sm" data-f="problema">⚠️ Problemas</button>';
    html += '<button class="btn btn-ghost btn-sm" data-f="troca">🔁 Trocas</button>';
    html += '<button class="btn btn-ghost btn-sm" data-f="resolvido">✅ Resolvidos</button>';
    html += '</div>';

    if (!tickets.length) {
      html += '<div class="vazio">Nenhum ticket de atendimento ainda</div>';
      ct().innerHTML = html;
      return;
    }

    // Lista de tickets
    html += '<div id="tickets-lista">';
    html += _renderTicketsList(tickets, 'todos');
    html += '</div>';

    window._todosTickets = tickets;
    ct().innerHTML = html;
    _attachAtendimento();
  } catch(e) { errMsg('Erro: '+e.message); }
}

function _attachAtendimento() {
  // Filtros via event delegation
  var filtros = document.getElementById('ticket-filtros');
  if (filtros) filtros.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-f]');
    if (!btn) return;
    filtros.querySelectorAll('[data-f]').forEach(function(b) {
      b.style.background = ''; b.style.color = '';
    });
    btn.style.background = '#1a1a2e'; btn.style.color = '#fff';
    var lista = document.getElementById('tickets-lista');
    if (lista && window._todosTickets) lista.innerHTML = _renderTicketsList(window._todosTickets, btn.getAttribute('data-f'));
    _attachTicketsActions();
  });
  _attachTicketsActions();
}

function _attachTicketsActions() {
  // Atualizar ticket via data-tid/data-tact
  ct().querySelectorAll('[data-tid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      atualizarTicket(this.getAttribute('data-tid'), this.getAttribute('data-tact'));
    });
  });
  // Abrir foto via data-foto
  ct().querySelectorAll('[data-foto]').forEach(function(img) {
    img.addEventListener('click', function() {
      abrirFoto(this.getAttribute('data-foto'));
    });
  });
}

function _renderTicketsList(tickets, filtro) {
  var lista = filtro === 'todos' ? tickets : tickets.filter(function(t) {
    if (filtro === 'problema') return t.tipo === 'problema';
    if (filtro === 'troca') return t.tipo === 'troca';
    return t.status === filtro;
  });
  if (!lista.length) return '<div class="vazio">Nenhum ticket nesta categoria</div>';

  var corStatus = {aberto:'#ef4444', em_atendimento:'#f59e0b', resolvido:'#16a34a'};
  var labelStatus = {aberto:'🔴 Aberto', em_atendimento:'🔄 Em Atendimento', resolvido:'✅ Resolvido'};
  var corTipo = {problema:'#ef4444', troca:'#2563eb'};
  var labelTipo = {problema:'⚠️ Problema', troca:'🔁 Troca'};

  var html = '<div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Pedido</th><th>Descrição</th><th>Mídias</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>';
  lista.slice().reverse().forEach(function(t) {
    var midias = t.midias || [];
    html += '<tr>';
    html += '<td><div style="font-weight:600;font-size:13px">'+( t.nome||t.telefone)+'</div><div style="font-size:11px;color:#9ca3af">'+t.telefone+'</div></td>';
    html += '<td><span style="background:'+(corTipo[t.tipo]||'#6b7280')+'20;color:'+(corTipo[t.tipo]||'#6b7280')+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">'+(labelTipo[t.tipo]||t.tipo)+'</span></td>';
    html += '<td style="font-size:12px">'+(t.pedido||'—')+'</td>';
    html += '<td style="max-width:200px;font-size:12px;color:#374151">'+(t.descricao||'—').substring(0,80)+(t.descricao&&t.descricao.length>80?'...':'')+'</td>';
    html += '<td>';
    midias.forEach(function(m) {
      if (m.tipo==='image') html += '<img src="'+m.url+'" data-foto="'+m.url+'" style="width:36px;height:36px;object-fit:cover;border-radius:5px;cursor:pointer;margin-right:3px">';
      else if (m.tipo==='video') html += '<a href="'+m.url+'" target="_blank" style="font-size:11px;color:#2563eb">🎥 vídeo</a> ';
      else if (m.tipo==='document') html += '<a href="'+m.url+'" target="_blank" style="font-size:11px;color:#2563eb">📄 doc</a> ';
    });
    if (!midias.length) html += '<span style="color:#9ca3af;font-size:12px">—</span>';
    html += '</td>';
    html += '<td><span style="background:'+(corStatus[t.status]||'#6b7280')+'20;color:'+(corStatus[t.status]||'#6b7280')+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">'+(labelStatus[t.status]||t.status)+'</span></td>';
    html += '<td style="font-size:11px;color:#9ca3af;white-space:nowrap">'+fmtDate(t.criado_em)+'</td>';
    html += '<td style="white-space:nowrap">';
    if (t.status!=='resolvido') {
      html += '<button data-tid="'+t.id+'" data-tact="em_atendimento" style="padding:4px 8px;background:#fef3c7;color:#92400e;border:none;border-radius:5px;font-size:11px;cursor:pointer;margin-right:4px">Atender</button>';
      html += '<button data-tid="'+t.id+'" data-tact="resolvido" style="padding:4px 8px;background:#dcfce7;color:#16a34a;border:none;border-radius:5px;font-size:11px;cursor:pointer">Resolver</button>';
    }
    if (t.telefone) {
      var wppMsg = encodeURIComponent('Olá '+( t.nome||'').split(' ')[0]+'! Aqui é da Kcique Relógios. Estamos analisando seu atendimento e já entramos em contato em breve! ⌚');
      html += ' <a href="https://wa.me/55'+t.telefone.replace(/\D/g,'')+"?text="+wppMsg+'" target="_blank" style="padding:4px 8px;background:#dcfce7;color:#16a34a;border:none;border-radius:5px;font-size:11px;cursor:pointer;text-decoration:none">💬</a>';
    }
    html += '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function filtrarTickets(btn, filtro) {
  document.querySelectorAll('[data-f]').forEach(function(b){b.style.background='';b.style.color='';});
  btn.style.background='#1a1a2e';btn.style.color='#fff';
  var lista = document.getElementById('tickets-lista');
  if (lista && window._todosTickets) lista.innerHTML = _renderTicketsList(window._todosTickets, filtro);
}

async function atualizarTicket(id, status) {
  await fetch(API+'/api/bot?action=atualizar-ticket&secret='+S, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({id, status})
  });
  renderAtendimento();
}

// ===== INBOX =====
var _inboxContatos = [];
var _inboxContatoAtivo = null;
var _inboxMsgs = [];

async function renderInbox() {
  loading();
  try {
    var [statsR, contatosR] = await Promise.all([
      fetch(API+'/api/inbox?action=stats&secret='+S).then(r=>r.json()).catch(()=>({dias:[],msgsHoje:0,totalContatos:0})),
      fetch(API+'/api/inbox?action=contatos&secret='+S).then(r=>r.json()).catch(()=>({contatos:[]}))
    ]);
    _inboxContatos = contatosR.contatos || [];
    var stats = statsR;

    var html = '';

    // ── MÉTRICAS ──
    var msgsOntem = stats.msgsOntem || 0;
    var varMsgs = msgsOntem > 0 ? ((stats.msgsHoje - msgsOntem) / msgsOntem * 100).toFixed(0) : null;
    // Botão limpar LIDs
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">';
    html += '<button onclick="limparLids()" style="padding:7px 14px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">🗑 Limpar contatos inválidos (LID)</button>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">';
    html += '<div class="stat-card" style="border-left:3px solid #25d366"><div class="stat-label">💬 Mensagens Hoje</div><div class="stat-value">'+stats.msgsHoje+'</div>'+(varMsgs!==null?'<div class="stat-sub" style="color:'+(varMsgs>=0?'#16a34a':'#ef4444')+'">'+(varMsgs>=0?'▲':'▼')+' '+Math.abs(varMsgs)+'% vs ontem</div>':'')+'</div>';
    html += '<div class="stat-card"><div class="stat-label">👥 Total de Contatos</div><div class="stat-value">'+stats.totalContatos+'</div></div>';
    var clientes = _inboxContatos.filter(function(c){return c.ehCliente;}).length;
    html += '<div class="stat-card" style="border-left:3px solid #2563eb"><div class="stat-label">🛍 Clientes Identificados</div><div class="stat-value">'+clientes+'</div><div class="stat-sub">'+Math.round(clientes/Math.max(1,stats.totalContatos)*100)+'% dos contatos</div></div>';
    var naoLidas = _inboxContatos.reduce(function(s,c){return s+(c.naoLidas||0);},0);
    html += '<div class="stat-card" style="border-left:3px solid #f59e0b"><div class="stat-label">🔔 Não Lidas</div><div class="stat-value" style="color:'+(naoLidas>0?'#f59e0b':'#111')+'">'+naoLidas+'</div></div>';
    html += '</div>';

    // ── GRÁFICO ──
    if (stats.dias && stats.dias.length) {
      var maxVal = Math.max.apply(null, stats.dias.map(function(d){return d.total;})) || 1;
      html += '<div class="stat-card" style="margin-bottom:20px;padding:20px">';
      html += '<div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:14px;text-transform:uppercase;letter-spacing:.04em">Mensagens recebidas — últimos 30 dias</div>';
      html += '<div style="display:flex;align-items:flex-end;gap:3px;height:80px">';
      stats.dias.forEach(function(d) {
        var h = Math.max(4, Math.round((d.total/maxVal)*80));
        var isHoje = d.data === new Date().toISOString().split('T')[0];
        var dd = d.data.split('-');
        var label = dd[2]+'/'+dd[1];
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px" title="'+label+': '+d.total+' msgs">';
        html += '<div style="width:100%;height:'+h+'px;background:'+(isHoje?'#25d366':'#bbf7d0')+';border-radius:3px 3px 0 0;min-height:4px"></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-top:4px"><span>'+stats.dias[0]?.data.split('-').slice(1).join('/')+'</span><span>hoje</span></div>';
      html += '</div>';
    }

    // ── LAYOUT CONVERSAS ──
    html += '<div style="display:grid;grid-template-columns:320px 1fr;gap:0;background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden;height:600px">';

    // Lista de contatos
    html += '<div style="border-right:1px solid #e8eaf0;display:flex;flex-direction:column;height:600px">';
    html += '<div style="padding:12px;border-bottom:1px solid #f3f4f6">';
    html += '<input id="inbox-busca" placeholder="🔍 Buscar conversa..." style="width:100%;padding:8px 12px;border:1px solid #e8eaf0;border-radius:8px;font-size:13px;outline:none;font-family:inherit">';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap">';
    ['Todos','cliente','possivel_cliente','vip','fornecedor','sem_etiqueta'].forEach(function(f,i){
      html += '<button class="inbox-filtro'+(i===0?' ativo':'')+'" data-f="'+f+'" style="padding:3px 10px;border-radius:20px;border:1px solid #e8eaf0;background:'+(i===0?'#1a1a2e':'#fff')+';color:'+(i===0?'#fff':'#6b7280')+';font-size:11px;cursor:pointer;font-weight:600">'+
        (f==='Todos'?'Todos':f==='cliente'?'🛍 Cliente':f==='possivel_cliente'?'👤 Possível':f==='vip'?'⭐ VIP':f==='fornecedor'?'📦 Fornecedor':'Sem etiqueta')+'</button>';
    });
    html += '</div>';
    html += '<div id="inbox-lista" style="flex:1;overflow-y:auto">';
    html += _renderContatosLista(_inboxContatos, 'Todos', '');
    html += '</div></div>';

    // Área da conversa
    html += '<div id="inbox-conversa" style="display:flex;flex-direction:column;height:600px">';
    html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px">Selecione uma conversa</div>';
    html += '</div>';
    html += '</div>';

    ct().innerHTML = html;
    _attachInbox();
  } catch(e) { errMsg('Erro: '+e.message); }
}

function _etiquetaCor(etiqueta) {
  var cores = {cliente:'#16a34a',possivel_cliente:'#2563eb',vip:'#f59e0b',fornecedor:'#7c3aed',bloqueado:'#ef4444'};
  var labels = {cliente:'Cliente',possivel_cliente:'Possível cliente',vip:'VIP',fornecedor:'Fornecedor',bloqueado:'Bloqueado'};
  return { cor: cores[etiqueta]||'#9ca3af', label: labels[etiqueta]||etiqueta };
}

function _renderContatosLista(contatos, filtro, busca) {
  var lista = contatos.filter(function(c) {
    if (filtro === 'sem_etiqueta') return !c.etiqueta;
    if (filtro !== 'Todos') return c.etiqueta === filtro;
    return true;
  }).filter(function(c) {
    if (!busca) return true;
    var q = busca.toLowerCase();
    return (c.nome||c.phone||'').toLowerCase().includes(q) || (c.phone||'').includes(q);
  });
  if (!lista.length) return '<div style="padding:24px;text-align:center;color:#9ca3af;font-size:13px">Nenhuma conversa</div>';
  return lista.map(function(c) {
    var isAtivo = _inboxContatoAtivo === c.phone;
    var et = c.etiqueta ? _etiquetaCor(c.etiqueta) : null;
    var hora = c.ultimoContato ? new Date(c.ultimoContato).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    var iniciais = (c.nome||c.phone||'?').split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div class="inbox-item" data-phone="'+c.phone+'" style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid #f9f9f9;background:'+(isAtivo?'#f0fdf4':'#fff')+';border-left:3px solid '+(isAtivo?'#25d366':'transparent')+'">' 
      + '<div style="position:relative;flex-shrink:0">'
        + (c.foto ? '<img src="'+c.foto+'" style="width:42px;height:42px;border-radius:50%;object-fit:cover">'
          : '<div style="width:42px;height:42px;border-radius:50%;background:#e8eaf0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#6b7280">'+iniciais+'</div>')
        + (c.ehCliente ? '<div style="position:absolute;bottom:0;right:0;width:14px;height:14px;background:#25d366;border-radius:50%;border:2px solid #fff" title="Cliente"></div>' : '')
      + '</div>'
      + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<div style="font-size:13px;font-weight:600;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(c.nome||c.phone)+'</div>'
          + '<div style="font-size:10px;color:#9ca3af;flex-shrink:0;margin-left:6px">'+hora+'</div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">'
          + '<div style="font-size:12px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+(c.ultimaMensagem||'').substring(0,35)+'</div>'
          + (c.naoLidas ? '<div style="background:#25d366;color:#fff;border-radius:50%;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-left:4px">'+c.naoLidas+'</div>' : '')
        + '</div>'
        + (et ? '<div style="margin-top:3px"><span style="font-size:10px;font-weight:600;color:'+et.cor+';background:'+et.cor+'15;padding:1px 7px;border-radius:20px">'+et.label+'</span></div>' : '')
      + '</div>'
    + '</div>';
  }).join('');
}

async function abrirConversa(phone) {
  _inboxContatoAtivo = phone;
  // Atualizar seleção visual
  document.querySelectorAll('.inbox-item').forEach(function(el){
    var isAtivo = el.getAttribute('data-phone') === phone;
    el.style.background = isAtivo ? '#f0fdf4' : '#fff';
    el.style.borderLeft = '3px solid ' + (isAtivo ? '#25d366' : 'transparent');
  });
  var area = document.getElementById('inbox-conversa');
  if (!area) return;
  area.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center"><div class="spin"></div></div>';

  // Marcar como lido
  fetch(API+'/api/inbox?action=marcar-lido&secret='+S, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});

  try {
    var [msgsR, contatoData] = await Promise.all([
      fetch(API+'/api/inbox?action=mensagens&secret='+S+'&phone='+encodeURIComponent(phone)).then(r=>r.json()),
      kvGetContato(phone)
    ]);
    _inboxMsgs = msgsR.mensagens || [];
    var contato = contatoData || _inboxContatos.find(function(c){return c.phone===phone;}) || {phone};

    var et = contato.etiqueta ? _etiquetaCor(contato.etiqueta) : null;
    var iniciais = (contato.nome||phone).split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();

    var html = '';
    // Header da conversa
    html += '<div style="padding:12px 16px;border-bottom:1px solid #e8eaf0;display:flex;align-items:center;gap:10px;background:#fafafa">';
    html += (contato.foto?'<img src="'+contato.foto+'" style="width:38px;height:38px;border-radius:50%;object-fit:cover">'
      :'<div style="width:38px;height:38px;border-radius:50%;background:#e8eaf0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#6b7280">'+iniciais+'</div>');
    html += '<div style="flex:1">';
    html += '<div style="font-size:14px;font-weight:600">'+(contato.nome||phone)+'</div>';
    html += '<div style="font-size:11px;color:#9ca3af">'+phone+(contato.ehCliente?' · <span style="color:#25d366;font-weight:600">✓ Cliente</span>':'')+'</div>';
    html += '</div>';
    // Painel direito: etiqueta + identificar
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<select id="inbox-etiqueta" data-phone="'+phone+'" style="padding:5px 8px;border:1px solid #e8eaf0;border-radius:8px;font-size:12px;outline:none;color:#374151">';
    ['','cliente','possivel_cliente','vip','fornecedor','bloqueado'].forEach(function(e2){
      html += '<option value="'+e2+'" '+(contato.etiqueta===e2?'selected':'')+'>'+(!e2?'Sem etiqueta':_etiquetaCor(e2).label)+'</option>';
    });
    html += '</select>';
    if (!contato.ehCliente) {
      html += '<button data-action="identificar" data-phone="'+phone+'" style="padding:5px 10px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">🔍 Identificar</button>';
    }
    if (contato.dadosShopify) {
      var sh = contato.dadosShopify;
      html += '<div style="font-size:11px;color:#374151;background:#f9fafb;padding:5px 10px;border-radius:8px;border:1px solid #e8eaf0">'+sh.totalPedidos+' pedidos · R$ '+sh.totalGasto.toFixed(2).replace('.',',')+' gastos</div>';
    }
    html += '</div>';
    html += '</div>';

    // Mensagens
    html += '<div id="inbox-msgs-area" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:6px;background:#f0f2f5">';
    if (!_inboxMsgs.length) {
      html += '<div style="text-align:center;color:#9ca3af;font-size:13px;margin-top:40px">Nenhuma mensagem salva</div>';
    } else {
      _inboxMsgs.forEach(function(msg) {
        html += _renderMensagem(msg);
      });
    }
    html += '</div>';

    // Input resposta
    html += '<div style="padding:10px 14px;border-top:1px solid #e8eaf0;display:flex;gap:8px;align-items:flex-end;background:#fff">';
    html += '<textarea id="inbox-reply" placeholder="Digite uma mensagem..." style="flex:1;padding:9px 12px;border:1px solid #e8eaf0;border-radius:20px;font-size:13px;font-family:inherit;resize:none;outline:none;min-height:40px;max-height:120px;line-height:1.4" rows="1" data-action="auto-resize"></textarea>';
    html += '<button data-action="enviar-reply" data-phone="'+phone+'" style="width:40px;height:40px;border-radius:50%;background:#25d366;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">';
    html += '<svg width="18" height="18" fill="#fff" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg></button>';
    html += '</div>';

    area.innerHTML = html;
    // Scroll para o final
    var msgsDiv = document.getElementById('inbox-msgs-area');
    if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;

    // Enter para enviar (Shift+Enter = nova linha)
    var reply = document.getElementById('inbox-reply');
    if (reply) reply.addEventListener('keydown', function(e){
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta(phone); }
    });

    // Atualizar badge de não lidas na lista
    var item = document.querySelector('.inbox-item[data-phone="'+phone+'"]');
    if (item) {
      var badge = item.querySelector('[style*="border-radius:50%"]');
      if (badge) badge.remove();
    }
  } catch(e) { area.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Erro: '+e.message+'</div>'; }
}

async function kvGetContato(phone) {
  try {
    var r = await fetch(API+'/api/inbox?action=contatos&secret='+S).then(r=>r.json());
    return (r.contatos||[]).find(function(c){return c.phone===phone;}) || null;
  } catch(e) { return null; }
}

function _renderMensagem(msg) {
  var isMe = msg.fromMe;
  var hora = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
  var bg = isMe ? '#dcf8c6' : '#fff';
  var align = isMe ? 'flex-end' : 'flex-start';
  var radius = isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px';

  var conteudo = '';
  if (msg.tipo === 'text') {
    conteudo = '<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word">'+(msg.texto||'')+'</div>';
  } else if (msg.tipo === 'image') {
    conteudo = msg.mediaThumbnail || msg.mediaUrl
      ? '<div style="cursor:pointer" data-action="abrir-foto" data-url="'+msg.mediaUrl+'">'
        + '<img src="'+(msg.mediaThumbnail||msg.mediaUrl)+'" style="max-width:200px;border-radius:8px;display:block">'
        + (msg.texto ? '<div style="font-size:12px;margin-top:4px;color:#374151">'+msg.texto+'</div>' : '')
        + '</div>'
      : '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">📷 Foto — clique para ver</div>';
  } else if (msg.tipo === 'video') {
    conteudo = '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">🎥 Vídeo — clique para ver</div>';
  } else if (msg.tipo === 'audio') {
    conteudo = '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">🎤 Áudio — clique para ouvir</div>';
  } else if (msg.tipo === 'document') {
    conteudo = '<a href="'+msg.mediaUrl+'" target="_blank" style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#2563eb;display:block;text-decoration:none">📄 Documento — clique para baixar</a>';
  } else if (msg.tipo === 'sticker') {
    conteudo = msg.mediaUrl ? '<img src="'+msg.mediaUrl+'" style="width:80px">' : '🎭 Sticker';
  }

  return '<div style="display:flex;justify-content:'+align+';margin-bottom:2px">'
    + '<div style="max-width:70%;background:'+bg+';border-radius:'+radius+';padding:8px 10px;box-shadow:0 1px 2px rgba(0,0,0,.08)">'
    + conteudo
    + '<div style="font-size:10px;color:#9ca3af;text-align:right;margin-top:3px">'+hora+'</div>'
    + '</div></div>';
}

async function enviarResposta(phone) {
  var input = document.getElementById('inbox-reply');
  if (!input || !input.value.trim()) return;
  var texto = input.value.trim();
  input.value = '';
  input.style.height = '40px';

  // Adicionar mensagem na tela imediatamente
  var area = document.getElementById('inbox-msgs-area');
  if (area) {
    var tmpMsg = { fromMe:true, tipo:'text', texto, timestamp:Date.now() };
    area.insertAdjacentHTML('beforeend', _renderMensagem(tmpMsg));
    area.scrollTop = area.scrollHeight;
  }

  try {
    await fetch(API+'/api/inbox?action=enviar&secret='+S, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({phone, texto})
    });
  } catch(e) { console.error('Erro envio:', e.message); }
}

async function trocarEtiqueta(phone, etiqueta) {
  await fetch(API+'/api/inbox?action=etiqueta&secret='+S, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phone, etiqueta})
  });
  // Atualizar local
  var c = _inboxContatos.find(function(x){return x.phone===phone;});
  if (c) c.etiqueta = etiqueta;
}

async function identificarCliente(phone) {
  var btn = document.querySelector('[onclick*="identificarCliente"]');
  if (btn) { btn.textContent='Identificando...'; btn.disabled=true; }
  var r = await fetch(API+'/api/inbox?action=identificar&secret='+S, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phone})
  }).then(r=>r.json());
  if (r.ok) {
    if (r.shopify.ehCliente) {
      alert('Cliente identificado: ' + r.shopify.nome + ' - ' + r.shopify.totalPedidos + ' pedidos');
    } else {
      alert('Não encontrado como cliente no Shopify.');
    }
    abrirConversa(phone);
  }
}

function carregarMidia(url, el) {
  if (!url) return;
  el.outerHTML = '<a href="'+url+'" target="_blank" style="color:#2563eb;font-size:12px">Abrir mídia →</a>';
}

async function limparLids() {
  if (!confirm('Remover todos os contatos com número inválido (LID)?')) return;
  var r = await fetch(API+'/api/inbox?action=limpar-lids&secret='+S, {method:'POST'}).then(r=>r.json());
  if (r.ok) { alert('✅ ' + r.removidos + ' contatos inválidos removidos'); renderInbox(); }
  else { alert('❌ Erro: ' + (r.erro||'falha')); }
}

function _attachInbox() {
  // Mostrar botão delete no hover
  ct().addEventListener('mouseover', function(e) {
    var wrapper = e.target.closest('[style*="position:relative"]');
    if (wrapper) {
      var btn = wrapper.querySelector('.inbox-del-btn');
      if (btn) btn.style.opacity = '1';
    }
  });
  ct().addEventListener('mouseout', function(e) {
    var wrapper = e.target.closest('[style*="position:relative"]');
    if (wrapper) {
      var btn = wrapper.querySelector('.inbox-del-btn');
      if (btn) btn.style.opacity = '0';
    }
  });
  ct().addEventListener('click', function(e) {
    // Deletar conversa
    var delBtn = e.target.closest('.inbox-del-btn');
    if (delBtn) {
      e.stopPropagation();
      var phone = delBtn.getAttribute('data-phone');
      var nome = (_inboxContatos.find(function(c){return c.phone===phone;})||{}).nome || phone;
      if (!confirm('Apagar conversa com ' + nome + '?')) return;
      fetch(API+'/api/inbox?action=deletar-conversa&secret='+S, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({phone})
      }).then(function(r){return r.json();}).then(function(d){
        if (d.ok) {
          _inboxContatos = _inboxContatos.filter(function(c){return c.phone!==phone;});
          var lista = document.getElementById('inbox-lista');
          if (lista) lista.innerHTML = _renderContatosLista(_inboxContatos, 'Todos', '');
          if (_inboxContatoAtivo === phone) {
            _inboxContatoAtivo = null;
            var area = document.getElementById('inbox-conversa');
            if (area) area.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px">Selecione uma conversa</div>';
          }
        }
      });
      return;
    }
    // Contato
    var item = e.target.closest('.inbox-item');
    if (item) { abrirConversa(item.getAttribute('data-phone')); return; }
    // Filtro
    var filtroBtn = e.target.closest('.inbox-filtro');
    if (filtroBtn) {
      document.querySelectorAll('.inbox-filtro').forEach(function(b){b.style.background='#fff';b.style.color='#6b7280';});
      filtroBtn.style.background='#1a1a2e'; filtroBtn.style.color='#fff';
      var lista = document.getElementById('inbox-lista');
      var busca = (document.getElementById('inbox-busca')||{}).value||'';
      if (lista) lista.innerHTML = _renderContatosLista(_inboxContatos, filtroBtn.getAttribute('data-f'), busca);
      return;
    }
    // Identificar cliente
    var idBtn = e.target.closest('[data-action="identificar"]');
    if (idBtn) { identificarCliente(idBtn.getAttribute('data-phone')); return; }
    // Enviar reply
    var sendBtn = e.target.closest('[data-action="enviar-reply"]');
    if (sendBtn) { enviarResposta(sendBtn.getAttribute('data-phone')); return; }
    // Abrir foto
    var fotoDiv = e.target.closest('[data-action="abrir-foto"]');
    if (fotoDiv) { abrirFoto(fotoDiv.getAttribute('data-url')); return; }
    // Carregar mídia lazy
    var midiaDiv = e.target.closest('[data-action="carregar-midia"]');
    if (midiaDiv) {
      var url = midiaDiv.getAttribute('data-url');
      midiaDiv.outerHTML = '<a href="'+url+'" target="_blank" style="color:#2563eb;font-size:12px">Abrir mídia →</a>';
      return;
    }
  });
  // Select etiqueta change via event delegation
  ct().addEventListener('change', function(e) {
    var sel = e.target.closest('#inbox-etiqueta');
    if (sel) trocarEtiqueta(sel.getAttribute('data-phone'), sel.value);
  });
  // Textarea auto-resize
  ct().addEventListener('input', function(e) {
    var ta = e.target.closest('[data-action="auto-resize"]');
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  });
  // Busca
  var busca = document.getElementById('inbox-busca');
  if (busca) busca.addEventListener('input', function() {
    var filtroAtivo = (document.querySelector('.inbox-filtro[style*="#1a1a2e"]')||{}).getAttribute('data-f')||'Todos';
    var lista = document.getElementById('inbox-lista');
    if (lista) lista.innerHTML = _renderContatosLista(_inboxContatos, filtroAtivo, this.value);
  });
}

// INICIAR
renderAba('home');
</script>
</body>
</html>`);
}
