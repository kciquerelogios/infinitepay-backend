export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const ZAPI_BOT_INSTANCE = process.env.ZAPI_BOT_INSTANCE || '3F6D640EE42042338F26EEAC12D8469F';
const ZAPI_BOT_TOKEN    = process.env.ZAPI_BOT_TOKEN    || 'AF932D5D83B1A3582D5847EF';
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const KV_URL            = process.env.KV_REST_API_URL;
const KV_TOKEN          = process.env.KV_REST_API_TOKEN;
const SHOPIFY_STORE     = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN     = process.env.SHOPIFY_TOKEN;
const ME_TOKEN          = process.env.MELHORENVIO_TOKEN;
const SECRET            = process.env.REPROCESSAR_SECRET || 'kcique2026';
const BOT_BASE          = `https://api.z-api.io/instances/${ZAPI_BOT_INSTANCE}/token/${ZAPI_BOT_TOKEN}`;
const ANTHROPIC_KEY     = process.env.ANTHROPIC_API_KEY;

// -- Redis --
async function kvGet(key) {
  try {
    const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    let v = d.result;
    while (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
    return v || null;
  } catch(e) { return null; }
}
async function kvSet(key, value, ex) {
  const url = ex
    ? `${KV_URL}/setex/${key}/${ex}/${encodeURIComponent(JSON.stringify(value))}`
    : `${KV_URL}/set/${key}`;
  const opts = ex
    ? { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } }
    : { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
  await fetch(url, opts);
}
async function kvDel(key) {
  await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

// -- Z-API --
async function enviarTexto(phone, message) {
  const r = await fetch(`${BOT_BASE}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message })
  });
  const d = await r.json().catch(() => ({}));
  console.log(`BOT enviou para ${phone}:`, JSON.stringify(d).substring(0, 80));
  return d;
}

// -- Shopify --
async function buscarClienteShopify(phone) {
  const nums = phone.replace(/\D/g, '').replace(/^55/, ''); // sem DDI
  // Tentar com +55 e sem prefixo
  const variantes = ['+55' + nums, nums, '55' + nums];
  let cliente = null;
  for (const v of variantes) {
    const r = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=phone:${encodeURIComponent(v)}&limit=1`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    ).then(r => r.json()).catch(() => ({ customers: [] }));
    if ((r.customers || []).length) { cliente = r.customers[0]; break; }
  }
  console.log(`BOT buscarClienteShopify phone=${phone} nums=${nums} encontrou=${!!cliente}`);
  if (!cliente) return null;
  const pedidos = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${cliente.id}/orders.json?status=any&limit=5`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));
  console.log(`BOT pedidos encontrados: ${(pedidos.orders||[]).length}`);
  return { cliente, pedidos: pedidos.orders || [] };
}

async function buscarPedidoPorEmail(email) {
  const r = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ customers: [] }));
  if (!(r.customers || []).length) {
    const r2 = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=250&financial_status=paid`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    ).then(r => r.json()).catch(() => ({ orders: [] }));
    const pedido = (r2.orders || []).find(o => (o.email || '').toLowerCase() === email.toLowerCase());
    return pedido ? { cliente: null, pedidos: [pedido] } : null;
  }
  const c = r.customers[0];
  const pedidos = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${c.id}/orders.json?status=any&limit=5`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));
  return { cliente: c, pedidos: pedidos.orders || [] };
}

// -- Melhor Envio --
async function buscarEtiquetaMEporCPF(cpf) {
  try {
    const r = await fetch(`https://melhorenvio.com.br/api/v2/me/orders/search?q=${encodeURIComponent(cpf)}`, {
      headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.data || []);
    return items.length ? items[0] : null;
  } catch(e) { return null; }
}

