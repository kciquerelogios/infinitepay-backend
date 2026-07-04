// api/grupo.js — Redireciona para o grupo VIP ativo
export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    const r = await fetch(`${KV_URL}/get/grupo-ativo-manual`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const j = await r.json();
    let dados = j.result;
    while (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch(e) { break; } }

    if (dados && dados.link) {
      return res.redirect(302, dados.link);
    }
  } catch(e) {}

  // Fallback
  return res.redirect(302, 'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1');
}
