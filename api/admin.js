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
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=100`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({products:[]})),
    ]);
    const prods = prodShopify.products || [];
    const getImg = (nome) => {
      const base = nome.split(' - ')[0].trim();
      const p = prods.find(p => p.title === nome || p.title === base || p.title.includes(base));
      return p?.image?.src || '';
    };
    const pedidos = (pedidosR.orders||[]).map(o => ({
      id: o.id,
      numero: o.order_number,
      cliente: o.customer ? `${o.customer.first_name||''} ${o.customer.last_name||''}`.trim() : 'Sem nome',
      email: o.customer?.email || o.email || '',
      telefone: o.shipping_address?.phone || o.billing_address?.phone || o.customer?.phone || o.phone || '',
      endereco: o.shipping_address ? `${o.shipping_address.address1||''}, ${o.shipping_address.city||''} - ${o.shipping_address.province_code||''}, ${o.shipping_address.zip||''}` : '',
      produto: (o.line_items||[]).map(i => i.title + (i.variant_title&&i.variant_title!=='Default Title'?' - '+i.variant_title:'')).join(', '),
      itens: (o.line_items||[]).map(i => ({ nome: i.title, variante: i.variant_title, quantidade: i.quantity, preco: i.price })),
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
      imagem: getImg((o.line_items||[])[0]?.title || ''),
    }));
    const pedResult = { pedidos };
    fetch(`${KV_URL}/set/${cachePedidos}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(pedResult), ex: 300 })
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

      const entradasHoje = calcEntradas(
        { grupos, total: totalAtual },
        snapOntem
      ) || 0;

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
        const entradas = i === 0 ? entradasHoje : (calcEntradas(snap1, snap0) || 0);
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

// ===== ENDPOINT: CRIAR PEDIDO MANUAL =====
// Adicionar no admin.js ANTES do bloco "// ===== DATAS =====" 
// Requer: SHOPIFY_STORE, SHOPIFY_TOKEN, MELHORENVIO_TOKEN, MELHORENVIO_CPF

  if (req.query.action === 'calcular-frete' && req.method === 'POST') {
    try {
      const { cep, produtos } = req.body || {};
      const cepLimpo = (cep||'').replace(/\D/g,'');
      if (cepLimpo.length !== 8) return res.status(400).json({ erro: 'CEP invalido' });
      const peso = (produtos||[]).reduce((s,p) => s + (p.quantidade||1) * 0.5, 0) || 0.5;
      const valor = (produtos||[]).reduce((s,p) => s + (p.preco||0) * (p.quantidade||1) / 100, 0) || 50;
      const body = {
        from: { postal_code: '01005020' },
        to: { postal_code: cepLimpo },
        package: { height: 10, width: 12, length: 18, weight: peso },
        insurance_value: valor,
        services: '1,2'
      };
      const r = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify(body)
      });
      const fretes = await r.json();
      const opcoes = (Array.isArray(fretes) ? fretes : []).filter(f => !f.error).map(f => ({
        id: f.id,
        nome: f.name,
        preco: parseFloat(f.price),
        prazo: f.delivery_time,
        empresa: f.company?.name || ''
      }));
      return res.status(200).json({ opcoes });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  if (req.query.action === 'buscar-cep' && req.method === 'GET') {
    try {
      const cep = (req.query.cep||'').replace(/\D/g,'');
      if (cep.length !== 8) return res.status(400).json({ erro: 'CEP invalido' });
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) return res.status(404).json({ erro: 'CEP nao encontrado' });
      return res.status(200).json({ logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  if (req.query.action === 'criar-pedido-manual' && req.method === 'POST') {
    try {
      const { cliente, endereco, produtos, frete, pagamento, observacao } = req.body || {};
      if (!cliente || !endereco || !produtos?.length || !frete) {
        return res.status(400).json({ erro: 'Dados incompletos' });
      }

      // 1. Montar line items para o Shopify
      const lineItems = produtos.map(p => ({
        title: p.nome + (p.variante && p.variante !== 'Default Title' ? ' - Cor: ' + p.variante : ''),
        quantity: p.quantidade || 1,
        price: (p.preco / 100).toFixed(2),
        requires_shipping: true
      }));

      // 2. Criar pedido no Shopify
      const partesNome = (cliente.nome||'').trim().split(/\s+/);
      const orderData = {
        order: {
          line_items: lineItems,
          financial_status: 'paid',
          fulfillment_status: null,
          currency: 'BRL',
          note: `Pedido manual via dashboard | Método: ${pagamento||'nao_informado'} | Telefone: ${cliente.telefone||''} | Origem: whatsapp${observacao ? ' | Obs: ' + observacao : ''}`,
          tags: 'Pedido Manual,WhatsApp',
          transactions: [{
            kind: 'sale',
            status: 'success',
            amount: ((produtos.reduce((s,p) => s + p.preco * p.quantidade, 0) / 100) + frete.preco).toFixed(2),
            gateway: pagamento === 'pix' ? 'PIX' : pagamento === 'credito' ? 'Cartão Crédito' : pagamento === 'debito' ? 'Cartão Débito' : 'Dinheiro'
          }],
          customer: {
            first_name: partesNome[0] || 'Cliente',
            last_name: partesNome.slice(1).join(' ') || partesNome[0] || '',
            email: cliente.email || '',
            phone: cliente.telefone || ''
          },
          shipping_address: {
            first_name: partesNome[0] || 'Cliente',
            last_name: partesNome.slice(1).join(' ') || '',
            address1: `${endereco.rua}, ${endereco.numero}`,
            address2: endereco.complemento || '',
            zip: endereco.cep.replace(/\D/g,''),
            city: endereco.cidade,
            province: endereco.estado,
            country: 'BR',
            phone: cliente.telefone || ''
          },
          shipping_lines: [{
            title: frete.nome,
            price: frete.preco.toFixed(2),
            code: frete.nome.toLowerCase().includes('sedex') ? 'SEDEX' : 'PAC'
          }]
        }
      };
      orderData.order.billing_address = orderData.order.shipping_address;

      const shopifyResp = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN }, body: JSON.stringify(orderData) }
      );
      const shopifyData = await shopifyResp.json();
      if (!shopifyData.order) {
        return res.status(400).json({ erro: 'Erro ao criar pedido no Shopify', detalhe: shopifyData.errors });
      }
      const orderId = shopifyData.order.id;
      const orderNumber = shopifyData.order.order_number;

      // 3. Gerar etiqueta no Melhor Envio
      const meBody = {
        service: frete.id === 2 ? 2 : 1,
        agency: null,
        from: {
          name: 'Kcique Relogios',
          phone: '11000000000',
          email: 'kciqueadm@gmail.com',
          document: process.env.MELHORENVIO_CPF || '',
          company_document: '66609452000183',
          state_register: null,
          address: 'Rua Sao Francisco',
          complement: 'Ap 804',
          number: '98',
          district: 'Se',
          city: 'Sao Paulo',
          country_id: 'BR',
          postal_code: '01005020',
          note: ''
        },
        to: {
          name: cliente.nome,
          phone: (cliente.telefone||'').replace(/\D/g,''),
          email: cliente.email || '',
          document: (cliente.cpf||'').replace(/\D/g,''),
          address: endereco.rua,
          complement: endereco.complemento || '',
          number: endereco.numero,
          district: endereco.bairro,
          city: endereco.cidade,
          country_id: 'BR',
          postal_code: endereco.cep.replace(/\D/g,''),
          note: ''
        },
        products: produtos.map(p => ({
          name: p.nome,
          quantity: p.quantidade || 1,
          unitary_value: Math.max(1, p.preco / 100).toFixed(2),
          weight: 0.5
        })),
        volumes: [{ height: 10, width: 12, length: 18, weight: produtos.reduce((s,p) => s + (p.quantidade||1) * 0.5, 0.5) }],
        tag: String(orderId),
        platform: 'Shopify',
        invoice: { key: null },
        options: {
          insurance_value: (produtos.reduce((s,p) => s + p.preco * p.quantidade, 0) / 100).toFixed(2),
          receipt: false,
          own_hand: false,
          collect: false,
          reverse: false,
          non_commercial: false
        }
      };

      const meResp = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify(meBody)
      });
      const meData = await meResp.json();
      console.log('ME cart pedido manual:', JSON.stringify(meData).substring(0,200));

      return res.status(200).json({
        ok: true,
        shopify_order: orderNumber,
        shopify_id: orderId,
        me_etiqueta: meData.id || null,
        me_erro: meData.id ? null : JSON.stringify(meData).substring(0,200)
      });
    } catch(e) {
      console.error('criar-pedido-manual erro:', e.message);
      return res.status(500).json({ erro: e.message });
    }
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
    <button class="nav-item" data-aba="carrinhos"><span class="nav-icon">🛒</span><span class="nav-label">Carrinhos</span></button>
    <button class="nav-item" data-aba="ofertas"><span class="nav-icon">📣</span><span class="nav-label">Ofertas</span></button>
    <button class="nav-item" data-aba="pedidos"><span class="nav-icon">📦</span><span class="nav-label">Pedidos</span></button>
    <button class="nav-item" data-aba="cupons"><span class="nav-icon">🎟</span><span class="nav-label">Cupons</span></button>
    <button class="nav-item" data-aba="grupos"><span class="nav-icon">📲</span><span class="nav-label">Grupos VIP</span></button>
    <button class="nav-item" data-aba="bundle"><span class="nav-icon">🎁</span><span class="nav-label">Bundle</span></button>
    <button class="nav-item" data-aba="recuperacao"><span class="nav-icon">💬</span><span class="nav-label">Recuperação</span></button>
    <button class="nav-item" data-aba="roleta"><span class="nav-icon">🎡</span><span class="nav-label">Roleta</span></button>
    <button class="nav-item" data-aba="atendimento"><span class="nav-icon">🎧</span><span class="nav-label">Atendimento</span></button>
    <button class="nav-item" data-aba="inbox"><span class="nav-icon">📱</span><span class="nav-label">Inbox</span></button>
    <button class="nav-item" data-aba="novopedido"><span class="nav-icon">➕</span><span class="nav-label">Novo Pedido</span></button>
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
const TITLES = {home:'📊 Visão Geral',carrinhos:'🛒 Carrinhos',ofertas:'📣 Ofertas WhatsApp',pedidos:'📦 Pedidos',cupons:'🎟 Cupons',grupos:'📲 Grupos VIP',bundle:'🎁 Bundle',recuperacao:'💬 Recuperação',roleta:'🎡 Roleta',atendimento:'🎧 Atendimento',inbox:'📱 Inbox',novopedido:'➕ Novo Pedido'};
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
  var fns = {home:renderHome, carrinhos:renderCarrinhos, ofertas:renderOfertas, pedidos:renderPedidos, cupons:renderCupons, grupos:renderGrupos, bundle:renderBundle, recuperacao:renderRecuperacao, roleta:renderRoleta, atendimento:renderAtendimento, inbox:renderInbox, novopedido:renderNovoPedido};
  if (fns[aba]) fns[aba](force);
}

