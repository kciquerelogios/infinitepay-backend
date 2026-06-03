export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { cor, preco, descricao, frete, cliente } = req.body;
  const HANDLE = process.env.INFINITE_HANDLE;

  const precoFrete = frete ? Math.round(frete.preco * 100) : 0;

  const items = [
    { quantity: 1, price: preco, description: descricao }
  ];

  if (frete && precoFrete > 0) {
    items.push({
      quantity: 1,
      price: precoFrete,
      description: `Frete ${frete.nome} (${frete.prazo} dias uteis)`
    });
  }

  const orderNsu = `pedido-${Date.now()}`;

  const body = {
    handle: HANDLE,
    redirect_url: process.env.URL_REDIRECIONADA,
    webhook_url: 'https://infinitepay-backend.vercel.app/api/webhook',
    order_nsu: orderNsu,
    items
  };

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
    // Salvar dados do cliente no Redis com o order_nsu como chave
    if (cliente && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const dadosPedido = {
        cliente,
        frete,
        preco,
        descricao,
        cor,
        order_nsu: orderNsu,
        criado_em: new Date().toISOString()
      };

      await fetch(`${process.env.KV_REST_API_URL}/set/${orderNsu}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: JSON.stringify(dadosPedido),
          ex: 86400 // expira em 24 horas
        })
      });
    }

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
