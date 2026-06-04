export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // SALVAR LEAD
  if (req.method === 'POST') {
    const body = req.body;
    const email = body.email;
    if (!email) return res.status(400).json({ erro: 'Email obrigatório' });

    const id = `lead-${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    const lead = {
      id,
      nome: body.nome || '',
      email,
      telefone: body.telefone || '',
      cpf: body.cpf || '',
      estagio: body.estagio || 'dados',
      carrinho: body.carrinho || [],
      frete: body.frete || null,
      cep: body.cep || '',
      rua: body.rua || '',
      numero: body.numero || '',
      complemento: body.complemento || '',
      bairro: body.bairro || '',
      cidade: body.cidade || '',
      estado: body.estado || '',
      atualizado_em: new Date().toISOString(),
      contatado: false
    };

    try {
      // Verificar se já existe para preservar criado_em
      let criado_em = new Date().toISOString();
      let naLista = false;

      const existeResp = await fetch(`${KV_URL}/get/${id}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const existeData = await existeResp.json();

      if (existeData.result) {
        // Já existe — preservar criado_em
        let existente = existeData.result;
        for (let i = 0; i < 10; i++) {
          if (typeof existente === 'string') { try { existente = JSON.parse(existente); } catch(e) { break; } }
          else if (existente && existente.value !== undefined) { existente = existente.value; }
          else break;
        }
        if (existente && existente.criado_em) criado_em = existente.criado_em;
        naLista = true; // Já está na lista
      }

      lead.criado_em = criado_em;

      // Salvar lead
      await fetch(`${KV_URL}/set/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 })
      });

      // Adicionar na lista somente se é novo
      if (!naLista) {
        await fetch(`${KV_URL}/lpush/leads-lista/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
      }

      return res.status(200).json({ ok: true, id });
    } catch(e) {
      console.error('Erro leads POST:', e.message);
      return res.status(500).json({ erro: e.message });
    }
  }

  // LISTAR LEADS
  if (req.method === 'GET') {
    const { secret } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });

    try {
      const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/500`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const listaData = await listaResp.json();
      const idsRaw = listaData.result || [];

      const ids = idsRaw.map(i => {
        if (typeof i === 'string') { try { const p = JSON.parse(i); return p.value || i; } catch(e) { return i; } }
        return i.value || i;
      });

      function desencapsular(val) {
        let v = val;
        for (let i = 0; i < 10; i++) {
          if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
          else if (v && typeof v === 'object') {
            if (v.value !== undefined) { v = v.value; continue; }
            if (v.result !== undefined) { v = v.result; continue; }
            break;
          } else break;
        }
        return v;
      }

      const leads = [];
      const idsVistos = [];

      for (const id of ids) {
        try {
          const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
          const d = await r.json();
          if (!d.result) continue;
          const parsed = desencapsular(d.result);
          if (parsed && parsed.email && !idsVistos.includes(parsed.id)) {
            idsVistos.push(parsed.id);
            leads.push(parsed);
          }
        } catch(e) {}
      }

      leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
      return res.status(200).json({ leads });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // DELETAR LEAD
  if (req.method === 'DELETE') {
    const { secret, id } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    await fetch(`${KV_URL}/del/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/leads-lista/0/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
