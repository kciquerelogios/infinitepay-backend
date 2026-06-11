export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  async function listarCupons() {
    const r = await fetch(`${KV_URL}/lrange/cupons-lista/0/100`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    console.log('lrange cupons result:', JSON.stringify(d).substring(0,200));
    // Normalizar IDs — alguns podem estar salvos como '["cupom_123"]' em vez de 'cupom_123'
    const ids = (d.result || []).map(id => {
      if (typeof id === 'string' && id.startsWith('[')) {
        try { const arr = JSON.parse(id); return Array.isArray(arr) ? arr[0] : id; } catch(e) { return id; }
      }
      return id;
    }).filter(Boolean);
    const cupons = await Promise.all(ids.map(async id => {
      const r2 = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d2 = await r2.json();
      let c = d2.result;
      while (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { break; } }
      return (c && c.codigo) ? c : null;
    }));
    return cupons.filter(Boolean);
  }

  // ===== VALIDAR CUPOM (público, usado no checkout) =====
  if (req.method === 'POST' && req.body && req.body.action === 'validar') {
    const { codigo, carrinho } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'Código inválido' });
    try {
      const cupons = await listarCupons();
      const cupom = cupons.find(c => c.codigo === codigo.toUpperCase().trim());
      if (!cupom) return res.status(404).json({ erro: 'Cupom não encontrado' });
      if (!cupom.ativo) return res.status(400).json({ erro: 'Cupom inativo' });
      if (cupom.validade) {
        const val = new Date(cupom.validade); val.setHours(23,59,59);
        if (new Date() > val) return res.status(400).json({ erro: 'Cupom expirado' });
      }
      if (cupom.limiteUsos && (cupom.usosAtuais || 0) >= cupom.limiteUsos) {
        return res.status(400).json({ erro: 'Cupom esgotado' });
      }
      const subtotal = (carrinho || []).reduce((s, i) => s + (i.preco * (i.quantidade||1)), 0);
      let desconto = 0, freteGratis = false, descontoDesc = '';
      if (cupom.tipo === 'percentual') { desconto = Math.round(subtotal * cupom.valor / 100); descontoDesc = cupom.valor + '% off'; }
      else if (cupom.tipo === 'fixo') { desconto = Math.min(Math.round(cupom.valor * 100), subtotal); descontoDesc = 'R$ ' + (cupom.valor).toFixed(2).replace('.', ',') + ' off'; }
      else if (cupom.tipo === 'frete_gratis') { freteGratis = true; descontoDesc = 'Frete grátis'; }
      else if (cupom.tipo === 'percentual_frete') { desconto = Math.round(subtotal * cupom.valor / 100); freteGratis = true; descontoDesc = cupom.valor + '% off + Frete grátis'; }
      return res.status(200).json({ ok: true, cupom: { codigo: cupom.codigo, tipo: cupom.tipo, valor: cupom.valor, desconto, freteGratis, descontoDesc } });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ===== ROTAS ADMIN =====
  const secret = req.query.secret || (req.body && req.body.secret);
  if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });

  // Listar
  if (req.method === 'GET' && req.query.action === 'listar') {
    try {
      const cupons = await listarCupons();
      return res.status(200).json({ cupons });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // Salvar
  if (req.method === 'POST' && req.body && req.body.action === 'salvar') {
    const { codigo, tipo, valor, validade, limiteUsos, produto } = req.body;
    if (!codigo || !tipo) return res.status(400).json({ erro: 'Código e tipo são obrigatórios' });
    const id = 'cupom_' + Date.now();
    const cupom = {
      id, codigo: codigo.toUpperCase().trim(), tipo,
      valor: parseFloat(valor) || 0,
      validade: validade || null,
      limiteUsos: limiteUsos ? parseInt(limiteUsos) : null,
      usosAtuais: 0,
      produto: produto || 'todos',
      ativo: true,
      criado_em: new Date().toISOString()
    };
    try {
      await fetch(`${KV_URL}/set/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cupom) });
      const rpushResp = await fetch(`${KV_URL}/rpush/cupons-lista/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const rpushData = await rpushResp.json();
      console.log('rpush cupom result:', JSON.stringify(rpushData));
      return res.status(200).json({ ok: true, cupom, rpush: rpushData });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // Deletar
  if (req.method === 'POST' && req.body && req.body.action === 'deletar') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ erro: 'ID obrigatório' });
    try {
      await fetch(`${KV_URL}/del/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      await fetch(`${KV_URL}/lrem/cupons-lista/0/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([id]) });
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // Toggle ativo/inativo
  if (req.method === 'POST' && req.body && req.body.action === 'toggle') {
    const { id } = req.body;
    try {
      const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      let c = d.result;
      while (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { break; } }
      c.ativo = !c.ativo;
      await fetch(`${KV_URL}/set/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
      return res.status(200).json({ ok: true, ativo: c.ativo });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  return res.status(400).json({ erro: 'Ação inválida' });
}
