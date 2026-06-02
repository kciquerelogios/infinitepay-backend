export default async function handler(req, res) {
  const { code, shop } = req.query;
  const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

  if (!code || !shop) return res.status(400).send('Missing parameters');

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      })
    });

    const data = await response.json();

    if (data.access_token) {
      res.status(200).send(`
        <h2>✅ Token gerado com sucesso!</h2>
        <p>Copie o token abaixo e salve no Vercel como <strong>SHOPIFY_TOKEN</strong>:</p>
        <textarea style="width:100%;height:80px;font-size:14px">${data.access_token}</textarea>
        <p>Loja: ${shop}</p>
      `);
    } else {
      res.status(400).send(`Erro: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    res.status(500).send(`Erro: ${error.message}`);
  }
}
