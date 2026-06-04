export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // SALVAR LEAD
  if (req.method === 'POST') {
    const { nome, email, telefone, cpf, estagio, carrinho, frete, endereco } = req.body;
    if (!email) return res.status(400).json({ erro: 'Email obrigatório' });

    const id = `lead-${Date.now()}`;
    const lead = {
      id,
      nome: nome || '',
      email,
      telefone: telefone || '',
      cpf: cpf || '',
      estagio,
      carrinho: carrinho || [],
      frete: frete || null,
      endereco: endereco || null,
      criado_em: new Date().toISOString(),
      contatado: false
    };

    try {
      // Salvar lead individual
      const setResp = await fetch(`${KV_URL}/set/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 })
      });
      const setData = await setResp.json();
      console.log('SET lead:', JSON.stringify(setData));

      // Adicionar ID na lista usando endpoint correto do Upstash
      const pushResp = await fetch(`${KV_URL}/lpush/leads-lista/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const pushData = await pushResp.json();
      console.log('LPUSH leads-lista:', JSON.stringify(pushData));

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
      const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/200`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const listaData = await listaResp.json();
      console.log('LRANGE result:', JSON.stringify(listaData));
      const idsRaw = listaData.result || [];
      // Upstash retorna IDs como strings ou como {"value":"lead-xxx"} — normalizar
      const ids = idsRaw.map(i => {
        if (typeof i === 'string') {
          try {
            const parsed = JSON.parse(i);
            return parsed.value || i;
          } catch(e) { return i; }
        }
        return i.value || i;
      });

      const leads = [];
      for (const id of ids) {
        try {
          const r = await fetch(`${KV_URL}/get/${id}`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
          });
          const d = await r.json();
          console.log('GET', id, JSON.stringify(d).substring(0, 200));
          if (d.result) {
            let parsed = d.result;
            while (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch(e) { break; }
            }
            // Se ainda tiver value dentro
            if (parsed && parsed.value) {
              let inner = parsed.value;
              while (typeof inner === 'string') {
                try { inner = JSON.parse(inner); } catch(e) { break; }
              }
              parsed = inner;
            }
            console.log('LEAD parsed:', JSON.stringify(parsed).substring(0, 100));
            if (parsed && parsed.email) leads.push(parsed);
          }
        } catch(e) { console.log('Erro GET', id, e.message); }
      }

      leads.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
      return res.status(200).json({ leads });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // DELETAR LEAD
  if (req.method === 'DELETE') {
    const { secret, id } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    await fetch(`${KV_URL}/del/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
