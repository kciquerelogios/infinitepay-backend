const ORIGENS_PERMITIDAS = ['https://kcique.com.br', 'https://www.kcique.com.br'];

function origemPermitida(origin) {
  if (!origin) return false;
  if (ORIGENS_PERMITIDAS.includes(origin)) return true;
  try { return new URL(origin).hostname.endsWith('.myshopify.com'); } catch (e) { return false; }
}

// Busca o preço real de cada produto no Shopify — nunca confiar no preço que o cliente manda.
// Retorna { carrinho } em caso de sucesso, ou { erroDebug } com o motivo exato da falha (pra diagnosticar sem depender de log da Vercel).
async function validarCarrinho(carrinho) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    return { erroDebug: 'SHOPIFY_STORE ou SHOPIFY_TOKEN não configurados no ambiente' };
  }

  const idsUnicos = [...new Set(carrinho.map(i => i.id))];
  const produtosMap = {};
  const falhasBusca = [];
  await Promise.all(idsUnicos.map(async id => {
    try {
      const r = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products/${id}.json`, {
        headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
        signal: AbortSignal.timeout(8000)
      });
      const d = await r.json();
      if (d.product) produtosMap[id] = d.product;
      else falhasBusca.push({ id, status: r.status, resposta: d });
    } catch (e) { falhasBusca.push({ id, erro: e.message }); }
  }));

  const itensInvalidos = [];
  const carrinhoValidado = carrinho.map(item => {
    const produto = produtosMap[item.id];
    if (!produto || !produto.variants || !produto.variants.length) {
      itensInvalidos.push({ id: item.id, nome: item.nome, cor: item.cor, motivo: 'produto não encontrado no Shopify para esse id' });
      return null;
    }
    let variante = produto.variants.find(v => v.title === item.cor);
    if (!variante) variante = produto.variants[0];
    return { ...item, preco: Math.round(parseFloat(variante.price) * 100), nome: item.nome || produto.title };
  });

  if (itensInvalidos.length > 0) {
    return { erroDebug: 'itens do carrinho não encontrados no Shopify', itensInvalidos, falhasBusca };
  }
  return { carrinho: carrinhoValidado };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origemPermitida(origin) ? origin : ORIGENS_PERMITIDAS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { carrinho, frete, cliente, cupom, ref } = req.body;
  const HANDLE = process.env.INFINITE_HANDLE;

  if (!carrinho || carrinho.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }

  // ===== RATE LIMIT (proteção contra abuso/bot) =====
  if (KV_URL && KV_TOKEN) {
    try {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
      const rlKey = `ratelimit:checkout:${ip}`;
      const rlResp = await fetch(`${KV_URL}/incr/${rlKey}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const rlData = await rlResp.json();
      if (rlData.result === 1) {
        await fetch(`${KV_URL}/expire/${rlKey}/60`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      }
      if (rlData.result > 20) {
        return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um instante e tente novamente.' });
      }
    } catch (e) { /* Redis fora do ar não pode travar o checkout */ }
  }

  // ===== VALIDAR PREÇOS REAIS NO SHOPIFY =====
  // O carrinho enviado pelo cliente NUNCA é confiável — preço e nome vêm sempre do Shopify a partir daqui.
  const validacaoCarrinho = await validarCarrinho(carrinho);
  if (!validacaoCarrinho.carrinho) {
    console.log('Validação de carrinho falhou:', JSON.stringify(validacaoCarrinho));
    return res.status(400).json({
      erro: 'Não foi possível validar os produtos do carrinho. Atualize a página e tente novamente.',
      debug: validacaoCarrinho
    });
  }
  const carrinhoValidado = validacaoCarrinho.carrinho;

  const ehPACfrete = frete && frete.nome && frete.nome.toLowerCase().indexOf('pac') !== -1;
  const totalItensCarrinho = carrinhoValidado.reduce((s, i) => s + (i.quantidade || 1), 0);
  let precoFrete = frete ? Math.round(frete.preco * 100) : 0;
  // Frete grátis PAC para 2+ itens é decidido aqui, no servidor — nunca confiar no preço que o front manda
  if (ehPACfrete && totalItensCarrinho >= 2) precoFrete = 0;

  // Aplicar desconto do cupom
  let descontoTotal = 0;
  let cupomValido = null;
  if (cupom && cupom.codigo) {
    try {
      const cupomResp = await fetch(`https://infinitepay-backend.vercel.app/api/cupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validar', codigo: cupom.codigo, carrinho: carrinhoValidado })
      });
      const cupomData = await cupomResp.json();

      if (cupomData.ok) {
        cupomValido = cupomData.cupom;

        // Trava atômica de limite de uso — evita corrida entre checkouts simultâneos estourando o limite
        if (cupomValido.limiteUsos && KV_URL && KV_TOKEN) {
          const contadorKey = `cupom_usos_count:${cupom.codigo.toUpperCase()}`;
          const incrResp = await fetch(`${KV_URL}/incr/${contadorKey}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
          const incrData = await incrResp.json();
          if (incrData.result > cupomValido.limiteUsos) {
            await fetch(`${KV_URL}/decr/${contadorKey}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
            cupomValido = null;
          }
        }
      }

      if (cupomValido) {
        // Recalcular desconto com base no carrinho validado (preços reais)
        const subtotalParaCupom = carrinhoValidado.reduce((s, i) => s + (i.preco * (i.quantidade || 1)), 0);
        if (cupomValido.tipo === 'percentual' || cupomValido.tipo === 'percentual_frete' || cupomValido.tipo === 'percentual_mais_frete') {
          descontoTotal = Math.round(subtotalParaCupom * cupomValido.valor / 100);
        } else if (cupomValido.tipo === 'fixo') {
          descontoTotal = Math.min(Math.round(cupomValido.valor * 100), subtotalParaCupom);
        } else {
          descontoTotal = cupomValido.desconto || 0;
        }
        // Frete grátis do cupom aplica SOMENTE no PAC
        if (cupomValido.freteGratis && ehPACfrete) precoFrete = 0;
        // Atualizar contador salvo no cupom (best-effort, só para exibição no admin)
        await fetch(`${KV_URL}/get/cupom_${cupom.codigo.toUpperCase()}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } })
          .then(r => r.json())
          .then(async d => {
            let c = d.result;
            while (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { break; } }
            if (c) {
              c.usosAtuais = (c.usosAtuais || 0) + 1;
              await fetch(`${KV_URL}/set/cupom_${cupom.codigo.toUpperCase()}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: JSON.stringify(c) })
              });
            }
          }).catch(()=>{});
      }
    } catch(e) { console.log('Erro cupom:', e.message); }
  }

  // Calcular subtotal e aplicar desconto proporcional
  const subtotalBruto = carrinhoValidado.reduce((s, i) => s + (i.preco * (i.quantidade||1)), 0);

  // Montar items para InfinitePay
  let items = carrinhoValidado.map(item => ({
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

  const orderNsu = `pedido-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    handle: HANDLE,
    redirect_url: process.env.REDIRECT_URL || process.env.URL_REDIRECIONADA || 'https://kcique.com.br/pages/obrigado',
    webhook_url: process.env.WEBHOOK_URL || 'https://infinitepay-backend.vercel.app/api/webhook',
    order_nsu: orderNsu,
    items
  };

  if (cliente) {
    if (!cliente.cep || !cliente.rua || !cliente.numero || !cliente.bairro || !cliente.cidade || !cliente.estado) {
      return res.status(400).json({ erro: 'Endereço incompleto' });
    }
    body.customer = {
      name: cliente.nome,
      email: cliente.email,
      phone_number: (function(tel) {
        var nums = (tel || '').replace(/\D/g, '');
        // DDD (2) + 8 dígitos = 10 total → sempre adiciona o 9
        if (nums.length === 10) nums = nums.slice(0, 2) + '9' + nums.slice(2);
        // Adicionar DDI 55
        if (nums.length === 11) nums = '55' + nums;
        return '+' + nums;
      })(cliente.telefone),
      document: (cliente.cpf || '').replace(/\D/g, '')
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
        carrinho: carrinhoValidado,
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
      res.status(500).json({ erro: 'Falha ao gerar link. Tente novamente em alguns instantes.', ref: orderNsu });
    }
  } catch (error) {
    console.log('Checkout erro geral:', error.message);
    res.status(500).json({ erro: 'Erro ao processar pagamento. Tente novamente.', ref: orderNsu });
  }
}
