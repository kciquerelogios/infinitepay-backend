export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;
    console.log('=== PAYLOAD INFINITEPAY ===', JSON.stringify(payload));

    if (!payload || !payload.items) {
      return res.status(400).json({ success: false, message: 'Payload inválido' });
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
    const HANDLE = process.env.INFINITE_HANDLE;

    // Tentar buscar mais dados via payment_check
    let extraData = null;
    if (payload.order_nsu && payload.transaction_nsu && payload.invoice_slug) {
      try {
        const checkResp = await fetch('https://api.checkout.infinitepay.io/payment_check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: HANDLE,
            order_nsu: payload.order_nsu,
            transaction_nsu: payload.transaction_nsu,
            slug: payload.invoice_slug
          })
        });
        extraData = await checkResp.json();
        console.log('=== PAYMENT CHECK RESPONSE ===', JSON.stringify(extraData));
      } catch (e) {
        console.log('Erro payment_check:', e.message);
      }
    }

    // Tentar buscar dados do comprovante
    if (payload.receipt_url) {
      try {
        const receiptResp = await fetch(payload.receipt_url);
        const receiptText = await receiptResp.text();
       // Tentar extrair dados do cliente do HTML
const nomeMatch = receiptText.match(/nome["\s:>]+([^<"]+)/i);
const cpfMatch = receiptText.match(/cpf["\s:>]+([^<"]+)/i);
const emailMatch = receiptText.match(/email["\s:>]+([^<"]+)/i);
const telefoneMatch = receiptText.match(/telefone["\s:>]+([^<"]+)/i) || receiptText.match(/phone["\s:>]+([^<"]+)/i);
const enderecoMatch = receiptText.match(/endere[çc]o["\s:>]+([^<"]+)/i) || receiptText.match(/address["\s:>]+([^<"]+)/i);

console.log('=== DADOS CLIENTE DO RECIBO ===', JSON.stringify({
  nome: nomeMatch ? nomeMatch[1].trim() : null,
  cpf: cpfMatch ? cpfMatch[1].trim() : null,
  email: emailMatch ? emailMatch[1].trim() : null,
  telefone: telefoneMatch ? telefoneMatch[1].trim() : null,
  endereco: enderecoMatch ? enderecoMatch[1].trim() : null
}));

// Log completo do HTML para análise
console.log('=== RECEIPT HTML COMPLETO ===', receiptText.substring(0, 5000));
      } catch (e) {
        console.log('Erro receipt_url:', e.message);
      }
    }

    const items = payload.items || [];
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
        currency: 'BRL',
        note: `Pago via InfinitePay | NSU: ${payload.order_nsu || ''} | Método: ${payload.capture_method || ''} | Comprovante: ${payload.receipt_url || ''}`,
        tags: 'InfinitePay',
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
      return res.status(400).json({ success: false, message: 'Erro ao criar pedido' });
    }

  } catch (error) {
    console.error('Erro webhook:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
