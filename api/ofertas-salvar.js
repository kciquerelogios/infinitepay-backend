export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    const { texto, imagem, link, dataHora, grupos } = req.body;
    if (!texto || !dataHora) return res.status(400).json({ error: 'Texto e data obrigatórios' });

    const id = `oferta-${Date.now()}`;
    const oferta = { id, texto, imagem: imagem || '', link: link || '', dataHora, grupos: grupos || 'todos', status: 'agendada', criado_em: new Date().toISOString() };

    // Salvar no Redis como string JSON simples
    await fetch(`${KV_URL}/set/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(oferta))
    });

    // Adicionar à lista
    await fetch(`${KV_URL}/rpush/ofertas-lista`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([id])
    });

    return res.status(200).json({ success: true, id });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
