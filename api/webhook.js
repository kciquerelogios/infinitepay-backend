export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;

    if (!payload || !payload.items) {
      return res.status(400).json({ success: false, message: 'Payload inválido' });
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

    const items = payload.items || [];
    const customer = payload.customer || {};
    const address = payload.address || {};

    const lineItems = items.map(item => ({
      title: item.description || 'Produto',
      quantity: item.quantity || 1,
      price: ((item.price || 0) / 100).toFixed(2),
      requires_shipping: true
    }));

    const orderData = {
      order: {
        line_items: lineItems,
        financial_status: 'paid',
        fulfillment_status: null,
        currency: 'BRL',
        note: `Pago via InfinitePay | NSU: ${payload.order_nsu || ''} | Método: ${payload.capture_method || ''}`,
        tags: 'InfinitePay',
        customer: customer.name ? {
          first_name: customer.name.split(' ')[0] || '',
          last_name: customer.name.split(' ').slice(1).join(' ') || '',
          email: customer.email || '',
          phone: customer.phone_number || ''
        } : undefined,
        shipping_address: address.cep ? {
          first_name: customer.name ? customer.name.split(' ')[0] : '',
          last_name: customer.name ? customer.name.split(' ').slice(1).join(' ') : '',
          address1: `${address.street || ''}, ${address.number || ''}`,
          address2: address.complement || '',
          zip: address.cep || '',
          city: address.city || '',
          province: address.state || '',
          country: 'BR',
          phone: customer.phone_number || ''
        } : undefined,
        transactions: [{
          kind: 'sale',
          status: 'success',
          amount: ((payload.paid_amount || payload.amount || 0) / 100).toFixed(2),
          gateway: 'InfinitePay'
        }]
      }
    };

    const shopifyResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_TOKEN
        },
        body: JSON.stringify(orderData)
      }
    );

    const shopifyData = await shopifyResponse.json();

    if (shopifyData.order) {
      console.log('Pedido criado no Shopify:', shopifyData.order.id);
      return res.status(200).json({ success: true, message: null });
    } else {
      console.error('Erro Shopify:', JSON.stringify(shopifyData));
      return res.status(400).json({ success: false, message: 'Erro ao criar pedido no Shopify' });
    }

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
