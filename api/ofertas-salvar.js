export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret } = req.query;
  if (secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    const { texto, imagem, link, dataHora, grupos } = req.body;

    if (!texto || !dataHora) {
      return res.status(400).json({ error: 'Texto e data são obrigatórios' });
    }

    const id = `oferta-${Date.now()}`;
    const oferta = {
      id,
      texto,
      imagem: imagem || '',
      link: link || '',
      dataHora,
      grupos: grupos || 'todos',
      status: 'agendada',
      criado_em: new Date().toISOString()
    };

    await fetch(`${KV_URL}/set/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(oferta), ex: 60 * 60 * 24 * 30 })
    });

    await fetch(`${KV_URL}/rpush/ofertas-lista`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([id])
    });

    console.log('Oferta agendada:', id, dataHora, grupos);
    return res.status(200).json({ success: true, id });

  } catch(e) {
    console.error('Erro ao salvar oferta:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
