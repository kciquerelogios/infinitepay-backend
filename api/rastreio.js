export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ME-Signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('=== MELHOR ENVIO WEBHOOK ===', JSON.stringify(payload));

    const dados = payload.data || payload;

    // Precisa ter tracking code
    const tracking = dados.tracking || dados.tracking_code || '';
    if (!tracking) {
      console.log('Sem tracking, ignorando');
      return res.status(200).json({ ok: true });
    }

    // Só processar quando status for released ou posted
    const status = dados.status || '';
    if (!['released', 'posted'].includes(status)) {
      console.log('Status ignorado:', status);
      return res.status(200).json({ ok: true });
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    // Verificar no Redis se já enviou rastreio para esse tracking
    const chaveRastreio = 'rastreio-enviado-' + tracking;
    try {
      const jaEnviou = await fetch(`${KV_URL}/get/${chaveRastreio}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const jaEnviouData = await jaEnviou.json();
      if (jaEnviouData.result) {
        console.log('Rastreio já enviado para:', tracking);
        return res.status(200).json({ ok: true });
      }
    } catch(e) {}

    // Buscar pedido no Shopify pelo nome do destinatário
    const nomeDestinatario = dados.to && dados.to.name ? dados.to.name : '';
    const emailDestinatario = dados.to && dados.to.email ? dados.to.email : '';
    let telefone = dados.to && dados.to.phone ? dados.to.phone.replace(/[^0-9]/g,'') : '';

    console.log('Destinatário:', nomeDestinatario, emailDestinatario, telefone);

    // Buscar pedido no Shopify por email para pegar telefone
    if (!telefone && emailDestinatario) {
      try {
        const shopifyResp = await fetch(
          `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?email=${encodeURIComponent(emailDestinatario)}&limit=5&financial_status=paid`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        );
        const shopifyData = await shopifyResp.json();
        const pedido = (shopifyData.orders || [])[0];
        if (pedido) {
          telefone = (pedido.shipping_address?.phone || pedido.phone || pedido.billing_address?.phone || '').replace(/[^0-9]/g,'');
        }
      } catch(e) { console.log('Erro Shopify:', e.message); }
    }

    if (!telefone) {
      console.log('Sem telefone, não enviou WhatsApp');
      return res.status(200).json({ ok: true });
    }

    // Garantir formato correto (55 + DDD + número)
    if (!telefone.startsWith('55')) telefone = '55' + telefone;

    const primeiroNome = nomeDestinatario.split(' ')[0] || 'cliente';
    const mensagem = `Olá ${primeiroNome}! 😊\n\nSeu pedido da *Kcique Relógios* foi enviado! ⌚📦\n\n🔍 *Código de rastreio:*\n${tracking}\n\n📦 *Acompanhe aqui:*\nhttps://www.melhorrastreio.com.br/rastreio/${tracking}\n\nQualquer dúvida estamos aqui! 😊`;

    // Enviar WhatsApp via Z-API
    const zapiResp = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: telefone, message: mensagem })
      }
    );
    const zapiData = await zapiResp.json();
    console.log('WhatsApp enviado:', JSON.stringify(zapiData));

    // Marcar no Redis que já enviou (TTL 30 dias)
    await fetch(`${KV_URL}/set/${chaveRastreio}/1/ex/2592000`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });

    return res.status(200).json({ ok: true, tracking, telefone });

  } catch (error) {
    console.error('Erro rastreio:', error);
    return res.status(200).json({ ok: true });
  }
}