async function buscarEtiquetaMEporTelefone(telefone) {
  try {
    const nums = telefone.replace(/\D/g, '');
    const numsSem55 = nums.replace(/^55/, '');
    const pages = await Promise.all([1, 2, 3].map(p =>
      fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${p}`, {
        headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
      }).then(r => r.json()).catch(() => ({ data: [] }))
    ));
    const allOrders = pages.flatMap(p => (p.data || []).flatMap(pu => pu.orders || []));
    console.log(`BOT ME purchases total orders: ${allOrders.length} buscando tel=${nums}`);
    const found = allOrders.find(o => {
      const tel = ((o.to && o.to.phone) || '').replace(/\D/g, '');
      return tel === nums || tel === numsSem55 || '55' + tel === nums || tel === '55' + numsSem55;
    });
    console.log(`BOT ME por telefone: ${found ? 'ENCONTROU tracking=' + found.tracking : 'NAO ENCONTROU'}`);
    return found || null;
  } catch(e) { console.log('BOT ME tel erro:', e.message); return null; }
}

function statusMELabel(status) {
  const map = {
    'delivered':   '✅ Entregue',
    'undelivered': '⚠️ Não entregue — em devolução',
    'canceled':    '❌ Cancelado',
    'posted':      '🚚 Em trânsito pelos Correios',
    'released':    '📦 Etiqueta gerada — aguardando postagem',
    'pending':     '⏳ Aguardando processamento',
    'paid':        '💳 Pago — preparando envio',
  };
  return map[status] || '📦 Em processamento';
}

function extrairDadosPedido(pedido) {
  const nota = pedido.note || '';
  let cpf = null;
  const matchCPF = nota.match(/CPF:\s*(\d{11})/i);
  if (matchCPF) cpf = matchCPF[1];
  let telefone = null;
  const matchTel = nota.match(/Telefone:\s*([\d\s\(\)\-]+?)(?:\s*\|)/i);
  if (matchTel) telefone = matchTel[1].replace(/\D/g, '');
  if (!telefone) {
    const tel = pedido.shipping_address?.phone || pedido.phone || '';
    if (tel) telefone = tel.replace(/\D/g, '');
  }
  console.log(`BOT extrairDadosPedido #${pedido.order_number}: cpf=${cpf} tel=${telefone} nota="${nota.substring(0,80)}"`);
  return { cpf, telefone };
}

// -- Catálogo de produtos --
async function buscarCatalogo() {
  // Cache no Redis por 1 hora
  const cached = await kvGet('bot:catalogo');
  if (cached) return cached;

  try {
    let allProducts = [];
    let pageInfo = null;
    let pages = 0;
    while (pages < 5) {
      const url = pageInfo
        ? `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,variants,status&page_info=${pageInfo}`
        : `https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,variants,status`;
      const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
      const d = await r.json().catch(() => ({ products: [] }));
      allProducts = allProducts.concat((d.products || []).filter(p => p.status === 'active'));
      const link = r.headers.get('link') || '';
      const m = link.match(/<[^>]*page_info=([^&>]*)[^>]*>;\s*rel="next"/);
      pageInfo = m ? m[1] : null;
      pages++;
      if (!pageInfo) break;
    }
    // Montar resumo compacto para o system prompt
    const catalogo = allProducts.map(p => {
      const variantes = (p.variants || []).map(v => v.title).filter(v => v !== 'Default Title');
      const preco = p.variants?.[0]?.price;
      return `- ${p.title}${preco ? ` (R$ ${parseFloat(preco).toFixed(2).replace('.', ',')})` : ''}${variantes.length ? ': ' + variantes.slice(0, 5).join(', ') : ''}`;
    }).join('\n');
    await kvSet('bot:catalogo', catalogo, 3600); // cache 1h
    return catalogo;
  } catch(e) {
    console.log('Erro catalogo:', e.message);
    return null;
  }
}

// -- Ticket --
async function criarTicket(dados) {
  const id = `ticket_${Date.now()}`;
  const ticket = { id, ...dados, status: 'aberto', criado_em: new Date().toISOString() };
  await kvSet(id, ticket);
  const lista = await kvGet('tickets-lista') || [];
  lista.push(id);
  await kvSet('tickets-lista', lista);
  return ticket;
}

// -- Claude AI --
async function chamarClaude(mensagens, systemPrompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: mensagens
    })
  });
  const d = await r.json();
  if (d.error) { console.error('Claude API erro:', JSON.stringify(d.error)); return ''; }
  return d.content?.[0]?.text || '';
}

// -- Montar contexto do cliente --
async function resumoHistorico(historico) {
  if (historico.length < 10) return null;
  // Resumo simples dos assuntos já tratados
  const msgs = historico.filter(m => m.role === 'user').map(m => m.content).slice(0, -1);
  if (!msgs.length) return null;
  return `Interações anteriores deste cliente: ${msgs.slice(-10).join(' | ').substring(0, 500)}`;
}

