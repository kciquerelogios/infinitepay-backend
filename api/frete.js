export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { cep_destino } = req.body;

  if (!cep_destino) {
    return res.status(400).json({ erro: 'CEP de destino obrigatório' });
  }

  const cepLimpo = cep_destino.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    return res.status(400).json({ erro: 'CEP inválido' });
  }

  try {
    const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MELHORENVIO_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)'
      },
      body: JSON.stringify({
        from: { postal_code: '03807060' },
        to: { postal_code: cepLimpo },
        package: {
          height: 10,
          width: 12,
          length: 18,
          weight: 0.5
        },
        services: '1,2', // 1 = PAC, 2 = SEDEX
        options: {
          receipt: false,
          own_hand: false
        }
      })
    });

    const data = await response.json();

    // Filtrar apenas PAC (id=1) e SEDEX (id=2) dos Correios
    const opcoes = data
      .filter(s => [1, 2].includes(s.id) && !s.error)
      .map(s => ({
        id: s.id,
        nome: s.name,
        preco: parseFloat(s.price),
        prazo: s.delivery_time <= 5 ? s.delivery_time : s.delivery_time <= 10 ? s.delivery_time - 2 : s.delivery_time - 3,
        empresa: s.company.name
      }));

    if (opcoes.length === 0) {
      return res.status(400).json({ erro: 'Frete não disponível para este CEP' });
    }

    return res.status(200).json({ opcoes });

  } catch (error) {
    console.error('Erro frete:', error);
    return res.status(500).json({ erro: 'Erro ao calcular frete' });
  }
}
