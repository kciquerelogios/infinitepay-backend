export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ME-Signature');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('=== MELHOR ENVIO WEBHOOK ===', JSON.stringify(payload));

    const evento = payload.event;
    const dados = payload.data;

    // Só processar quando a etiqueta for postada ou tiver código de rastreio
    if (!dados || !dados.tag) {
      return res.status(200).json({ ok: true });
    }

    const shopifyOrderId = dados.tag;
    const trackingUrl = dados.tracking_url || '';
    const status = dados.status;

    console.log(`Evento: ${evento} | Pedido Shopify: ${shopifyOrderId} | Status: ${status}`);

    // Só atualizar quando postado ou com rastreio disponível
    if (evento === 'order.posted' || evento === 'order.generated' || trackingUrl) {
      const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
      const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

      // Extrair código de rastreio da URL
      // Ex: https://www.melhorrastreio.com.br/rastreio/AA123456789BR
      let trackingCode = '';
      if (trackingUrl) {
        const partes = trackingUrl.split('/');
        trackingCode = partes[partes.length - 1] || '';
      }

      // Buscar pedido no Shopify
      const pedidoResp = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${shopifyOrderId}.json`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      );
      const pedidoData = await pedidoResp.json();

      if (!pedidoData.order) {
        console.log('Pedido não encontrado no Shopify:', shopifyOrderId);
        return res.status(200).json({ ok: true });
      }

      // Criar fulfillment (marcar como enviado com rastreio)
      const fulfillmentResp = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${shopifyOrderId}/fulfillments.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_TOKEN
          },
          body: JSON.stringify({
            fulfillment: {
              tracking_number: trackingCode,
              tracking_url: trackingUrl,
              tracking_company: 'Correios',
              notify_customer: true,
              line_items: pedidoData.order.line_items.map(item => ({
                id: item.id,
                quantity: item.quantity
              }))
            }
          })
        }
      );

      const fulfillmentData = await fulfillmentResp.json();
      console.log('=== FULFILLMENT SHOPIFY ===', JSON.stringify(fulfillmentData));

      if (fulfillmentData.fulfillment) {
        console.log('Fulfillment criado! Rastreio:', trackingCode);
      } else {
        console.log('Erro ao criar fulfillment:', JSON.stringify(fulfillmentData));
      }
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Erro rastreio:', error);
    return res.status(200).json({ ok: true }); // sempre 200 pro Melhor Envio
  }
}
