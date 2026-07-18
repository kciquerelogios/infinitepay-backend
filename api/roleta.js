export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SECRET = process.env.REPROCESSAR_SECRET || 'kcique2026';
  const action = req.query.action || 'config';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── CONFIG: retorna itens da roleta ──────────────────────────
  if (action === 'config') {
    const r = await fetch(KV_URL + '/get/roleta-config', {
      headers: { Authorization: 'Bearer ' + KV_TOKEN }
    }).then(function(r){return r.json();}).catch(function(){return {result:null};});

    let itens;
    if (r.result) {
      try { itens = JSON.parse(r.result); } catch(e) { itens = null; }
    }
    if (!itens) {
      itens = [
        { label: '10% OFF',        cor: '#e74c3c', prob: 30, cupom: 'SPIN10'    },
        { label: 'Frete Grátis',   cor: '#27ae60', prob: 20, cupom: 'FRETEFREE' },
        { label: '15% OFF',        cor: '#2980b9', prob: 15, cupom: 'SPIN15'    },
        { label: 'Tente de\nnovo', cor: '#7f8c8d', prob: 20, cupom: '',          mensagem: 'Tente de novo amanhã!' },
        { label: '20% OFF',        cor: '#8e44ad', prob: 10, cupom: 'SPIN20'    },
        { label: 'Brinde\nEspecial', cor: '#d35400', prob: 5, cupom: 'BRINDE'   },
      ];
    }
    const statusR = await fetch(KV_URL + '/get/roleta-aberta', {
      headers: { Authorization: 'Bearer ' + KV_TOKEN }
    }).then(function(r){return r.json();}).catch(function(){return {result:null};});
    const aberta = statusR.result !== '0';
    return res.status(200).json({ itens, aberta });
  }

  // ── REGISTRAR SPIN ────────────────────────────────────────────
  if (action === 'registrar' && req.method === 'POST') {
    const premio = (req.body && req.body.premio) || '';
    const cupom  = (req.body && req.body.cupom)  || '';
    const hoje   = new Date().toISOString().split('T')[0];
    await fetch(KV_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['LPUSH', 'roleta-historico', JSON.stringify({ premio, cupom, data: hoje, ts: Date.now() })],
        ['LTRIM', 'roleta-historico', '0', '999']
      ])
    }).catch(function(){});
    return res.status(200).json({ ok: true });
  }

  // ── TOGGLE STATUS ────────────────────────────────────────────
  if (action === 'toggle-status' && req.method === 'POST') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const aberta = req.body && req.body.aberta;
    await fetch(KV_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', 'roleta-aberta', aberta ? '1' : '0']])
    });
    return res.status(200).json({ ok: true, aberta: aberta });
  }

  // ── SALVAR CONFIG (dashboard) ─────────────────────────────────
  if (action === 'salvar-config' && req.method === 'POST') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const itens = req.body && req.body.itens;
    if (!itens || !Array.isArray(itens)) return res.status(400).json({ erro: 'itens inválidos' });
    await fetch(KV_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', 'roleta-config', JSON.stringify(itens)]])
    });
    return res.status(200).json({ ok: true });
  }

  // ── HISTÓRICO (dashboard) ─────────────────────────────────────
  if (action === 'historico') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const r = await fetch(KV_URL + '/lrange/roleta-historico/0/99', {
      headers: { Authorization: 'Bearer ' + KV_TOKEN }
    }).then(function(r){return r.json();}).catch(function(){return {result:[]};});
    const entries = (r.result||[]).map(function(e){
      try { return JSON.parse(e); } catch(x) { return null; }
    }).filter(Boolean);
    return res.status(200).json({ historico: entries });
  }

  return res.status(404).json({ erro: 'action não encontrada' });
}