// ===== HOME =====
var _homeCache = null;
async function renderHome(force) {
  if (_homeCache && !force) { renderHomeHtml(_homeCache); return; }
  loading();
  try {
    var [d, presenca, grupos] = await Promise.all([
      fetch(API+'/api/admin?secret='+S+'&action=dashboard-home'+(force?'&refresh=1':'')).then(r=>r.json()),
      fetch(API+'/api/checkout?action=contar').then(r=>r.json()).catch(function(){return {ativos:0,totalDia:0};}),
      fetch(API+'/api/admin?secret='+S+'&action=grupos-vip-dashboard').then(r=>r.json()).catch(function(){return {};})
    ]);
    d.presenca = presenca;
    d.gruposVip = { total: grupos.totalMembros||0, entradasHoje: grupos.entradasHoje||0, grupoAtivo: grupos.grupoAtivo||{} };
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

// ===== CARRINHOS =====
async function renderCarrinhos() {
  loading();
  try {
    var d = await fetch(API+'/api/leads?secret='+S).then(r=>r.json());
    _leads = (d.leads||[]).sort(function(a,b){return new Date(b.atualizado_em||b.criado_em)-new Date(a.atualizado_em||a.criado_em);});
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
    fetch(API+'/api/admin?secret='+S+'&del_lead='+b.getAttribute('data-lid')).then(function(){if(tr)tr.remove();});
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
      body: JSON.stringify({action:'limpar_leads', secret:S})
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
  html += '<div class="row-2"><div class="field"><label>URL da Imagem (opcional)</label><input id="of-imagem" placeholder="https://cdn.shopify.com/..."></div>';
  html += '<div class="field"><label>Link (opcional)</label><input id="of-link" placeholder="https://kcique.com.br/..."></div></div>';
  html += '<div class="row-2"><div class="field"><label>Data e hora (Brasília)</label><input type="datetime-local" id="of-data"></div>';
  html += '<div class="field"><label>Grupos</label><select id="of-grupos"><option value="todos">Todos os grupos (1-17)</option>';
  GRUPOS_NOMES.forEach(function(g){ html += '<option value="'+g+'">Grupo '+g+'</option>'; });
  html += '</select></div></div>';
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
  var bl = get('btn-limpar-of');
  if (bl) bl.addEventListener('click', limparOfertas);
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
    var r = await fetch(API+'/api/ofertas?action=salvar&secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto,imagem:val('of-imagem'),link:val('of-link'),dataHora:data+':00-03:00',grupos:val('of-grupos')||'todos'})});
    var d = await r.json();
    if(d.success){if(msg){msg.textContent='✅ Agendada!';msg.style.color='#16a34a';}setTimeout(function(){renderOfertas();},1000);}
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
      html+='<td>'+(p.imagem?'<img src="'+p.imagem+'" style="width:32px;height:32px;object-fit:cover;border-radius:6px">':'')+'</td>';
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
    html+='<div style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:16px">';
    p.itens.forEach(function(it){
      html+='<div style="padding:10px 12px;border-bottom:1px solid #e8eaf0;display:flex;justify-content:space-between;align-items:center">';
      html+='<div><div style="font-size:13px;font-weight:600">'+it.nome+'</div>';
      if(it.variante&&it.variante!=='Default Title')html+='<div style="font-size:11px;color:#9ca3af">'+it.variante+'</div>';
      html+='</div><div style="text-align:right"><div style="font-size:12px;color:#6b7280">x'+it.quantidade+'</div><div style="font-size:13px;font-weight:600">'+fmt(parseFloat(it.preco)*it.quantidade)+'</div></div></div>';
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

// ===== CUPONS =====
async function renderCupons() {
  loading();
  try {
    var d = await fetch(API+'/api/cupons?secret='+S+'&action=listar').then(r=>r.json());
    var cupons=d.cupons||[];
    var html='<div class="form-card"><div class="form-title">🎟 Criar novo cupom</div>';
    html+='<div class="row-3"><div class="field"><label>Código</label><input id="c-cod" placeholder="KCIQUE10" oninput="this.value=this.value.toUpperCase()"></div>';
    html+='<div class="field"><label>Tipo</label><select id="c-tipo"><option value="percentual">% Percentual</option><option value="fixo">R$ Fixo</option><option value="frete_gratis">Frete Grátis</option><option value="percentual_frete">% no Frete</option></select></div>';
    html+='<div class="field" id="campo-val"><label>Valor</label><input type="number" id="c-val" placeholder="10" min="0" step="0.01"></div></div>';
    html+='<div class="row-3"><div class="field"><label>Validade (opcional)</label><input type="datetime-local" id="c-valid"></div>';
    html+='<div class="field"><label>Limite de usos (opcional)</label><input type="number" id="c-limite" placeholder="100"></div>';
    html+='<div class="field"><label>Produto (opcional)</label><input id="c-prod" placeholder="TAG Senna"></div></div>';
    html+='<div style="display:flex;align-items:center;gap:10px"><button class="btn btn-primary" id="btn-criar-cupom">💾 Criar Cupom</button><span id="c-msg" style="font-size:13px"></span></div></div>';
    html+='<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-danger btn-sm" id="btn-limpar-cupons">🗑 Limpar todos</button></div>';
    if(!cupons.length){html+='<div class="vazio">Nenhum cupom cadastrado</div>';ct().innerHTML=html;_attachCupons();return;}
    html+='<div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Validade</th><th>Usos</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
    cupons.forEach(function(c){
      html+='<tr>';
      html+='<td><strong style="font-family:monospace">'+c.codigo+'</strong></td>';
      html+='<td>'+c.tipo+'</td>';
      html+='<td>'+(c.tipo==='percentual'?c.valor+'%':c.tipo==='fixo'?fmt(c.valor):c.tipo==='frete_gratis'?'Grátis':c.valor+'%')+'</td>';
      html+='<td style="font-size:12px">'+(c.validade?fmtDate(c.validade):'Sem validade')+'</td>';
      html+='<td>'+(c.usos||0)+(c.limite?'/'+c.limite:'')+'</td>';
      html+='<td><span class="badge" style="background:'+(c.ativo?'#bbf7d0':'#f3f4f6')+';color:'+(c.ativo?'#16a34a':'#6b7280')+'">'+(c.ativo?'Ativo':'Inativo')+'</span></td>';
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
  var tipo=get('c-tipo');if(tipo)tipo.addEventListener('change',function(){var cv=get('campo-val');if(cv)cv.style.display=this.value==='frete_gratis'?'none':'block';});
  ct().addEventListener('click',function(e){
    var b=e.target.closest('[data-cid]');if(!b)return;
    var act=b.getAttribute('data-action');
    if(act==='toggle'){fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle',secret:S,id:b.getAttribute('data-cid')})}).then(function(){renderCupons();});}
    if(act==='del'){if(!confirm('Deletar cupom '+b.getAttribute('data-ccod')+'?'))return;var tr=b.closest('tr');if(tr)tr.style.opacity='0.4';fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deletar',secret:S,id:b.getAttribute('data-cid')})}).then(function(){if(tr)tr.remove();});}
  },{once:true});
}
async function salvarCupom(){
  var cod=val('c-cod').trim().toUpperCase(),tipo=val('c-tipo'),v=parseFloat(val('c-val')||0),msg=get('c-msg');
  console.log('salvarCupom:',cod,tipo,v);
  if(!cod){if(msg)msg.textContent='⚠️ Digite o código';return;}
  var btn=get('btn-criar-cupom');btn.disabled=true;btn.textContent='Salvando...';
  try{
    var d=await fetch(API+'/api/cupons?secret='+S,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'salvar',secret:S,codigo:cod,tipo,valor:v,ativo:true,validade:val('c-valid')||null,limiteUsos:parseInt(val('c-limite'))||null,produto:val('c-prod')||null})}).then(r=>r.json());
    if(d.ok){if(msg){msg.textContent='✅ Criado!';msg.style.color='#16a34a';}setTimeout(function(){renderCupons();},800);}
    else{if(msg){msg.textContent='❌ '+(d.erro||d.error||'Erro');msg.style.color='#ef4444';}}
  }catch(e){if(msg)msg.textContent='❌ '+e.message;}
  btn.disabled=false;btn.textContent='💾 Criar Cupom';
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
    var html='<div class="form-card"><div class="form-title">🟢 Grupo Ativo: <strong>'+ga.nome+'</strong></div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:13px;color:#6b7280">';
    html += '<span>'+fmtN(ga.membros||0)+' membros no grupo ativo</span>';
    html += '<span style="color:#d1d5db">·</span>';
    html += '<span><strong style="color:#111">'+fmtN(d.totalMembros||0)+'</strong> total em 17 grupos</span>';
    html += '<span style="color:#d1d5db">·</span>';
    html += '<span>📈 Entradas hoje: <strong style="color:#16a34a">'+d.entradasHoje+'</strong></span>';
    html += '</div>';
    html+='<div style="display:flex;gap:8px;margin-bottom:6px">';
    html+='<input id="inp-link" value="'+(ga.link||'')+'" style="flex:1;padding:8px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:12px;outline:none" placeholder="Novo link do grupo">';
    html+='<button class="btn btn-ghost btn-sm" id="btn-salvar-link">Salvar link</button>';
    html+='<button class="btn btn-ghost btn-sm" id="btn-copiar-link">📋 Copiar /api/grupo</button>';
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

async function renderRecuperacao() {
  loading();
  try {
    var config = await fetch(API+'/api/admin?secret='+S+'&action=recuperacao-config').then(r=>r.json()).catch(function(){return {};});
    var c = config.config || {};
    var regras = [
      { key: 'regra_identificacao', label: '\ud83d\udccb Preencheu identifica\u00e7\u00e3o (nome/email)', desc: 'Pessoa preencheu dados pessoais mas n\u00e3o foi ao endere\u00e7o' },
      { key: 'regra_frete',         label: '\ud83d\ude9a Abandonou no frete',                  desc: 'Pessoa calculou ou selecionou frete mas n\u00e3o foi ao pagamento' },
      { key: 'regra_pagamento',     label: '\ud83d\udcb3 Abandonou no pagamento',               desc: 'Pessoa clicou em pagar mas n\u00e3o completou' },
    ];
    var html = '';
    // Status global
    var ativo = c.ativo !== false;
    html += '<div class="form-card" style="margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between">';
    html += '<div><div class="form-title">\ud83d\udcac Recupera\u00e7\u00e3o Autom\u00e1tica de Carrinhos</div>';
    html += '<div style="font-size:13px;color:#6b7280">Mensagens autom\u00e1ticas via WhatsApp para recuperar carrinhos abandonados</div></div>';
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">';
    html += '<span style="font-size:13px;font-weight:600">'+(ativo?'Ativo':'Inativo')+'</span>';
    html += '<div style="position:relative;width:44px;height:24px"><input type="checkbox" id="rec-ativo" '+(ativo?'checked':'')+'style="opacity:0;position:absolute;width:100%;height:100%;margin:0;cursor:pointer;z-index:2">';
    html += '<div id="rec-ativo-bg" style="position:absolute;inset:0;border-radius:12px;background:'+(ativo?'#25d366':'#d1d5db')+';transition:background .2s"></div>';
    html += '<div id="rec-ativo-dot" style="position:absolute;top:3px;left:'+(ativo?'23':'3')+'px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div></div></label>';
    html += '</div></div>';
    // Vari\u00e1veis dispon\u00edveis
    html += '<div style="margin-bottom:16px;padding:12px 16px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;font-size:12px;color:#0369a1">';
    html += '<strong>Vari\u00e1veis dispon\u00edveis nas mensagens:</strong> ';
    html += '<code>{nome}</code> \u00b7 <code>{produtos}</code> \u00b7 <code>{link}</code> \u00b7 <code>{email}</code>';
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
      html += '<option value="1" '+(r.reenviar!==false?'selected':'')+'>Sim \u2014 n\u00e3o reenviar</option>';
      html += '</select></div></div>';
      html += '<div class="field"><label>Mensagem WhatsApp</label>';
      html += '<textarea class="rec-mensagem" data-regra="'+regra.key+'" rows="4" placeholder="Ex: Ol\u00e1 {nome}! Vi que voc\u00ea deixou {produtos} no carrinho...">'+(r.mensagem||'')+'</textarea></div>';
      html += '</div>';
    });
    html += '<div style="display:flex;gap:10px;align-items:center">';
    html += '<button class="btn btn-primary" id="btn-salvar-rec">\ud83d\udcbe Salvar configura\u00e7\u00f5es</button>';
    html += '<button class="btn btn-ghost" id="btn-testar-rec">\u25b6 Disparar agora</button>';
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
      if (r.ok) { msg.textContent='\u2705 Salvo!'; msg.style.color='#16a34a'; }
      else { msg.textContent='\u274c Erro'; msg.style.color='#ef4444'; }
      btn.disabled=false; btn.textContent='\ud83d\udcbe Salvar configura\u00e7\u00f5es';
      setTimeout(function(){ msg.textContent=''; }, 3000);
    });
    // Disparar agora
    document.getElementById('btn-testar-rec').addEventListener('click', async function() {
      var btn=this; btn.disabled=true; btn.textContent='Disparando...';
      var r = await fetch(API+'/api/recuperacao?secret='+S, {method:'POST'}).then(function(r){return r.json();}).catch(function(){return {ok:false};});
      var msg = document.getElementById('rec-msg');
      if (r.ok) { msg.textContent='\u2705 '+r.disparos+' mensagens enviadas'; msg.style.color='#16a34a'; }
      else { msg.textContent='\u274c Erro ao disparar'; msg.style.color='#ef4444'; }
      btn.disabled=false; btn.textContent='\u25b6 Disparar agora';
    });
  } catch(e) { errMsg('Erro: '+e.message); }
}
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
      + '<h2 style="font-size:20px;font-weight:700">&#127905; Roleta de Pr\u00eamios</h2>'
      + '<button onclick="rkToggle()" id="rk-toggle-btn" style="padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;'+(aberta?'background:#fee2e2;color:#dc2626':'background:#dcfce7;color:#16a34a')+'">'+(aberta?'&#128274; Fechar Roleta':'&#128275; Abrir Roleta')+'</button>'
      + '</div>'
      + '<div id="rk-status-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:20px;'+(aberta?'background:#dcfce7;color:#16a34a':'background:#fee2e2;color:#dc2626')+'">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:'+(aberta?'#16a34a':'#dc2626')+'"></span>'
      + (aberta?'Roleta aberta ao p\u00fablico':'Roleta fechada')
      + '</div>'
      + '<p style="color:#6b7280;font-size:13px;margin-bottom:24px">Configure os itens da roleta. A probabilidade \u00e9 relativa \u2014 os valores n\u00e3o precisam somar 100.</p>'
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
      + '<button onclick="rkSalvar()" id="rk-save-btn" style="padding:10px 24px;background:#111;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Salvar configura\u00e7\u00e3o</button>'
      + '<a href="https://kcique.com.br/pages/roleta" target="_blank" style="font-size:13px;color:#2563eb;text-decoration:none">Ver roleta ao vivo &#8594;</a>'
      + '</div></div>'
      + '<div style="background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px">'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:16px">\u00daltimos giros ('+historico.length+')</div>'
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
        badge.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;margin-right:6px"></span>Roleta aberta ao p\u00fablico';
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
    btn.textContent = d.ok ? '\u2705 Salvo!' : '\u274c Erro';
    setTimeout(function(){ btn.textContent='Salvar configura\u00e7\u00e3o'; btn.disabled=false; }, 2000);
  } catch(e) {
    btn.textContent = '\u274c Erro'; btn.disabled = false;
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
    html += '<div class="stat-card"><div class="stat-label">\ud83c\udfa7 Total Tickets</div><div class="stat-value">'+tickets.length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">\ud83d\udd34 Abertos</div><div class="stat-value" style="color:#ef4444">'+tickets.filter(function(t){return t.status==='aberto';}).length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">\ud83d\udd04 Em Atendimento</div><div class="stat-value" style="color:#f59e0b">'+tickets.filter(function(t){return t.status==='em_atendimento';}).length+'</div></div>';
    html += '<div class="stat-card"><div class="stat-label">\u2705 Resolvidos</div><div class="stat-value" style="color:#16a34a">'+tickets.filter(function(t){return t.status==='resolvido';}).length+'</div></div>';
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
  } catch(e) { errMsg('Erro: '+e.message); }
}
function _renderTicketsList(tickets, filtro) {
  var lista = filtro === 'todos' ? tickets : tickets.filter(function(t) {
    if (filtro === 'problema') return t.tipo === 'problema';
    if (filtro === 'troca') return t.tipo === 'troca';
    return t.status === filtro;
  });
  if (!lista.length) return '<div class="vazio">Nenhum ticket nesta categoria</div>';
  var corStatus = {aberto:'#ef4444', em_atendimento:'#f59e0b', resolvido:'#16a34a'};
  var labelStatus = {aberto:'\ud83d\udd34 Aberto', em_atendimento:'\ud83d\udd04 Em Atendimento', resolvido:'\u2705 Resolvido'};
  var corTipo = {problema:'#ef4444', troca:'#2563eb'};
  var labelTipo = {problema:'\u26a0\ufe0f Problema', troca:'\ud83d\udd01 Troca'};
  var html = '<div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Pedido</th><th>Descri\u00e7\u00e3o</th><th>M\u00eddias</th><th>Status</th><th>Data</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>';
  lista.slice().reverse().forEach(function(t) {
    var midias = t.midias || [];
    html += '<tr>';
    html += '<td><div style="font-weight:600;font-size:13px">'+( t.nome||t.telefone)+'</div><div style="font-size:11px;color:#9ca3af">'+t.telefone+'</div></td>';
    html += '<td><span style="background:'+(corTipo[t.tipo]||'#6b7280')+'20;color:'+(corTipo[t.tipo]||'#6b7280')+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">'+(labelTipo[t.tipo]||t.tipo)+'</span></td>';
    html += '<td style="font-size:12px">'+(t.pedido||'\u2014')+'</td>';
    html += '<td style="max-width:200px;font-size:12px;color:#374151">'+(t.descricao||'\u2014').substring(0,80)+(t.descricao&&t.descricao.length>80?'...':'')+'</td>';
    html += '<td>';
    midias.forEach(function(m) {
      if (m.tipo==='image') html += '<img src="'+m.url+'" data-foto="'+m.url+'" style="width:36px;height:36px;object-fit:cover;border-radius:5px;cursor:pointer;margin-right:3px">';
      else if (m.tipo==='video') html += '<a href="'+m.url+'" target="_blank" style="font-size:11px;color:#2563eb">\ud83c\udfa5 v\u00eddeo</a> ';
      else if (m.tipo==='document') html += '<a href="'+m.url+'" target="_blank" style="font-size:11px;color:#2563eb">\ud83d\udcc4 doc</a> ';
    });
    if (!midias.length) html += '<span style="color:#9ca3af;font-size:12px">\u2014</span>';
    html += '</td>';
    html += '<td><span style="background:'+(corStatus[t.status]||'#6b7280')+'20;color:'+(corStatus[t.status]||'#6b7280')+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">'+(labelStatus[t.status]||t.status)+'</span></td>';
    html += '<td style="font-size:11px;color:#9ca3af;white-space:nowrap">'+fmtDate(t.criado_em)+'</td>';
    html += '<td style="white-space:nowrap">';
    if (t.status!=='resolvido') {
      html += '<button data-tid="'+t.id+'" data-tact="em_atendimento" style="padding:4px 8px;background:#fef3c7;color:#92400e;border:none;border-radius:5px;font-size:11px;cursor:pointer;margin-right:4px">Atender</button>';
      html += '<button data-tid="'+t.id+'" data-tact="resolvido" style="padding:4px 8px;background:#dcfce7;color:#16a34a;border:none;border-radius:5px;font-size:11px;cursor:pointer">Resolver</button>';
    }
    if (t.telefone) {
      var wppMsg = encodeURIComponent('Ol\u00e1 '+( t.nome||'').split(' ')[0]+'! Aqui \u00e9 da Kcique Rel\u00f3gios. Estamos analisando seu atendimento e j\u00e1 entramos em contato em breve! \u231a');
      html += ' <a href="https://wa.me/55'+t.telefone.replace(/\\D/g,'')+"?text="+wppMsg+'" target="_blank" style="padding:4px 8px;background:#dcfce7;color:#16a34a;border:none;border-radius:5px;font-size:11px;cursor:pointer;text-decoration:none">\ud83d\udcac</a>';
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

    // \u2500\u2500 M\u00c9TRICAS \u2500\u2500
    var msgsOntem = stats.msgsOntem || 0;
    var varMsgs = msgsOntem > 0 ? ((stats.msgsHoje - msgsOntem) / msgsOntem * 100).toFixed(0) : null;
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">';
    html += '<div class="stat-card" style="border-left:3px solid #25d366"><div class="stat-label">\ud83d\udcac Mensagens Hoje</div><div class="stat-value">'+stats.msgsHoje+'</div>'+(varMsgs!==null?'<div class="stat-sub" style="color:'+(varMsgs>=0?'#16a34a':'#ef4444')+'">'+(varMsgs>=0?'\u25b2':'\u25bc')+' '+Math.abs(varMsgs)+'% vs ontem</div>':'')+'</div>';
    html += '<div class="stat-card"><div class="stat-label">\ud83d\udc65 Total de Contatos</div><div class="stat-value">'+stats.totalContatos+'</div></div>';
    var clientes = _inboxContatos.filter(function(c){return c.ehCliente;}).length;
    html += '<div class="stat-card" style="border-left:3px solid #2563eb"><div class="stat-label">\ud83d\udecd Clientes Identificados</div><div class="stat-value">'+clientes+'</div><div class="stat-sub">'+Math.round(clientes/Math.max(1,stats.totalContatos)*100)+'% dos contatos</div></div>';
    var naoLidas = _inboxContatos.reduce(function(s,c){return s+(c.naoLidas||0);},0);
    html += '<div class="stat-card" style="border-left:3px solid #f59e0b"><div class="stat-label">\ud83d\udd14 N\u00e3o Lidas</div><div class="stat-value" style="color:'+(naoLidas>0?'#f59e0b':'#111')+'">'+naoLidas+'</div></div>';
    html += '</div>';

    // \u2500\u2500 GR\u00c1FICO \u2500\u2500
    if (stats.dias && stats.dias.length) {
      var maxVal = Math.max.apply(null, stats.dias.map(function(d){return d.total;})) || 1;
      html += '<div class="stat-card" style="margin-bottom:20px;padding:20px">';
      html += '<div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:14px;text-transform:uppercase;letter-spacing:.04em">Mensagens recebidas \u2014 \u00faltimos 30 dias</div>';
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

    // \u2500\u2500 LAYOUT CONVERSAS \u2500\u2500
    html += '<div style="display:grid;grid-template-columns:320px 1fr;gap:0;background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden;height:600px">';

    // Lista de contatos
    html += '<div style="border-right:1px solid #e8eaf0;display:flex;flex-direction:column;height:600px">';
    html += '<div style="padding:12px;border-bottom:1px solid #f3f4f6">';
    html += '<input id="inbox-busca" placeholder="\ud83d\udd0d Buscar conversa..." style="width:100%;padding:8px 12px;border:1px solid #e8eaf0;border-radius:8px;font-size:13px;outline:none;font-family:inherit">';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap">';
    ['Todos','cliente','possivel_cliente','vip','fornecedor','sem_etiqueta'].forEach(function(f,i){
      html += '<button class="inbox-filtro'+(i===0?' ativo':'')+'" data-f="'+f+'" style="padding:3px 10px;border-radius:20px;border:1px solid #e8eaf0;background:'+(i===0?'#1a1a2e':'#fff')+';color:'+(i===0?'#fff':'#6b7280')+';font-size:11px;cursor:pointer;font-weight:600">'+
        (f==='Todos'?'Todos':f==='cliente'?'\ud83d\udecd Cliente':f==='possivel_cliente'?'\ud83d\udc64 Poss\u00edvel':f==='vip'?'\u2b50 VIP':f==='fornecedor'?'\ud83d\udce6 Fornecedor':'Sem etiqueta')+'</button>';
    });
    html += '</div>';
    html += '<div id="inbox-lista" style="flex:1;overflow-y:auto">';
    html += _renderContatosLista(_inboxContatos, 'Todos', '');
    html += '</div></div>';

    // \u00c1rea da conversa
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
  var labels = {cliente:'Cliente',possivel_cliente:'Poss\u00edvel cliente',vip:'VIP',fornecedor:'Fornecedor',bloqueado:'Bloqueado'};
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
  // Atualizar sele\u00e7\u00e3o visual
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
    html += '<div style="font-size:11px;color:#9ca3af">'+phone+(contato.ehCliente?' \u00b7 <span style="color:#25d366;font-weight:600">\u2713 Cliente</span>':'')+'</div>';
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
      html += '<div style="font-size:11px;color:#374151;background:#f9fafb;padding:5px 10px;border-radius:8px;border:1px solid #e8eaf0">'+sh.totalPedidos+' pedidos \u00b7 R$ '+sh.totalGasto.toFixed(2).replace('.',',')+' gastos</div>';
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
    html += '<textarea id="inbox-reply" placeholder="Digite uma mensagem..." style="flex:1;padding:9px 12px;border:1px solid #e8eaf0;border-radius:20px;font-size:13px;font-family:inherit;resize:none;outline:none;min-height:40px;max-height:120px;line-height:1.4" rows="1" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'"></textarea>';
    html += '<button onclick="enviarResposta(\''+phone+'\')" style="width:40px;height:40px;border-radius:50%;background:#25d366;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">';
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

    // Atualizar badge de n\u00e3o lidas na lista
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
      if (m.tipo==='image') html += '<img src="'+m.url+'" data-foto="'+m.url+'" style="width:36px;height:36px;object-fit:cover;border-radius:5px;cursor:pointer;margin-right:3px">';
        + '<img src="'+(msg.mediaThumbnail||msg.mediaUrl)+'" style="max-width:200px;border-radius:8px;display:block">'
        + (msg.texto ? '<div style="font-size:12px;margin-top:4px;color:#374151">'+msg.texto+'</div>' : '')
        + '</div>'
      conteudo = '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">📷 Foto — clique para ver</div>';
  } else if (msg.tipo === 'video') {
      conteudo = '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">🎥 Vídeo — clique para ver</div>';
  } else if (msg.tipo === 'audio') {
      conteudo = '<div style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer" data-action="carregar-midia" data-url="'+msg.mediaUrl+'">🎤 Áudio — clique para ouvir</div>';
  } else if (msg.tipo === 'document') {
    conteudo = '<a href="'+msg.mediaUrl+'" target="_blank" style="padding:8px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#2563eb;display:block;text-decoration:none">\ud83d\udcc4 Documento \u2014 clique para baixar</a>';
  } else if (msg.tipo === 'sticker') {
    conteudo = msg.mediaUrl ? '<img src="'+msg.mediaUrl+'" style="width:80px">' : '\ud83c\udfad Sticker';
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
      alert('Cliente identificado: '+r.shopify.nome+' - '+r.shopify.totalPedidos+' pedidos');
    } else {
      alert('N\u00e3o encontrado como cliente no Shopify.');
    }
    abrirConversa(phone);
  }
}

function carregarMidia(url, el) {
  if (!url) return;
  el.outerHTML = '<a href="'+url+'" target="_blank" style="color:#2563eb;font-size:12px">Abrir m\u00eddia \u2192</a>';
}

function _attachInbox() {
  // Clicar em contato
  ct().addEventListener('click', function(e) {
    var item = e.target.closest('.inbox-item');
    if (item) abrirConversa(item.getAttribute('data-phone'));
  });
  // Filtros
  ct().addEventListener('click', function(e) {
    var btn = e.target.closest('.inbox-filtro');
    if (!btn) return;
    document.querySelectorAll('.inbox-filtro').forEach(function(b){
      b.style.background='#fff'; b.style.color='#6b7280'; b.style.borderColor='#e8eaf0';
    });
    btn.style.background='#1a1a2e'; btn.style.color='#fff';
    var lista = document.getElementById('inbox-lista');
    var busca = (document.getElementById('inbox-busca')||{}).value||'';
    if (lista) lista.innerHTML = _renderContatosLista(_inboxContatos, btn.getAttribute('data-f'), busca);
  });
  // Busca
  var busca = document.getElementById('inbox-busca');
  if (busca) busca.addEventListener('input', function() {
    var filtroAtivo = (document.querySelector('.inbox-filtro[style*="#1a1a2e"]')||{}).getAttribute('data-f')||'Todos';
    var lista = document.getElementById('inbox-lista');
    if (lista) lista.innerHTML = _renderContatosLista(_inboxContatos, filtroAtivo, this.value);
  });
}
// ===== ABA NOVO PEDIDO =====
// 1. Adicionar no objeto TITLES:
//    novopedido: 'Novo Pedido'
//
// 2. Adicionar no nav://
// 3. Adicionar no objeto fns do renderAba:
//    novopedido: renderNovoPedido
//
// 4. Colar o código abaixo no <script> antes de "// INICIAR"

var _npProdutos = [];
var _npCarrinho = [];
var _npFrete = null;

async function renderNovoPedido() {
  loading();

  // Carregar catalogo de produtos
  try {
    if (!_npProdutos.length) {
      var r = await fetch(API+'/api/admin?secret='+S+'&action=produtos-lista').then(r=>r.json());
      _npProdutos = r.produtos || [];
    }
  } catch(e) {}

  var html = '';
  html += '<div style="max-width:900px">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';

  // COLUNA ESQUERDA: formulario
  html += '<div>';

  // Cliente
  html += '<div class="form-card">';
  html += '<div class="form-title">👤 Dados do Cliente</div>';
  html += '<div class="field"><label>Nome completo *</label><input id="np-nome" placeholder="Ex: João Silva"></div>';
  html += '<div class="row-2">';
  html += '<div class="field"><label>Telefone *</label><input id="np-tel" placeholder="11999999999" type="tel"></div>';
  html += '<div class="field"><label>Email</label><input id="np-email" placeholder="joao@email.com" type="email"></div>';
  html += '</div>';
  html += '<div class="field"><label>CPF (para etiqueta ME)</label><input id="np-cpf" placeholder="000.000.000-00"></div>';
  html += '</div>';

  // Endereço
  html += '<div class="form-card">';
  html += '<div class="form-title">📍 Endereço de Entrega</div>';
  html += '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px">';
  html += '<div class="field" style="flex:1;margin-bottom:0"><label>CEP *</label><input id="np-cep" placeholder="00000-000" maxlength="9" oninput="this.value=this.value.replace(/\D/g,\'\').replace(/^(\d{5})(\d)/,\'$1-$2\')"></div>';
  html += '<button class="btn btn-ghost btn-sm" id="btn-buscar-cep" style="margin-bottom:1px">Buscar</button>';
  html += '</div>';
  html += '<div class="row-2">';
  html += '<div class="field"><label>Rua *</label><input id="np-rua" placeholder="Rua das Flores"></div>';
  html += '<div class="field"><label>Número *</label><input id="np-num" placeholder="123"></div>';
  html += '</div>';
  html += '<div class="row-2">';
  html += '<div class="field"><label>Complemento</label><input id="np-comp" placeholder="Apto 42"></div>';
  html += '<div class="field"><label>Bairro *</label><input id="np-bairro" placeholder="Centro"></div>';
  html += '</div>';
  html += '<div class="row-2">';
  html += '<div class="field"><label>Cidade *</label><input id="np-cidade" placeholder="São Paulo"></div>';
  html += '<div class="field"><label>Estado *</label><input id="np-uf" placeholder="SP" maxlength="2" style="text-transform:uppercase"></div>';
  html += '</div>';
  html += '</div>';

  // Pagamento
  html += '<div class="form-card">';
  html += '<div class="form-title">💳 Pagamento</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
  [['pix','PIX'],['credito','Cartão Crédito'],['debito','Cartão Débito'],['dinheiro','Dinheiro']].forEach(function(op){
    html += '<label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:10px;border:1.5px solid #e8eaf0;cursor:pointer;font-size:12px;font-weight:600;text-align:center;transition:all .15s" id="npay-lbl-'+op[0]+'">';
    html += '<input type="radio" name="np-pagamento" value="'+op[0]+'" style="display:none">';
    html += '<span style="font-size:20px">'+(op[0]==='pix'?'🟢':op[0]==='credito'?'💳':op[0]==='debito'?'💵':'💰')+'</span>';
    html += op[1]+'</label>';
  });
  html += '</div>';
  html += '</div>';

  // Observação
  html += '<div class="form-card">';
  html += '<div class="field"><label>Observação (opcional)</label><textarea id="np-obs" rows="2" placeholder="Ex: Embalar como presente"></textarea></div>';
  html += '</div>';

  html += '</div>'; // fim coluna esquerda

  // COLUNA DIREITA: produtos + frete + resumo
  html += '<div>';

  // Busca de produtos
  html += '<div class="form-card">';
  html += '<div class="form-title">📦 Produtos</div>';
  html += '<div style="position:relative">';
  html += '<input id="np-busca-prod" placeholder="Buscar produto..." style="width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:13px;outline:none;font-family:inherit">';
  html += '<div id="np-sugestoes" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #e8eaf0;border-radius:8px;max-height:220px;overflow-y:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.1)"></div>';
  html += '</div>';
  // Carrinho
  html += '<div id="np-carrinho" style="margin-top:12px"></div>';
  html += '</div>';

  // Frete
  html += '<div class="form-card" id="np-frete-card" style="display:none">';
  html += '<div class="form-title">🚚 Calcular Frete</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">';
  html += '<span id="np-frete-info" style="font-size:13px;color:#6b7280">Preencha o CEP para calcular</span>';
  html += '<button class="btn btn-ghost btn-sm" id="btn-calc-frete">Calcular</button>';
  html += '</div>';
  html += '<div id="np-fretes-opcoes"></div>';
  html += '</div>';

  // Resumo + confirmar
  html += '<div class="form-card" id="np-resumo-card" style="display:none">';
  html += '<div class="form-title">✅ Resumo do Pedido</div>';
  html += '<div id="np-resumo-body"></div>';
  html += '<div style="margin-top:16px"><button class="btn btn-primary" id="btn-criar-pedido" style="width:100%;padding:14px;font-size:15px">🛒 Criar Pedido + Gerar Etiqueta ME</button></div>';
  html += '<div id="np-resultado" style="margin-top:12px;font-size:13px"></div>';
  html += '</div>';

  html += '</div>'; // fim coluna direita
  html += '</div>'; // fim grid
  html += '</div>'; // fim max-width

  ct().innerHTML = html;
  _attachNovoPedido();
}

function _attachNovoPedido() {
  // Busca de CEP
  var btnCep = get('btn-buscar-cep');
  if (btnCep) btnCep.addEventListener('click', async function() {
    var cep = val('np-cep').replace(/\D/g,'');
    if (cep.length !== 8) return alert('CEP invalido');
    btnCep.textContent = 'Buscando...'; btnCep.disabled = true;
    try {
      var r = await fetch(API+'/api/admin?secret='+S+'&action=buscar-cep&cep='+cep).then(r=>r.json());
      if (r.erro) { alert('CEP nao encontrado'); }
      else {
        if (get('np-rua') && !val('np-rua')) get('np-rua').value = r.logradouro || '';
        if (get('np-bairro')) get('np-bairro').value = r.bairro || '';
        if (get('np-cidade')) get('np-cidade').value = r.cidade || '';
        if (get('np-uf')) get('np-uf').value = r.estado || '';
        if (get('np-frete-info')) get('np-frete-info').textContent = 'CEP: ' + val('np-cep');
        var fc = get('np-frete-card'); if (fc) fc.style.display = 'block';
      }
    } catch(e) { alert('Erro: '+e.message); }
    btnCep.textContent = 'Buscar'; btnCep.disabled = false;
  });

  // Pagamento: highlight selecionado
  ct().addEventListener('change', function(e) {
    if (e.target.name === 'np-pagamento') {
      document.querySelectorAll('[id^="npay-lbl-"]').forEach(function(l) {
        l.style.border = '1.5px solid #e8eaf0';
        l.style.background = '#fff';
      });
      var lbl = get('npay-lbl-'+e.target.value);
      if (lbl) { lbl.style.border = '1.5px solid #25d366'; lbl.style.background = '#f0fdf4'; }
      _npAtualizarResumo();
    }
  });

  // Busca de produto
  var busca = get('np-busca-prod');
  if (busca) busca.addEventListener('input', function() {
    var q = this.value.toLowerCase().trim();
    var sug = get('np-sugestoes');
    if (!q || !sug) { if (sug) sug.style.display = 'none'; return; }
    var matches = _npProdutos.filter(function(p) {
      return (p.titulo||p.nome||'').toLowerCase().includes(q);
    }).slice(0, 8);
    if (!matches.length) { sug.style.display = 'none'; return; }
    sug.innerHTML = matches.map(function(p) {
      return '<div class="np-sug-item" data-pid="'+p.id+'" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;font-size:13px">'
        + (p.imagem ? '<img src="'+p.imagem+'" style="width:32px;height:32px;object-fit:cover;border-radius:5px;flex-shrink:0">' : '<div style="width:32px;height:32px;background:#f3f4f6;border-radius:5px;flex-shrink:0"></div>')
        + '<div><div style="font-weight:600">'+( p.titulo||p.nome||'')+'</div><div style="font-size:11px;color:#9ca3af">R$ '+parseFloat(p.preco||0).toFixed(2).replace('.',',')+'</div></div>'
        + '</div>';
    }).join('');
    sug.style.display = 'block';
  });

  // Clicar na sugestão
  ct().addEventListener('click', function(e) {
    var item = e.target.closest('.np-sug-item');
    if (item) {
      var pid = item.getAttribute('data-pid');
      var prod = _npProdutos.find(function(p){ return String(p.id) === String(pid); });
      if (!prod) return;
      var sug = get('np-sugestoes'); if (sug) sug.style.display = 'none';
      var busca = get('np-busca-prod'); if (busca) busca.value = '';
      _npAdicionarProduto(prod);
      return;
    }
    // Botões de quantidade e remover
    var btnMinus = e.target.closest('[data-action="np-minus"]');
    if (btnMinus) { _npAlterarQtd(btnMinus.getAttribute('data-pid'), -1); return; }
    var btnPlus = e.target.closest('[data-action="np-plus"]');
    if (btnPlus) { _npAlterarQtd(btnPlus.getAttribute('data-pid'), +1); return; }
    var btnRemove = e.target.closest('[data-action="np-remove"]');
    if (btnRemove) { _npRemoverProduto(btnRemove.getAttribute('data-pid')); return; }

    // Calcular frete
    var btnFrete = e.target.closest('#btn-calc-frete');
    if (btnFrete) { _npCalcularFrete(); return; }

    // Selecionar opção de frete
    var freteOp = e.target.closest('[data-frete]');
    if (freteOp) {
      document.querySelectorAll('[data-frete]').forEach(function(f) {
        f.style.border = '1.5px solid #e8eaf0'; f.style.background = '#fff';
      });
      freteOp.style.border = '1.5px solid #25d366'; freteOp.style.background = '#f0fdf4';
      _npFrete = JSON.parse(decodeURIComponent(freteOp.getAttribute('data-frete')));
      _npAtualizarResumo();
      return;
    }

    // Criar pedido
    var btnCriar = e.target.closest('#btn-criar-pedido');
    if (btnCriar) { _npCriarPedido(); return; }
  });

  // Fechar sugestões ao clicar fora
  document.addEventListener('click', function handler(e) {
    var sug = get('np-sugestoes');
    if (sug && !sug.contains(e.target) && e.target !== get('np-busca-prod')) {
      sug.style.display = 'none';
    }
  });
}

function _npAdicionarProduto(prod) {
  var existente = _npCarrinho.find(function(p) { return String(p.id) === String(prod.id); });
  if (existente) { existente.quantidade++; }
  else { _npCarrinho.push({ id: prod.id, nome: prod.titulo||prod.nome||'', variante: '', preco: Math.round(parseFloat(prod.preco||0)*100), quantidade: 1, imagem: prod.imagem||'' }); }
  _npRenderCarrinho();
}

function _npAlterarQtd(pid, delta) {
  var idx = _npCarrinho.findIndex(function(p){ return String(p.id) === String(pid); });
  if (idx < 0) return;
  _npCarrinho[idx].quantidade = Math.max(1, (_npCarrinho[idx].quantidade||1) + delta);
  _npRenderCarrinho();
}

function _npRemoverProduto(pid) {
  _npCarrinho = _npCarrinho.filter(function(p){ return String(p.id) !== String(pid); });
  _npRenderCarrinho();
}

function _npRenderCarrinho() {
  var el = get('np-carrinho');
  if (!el) return;
  if (!_npCarrinho.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">Nenhum produto adicionado</div>';
    var fc = get('np-frete-card'); if (fc) fc.style.display = 'none';
    var rc = get('np-resumo-card'); if (rc) rc.style.display = 'none';
    return;
  }
  var html = '';
  _npCarrinho.forEach(function(p) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6">';
    html += (p.imagem ? '<img src="'+p.imagem+'" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0">' : '<div style="width:36px;height:36px;background:#f3f4f6;border-radius:6px;flex-shrink:0"></div>');
    html += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.nome+'</div>';
    html += '<div style="font-size:11px;color:#9ca3af">R$ '+( p.preco/100).toFixed(2).replace('.',',')+'</div></div>';
    html += '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">';
    html += '<button data-action="np-minus" data-pid="'+p.id+'" style="width:24px;height:24px;border-radius:6px;border:1px solid #e8eaf0;background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">-</button>';
    html += '<span style="font-size:13px;font-weight:600;min-width:20px;text-align:center">'+p.quantidade+'</span>';
    html += '<button data-action="np-plus" data-pid="'+p.id+'" style="width:24px;height:24px;border-radius:6px;border:1px solid #e8eaf0;background:#f9fafb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">+</button>';
    html += '</div>';
    html += '<div style="font-size:12px;font-weight:700;color:#111;flex-shrink:0;min-width:60px;text-align:right">R$ '+(p.preco*p.quantidade/100).toFixed(2).replace('.',',')+'</div>';
    html += '<button data-action="np-remove" data-pid="'+p.id+'" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;flex-shrink:0">×</button>';
    html += '</div>';
  });
  el.innerHTML = html;
  var fc = get('np-frete-card'); if (fc) fc.style.display = 'block';
  _npAtualizarResumo();
}

async function _npCalcularFrete() {
  var cep = val('np-cep').replace(/\D/g,'');
  if (cep.length !== 8) { alert('Preencha o CEP primeiro'); return; }
  if (!_npCarrinho.length) { alert('Adicione pelo menos um produto'); return; }
  var btn = get('btn-calc-frete');
  btn.textContent = 'Calculando...'; btn.disabled = true;
  try {
    var r = await fetch(API+'/api/admin?secret='+S+'&action=calcular-frete', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ cep, produtos: _npCarrinho })
    }).then(r=>r.json());
    var el = get('np-fretes-opcoes');
    if (!r.opcoes || !r.opcoes.length) {
      el.innerHTML = '<div style="color:#ef4444;font-size:13px">Nenhuma opcao de frete disponivel</div>';
    } else {
      _npFrete = null;
      el.innerHTML = r.opcoes.map(function(f) {
        return '<div data-frete="'+encodeURIComponent(JSON.stringify(f))+'" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1.5px solid #e8eaf0;border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all .15s">'
          + '<div><div style="font-size:13px;font-weight:600">'+f.empresa+' '+f.nome+'</div><div style="font-size:11px;color:#9ca3af">'+f.prazo+' dias uteis</div></div>'
          + '<div style="font-size:14px;font-weight:700;color:#111">R$ '+f.preco.toFixed(2).replace('.',',')+'</div>'
          + '</div>';
      }).join('');
    }
  } catch(e) { alert('Erro ao calcular frete: '+e.message); }
  btn.textContent = 'Calcular'; btn.disabled = false;
}

function _npAtualizarResumo() {
  var rc = get('np-resumo-card');
  if (!rc) return;
  if (!_npCarrinho.length || !_npFrete) { rc.style.display = 'none'; return; }
  var pagamento = '';
  var radios = document.querySelectorAll('input[name="np-pagamento"]');
  radios.forEach(function(r) { if (r.checked) pagamento = r.value; });
  if (!pagamento) { rc.style.display = 'none'; return; }
  rc.style.display = 'block';
  var subtotal = _npCarrinho.reduce(function(s,p){ return s + p.preco * p.quantidade; }, 0) / 100;
  var total = subtotal + (_npFrete ? _npFrete.preco : 0);
  var pagLabels = {pix:'PIX',credito:'Cartao Credito',debito:'Cartao Debito',dinheiro:'Dinheiro'};
  var rb = get('np-resumo-body');
  if (rb) {
    var html = '';
    _npCarrinho.forEach(function(p) {
      html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>'+p.nome+' x'+p.quantidade+'</span><span>R$ '+(p.preco*p.quantidade/100).toFixed(2).replace('.',',')+'</span></div>';
    });
    html += '<div style="border-top:1px solid #e8eaf0;margin:8px 0;padding-top:8px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Subtotal</span><span>R$ '+subtotal.toFixed(2).replace('.',',')+'</span></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Frete ('+(_npFrete.nome)+')</span><span>R$ '+(_npFrete.preco).toFixed(2).replace('.',',')+'</span></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:8px"><span>Total</span><span style="color:#16a34a">R$ '+total.toFixed(2).replace('.',',')+'</span></div>';
    html += '<div style="font-size:12px;color:#6b7280;margin-top:4px">Pagamento: '+(pagLabels[pagamento]||pagamento)+'</div>';
    html += '</div>';
    rb.innerHTML = html;
  }
}

async function _npCriarPedido() {
  var nome = val('np-nome').trim();
  var tel = val('np-tel').replace(/\D/g,'');
  var cep = val('np-cep').replace(/\D/g,'');
  var rua = val('np-rua').trim();
  var num = val('np-num').trim();
  var bairro = val('np-bairro').trim();
  var cidade = val('np-cidade').trim();
  var uf = val('np-uf').trim().toUpperCase();
  var pagamento = '';
  document.querySelectorAll('input[name="np-pagamento"]').forEach(function(r) { if (r.checked) pagamento = r.value; });

  if (!nome) return alert('Informe o nome do cliente');
  if (tel.length < 10) return alert('Informe o telefone do cliente');
  if (cep.length !== 8) return alert('CEP invalido');
  if (!rua || !num || !bairro || !cidade || !uf) return alert('Preencha o endereco completo');
  if (!_npCarrinho.length) return alert('Adicione pelo menos um produto');
  if (!_npFrete) return alert('Selecione uma opcao de frete');
  if (!pagamento) return alert('Selecione o metodo de pagamento');

  var btn = get('btn-criar-pedido');
  btn.disabled = true; btn.textContent = 'Criando pedido...';
  var resultado = get('np-resultado');
  if (resultado) resultado.textContent = '';

  try {
    var body = {
      cliente: {
        nome: nome,
        telefone: '55' + tel,
        email: val('np-email').trim(),
        cpf: val('np-cpf').trim()
      },
      endereco: {
        cep: cep,
        rua: rua,
        numero: num,
        complemento: val('np-comp').trim(),
        bairro: bairro,
        cidade: cidade,
        estado: uf
      },
      produtos: _npCarrinho,
      frete: _npFrete,
      pagamento: pagamento,
      observacao: val('np-obs').trim()
    };

    var r = await fetch(API+'/api/admin?secret='+S+'&action=criar-pedido-manual', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    }).then(r=>r.json());

    if (r.ok) {
      if (resultado) {
        resultado.innerHTML = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px">'
          + '<div style="font-size:15px;font-weight:700;color:#16a34a;margin-bottom:6px">Pedido criado com sucesso!</div>'
          + '<div style="font-size:13px">Pedido Shopify: <strong>#'+r.shopify_order+'</strong></div>'
          + (r.me_etiqueta ? '<div style="font-size:13px;margin-top:4px">Etiqueta ME: <strong>'+r.me_etiqueta+'</strong> gerada no carrinho</div>' : '<div style="font-size:13px;color:#f59e0b;margin-top:4px">Etiqueta ME: '+(r.me_erro||'nao gerada — verifique o ME')+'</div>')
          + '</div>';
      }
      // Limpar formulario
      _npCarrinho = [];
      _npFrete = null;
      setTimeout(function() {
        ['np-nome','np-tel','np-email','np-cpf','np-cep','np-rua','np-num','np-comp','np-bairro','np-cidade','np-uf','np-obs'].forEach(function(id) {
          var el = get(id); if (el) el.value = '';
        });
        _npRenderCarrinho();
        document.querySelectorAll('input[name="np-pagamento"]').forEach(function(r) { r.checked = false; });
        document.querySelectorAll('[id^="npay-lbl-"]').forEach(function(l) { l.style.border='1.5px solid #e8eaf0'; l.style.background='#fff'; });
      }, 3000);
    } else {
      if (resultado) resultado.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:13px;color:#dc2626">Erro: '+(r.erro||'Falha ao criar pedido')+'</div>';
    }
  } catch(e) {
    if (resultado) resultado.innerHTML = '<div style="color:#ef4444;font-size:13px">Erro: '+e.message+'</div>';
  }
  btn.disabled = false; btn.textContent = 'Criar Pedido + Gerar Etiqueta ME';
}

// INICIAR
renderAba('home');
</script>
</body>
</html>`);
      html += '<button data-action="identificar" data-phone="'+phone+'" style="padding:5px 10px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">🔍 Identificar</button>';