async function montarContextoCliente(phone) {
  // Buscar cliente no Shopify pelo telefone
  const shopify = await buscarClienteShopify(phone);
  let contexto = { identificado: false, pedidos: [] };

  if (shopify) {
    contexto.identificado = true;
    contexto.nome = shopify.cliente ? `${shopify.cliente.first_name || ''} ${shopify.cliente.last_name || ''}`.trim() : '';
    contexto.email = shopify.cliente?.email || '';

    // Buscar status ME para cada pedido
    for (const pedido of shopify.pedidos.slice(0, 3)) {
      const { cpf, telefone } = extrairDadosPedido(pedido);
      let etiquetaME = null;
      if (cpf) etiquetaME = await buscarEtiquetaMEporCPF(cpf);
      if (!etiquetaME && telefone) etiquetaME = await buscarEtiquetaMEporTelefone(telefone);

      contexto.pedidos.push({
        numero: pedido.order_number,
        valor: pedido.total_price,
        status_pagamento: pedido.financial_status,
        produtos: (pedido.line_items || []).map(i => `${i.title}${i.variant_title && i.variant_title !== 'Default Title' ? ' - ' + i.variant_title : ''}`).join(', '),
        frete: (pedido.shipping_lines || [])[0]?.title || 'PAC',
        endereco_cep: pedido.shipping_address?.zip || '',
        me_status: etiquetaME ? statusMELabel(etiquetaME.status) : null,
        me_tracking: etiquetaME?.tracking || null,
        me_status_raw: etiquetaME?.status || null,
        criado_em: pedido.created_at
      });
    }
  }

  return contexto;
}

