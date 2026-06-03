export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { cor, preco, descricao, frete, cliente } = req.body;
  const HANDLE = process.env.INFINITE_HANDLE;

  // Preco total = produto + frete
  const precoFrete = frete ? Math.round(frete.preco * 100) : 0;
  const precoTotal = preco + precoFrete;

  const items = [
    { quantity: 1, price: preco, description: descricao }
  ];

  if (frete && precoFrete > 0) {
    items.push({
      quantity: 1,
      price: precoFrete,
      description: `Frete ${frete.nome} (${frete.prazo} dias úteis)`
    });
  }

  const body = {
    handle: HANDLE,
    redirect_url: process.env.URL_REDIRECIONADA,
    webhook_url: 'https://infinitepay-backend.vercel.app/api/webhook',
    order_nsu: `pedido-${Date.now()}`,
    items
  };

  // Enviar dados do cliente para a InfinitePay
  if (cliente) {
    body.customer = {
      name: cliente.nome,
      email: cliente.email,
      phone_number: cliente.telefone,
      document: cliente.cpf
    };
    body.address = {
      cep: cliente.cep.replace(/\D/g, ''),
      street: cliente.rua,
      number: cliente.numero,
      complement: cliente.complemento || '',
      neighborhood: cliente.bairro,
      city: cliente.cidade,
      state: cliente.estado
    };
  }

  try {
    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.url) {
      res.status(200).json({ url: data.url });
    } else {
      res.status(500).json({ erro: 'Falha ao gerar link', detalhe: data });
    }
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
}
