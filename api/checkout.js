export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { cor, preco, descricao } = req.body;
  const HANDLE = process.env.INFINITE_HANDLE;

  const response = await fetch('https://api.checkout.infinitepay.io/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle: HANDLE,
      redirect_url: process.env.REDIRECT_URL,
      order_nsu: `pedido-${Date.now()}`,
      items: [{ quantity: 1, price: preco, description: descricao }]
    })
  });

  const data = await response.json();
  if (data.url) res.status(200).json({ url: data.url });
  else res.status(500).json({ erro: 'Falha ao gerar link' });
}
