// api/grupo.js — Redireciona para o grupo VIP ativo
export default async function handler(req, res) {
  const FALLBACK = 'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1';
  
  try {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    
    if (!KV_URL || !KV_TOKEN) return res.redirect(302, FALLBACK);

    const r = await fetch(`${KV_URL}/get/grupo-ativo-manual`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    
    if (!r.ok) return res.redirect(302, FALLBACK);
    
    const j = await r.json();
    let dados = j.result;
    if (!dados) return res.redirect(302, FALLBACK);
    while (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch(e) { break; } }

    if (dados && dados.link) {
      return res.redirect(302, dados.link);
    }
  } catch(e) {
    console.error('grupo.js erro:', e.message);
  }

  return res.redirect(302, FALLBACK);
}
