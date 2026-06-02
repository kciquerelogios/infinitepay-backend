export default async function handler(req, res) {
  const shop = req.query.shop;
  const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
  const SCOPES = 'read_orders,write_orders,read_customers,write_customers';
  const REDIRECT_URI = 'https://infinitepay-backend.vercel.app/api/callback';

  if (!shop) return res.status(400).send('Missing shop parameter');

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(authUrl);
}
