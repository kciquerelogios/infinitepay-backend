// api/produtos-json.js — redirect para admin?action=produtos-lista
// Este arquivo existe para compatibilidade com versões antigas do dashboard
export default async function handler(req, res) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const r = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&status=active`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