// -- Processar mensagem com IA --
async function processarMensagem(phone, texto, midia) {
  const histKey = `bot:hist:${phone}`;
  const ctxKey  = `bot:ctx:${phone}`;
  const TTL = 60 * 60; // 1 hora para contexto (pedidos mudam)
  // Histórico é permanente — sem TTL

  // Carregar histórico, contexto e catálogo em paralelo
  const [historicoRaw, contextoSalvo, catalogo] = await Promise.all([
    kvGet(histKey),
    kvGet(ctxKey),
    buscarCatalogo()
  ]);
  const historico = historicoRaw || [];
  let contexto    = contextoSalvo;

  // Atualizar contexto: sempre se nao identificado, ou a cada 10 msgs
  if (!contexto || !contexto.identificado || historico.length % 10 === 0) {
    const novoCtx = await montarContextoCliente(phone);
    contexto = novoCtx;
    // So cacheia se identificou — senao tenta de novo na proxima msg
    if (contexto.identificado) {
      await kvSet(ctxKey, contexto, TTL);
    }
  }

  // Se ainda não identificado, verificar se a mensagem atual parece um email ou CPF
  if (!contexto.identificado && texto) {
    const emailMatch = texto.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const cpfMatch   = texto.replace(/\D/g, '').length === 11 ? texto.replace(/\D/g, '') : null;

    if (emailMatch) {
      const shopify = await buscarPedidoPorEmail(emailMatch[0]);
      if (shopify) {
        contexto.identificado = true;
        contexto.nome  = shopify.cliente ? `${shopify.cliente.first_name || ''} ${shopify.cliente.last_name || ''}`.trim() : '';
        contexto.email = emailMatch[0];
        // Buscar status ME para cada pedido
        contexto.pedidos = [];
        for (const pedido of (shopify.pedidos || []).slice(0, 3)) {
          const { cpf, telefone } = extrairDadosPedido(pedido);
          let etiquetaME = null;
          if (cpf) etiquetaME = await buscarEtiquetaMEporCPF(cpf);
          if (!etiquetaME && telefone) etiquetaME = await buscarEtiquetaMEporTelefone(telefone);
          contexto.pedidos.push({
            numero: pedido.order_number,
            valor: pedido.total_price,
            status_pagamento: pedido.financial_status,
            produtos: (pedido.line_items || []).map(i => `${i.title}${i.variant_title && i.variant_title !== 'Default Title' ? ' - ' + i.variant_title : ''}`).join(', '),
            frete: (pedido.shipping_lines || [])[0]?.title || 'PAC',
            endereco_cep: pedido.shipping_address?.zip || '',
            me_status: etiquetaME ? statusMELabel(etiquetaME.status) : null,
            me_tracking: etiquetaME?.tracking || null,
            me_status_raw: etiquetaME?.status || null,
            criado_em: pedido.created_at
          });
        }
        await kvSet(ctxKey, contexto, TTL);
        console.log(`BOT identificou ${phone} via email: ${emailMatch[0]}`);
      }
    } else if (cpfMatch) {
      const etiquetaME = await buscarEtiquetaMEporCPF(cpfMatch);
      if (etiquetaME) {
        contexto.identificado = true;
        contexto.me_direto = etiquetaME;
        contexto.pedidos = [{
          numero: '—',
          produtos: etiquetaME.to?.name || '—',
          me_status: statusMELabel(etiquetaME.status),
          me_tracking: etiquetaME.tracking || null,
          me_status_raw: etiquetaME.status,
          frete: '—',
          endereco_cep: ''
        }];
        await kvSet(ctxKey, contexto, TTL);
        console.log(`BOT identificou ${phone} via CPF no ME`);
      }
    }
  }

  // Adicionar mensagem do usuário ao histórico
  const msgUsuario = texto || (midia ? `[${midia.tipo}]` : '[mensagem]');
  historico.push({ role: 'user', content: msgUsuario });

  // Montar system prompt
  const pedidosTexto = contexto.pedidos.length
    ? contexto.pedidos.map(p => `
Pedido #${p.numero} | ${p.produtos}
- Valor: R$ ${parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}
- Frete: ${p.frete}
- CEP destino: ${p.endereco_cep || 'não informado'}
- Pagamento: ${p.status_pagamento}
- Status envio ME: ${p.me_status || 'não encontrado no ME'}
- Código de rastreio: ${p.me_tracking || 'não disponível'}
- Link rastreio: ${p.me_tracking ? `https://rastreamento.correios.com.br/app/index.php?objetos=${p.me_tracking}` : 'não disponível'}
- Data do pedido: ${p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : ''}
    `.trim()).join('\n\n')
    : 'Nenhum pedido encontrado pelo telefone deste número.';

  // Resumo do histórico anterior (se houver)
  const resumo = await resumoHistorico(historico);

  const systemPrompt = `Você é a assistente virtual de suporte da Kcique Relógios ⌚, uma loja online de relógios.

Seu papel é atender clientes com problemas ou dúvidas sobre pedidos. Seja simpática, direta e eficiente.

${contexto.identificado
  ? `CLIENTE IDENTIFICADO:
Nome: ${contexto.nome || 'não informado'}
Email: ${contexto.email || 'não informado'}
Telefone de cadastro: ${phone}

PEDIDOS DO CLIENTE:
${pedidosTexto}`
  : `CLIENTE NÃO IDENTIFICADO pelo telefone ${phone}.
Voce DEVE pedir o email do cliente para buscá-lo no sistema. Nao diga que nao consegue buscar por email — voce consegue sim, basta o cliente informar. Peca o email agora de forma simpatica.
Quando o cliente informar o email, voce vai encontrar os pedidos automaticamente.`
}

${catalogo ? `CATÁLOGO DE PRODUTOS DISPONÍVEIS:
${catalogo}

` : ''}${resumo ? `HISTÓRICO DE ATENDIMENTOS ANTERIORES COM ESTE CLIENTE:
${resumo}

` : ''}REGRAS IMPORTANTES:
1. Para rastreio: sempre forneça o código e o link dos Correios quando disponível
2. Para prazo de entrega: o prazo depende do CEP do cliente e da modalidade (PAC ou SEDEX). Se não tiver a previsão exata do ME, informe que PAC leva em média 5-15 dias úteis e SEDEX 1-3 dias úteis após postagem
3. Para problemas ou trocas: ouça o cliente, colete as informações necessárias e avise que vai abrir um ticket para um especialista analisar e entrar em contato. Política de troca/devolução: 7 dias corridos a partir do recebimento, sem necessidade de embalagem original
4. Quando abrir ticket: responda com a palavra exata "ABRIR_TICKET" em uma linha separada no final da sua resposta, seguida de "|" e o tipo: "problema" ou "troca"
5. Quando nao identificar o cliente pelo telefone: SEMPRE peca o email. Nunca diga que nao consegue buscar por email — o sistema busca sim. Quando o cliente informar o email, o sistema identifica automaticamente
6. Nunca invente informações de rastreio ou pedido
7. Não temos loja física — somente loja online
8. Formate as mensagens para WhatsApp usando *negrito* quando necessário
9. Seja concisa — evite mensagens muito longas`;

  // Chamar Claude
  const resposta = await chamarClaude(historico.slice(-30), systemPrompt); // últimas 30 msgs

  // Verificar se Claude quer abrir ticket
  let respostaFinal = resposta;
  let abrirTicket = null;

  if (resposta.includes('ABRIR_TICKET')) {
    const linhas = resposta.split('\n');
    const linhaTicket = linhas.find(l => l.includes('ABRIR_TICKET'));
    const tipo = linhaTicket?.split('|')[1]?.trim() || 'problema';
    abrirTicket = tipo;
    // Remover a linha do ticket da resposta
    respostaFinal = linhas.filter(l => !l.includes('ABRIR_TICKET')).join('\n').trim();
  }

  // Adicionar resposta ao histórico
  historico.push({ role: 'assistant', content: respostaFinal });

  // Salvar histórico permanente (sem TTL) — últimas 100 msgs por cliente
  await kvSet(histKey, historico.slice(-100));

  // Abrir ticket se necessário
  if (abrirTicket) {
    const ultimoPedido = contexto.pedidos[0];
    await criarTicket({
      tipo: abrirTicket,
      telefone: phone,
      nome: contexto.nome || phone,
      pedido: ultimoPedido ? `#${ultimoPedido.numero}` : '—',
      descricao: historico.filter(m => m.role === 'user').map(m => m.content).slice(-5).join(' | '),
      midias: midia ? [midia] : []
    });
    console.log(`BOT ticket aberto: ${abrirTicket} para ${phone}`);
  }

  // Enviar resposta
  await enviarTexto(phone, respostaFinal);
}

