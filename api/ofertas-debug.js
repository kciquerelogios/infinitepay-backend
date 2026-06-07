export default async function handler(req, res) {
  if (req.query.secret !== process.env.REPROCESSAR_SECRET) return res.status(401).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const listaData = await listaResp.json();
  const ids = listaData.result || [];

  const raw = [];
  for (const id of ids.slice(0, 5)) {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    raw.push({ id, result: d.result });
  }

  return res.status(200).json({ total: ids.length, ids: ids.slice(0, 5), raw });
}
