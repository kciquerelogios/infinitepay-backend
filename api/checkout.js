export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // ===== PRESENÇA EM TEMPO REAL =====
  // Usa Hash Redis: campo = sessaoId, valor = timestamp do último ping
  // Limpeza automática de sessões antigas (>3 min) a cada request

  if (req.query.action === 'presenca') {
    const { sessao, evento } = req.body || {};
    if (!sessao) return res.status(400).json({ error: 'sessao obrigatória' });

    const hoje = new Date();
    const hojeBR = new Date(hoje.getTime() - 3*60*60*1000).toISOString().split('T')[0];
    const HASH_KEY = 'checkout-presenca-hash';
    const chaveDiario = 'checkout-total-'+hojeBR;
    const agora = Date.now();

    if (evento === 'entrou' || evento === 'ping') {
      // Upstash HSET via pipeline: POST /pipeline com comando HSET
      await fetch(`${KV_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['HSET', HASH_KEY, sessao, String(agora)]
        ])
      });

      if (evento === 'entrou') {
        // Incrementar contador diário
        await fetch(`${KV_URL}/incr/${chaveDiario}`, {
          method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        await fetch(`${KV_URL}/expire/${chaveDiario}/86400`, {
          method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
      }
    } else if (evento === 'saiu') {
      await fetch(`${KV_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['HDEL', HASH_KEY, sessao]
        ])
      });
    }

    return res.status(200).json({ ok: true });
  }

  // ===== LIMPAR HASH (admin) =====
  if (req.query.action === 'limpar-hash' && req.query.secret === process.env.REPROCESSAR_SECRET) {
    await fetch(`${KV_URL}/del/checkout-presenca-hash`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.status(200).json({ ok: true });
  }

  // ===== CONTAR ATIVOS =====
  if (req.query.action === 'contar') {
    try {
      const hoje = new Date();
      const hojeBR = new Date(hoje.getTime() - 3*60*60*1000).toISOString().split('T')[0];
      const chaveDiario = 'checkout-total-'+hojeBR;
      const HASH_KEY = 'checkout-presenca-hash';
      const agora = Date.now();
      const TIMEOUT = 90 * 1000; // 90 segundos sem ping = offline

      // Buscar todos os campos do hash
      const hashResp = await fetch(`${KV_URL}/hgetall/${HASH_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const hashData = await hashResp.json();
      const campos = hashData.result || [];

      // hgetall retorna array alternado [campo, valor, campo, valor...]
      let ativos = 0;
      const sessoesMortas = [];
      for (let i = 0; i < campos.length; i += 2) {
        const sessId = campos[i];
        const ts = parseInt(campos[i+1] || 0);
        if (agora - ts <= TIMEOUT) {
          ativos++;
        } else {
          sessoesMortas.push(sessId);
        }
      }

      // Limpar sessões mortas em background (sem await)
      if (sessoesMortas.length > 0) {
        fetch(`${KV_URL}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(sessoesMortas.map(s => ['HDEL', HASH_KEY, s]))
        }).catch(() => {});
      }

      // Total do dia
      const diaResp = await fetch(`${KV_URL}/get/${chaveDiario}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const diaData = await diaResp.json();
      const totalDia = parseInt(diaData.result || 0);

      return res.status(200).json({ ativos, totalDia });
    } catch(e) {
      return res.status(200).json({ ativos: 0, totalDia: 0 });
    }
  }


  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { carrinho, frete, cliente, cupom, ref } = req.body;
  const HANDLE = process.env.INFINITE_HANDLE;

  if (!carrinho || carrinho.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }

  let precoFrete = frete ? Math.round(frete.preco * 100) : 0;

  // Aplicar desconto do cupom
  let descontoTotal = 0;
  let cupomValido = null;
  if (cupom && cupom.codigo) {
    try {
      const cupomResp = await fetch(`https://infinitepay-backend.vercel.app/api/cupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validar', codigo: cupom.codigo, carrinho })
      });
      const cupomData = await cupomResp.json();
      if (cupomData.ok) {
        cupomValido = cupomData.cupom;
        // Recalcular desconto com base no carrinho atual
        const subtotalParaCupom = carrinho.reduce((s, i) => s + (i.preco * (i.quantidade || 1)), 0);
        if (cupomValido.tipo === 'percentual' || cupomValido.tipo === 'percentual_frete' || cupomValido.tipo === 'percentual_mais_frete') {
          descontoTotal = Math.round(subtotalParaCupom * cupomValido.valor / 100);
        } else if (cupomValido.tipo === 'fixo') {
          descontoTotal = Math.min(Math.round(cupomValido.valor * 100), subtotalParaCupom);
        } else {
          descontoTotal = cupomValido.desconto || 0;
        }
        // Frete grátis aplica SOMENTE no PAC
        const ehPACfrete = frete && frete.nome && frete.nome.toLowerCase().indexOf('pac') !== -1;
        if (cupomValido.freteGratis && ehPACfrete) precoFrete = 0;
        // Incrementar uso do cupom
        await fetch(`${process.env.KV_REST_API_URL}/get/cupom_${cupom.codigo.toUpperCase()}`, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } })
          .then(r => r.json())
          .then(async d => {
            let c = d.result;
            while (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { break; } }
            if (c) {
              c.usosAtuais = (c.usosAtuais || 0) + 1;
              await fetch(`${process.env.KV_REST_API_URL}/set/cupom_${cupom.codigo.toUpperCase()}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: JSON.stringify(c) })
              });
            }
          }).catch(()=>{});
      }
    } catch(e) { console.log('Erro cupom:', e.message); }
  }

  // Calcular subtotal e aplicar desconto proporcional
  const subtotalBruto = carrinho.reduce((s, i) => s + (i.preco * (i.quantidade||1)), 0);

  // Montar items para InfinitePay
  let items = carrinho.map(item => ({
    quantity: item.quantidade || 1,
    price: item.preco,
    description: item.nome + (item.cor && item.cor !== 'Default Title' ? ' - Cor: ' + item.cor : '')
  }));

  if (frete && precoFrete > 0) {
    items.push({
      quantity: 1,
      price: precoFrete,
      description: `Frete ${frete.nome} (${frete.prazo} dias uteis)`
    });
  }

  // Aplicar desconto proporcional em cada item
  if (descontoTotal > 0 && cupomValido && subtotalBruto > 0) {
    items = items.map(item => {
      if (item.description && item.description.startsWith('Frete')) return item;
      const proporcao = (item.price * item.quantity) / subtotalBruto;
      const descontoItem = Math.round(descontoTotal * proporcao);
      return { ...item, price: Math.max(1, item.price - Math.round(descontoItem / item.quantity)) };
    });
  }

  const orderNsu = `pedido-${Date.now()}`;

  const body = {
    handle: HANDLE,
    redirect_url: process.env.REDIRECT_URL || process.env.URL_REDIRECIONADA || 'https://kcique.com.br/pages/obrigado',
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
    // Salvar dados no Redis
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const valorOriginalTotal = subtotalBruto + (frete ? precoFrete : 0);
      const dadosPedido = {
        cliente,
        frete,
        carrinho,
        order_nsu: orderNsu,
        ref: ref || 'direto',
        cupom: cupomValido || null,
        valorOriginal: descontoTotal > 0 ? (valorOriginalTotal / 100).toFixed(2) : null,
        desconto: descontoTotal > 0 ? (descontoTotal / 100).toFixed(2) : null,
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
          ex: 86400
        })
      });
    }

    // Garantir que nenhum item tem preço zero ou negativo
    body.items = body.items.map(item => ({
      ...item,
      price: Math.max(1, Math.round(item.price))
    }));

    if (!body.items.length) {
      return res.status(400).json({ erro: 'Carrinho vazio' });
    }

    // Tentar até 2 vezes (timeout intermitente da InfinitePay)
    let response, data;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        response = await fetch('https://api.checkout.infinitepay.io/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000) // 15s timeout
        });
        data = await response.json();
        if (data.url) break; // Sucesso
        console.log(`Tentativa ${tentativa} falhou:`, JSON.stringify(data));
        if (tentativa < 2) await new Promise(r => setTimeout(r, 1000)); // esperar 1s
      } catch(e) {
        console.log(`Tentativa ${tentativa} erro:`, e.message);
        if (tentativa === 2) throw e;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (data && data.url) {
      res.status(200).json({ url: data.url });
    } else {
      console.log('InfinitePay erro final:', JSON.stringify(data));
      res.status(500).json({ erro: 'Falha ao gerar link. Tente novamente em alguns instantes.', detalhe: data });
    }
  } catch (error) {
    console.log('Checkout erro geral:', error.message);
    res.status(500).json({ erro: error.message });
  }
}
