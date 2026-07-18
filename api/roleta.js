export default async function handler(req, res) {
  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SECRET   = process.env.REPROCESSAR_SECRET || 'kcique2026';
  const action   = req.query.action || 'config';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kv = (path, opts) => fetch(KV_URL + path, {
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    ...opts
  }).then(r => r.json()).catch(() => ({}));

  // ── CONFIG ────────────────────────────────────────────────────
  if (action === 'config') {
    const [cfgR, statusR] = await Promise.all([
      kv('/get/roleta-config'),
      kv('/get/roleta-aberta')
    ]);

    let itens = null;
    if (cfgR.result) { try { itens = JSON.parse(cfgR.result); } catch(e) {} }
    if (!itens) itens = [
      { label: '10% OFF',          cor: '#1a1a1a', fg: '#fff', prob: 30, cupom: 'SPIN10'    },
      { label: 'Frete Grátis',     cor: '#2d6a4f', fg: '#fff', prob: 20, cupom: 'FRETEFREE' },
      { label: '15% OFF',          cor: '#1d4e89', fg: '#fff', prob: 15, cupom: 'SPIN15'    },
      { label: 'Tente\nNovamente', cor: '#888888', fg: '#fff', prob: 20, cupom: '',          mensagem: 'Tente de novo amanhã!' },
      { label: '20% OFF',          cor: '#5c2a8c', fg: '#fff', prob: 10, cupom: 'SPIN20'    },
      { label: 'Brinde\nEspecial', cor: '#b5451b', fg: '#fff', prob: 5,  cupom: 'BRINDE'    },
    ];

    // aberta: null/undefined/'1' = aberta, '0' = fechada
    const aberta = statusR.result !== '0';
    return res.status(200).json({ itens, aberta });
  }

  // ── REGISTRAR SPIN ────────────────────────────────────────────
  if (action === 'registrar' && req.method === 'POST') {
    const premio = (req.body && req.body.premio) || '';
    const cupom  = (req.body && req.body.cupom)  || '';
    const hoje   = new Date().toISOString().split('T')[0];
    await kv('/pipeline', {
      method: 'POST',
      body: JSON.stringify([
        ['LPUSH', 'roleta-historico', JSON.stringify({ premio, cupom, data: hoje, ts: Date.now() })],
        ['LTRIM', 'roleta-historico', '0', '999']
      ])
    });
    return res.status(200).json({ ok: true });
  }

  // ── TOGGLE STATUS ─────────────────────────────────────────────
  if (action === 'toggle-status' && req.method === 'POST') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const aberta = !!(req.body && req.body.aberta);
    await kv('/pipeline', {
      method: 'POST',
      body: JSON.stringify([['SET', 'roleta-aberta', aberta ? '1' : '0']])
    });
    return res.status(200).json({ ok: true, aberta });
  }

  // ── SALVAR CONFIG ─────────────────────────────────────────────
  if (action === 'salvar-config' && req.method === 'POST') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const itens = req.body && req.body.itens;
    if (!itens || !Array.isArray(itens)) return res.status(400).json({ erro: 'itens inválidos' });
    await kv('/pipeline', {
      method: 'POST',
      body: JSON.stringify([['SET', 'roleta-config', JSON.stringify(itens)]])
    });
    return res.status(200).json({ ok: true });
  }

  // ── HISTÓRICO ─────────────────────────────────────────────────
  if (action === 'historico') {
    if (req.query.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const r = await kv('/lrange/roleta-historico/0/99');
    const historico = (r.result || []).map(e => { try { return JSON.parse(e); } catch(x) { return null; } }).filter(Boolean);
    return res.status(200).json({ historico });
  }

  return res.status(404).json({ erro: 'action não encontrada' });
}
