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
      const linkInfo = GRUPOS_LINKS.find(x => x.nome === ativo.nome) || GRUPOS_LINKS[0];
      return res.status(200).json({ grupo: ativo.nome, link: linkInfo.link, membros: ativo.membros, vagas: LIMITE - ativo.membros, fonte: 'snapshot' });
    } catch(e) {
      // Sem snapshot — buscar ao vivo no Z-API
      try {
        const GRUPOS_IDS = [
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
        const membrosArr = await Promise.all(GRUPOS_IDS.map(async g => {
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
        const linkInfo = GRUPOS_LINKS.find(x => x.nome === ativo.nome) || GRUPOS_LINKS[0];
        return res.status(200).json({ grupo: ativo.nome, link: linkInfo.link, membros: ativo.membros, vagas: 1000 - ativo.membros, fonte: 'live' });
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
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

  // ===== JSON: DASHBOARD HOME =====
  if (req.query.action === 'dashboard-home') {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=open&fulfillment_status=unfulfilled&financial_status=paid&limit=250`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
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
    const getImg = (nome) => {
      const base = nome.split(' - ')[0].trim();
      const p = prods.find(p => p.title === nome || p.title === base || p.title.includes(base));
      return p?.image?.src || '';
    };
    const topProdutos = Object.entries(prodContagem)
      .filter(([n]) => !n.toLowerCase().includes('frete') && n.length > 5)
      .map(([nome, d]) => ({ nome, ...d, imagem: getImg(nome) }))
      .sort((a,b) => b.valor - a.valor).slice(0, 5);

    return res.status(200).json({
      vendas: {
        hoje: calc(oH.orders), semana: calc(oS.orders), mes: vM, mesAnt: calc(oMA.orders),
        pendentes: (pedPendentes.orders||[]).length,
        ticketMedio: vM.count > 0 ? vM.valor / vM.count : 0,
      },
      melhorEnvio: { saldo: parseFloat(saldoME.balance || 0) },
      leads: { total: (leadsR.leads||[]).length },
      topProdutos,
    });
  }

  // ===== JSON: PEDIDOS =====
  if (req.query.action === 'pedidos-json') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const [pedidosR, prodShopify] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=50&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=100`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({products:[]})),
    ]);
    const prods = prodShopify.products || [];
    const getImg = (nome) => {
      const base = nome.split(' - ')[0].trim();
      const p = prods.find(p => p.title === nome || p.title === base || p.title.includes(base));
      return p?.image?.src || '';
    };
    const pedidos = (pedidosR.orders||[]).map(o => ({
      id: o.id, numero: o.order_number,
      cliente: o.customer ? `${o.customer.first_name||''} ${o.customer.last_name||''}`.trim() : 'Sem nome',
      produto: (o.line_items||[])[0]?.title || '',
      valor: o.total_price, financeiro: o.financial_status, fulfillment: o.fulfillment_status || 'unfulfilled',
      tracking: (o.fulfillments||[])[0]?.tracking_number || '',
      meOrderId: '', criado_em: o.created_at,
      imagem: getImg((o.line_items||[])[0]?.title || ''),
    }));
    return res.status(200).json({ pedidos });
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
        preco: p.variants && p.variants[0] ? p.variants[0].price : '0'
      }));
      return res.status(200).json({ produtos, total: produtos.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
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
      for (let i = 0; i <= 2; i++) {
        const d = new Date(hojeBR); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const r = await fetch(`${KV_URL}/get/vip-snapshot-${ds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const j = await r.json();
        let snap = j.result;
        while (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch(e) { break; } }
        if (snap && snap.grupos) { grupos = snap.grupos; break; }
      }
      // Se não tem snapshot, retornar erro amigável
      if (!grupos) {
        return res.status(200).json({ grupos: GRUPOS_LINKS.map(g=>({...g,membros:0})), grupoAtivo: GRUPOS_LINKS[0], entradasHoje: 0, historico: [], totalMembros: 0, aviso: 'Snapshot não disponível. Aguarde o cron rodar.' });
      }
      // Adicionar links aos grupos do snapshot
      grupos = grupos.map(g => ({ ...g, link: (GRUPOS_LINKS.find(l=>l.nome===g.nome)||{}).link||'' }));

      // Verificar se há grupo definido manualmente
      const manualR = await fetch(`${KV_URL}/get/grupo-ativo-manual`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const manualJ = await manualR.json();
      let manualGrupo = manualJ.result;
      while (typeof manualGrupo === 'string') { try { manualGrupo = JSON.parse(manualGrupo); } catch(e) { break; } }
      let grupoAtivo;
      if (manualGrupo && manualGrupo.link) {
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

      // Salvar snapshot de hoje
      const chaveHoje = `vip-snapshot-${hojeStr}`;
      const snapHojeResp = await fetch(`${KV_URL}/get/${chaveHoje}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const snapHojeData = await snapHojeResp.json();
      const snapHoje = snapHojeData.result ? JSON.parse(snapHojeData.result) : null;

      // Snapshot salvo pelo cron (ofertas.js)

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
      const entradasHoje = snapOntem ? Math.max(0, totalAtual - (snapOntem.total || 0)) : 0;

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
        const snap1 = r1.result ? JSON.parse(r1.result) : null;
        const snap0 = r0.result ? JSON.parse(r0.result) : null;
        const entradas = (snap1 && snap0) ? Math.max(0, snap1.total - snap0.total) : (i===0 ? entradasHoje : 0);
        historico.push({ data: ds1, entradas });
      }

      return res.status(200).json({ grupos, grupoAtivo, entradasHoje, historico, totalMembros: totalAtual });
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
    // Shopify pedidos aguardando pagamento/envio
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=open&fulfillment_status=unfulfilled&financial_status=paid&limit=250`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
    // Shopify produtos (estoque + imagens)
    fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({products:[]})),
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
      <div class="stat-card"><div class="stat-label">📦 Aguardando Envio</div><div class="stat-value" style="color:${pedidosPendentes>0?'#f59e0b':'#10b981'}">${pedidosPendentes}</div><div class="stat-sub">pedidos para postar</div></div>
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

  const getImgPedido = (titulo) => {
    const base = titulo.split(' - Cor:')[0].split(' - ')[0].trim();
    const p = (produtosSemEstoque.products||[]).find(p => p.title === titulo || p.title === base || p.title.includes(base) || base.includes(p.title));
    return p && p.image ? p.image.src : '';
  };

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
      ? encodeURIComponent('Olá ' + nome.split(' ')[0] + '! 😊 Seu pedido foi enviado!\n\n📦 Rastreie: https://www.melhorrastreio.com.br/rastreio/' + rastreios[0] + '\n\nQualquer dúvida estamos aqui! — Kcique Relógios ⌚')
      : '';
    const msgWpp = encodeURIComponent('Olá ' + nome.split(' ')[0] + '! Aqui é da Kcique Relógios. Posso te ajudar?');

    const produtosHtml = (order.line_items||[]).map(item => {
      const img = getImgPedido(item.title);
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6">'
        + (img
          ? '<img src="' + img + '" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">'
          : '<div style="width:56px;height:56px;background:#f3f4f6;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px">⌚</div>')
        + '<div>'
        + '<div style="font-size:14px;font-weight:600">' + item.title + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:2px">x' + item.quantity + ' — R$ ' + parseFloat(item.price||0).toFixed(2).replace('.',',') + '</div>'
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
          + (tel && msgRastreio ? '<a href="https://wa.me/55'+tel+'?text='+msgRastreio+'" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:8px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">📦 Enviar Rastreio</a>' : '')
          + '<button onclick="enviarFornecedor(\'' + nome.replace(/'/g,"\'") + '\',\'' + (rastreios[0]||'') + '\',\'' + getImgPedido((order.line_items&&order.line_items[0]&&order.line_items[0].title)||'').replace(/'/g,"\'") + '\',\'' + (trackingToMeId[rastreios[0]]||'') + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">🚀 Fornecedor</button>'
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
body{font-family:-apple-system,sans-serif;background:#f7f8fa;color:#1a1a2e;display:flex;min-height:100vh}
.sidebar{width:220px;background:#111;color:#fff;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:10}
.sidebar-logo{padding:24px 20px;font-size:16px;font-weight:700;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px}
.sidebar-menu{flex:1;padding:16px 0}
.menu-item{display:flex;align-items:center;gap:10px;padding:12px 20px;color:#aaa;font-size:14px;font-weight:500;transition:all 0.15s;cursor:pointer;border:none;background:none;width:100%;text-align:left;border-left:3px solid transparent}
.menu-item:hover{background:#1a1a1a;color:#fff}
.menu-item.ativo{background:#1a1a1a;color:#fff;border-left-color:#25d366}
.menu-icon{font-size:18px;width:24px;text-align:center}
.sidebar-footer{padding:16px 20px;font-size:11px;color:#444;border-top:1px solid #222}
.main{margin-left:220px;flex:1;padding:32px}
.page-title{font-size:22px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between}
.stat-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px}
.stat-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px}
.stat-value{font-size:26px;font-weight:700}
.stat-sub{font-size:12px;color:#6b7280;margin-top:4px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden}
th{background:#f9f9fb;padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e8eaf0}
td{padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:top}
tr:last-child td{border-bottom:none}tr:hover td{background:#f9f9fb}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;white-space:nowrap}
.btn-wpp{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;margin-right:4px}
.btn-del{display:inline-flex;align-items:center;padding:6px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;text-decoration:none;font-size:12px}
.vazio{text-align:center;padding:48px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}
.form-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:24px;margin-bottom:24px}
.form-title{font-size:15px;font-weight:700;margin-bottom:18px}
.field{margin-bottom:14px}
.field label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
.field input,.field textarea{width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
.field input:focus,.field textarea:focus{border-color:#25d366}
.field textarea{resize:vertical}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grupos-wrap{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.grupo-label{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid #e8eaf0;border-radius:6px;cursor:pointer;font-size:12px}
.btn-green{padding:12px 24px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.btn-green:hover{background:#1da851}
.refresh-btn{padding:8px 16px;background:#f3f4f6;border:1px solid #e8eaf0;border-radius:8px;font-size:13px;color:#374151;cursor:pointer}
.aba{display:none}.aba.ativa{display:block}
.section-divider{font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;margin-top:4px;padding-bottom:8px;border-bottom:1px solid #e8eaf0}
@media(max-width:768px){.sidebar{width:60px}.sidebar-logo span,.menu-label,.sidebar-footer{display:none}.menu-item{padding:14px;justify-content:center}.main{margin-left:60px;padding:16px}.row-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-logo">⌚ <span>Kcique Admin</span></div>
  <div class="sidebar-menu">
    <button onclick="mudarAba('home')" class="menu-item ativo" id="menu-home"><span class="menu-icon">📊</span><span class="menu-label">Visão Geral</span></button>
    <button onclick="mudarAba('carrinhos')" class="menu-item" id="menu-carrinhos"><span class="menu-icon">🛒</span><span class="menu-label">Carrinhos</span></button>
    <button onclick="mudarAba('ofertas')" class="menu-item" id="menu-ofertas"><span class="menu-icon">📣</span><span class="menu-label">Ofertas WhatsApp</span></button>
    <button onclick="mudarAba('pedidos')" class="menu-item" id="menu-pedidos"><span class="menu-icon">📦</span><span class="menu-label">Pedidos</span></button>
    <button onclick="mudarAba('cupons')" class="menu-item" id="menu-cupons"><span class="menu-icon">🎟</span><span class="menu-label">Cupons</span></button>
    <button onclick="mudarAba('grupos-vip')" class="menu-item" id="menu-grupos-vip"><span class="menu-icon">📲</span><span class="menu-label">Grupos VIP</span></button>
    <button onclick="mudarAba('bundle')" class="menu-item" id="menu-bundle"><span class="menu-icon">🎁</span><span class="menu-label">Bundle Produtos</span></button>
  </div>
  <div class="sidebar-footer">Kcique Relógios</div>
</div>
<div class="main">
  <div class="page-title">
    <span id="page-title">📊 Visão Geral</span>
    <button onclick="window.location.reload()" class="refresh-btn">🔄 Atualizar</button>
  </div>
  <div id="aba-home" class="aba ativa">${abaHome}</div>
  <div id="aba-carrinhos" class="aba">${abaCarrinhos}</div>
  <div id="aba-ofertas" class="aba">${abaOfertas}</div>
  <div id="aba-pedidos" class="aba">${abaPedidos}</div>
  <div id="aba-cupons" class="aba">${abaCupons}</div>
  <div id="aba-grupos-vip" class="aba" id="aba-grupos-vip-el">
    <div id="gvip-loading" style="text-align:center;padding:60px;color:#9ca3af">Carregando dados dos grupos...</div>
    <div id="gvip-content" style="display:none"></div>
  </div>
  <div id="aba-bundle" class="aba">
    <div id="bundle-loading" style="text-align:center;padding:60px;color:#9ca3af">Carregando produtos...</div>
    <div id="bundle-content" style="display:none"></div>
  </div>
</div>
<script>
var titulos={home:'📊 Visão Geral',carrinhos:'🛒 Carrinhos Abandonados',ofertas:'📣 Ofertas WhatsApp',pedidos:'📦 Pedidos',cupons:'🎟 Cupons de Desconto','grupos-vip':'📲 Grupos VIP',bundle:'🎁 Bundle de Produtos'};
function mudarAba(aba){
  document.querySelectorAll('.aba').forEach(function(el){el.classList.remove('ativa');});
  document.querySelectorAll('.menu-item').forEach(function(el){el.classList.remove('ativo');});
  document.getElementById('aba-'+aba).classList.add('ativa');
  document.getElementById('menu-'+aba).classList.add('ativo');
  document.getElementById('page-title').textContent=titulos[aba];
  if(aba==='grupos-vip') carregarGruposVip();
  if(aba==='bundle') carregarBundle();
}
if(window.location.hash==='#carrinhos')mudarAba('carrinhos');
if(window.location.hash==='#ofertas')mudarAba('ofertas');
if(window.location.hash==='#cupons')mudarAba('cupons');

function toggleTodos(cb){document.querySelectorAll('#grupos-wrap input').forEach(function(el){el.checked=cb.checked;});}
async function salvarOferta(){
  var msg=document.getElementById('form-msg');
  var texto=document.getElementById('f-texto').value.trim();
  var dataHoraRaw=document.getElementById('f-data').value;
  // Converter para ISO com offset de Brasília (UTC-3) explícito
  var dataHora = dataHoraRaw ? dataHoraRaw + ':00-03:00' : '';
  if(!texto){msg.textContent='⚠️ Digite o texto';msg.style.color='#ef4444';return;}
  if(!dataHoraRaw){msg.textContent='⚠️ Selecione data e hora';msg.style.color='#ef4444';return;}
  var sel=[];document.querySelectorAll('#grupos-wrap input:checked').forEach(function(el){sel.push(el.value);});
  var total=document.querySelectorAll('#grupos-wrap input').length;
  var grupos=sel.length===total?'todos':sel.join(',');
  msg.textContent='Salvando...';msg.style.color='#6b7280';
  try{
    var resp=await fetch('/api/ofertas?action=salvar&secret=${secret}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto,imagem:document.getElementById('f-imagem').value.trim(),link:document.getElementById('f-link').value.trim(),dataHora,grupos})});
    var data=await resp.json();
    if(data.success){
      msg.textContent='✅ Agendada!';msg.style.color='#10b981';
      document.getElementById('f-texto').value='';
      document.getElementById('f-imagem').value='';
      document.getElementById('f-link').value='';
      var agora2=new Date();agora2.setMinutes(agora2.getMinutes()+5);
      var pad2=function(n){return n<10?'0'+n:String(n);};
      document.getElementById('f-data').value=agora2.getFullYear()+'-'+pad2(agora2.getMonth()+1)+'-'+pad2(agora2.getDate())+'T'+pad2(agora2.getHours())+':'+pad2(agora2.getMinutes());
      setTimeout(function(){msg.textContent='';mudarAba('ofertas');},1500);
    }
    else{msg.textContent='❌ '+(data.error||'Erro');msg.style.color='#ef4444';}
  }catch(e){msg.textContent='❌ Erro de conexão';msg.style.color='#ef4444';}
}

var agora=new Date();agora.setMinutes(agora.getMinutes()+5);
var pad=function(n){return n<10?'0'+n:n;};
var min=agora.getFullYear()+'-'+pad(agora.getMonth()+1)+'-'+pad(agora.getDate())+'T'+pad(agora.getHours())+':'+pad(agora.getMinutes());
if(document.getElementById('f-data')){document.getElementById('f-data').min=min;document.getElementById('f-data').value=min;}

// Enviar pedido para fornecedor
async function enviarFornecedor(nome, tracking, imgUrl, meOrderId) {
  var btn = event.target;
  btn.textContent = '⏳ Enviando...';
  btn.disabled = true;
  try {
    // 1. Buscar dados do pedido via Vercel (rápido)
    var params = new URLSearchParams({ action: 'enviar-fornecedor', secret: '${secret}', clienteNome: nome, tracking: tracking, imgUrl: encodeURIComponent(imgUrl), meOrderId: meOrderId||'' });
    var resp = await fetch('/api/admin?' + params.toString());
    var data = await resp.json();
    if (data.ok) { btn.textContent = '✅ Enviado!'; btn.style.background = '#16a34a'; }
    else if (data.pdfPending) {
      // 2. Vercel enviou tudo exceto PDF - chamar Railway diretamente para o PDF
      btn.textContent = '⏳ PDF...';
      var pdfResp = await fetch('https://kcique-pdf-service-production.up.railway.app/send-pdf?secret=kcique2026&hash=' + data.printHash + '&phone=120363426285950378-group&nome=' + encodeURIComponent(nome) + '&tracking=' + (tracking||''));
      var pdfData = await pdfResp.json();
      btn.textContent = pdfData.ok ? '✅ Enviado!' : '⚠️ Sem PDF';
      btn.style.background = pdfData.ok ? '#16a34a' : '#f59e0b';
    } else { 
      btn.textContent = '❌ Erro'; btn.style.background = '#ef4444'; btn.disabled = false; 
    }
  } catch(e) { btn.textContent = '❌ Erro'; btn.style.background = '#ef4444'; btn.disabled = false; }
}

// Cupons
function atualizarCampoValor() {
  var tipo = document.getElementById('c-tipo').value;
  var campo = document.getElementById('campo-valor');
  campo.style.display = (tipo === 'frete_gratis') ? 'none' : 'block';
}
async function salvarCupom() {
  // Buscar campos do formulário ativo no DOM atual
  var form = document.querySelector('[id="c-codigo"]')?.closest('form') || document.getElementById('content-cupons') || document.body;
  var msg = document.getElementById('cupom-msg');
  var codigoEl = document.getElementById('c-codigo');
  var tipoEl = document.getElementById('c-tipo');
  var valorEl = document.getElementById('c-valor');
  var validadeEl = document.getElementById('c-validade');
  var limiteEl = document.getElementById('c-limite');
  if (!codigoEl || !tipoEl) { if(msg) msg.textContent = '⚠️ Formulário não encontrado'; return; }
  var codigo = codigoEl.value.trim().toUpperCase();
  var tipo = tipoEl.value;
  var valor = valorEl ? valorEl.value : '0';
  var validade = validadeEl ? validadeEl.value : '';
  var limite = limiteEl ? limiteEl.value : '';
  console.log('salvarCupom:', codigo, tipo, valor);
  if (!codigo) { msg.textContent = '⚠️ Digite o código'; msg.style.color = '#ef4444'; return; }
  msg.textContent = 'Salvando...'; msg.style.color = '#6b7280';
  try {
    var resp = await fetch('/api/cupons?secret='+encodeURIComponent('${secret}'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'salvar', secret: '${secret}', codigo: codigo, tipo: tipo, valor: parseFloat(valor)||0, validade: validade||null, limiteUsos: limite ? parseInt(limite) : null, produto: document.getElementById('c-produto').value.trim()||'todos', qtdMinima: document.getElementById('c-qtd-minima').value ? parseInt(document.getElementById('c-qtd-minima').value) : null, ativo: true })
    });
    var data = await resp.json();
    if (data.ok) { msg.textContent = '✅ Cupom criado!'; msg.style.color = '#10b981'; setTimeout(() => mudarAba('cupons'), 1500); }
    else { msg.textContent = '❌ ' + (data.erro||'Erro'); msg.style.color = '#ef4444'; }
  } catch(e) { msg.textContent = '❌ Erro'; msg.style.color = '#ef4444'; }
}
async function toggleCupom(id) {
  var resp = await fetch('/api/cupons?secret='+encodeURIComponent('${secret}'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'toggle', secret: '${secret}', id: id }) });
  var data = await resp.json();
  if (data.ok) window.location.reload();
}
async function limparOfertas() {
  if (!confirm('Deletar todas as ofertas enviadas e com erro? As agendadas serão mantidas.')) return;
  var btn = event.target;
  btn.disabled = true; btn.textContent = 'Limpando...';
  try {
    var resp = await fetch('/api/ofertas?action=limpar_enviadas&secret=${secret}');
    var data = await resp.json();
    if (data.ok) {
      alert('✅ ' + data.deletadas + ' ofertas removidas!');
      location.reload();
    } else {
      alert('Erro: ' + (data.error || 'desconhecido'));
      btn.disabled = false; btn.textContent = '🗑 Limpar todas enviadas';
    }
  } catch(e) {
    alert('Erro de conexão');
    btn.disabled = false; btn.textContent = '🗑 Limpar todas enviadas';
  }
}

async function deletarCupom(id, codigo) {
  if (!confirm('Deletar cupom ' + codigo + '?')) return;
  var resp = await fetch('/api/cupons?secret='+encodeURIComponent('${secret}'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'deletar', secret: '${secret}', id: id }) });
  var data = await resp.json();
  if (data.ok) window.location.reload();
}

// Carregar aba Grupos VIP
var gvipCarregado = false;
async function carregarGruposVip() {
  if (gvipCarregado) return;
  gvipCarregado = true;
  var loading = document.getElementById('gvip-loading');
  var el = document.getElementById('gvip-content');
  try {
    var resp = await fetch('/api/admin?action=grupos-vip-dashboard&secret=${secret}');
    var data = await resp.json();
    if (!data.grupos) { loading.textContent = 'Erro ao carregar'; return; }

    var LIMITE = 1000;
    var ga = data.grupoAtivo;
    var pct = Math.min(100, Math.round((ga.membros / LIMITE) * 100));
    var vagas = LIMITE - ga.membros;

    // Cards superiores
    var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">';
    html += '<div class="stat-card" style="border-color:#2563eb">';
    html += '<div class="stat-label">📲 Grupo Ativo Agora</div>';
    html += '<div class="stat-value">' + ga.nome + '</div>';
    html += '<div class="stat-sub">' + ga.membros + ' membros · ' + vagas + ' vagas</div>';
    html += '<div style="background:#f3f4f6;border-radius:6px;height:8px;margin-top:10px"><div style="background:#2563eb;height:8px;border-radius:6px;width:' + pct + '%"></div></div>';
    html += '<a href="' + ga.link + '" target="_blank" style="display:inline-block;margin-top:10px;font-size:12px;color:#2563eb">Ver link do grupo →</a>';
    html += '</div>';
    html += '<div class="stat-card"><div class="stat-label">👥 Total de Membros VIP</div><div class="stat-value">' + data.totalMembros.toLocaleString('pt-BR') + '</div><div class="stat-sub">em 17 grupos</div></div>';
    html += '<div class="stat-card"><div class="stat-label">📈 Entradas Hoje</div><div class="stat-value" style="color:#10b981">' + data.entradasHoje + '</div><div class="stat-sub">novos membros hoje</div></div>';
    html += '</div>';

    // Historico + link
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">';
    html += '<div class="stat-card"><div class="stat-label" style="margin-bottom:16px">📅 Entradas nos últimos 7 dias</div>';
    data.historico.forEach(function(h) {
      var d = new Date(h.data + 'T12:00:00');
      var label = d.toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'2-digit'});
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6">';
      html += '<span style="font-size:13px;color:#6b7280">' + label + '</span>';
      html += '<span style="font-size:14px;font-weight:600">' + h.entradas + ' entradas</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="stat-card"><div class="stat-label" style="margin-bottom:12px">🔗 Link ativo</div>';
    html += '<div style="font-size:13px;word-break:break-all;color:#2563eb;margin-bottom:8px"><a id="link-ativo" href="' + ga.link + '" target="_blank">' + ga.link + '</a></div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
    html += '<input id="input-link-ativo" value="' + ga.link + '" style="flex:1;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px" placeholder="Novo link do grupo">';
    html += '<button class="btn-salvar-link" style="padding:6px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Salvar link</button>';
    html += '</div>';
    html += '<button id="btn-copiar-link" style="padding:8px 16px;background:#f0f5ff;color:#2563eb;border:1px solid #2563eb;border-radius:6px;font-size:13px;cursor:pointer">📋 Copiar link /api/grupo</button>';
    html += '</div></div>';

    // Grid de todos os grupos
    html += '<div><div class="stat-label" style="margin-bottom:16px">📊 Status de todos os grupos</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">';
    data.grupos.forEach(function(g) {
      var pctG = Math.min(100, Math.round((g.membros / LIMITE) * 100));
      var isAtivo = g.id === ga.id;
      var cor = pctG >= 90 ? '#ef4444' : pctG >= 70 ? '#f59e0b' : '#10b981';
      html += '<div style="background:#fff;border:' + (isAtivo ? '2px solid #2563eb' : '1px solid #e8eaf0') + ';border-radius:10px;padding:12px;position:relative">';
      if (isAtivo) html += '<span style="position:absolute;top:6px;right:6px;background:#2563eb;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:20px">ATIVO</span>';
      html += '<div style="font-size:12px;font-weight:700;margin-bottom:4px">' + g.nome + '</div>';
      html += '<div style="font-size:18px;font-weight:700;margin-bottom:4px">' + g.membros.toLocaleString('pt-BR') + '</div>';
      html += '<div style="background:#f3f4f6;border-radius:4px;height:5px;margin-bottom:3px"><div style="background:' + cor + ';height:5px;border-radius:4px;width:' + pctG + '%"></div></div>';
      html += '<div style="font-size:10px;color:#9ca3af;margin-bottom:6px">' + (LIMITE - g.membros) + ' vagas</div>';
      if (!isAtivo) html += '<button class="btn-def-ativo" data-nome="' + g.nome + '" data-link="' + encodeURIComponent(g.link||'') + '" style="width:100%;padding:4px;background:#f0f5ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:4px;font-size:10px;cursor:pointer">Definir ativo</button>';
      html += '</div>';
    });
    html += '</div></div>';

    loading.style.display = 'none';
    el.innerHTML = html;
    el.style.display = 'block';
    // Adicionar event listeners após inserir HTML
    var btnCopiar = document.getElementById('btn-copiar-link');
    if (btnCopiar) {
      btnCopiar.onclick = function() {
        navigator.clipboard.writeText('https://infinitepay-backend.vercel.app/api/grupo').then(function(){ alert('Link copiado! Use este link fixo nos seus anúncios.'); });
      };
    }
    // Delegação de eventos para botões "Definir ativo"
    el.querySelectorAll('.btn-def-ativo').forEach(function(btn) {
      btn.onclick = function() {
        var nome = btn.getAttribute('data-nome');
        var link = decodeURIComponent(btn.getAttribute('data-link'));
        var novoLink = prompt('Novo link para o grupo ' + nome + ':', link);
        if (!novoLink) return;
        fetch('/api/admin?secret=${secret}&action=set-grupo-ativo', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ nome: nome, link: novoLink })
        }).then(function(r){ return r.json(); }).then(function(d){
          if (d.ok) { alert('✅ Grupo ' + nome + ' definido como ativo!'); carregarGruposVip(); }
          else alert('Erro: ' + (d.error||'desconhecido'));
        });
      };
    });
    // Campo de atualizar link
    var btnSalvarLink = el.querySelector('.btn-salvar-link');
    if (btnSalvarLink) {
      btnSalvarLink.onclick = function() {
        var input = document.getElementById('input-link-ativo');
        if (!input || !input.value.trim()) return;
        fetch('/api/admin?secret=${secret}&action=set-grupo-ativo', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ nome: data.grupoAtivo.nome, link: input.value.trim() })
        }).then(function(r){ return r.json(); }).then(function(d){
          if (d.ok) { alert('✅ Link atualizado!'); carregarGruposVip(); }
        });
      };
    }
  } catch(e) {
    loading.textContent = 'Erro: ' + e.message;
  }
}

// Carregar aba Bundle de Produtos
var bundleCarregado = false;
async function carregarBundle() {
  if (bundleCarregado) return;
  bundleCarregado = true;
  var loading = document.getElementById('bundle-loading');
  var el = document.getElementById('bundle-content');
  try {
    var [resp, configResp2] = await Promise.all([
      fetch('/api/admin?action=produtos-lista&secret=${secret}'),
      fetch('/api/admin?action=bundle-produtos')
    ]);
    var data = await resp.json();
    var config = await configResp2.json();
    var produtos = data.produtos || [];
    var selecionados = config.produtoIds || [];

    var html = '<div class="form-card">';
    html += '<div class="form-title">🎁 Configurar Bundle de Produtos</div>';
    html += '<div class="field"><label>Valor do desconto (R$)</label><input type="number" id="bundle-desconto" value="' + (config.desconto||50) + '" step="1" min="0" style="width:160px"></div>';
    html += '<div style="font-size:13px;font-weight:600;color:#374151;margin:16px 0 10px">Selecione os produtos que podem aparecer no bundle:</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-height:500px;overflow-y:auto;padding:4px">';
    produtos.forEach(function(p) {
      var checked = selecionados.indexOf(p.id) !== -1 ? 'checked' : '';
      html += '<label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid #e8eaf0;border-radius:10px;cursor:pointer;background:#fff">';
      html += '<input type="checkbox" class="bundle-prod-check" value="' + p.id + '" ' + checked + ' style="width:18px;height:18px;flex-shrink:0">';
      if (p.imagem) html += '<img src="' + p.imagem + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0">';
      html += '<span style="font-size:13px;font-weight:500;line-height:1.3">' + p.titulo + '</span>';
      html += '</label>';
    });
    html += '</div>';
    html += '<button class="btn-green" onclick="salvarBundle()" style="margin-top:18px">💾 Salvar Configuração</button>';
    html += '<div id="bundle-msg" style="margin-top:10px;font-size:13px"></div>';
    html += '</div>';

    loading.style.display = 'none';
    el.innerHTML = html;
    el.style.display = 'block';
  } catch(e) {
    loading.textContent = 'Erro: ' + e.message;
  }
}

async function salvarBundle() {
  var msg = document.getElementById('bundle-msg');
  var desconto = document.getElementById('bundle-desconto').value;
  var ids = [];
  document.querySelectorAll('.bundle-prod-check:checked').forEach(function(el) { ids.push(el.value); });
  msg.textContent = 'Salvando...'; msg.style.color = '#6b7280';
  try {
    var resp = await fetch('/api/admin?action=bundle-salvar&secret=${secret}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtoIds: ids, desconto: parseFloat(desconto) || 50 })
    });
    var data = await resp.json();
    if (data.ok) { msg.textContent = '✅ Salvo! ' + ids.length + ' produtos selecionados.'; msg.style.color = '#10b981'; }
    else { msg.textContent = '❌ Erro ao salvar'; msg.style.color = '#ef4444'; }
  } catch(e) { msg.textContent = '❌ Erro de conexão'; msg.style.color = '#ef4444'; }
}

// Carregar membros dos grupos de forma assíncrona
async function carregarMembrosGrupos(){
  var el=document.getElementById('grupos-membros');
  if(!el)return;
  try{
    var resp=await fetch('/api/admin?action=grupos&secret=${secret}');
    var data=await resp.json();
    if(data.grupos){
      el.innerHTML='<div style="font-weight:600;color:#1a1a2e;margin-bottom:8px">Total: '+data.total+' membros</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
        data.grupos.map(function(g){return '<span style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:11px">'+g.nome+': '+g.membros+'</span>';}).join('')+
        '</div>';
    }
  }catch(e){
    if(el)el.textContent='Erro ao carregar membros';
  }
}
setTimeout(carregarMembrosGrupos,800);

async function definirGrupoAtivo(nome, link) {
  var novoLink = prompt('Link do grupo ' + nome + ':', link);
  if (!novoLink) return;
  var r = await fetch('/api/admin?secret=${secret}&action=set-grupo-ativo', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ nome, link: novoLink })
  });
  var d = await r.json();
  if (d.ok) { alert('✅ Grupo ' + nome + ' definido como ativo!'); carregarGruposVip(); }
  else alert('❌ Erro: ' + (d.error||'desconhecido'));
}

async function atualizarLinkAtivo() {
  var input = document.getElementById('input-link-ativo');
  var linkAtivo = document.getElementById('link-ativo');
  if (!input || !input.value.trim()) return;
  var novoLink = input.value.trim();
  // Buscar grupo ativo atual para saber o nome
  var r = await fetch('/api/admin?secret=${secret}&action=grupos-vip-dashboard');
  var d = await r.json();
  var nome = d.grupoAtivo ? d.grupoAtivo.nome : '#1';
  var r2 = await fetch('/api/admin?secret=${secret}&action=set-grupo-ativo', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ nome, link: novoLink })
  });
  var d2 = await r2.json();
  if (d2.ok) {
    alert('✅ Link atualizado!');
    carregarGruposVip();
  }
}

async function delOferta(btn, id) {
  if (!confirm('Remover oferta?')) return;
  btn.textContent = '...'; btn.disabled = true;
  var tr = btn.closest('tr');
  if (tr) tr.style.opacity = '0.4';
  await fetch('/api/admin?secret=${secret}&del_oferta=' + id);
  if (tr) tr.remove();
}
async function delLead(btn, id) {
  if (!confirm('Remover carrinho?')) return;
  btn.textContent = '...'; btn.disabled = true;
  var tr = btn.closest('tr');
  if (tr) tr.style.opacity = '0.4';
  await fetch('/api/admin?secret=${secret}&del_lead=' + id);
  if (tr) tr.remove();
}
</script>
</body>
</html>`);
}
