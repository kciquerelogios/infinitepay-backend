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
      estagio, // 'dados' ou 'pagamento'
      carrinho: carrinho || [],
      frete: frete || null,
      endereco: endereco || null,
      criado_em: new Date().toISOString(),
      contatado: false
    };

    // Salvar lead individual
    await fetch(`${KV_URL}/set/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 }) // 7 dias
    });

    // Adicionar ID na lista de leads
    await fetch(`${KV_URL}/lpush/leads-lista`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: id })
    });

    return res.status(200).json({ ok: true, id });
  }

  // LISTAR LEADS
  if (req.method === 'GET') {
    const { secret } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });

    try {
      // Buscar lista de IDs
      const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/200`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const listaData = await listaResp.json();
      const ids = listaData.result || [];

      // Buscar cada lead
      const leads = [];
      for (const id of ids) {
        try {
          const r = await fetch(`${KV_URL}/get/${id}`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
          });
          const d = await r.json();
          if (d.result) {
            let parsed = d.result;
            while (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (parsed && parsed.email) leads.push(parsed);
          }
        } catch(e) {}
      }

      // Ordenar por mais recente
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