// -- HANDLER --
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // -- Dashboard endpoints --
  if (req.method === 'GET' && req.query.action) {
    const secret = req.query.secret || '';
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });

    if (req.query.action === 'listar-tickets') {
      try {
        const ids = await kvGet('tickets-lista') || [];
        const tickets = await Promise.all(ids.map(id => kvGet(id)));
        return res.status(200).json({ tickets: tickets.filter(Boolean) });
      } catch(e) { return res.status(500).json({ erro: e.message }); }
    }

    if (req.query.action === 'stats') {
      try {
        const ids = await kvGet('tickets-lista') || [];
        const tickets = (await Promise.all(ids.map(id => kvGet(id)))).filter(Boolean);
        return res.status(200).json({
          total: tickets.length,
          abertos: tickets.filter(t => t.status === 'aberto').length,
          em_atendimento: tickets.filter(t => t.status === 'em_atendimento').length,
          resolvidos: tickets.filter(t => t.status === 'resolvido').length
        });
      } catch(e) { return res.status(500).json({ erro: e.message }); }
    }
  }

  if (req.method === 'POST' && req.query.action === 'atualizar-ticket') {
    const secret = req.query.secret || '';
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const { id, status } = req.body || {};
      const ticket = await kvGet(id);
      if (!ticket) return res.status(404).json({ erro: 'Ticket não encontrado' });
      ticket.status = status;
      ticket.atualizado_em = new Date().toISOString();
      await kvSet(id, ticket);
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // -- Webhook Z-API --
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      console.log('BOT webhook:', JSON.stringify(body).substring(0, 200));

      if (body.fromMe || body.isGroup) return res.status(200).json({ ok: true });

      const phone = body.phone || body.from || '';
      if (!phone) return res.status(200).json({ ok: true });

      // Extrair texto
      let texto = '';
      if (body.text) texto = typeof body.text === 'string' ? body.text : (body.text.message || '');
      if (!texto && body.caption) texto = body.caption;

      // Extrair mídia
      let midia = null;
      if (body.image) midia = { tipo: 'image', url: body.image.imageUrl || body.image.url || '' };
      else if (body.video) midia = { tipo: 'video', url: body.video.videoUrl || body.video.url || '' };
      else if (body.document) midia = { tipo: 'document', url: body.document.documentUrl || body.document.url || '' };
      else if (body.audio) midia = { tipo: 'audio', url: body.audio.audioUrl || body.audio.url || '' };

      // Processar com IA
      try {
        await processarMensagem(phone, texto, midia);
      } catch(e) {
        console.error('BOT erro IA:', e.message);
        // Fallback em caso de erro da API
        await enviarTexto(phone, 'Olá! 😊 Estamos com uma instabilidade momentânea. Por favor, tente novamente em alguns instantes. — Kcique Relógios ⌚');
      }

      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error('BOT handler erro:', e.message);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).end();
}
