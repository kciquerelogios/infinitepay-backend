const KV = () => ({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

const kv = {
  get: async (key) => {
    const { url, token } = KV();
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (!d.result) return null;
    let v = d.result;
    // Desencapsular múltiplas camadas de string
    let tries = 0;
    while (typeof v === 'string' && tries++ < 5) {
      try { v = JSON.parse(v); } catch(e) { break; }
    }
    // Se ainda for {value: "..."}, desencapsular
    if (v && typeof v === 'object' && typeof v.value === 'string') {
      try { v = JSON.parse(v.value); } catch(e) {}
    }
    return v;
  },
  set: async (key, value, ex = 604800) => {
    const { url, token } = KV();
    // Upstash espera string no campo value
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: strValue, ex })
    });
  },
  del: async (key) => {
    const { url, token } = KV();
    await fetch(`${url}/del/${encodeURIComponent(key)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  },
  sadd: async (key, member) => {
    const { url, token } = KV();
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SADD', key, member]])
    });
  },
  srem: async (key, member) => {
    const { url, token } = KV();
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SREM', key, member]])
    });
  },
  smembers: async (key) => {
    const { url, token } = KV();
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SMEMBERS', key]])
    });
    const d = await r.json();
    return (d[0]?.result) || [];
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SECRET = process.env.REPROCESSAR_SECRET;

  // ── LIMPAR TODOS ──────────────────────────────────────────
  if (req.method === 'POST' && req.body?.action === 'limpar_todos') {
    if (req.body.secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const ids = await kv.smembers('leads-set');
    await Promise.all(ids.map(id => kv.del(id)));
    await kv.del('leads-set');
    return res.status(200).json({ ok: true, deletados: ids.length });
  }

  // ── DELETAR UM LEAD ───────────────────────────────────────
  if (req.method === 'DELETE') {
    const { secret, id } = req.query;
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    await kv.del(id);
    await kv.srem('leads-set', id);
    return res.status(200).json({ ok: true });
  }

  // ── LISTAR LEADS ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { secret } = req.query;
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const ids = await kv.smembers('leads-set');
    const leadsRaw = await Promise.all(ids.map(id => kv.get(id)));
    const leads = leadsRaw
      .filter(Boolean)
      .map(l => {
        // Desencapsular se vier como objeto {value: "..."}
        if (l && typeof l.value === 'string') {
          try { return JSON.parse(l.value); } catch(e) { return null; }
        }
        // Desencapsular se vier como string
        if (typeof l === 'string') {
          try { return JSON.parse(l); } catch(e) { return null; }
        }
        return l;
      })
      .filter(l => l && l.email);
    leads.sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em));
    return res.status(200).json({ leads });
  }

  // ── SALVAR / ATUALIZAR LEAD ───────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ erro: 'Email inválido' });
    }

    const id = `lead:${email.replace(/[^a-z0-9]/g, '_')}`;
    const agora = new Date().toISOString();
    const existente = await kv.get(id);

    // Merge de tags — nunca perder o histórico
    const tagsAntigas = existente?.tags || [];
    const tagsNovas = body.tags || [];
    const tags = [...new Set([...tagsAntigas, ...tagsNovas])];

    // Ordem de estágio para exibição
    const ordemEstagio = ['cep_produto','identificacao','calculou_frete','endereco','frete_selecionado','pagamento_pendente'];
    const estagio = tags.filter(t => ordemEstagio.includes(t))
      .sort((a,b) => ordemEstagio.indexOf(b) - ordemEstagio.indexOf(a))[0] || 'dados';

    const lead = {
      id,
      email,
      nome: body.nome || existente?.nome || '',
      telefone: body.telefone || existente?.telefone || '',
      cpf: body.cpf || existente?.cpf || '',
      cep: body.cep || existente?.cep || '',
      rua: body.rua || existente?.rua || '',
      numero: body.numero || existente?.numero || '',
      complemento: body.complemento || existente?.complemento || '',
      bairro: body.bairro || existente?.bairro || '',
      cidade: body.cidade || existente?.cidade || '',
      estado: body.estado || existente?.estado || '',
      frete: body.frete || existente?.frete || null,
      carrinho: body.carrinho || existente?.carrinho || [],
      tags,
      estagio,
      recuperacao_enviada: existente?.recuperacao_enviada || false,
      criado_em: existente?.criado_em || agora,
      atualizado_em: agora,
    };

    await kv.set(id, lead);
    await kv.sadd('leads-set', id); // Set garante sem duplicatas
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).end();
}
