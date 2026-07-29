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
const TIMEOUT_MIN       = 30; // minutos sem resposta para resetar estado

// ── Helpers Redis ────────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  let v = d.result;
  while (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
  return v || null;
}
async function kvSet(key, value, ex) {
  // Upstash REST: com TTL usa /setex/key/seconds/value, sem TTL usa /set/key com body direto
  if (ex) {
    await fetch(`${KV_URL}/setex/${key}/${ex}/${encodeURIComponent(JSON.stringify(value))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
  } else {
    await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
  }
}
async function kvDel(key) {
  await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

// ── Enviar mensagem Z-API ────────────────────────────────────
async function enviarTexto(phone, message) {
  console.log(`BOT enviarTexto: phone=${phone} msg=${message.substring(0,50)} url=${BOT_BASE}/send-text`);
  const r = await fetch(`${BOT_BASE}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message })
  });
  return r.json().catch(() => ({}));
}

// ── Buscar pedido do cliente ─────────────────────────────────
async function buscarPedidoPorTelefone(tel) {
  // Busca cliente pelo telefone na API do Shopify
  const nums = tel.replace(/\D/g, '').replace(/^55/, ''); // remove DDI 55
  const variantes = [nums, '55' + nums];
  for (const v of variantes) {
    const r = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=phone:${encodeURIComponent('+55' + nums)}&limit=5`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    ).then(r => r.json()).catch(() => ({ customers: [] }));
    if ((r.customers || []).length) {
      const cliente = r.customers[0];
      const pedidos = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${cliente.id}/orders.json?status=any&limit=10`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      ).then(r => r.json()).catch(() => ({ orders: [] }));
      const pedidosPagos = (pedidos.orders || []).filter(o => o.financial_status === 'paid' || o.financial_status === 'partially_refunded');
      if (pedidosPagos.length) return pedidosPagos[0];
    }
  }
  return null;
}

async function buscarPedidoPorEmail(email) {
  // Busca cliente pelo email no Shopify
  const r = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=email:${encodeURIComponent(email)}&limit=5`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ customers: [] }));
  if (!(r.customers || []).length) {
    // Fallback: buscar diretamente nos pedidos por email
    const r2 = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=250&financial_status=paid`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    ).then(r => r.json()).catch(() => ({ orders: [] }));
    return (r2.orders || []).find(o => (o.email || '').toLowerCase() === email.toLowerCase()) || null;
  }
  const cliente = r.customers[0];
  const pedidos = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${cliente.id}/orders.json?status=any&limit=10`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));
  const pagos = (pedidos.orders || []).filter(o => o.financial_status === 'paid' || o.financial_status === 'partially_refunded');
  return pagos[0] || null;
}

async function buscarPedidoPorCPF(cpf) {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length < 11) return null;

  // Buscar nos pedidos pela nota (CPF: XXXXXXXXXXX)
  const r = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&limit=250&financial_status=paid`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));

  // Match exato do CPF na nota — formato "CPF: 12345678901"
  return (r.orders || []).find(o => {
    const nota = o.note || '';
    const match = nota.match(/CPF:\s*(\d{11})/i);
    return match && match[1] === nums;
  }) || null;
}

async function buscarPedidoPorNome(nome) {
  const r = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=${encodeURIComponent(nome)}&limit=5`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ customers: [] }));
  if (!(r.customers || []).length) return null;
  const cliente = r.customers[0];
  const pedidos = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${cliente.id}/orders.json?status=any&limit=5&financial_status=paid`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));
  return (pedidos.orders || [])[0] || null;
}

// ── Melhor Envio: buscar etiqueta por CPF (document) ─────────────────────
async function buscarEtiquetaMEporCPF(cpf) {
  try {
    const r = await fetch(`https://melhorenvio.com.br/api/v2/me/orders/search?q=${encodeURIComponent(cpf)}`, {
      headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.data || []);
    return items.length ? items[0] : null;
  } catch(e) { console.log('ME CPF search erro:', e.message); return null; }
}

// ── Melhor Envio: buscar etiqueta nas purchases por telefone ───────────────
async function buscarEtiquetaMEporTelefone(telefone) {
  try {
    const nums = telefone.replace(/\D/g, '');
    // Buscar nas últimas 3 páginas de purchases
    const pages = await Promise.all([1,2,3].map(p =>
      fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${p}`, {
        headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
      }).then(r => r.json()).catch(() => ({ data: [] }))
    ));
    const allOrders = pages.flatMap(p => (p.data || []).flatMap(pu => pu.orders || []));
    // Buscar pelo telefone exato no to.phone
    const found = allOrders.find(o => {
      const tel = ((o.to && o.to.phone) || '').replace(/\D/g, '');
      return tel === nums || tel === nums.replace(/^55/, '') || '55' + tel === nums;
    });
    return found || null;
  } catch(e) { console.log('ME tel search erro:', e.message); return null; }
}

// Extrair CPF do pedido Shopify (salvo na nota ou no customer)
function extrairDadosPedido(pedido) {
  const nota = pedido.note || '';

  // CPF — formato: "CPF: 12345678901"
  let cpf = null;
  const matchCPF = nota.match(/CPF:\s*(\d{11})/i);
  if (matchCPF) cpf = matchCPF[1];

  // Telefone — formato: "Telefone: (67) 99291-3121"
  let telefone = null;
  const matchTel = nota.match(/Telefone:\s*([\d\s\(\)\-]+?)(?:\s*\|)/i);
  if (matchTel) telefone = matchTel[1].replace(/\D/g, '');

  // Fallback: pegar do shipping_address do pedido
  if (!telefone) {
    const tel = pedido.shipping_address?.phone || pedido.phone || '';
    if (tel) telefone = tel.replace(/\D/g, '');
  }

  return { cpf, telefone };
}

// Status da etiqueta ME para label legível
function statusMELabel(status) {
  const map = {
    'delivered':   '✅ *Entregue*',
    'undelivered': '⚠️ *Não entregue — em devolução*',
    'canceled':    '❌ *Cancelado*',
    'posted':      '🚚 *Em trânsito pelos Correios*',
    'released':    '📦 *Etiqueta gerada — aguardando postagem*',
    'pending':     '⏳ *Aguardando processamento*',
    'paid':        '💳 *Pago — preparando envio*',
    'suspended':   '⚠️ *Suspenso*',
  };
  return map[status] || '📦 *Em processamento*';
}

async function buscarTodosPedidosTelefone(tel) {
  const nums = tel.replace(/\D/g, '').replace(/^55/, '');
  const r = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=phone:${encodeURIComponent('+55' + nums)}&limit=5`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ customers: [] }));
  if (!(r.customers || []).length) return [];
  const cliente = r.customers[0];
  const pedidos = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${cliente.id}/orders.json?status=any&limit=10`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
  ).then(r => r.json()).catch(() => ({ orders: [] }));
  return (pedidos.orders || []).filter(o => o.financial_status === 'paid' || o.financial_status === 'partially_refunded');
}

// ── MENU PRINCIPAL ────────────────────────────────────────────
const MENU = `Olá! 😊 Bem-vindo ao atendimento da *Kcique Relógios* ⌚

Digite o número da opção desejada:

*1* — 📦 Rastrear meu pedido
*2* — 🔢 Obter código de rastreio
*3* — 📅 Prazo de entrega
*4* — ⚠️ Problema com a compra
*5* — 🔁 Solicitar troca

_Digite *0* a qualquer momento para voltar ao menu._`;

const VOLTAR_MSG = '_Operação cancelada. Voltando ao menu..._\n\n' + MENU.replace('Olá! 😊 Bem-vindo ao atendimento da *Kcique Relógios* ⌚\n\n', '');

// ── SALVAR TICKET ─────────────────────────────────────────────
async function criarTicket(dados) {
  const id = `ticket_${Date.now()}`;
  const ticket = { id, ...dados, status: 'aberto', criado_em: new Date().toISOString() };
  await kvSet(id, ticket);
  // Adicionar à lista
  const lista = await kvGet('tickets-lista') || [];
  lista.push(id);
  await kvSet('tickets-lista', lista);
  return ticket;
}

// ── PROCESSAR MENSAGEM ────────────────────────────────────────
async function processarMensagem(phone, texto, midia) {
  const stateKey = `bot:estado:${phone}`;
  console.log(`BOT processando: phone=${phone} texto="${texto}" instance=${ZAPI_BOT_INSTANCE}`);
  const estado = await kvGet(stateKey) || { etapa: 'menu' };
  const TTL = TIMEOUT_MIN * 60;
  const txt = (texto || '').trim();
  const txLow = txt.toLowerCase();

  console.log(`BOT [${phone}] etapa:${estado.etapa} msg:${txt.substring(0,50)}`);

  // ── DIGITO 0 = voltar ao menu em qualquer etapa ───────────
  if (txt === '0' && estado.etapa !== 'menu') {
    await kvSet(stateKey, { etapa: 'aguardando_opcao' }, TTL);
    await enviarTexto(phone, VOLTAR_MSG);
    return;
  }

  // ── QUALQUER mensagem na etapa menu → mostrar menu ────────
  if (estado.etapa === 'menu') {
    await kvSet(stateKey, { etapa: 'aguardando_opcao' }, TTL);
    await enviarTexto(phone, MENU);
    return;
  }

  // ── AGUARDANDO OPÇÃO ──────────────────────────────────────
  if (estado.etapa === 'aguardando_opcao') {
    const opcao = txt.replace(/[^1-5]/g, '');
    if (!['1','2','3','4','5'].includes(opcao)) {
      await enviarTexto(phone, 'Por favor, digite apenas o número da opção (1, 2, 3, 4 ou 5).');
      return;
    }
    const novoEstado = { etapa: 'identificando', opcao, tentativas: 0 };
    await kvSet(stateKey, novoEstado, TTL);

    // Tentar identificar pelo telefone automaticamente
    const pedidos = await buscarTodosPedidosTelefone(phone);
    if (pedidos.length === 1) {
      await kvSet(stateKey, { ...novoEstado, etapa: 'identificado', pedido: pedidos[0] }, TTL);
      await processarOpcao(phone, opcao, pedidos[0], stateKey, TTL);
    } else if (pedidos.length > 1) {
      // Múltiplos pedidos — perguntar qual
      let msg = 'Encontrei mais de um pedido no seu número. Qual você deseja tratar?\n\n';
      pedidos.forEach((p, i) => {
        const produto = (p.line_items || [])[0]?.title || 'Produto';
        msg += `*${i+1}* — Pedido #${p.order_number} · ${produto}\n`;
      });
      await kvSet(stateKey, { ...novoEstado, etapa: 'escolhendo_pedido', pedidos: pedidos.map(p => p.id) }, TTL);
      await enviarTexto(phone, msg);
    } else {
      // Não encontrou pelo telefone — pedir email
      await kvSet(stateKey, { ...novoEstado, etapa: 'aguardando_email' }, TTL);
      await enviarTexto(phone, 'Não encontrei pedidos com seu número. Por favor, informe o *e-mail* usado na compra:');
    }
    return;
  }

  // ── ESCOLHENDO PEDIDO (múltiplos) ────────────────────────
  if (estado.etapa === 'escolhendo_pedido') {
    const idx = parseInt(txt) - 1;
    const ids = estado.pedidos || [];
    if (isNaN(idx) || idx < 0 || idx >= ids.length) {
      await enviarTexto(phone, `Por favor, digite um número entre 1 e ${ids.length}.`);
      return;
    }
    // Buscar pedido pelo ID
    const r = await fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders/${ids[idx]}.json`, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
    }).then(r => r.json()).catch(() => ({}));
    const pedido = r.order || null;
    if (!pedido) {
      await enviarTexto(phone, 'Não consegui encontrar esse pedido. Tente novamente.');
      return;
    }
    await kvSet(stateKey, { ...estado, etapa: 'identificado', pedido }, TTL);
    await processarOpcao(phone, estado.opcao, pedido, stateKey, TTL);
    return;
  }

  // ── AGUARDANDO EMAIL ──────────────────────────────────────
  if (estado.etapa === 'aguardando_email') {
    const pedido = txt.includes('@') ? await buscarPedidoPorEmail(txt) : null;
    if (pedido) {
      await kvSet(stateKey, { ...estado, etapa: 'identificado', pedido }, TTL);
      await processarOpcao(phone, estado.opcao, pedido, stateKey, TTL);
    } else {
      await kvSet(stateKey, { ...estado, etapa: 'aguardando_cpf' }, TTL);
      await enviarTexto(phone, 'Não encontrei com esse e-mail. Por favor, informe seu *CPF* (somente números):');
    }
    return;
  }

  // ── AGUARDANDO CPF ────────────────────────────────────────
  // ── AGUARDANDO CPF ────────────────────────────────────────
  if (estado.etapa === 'aguardando_cpf') {
    const cpfNums = txt.replace(/\D/g,'');
    if (cpfNums.length < 11) {
      await enviarTexto(phone, 'CPF inválido. Por favor, informe os *11 dígitos* do CPF:');
      return;
    }
    // Buscar no ME diretamente pelo CPF
    const etiquetaME = await buscarEtiquetaMEporCPF(cpfNums);
    if (etiquetaME) {
      // Achou no ME — buscar pedido no Shopify pelo telefone ou email do ME
      const telME = (etiquetaME.to && etiquetaME.to.phone || '').replace(/\D/g,'');
      let pedido = telME ? ((await buscarTodosPedidosTelefone(telME))[0] || null) : null;
      if (!pedido && etiquetaME.to && etiquetaME.to.email) pedido = await buscarPedidoPorEmail(etiquetaME.to.email);
      if (pedido) {
        await kvSet(stateKey, { ...estado, etapa: 'identificado', pedido }, TTL);
        await processarOpcao(phone, estado.opcao, pedido, stateKey, TTL);
      } else {
        // Tem etiqueta no ME mas sem pedido Shopify — responder com dados do ME
        const statusLabel = statusMELabel(etiquetaME.status);
        const meTracking = etiquetaME.tracking || null;
        let msg = `📦 Status do seu pedido:\n\nStatus: ${statusLabel}`;
        if (meTracking) msg += `\nCódigo: *${meTracking}*\n\n🔍 https://rastreamento.correios.com.br/app/index.php?objetos=${meTracking}`;
        await enviarTexto(phone, msg);
        await kvDel(stateKey);
      }
    } else {
      // Não achou no ME — fallback Shopify
      const pedido = await buscarPedidoPorCPF(cpfNums);
      if (pedido) {
        await kvSet(stateKey, { ...estado, etapa: 'identificado', pedido }, TTL);
        await processarOpcao(phone, estado.opcao, pedido, stateKey, TTL);
      } else {
        await kvSet(stateKey, { ...estado, etapa: 'aguardando_nome' }, TTL);
        await enviarTexto(phone, 'Não encontrei com esse CPF. Por favor, informe o *nome completo* usado no cadastro:');
      }
    }
    return;
  }
  // ── AGUARDANDO NOME ───────────────────────────────────────
  if (estado.etapa === 'aguardando_nome') {
    const pedido = txt.split(' ').length >= 2 ? await buscarPedidoPorNome(txt) : null;
    if (pedido) {
      await kvSet(stateKey, { ...estado, etapa: 'identificado', pedido }, TTL);
      await processarOpcao(phone, estado.opcao, pedido, stateKey, TTL);
    } else {
      await kvSet(stateKey, { etapa: 'aguardando_opcao' }, TTL);
      await enviarTexto(phone, 'Não consegui encontrar seu pedido. Por favor, entre em contato pelo nosso atendimento humano.\n\nDigite qualquer mensagem para ver o menu novamente.');
    }
    return;
  }

  // ── AGUARDANDO DESCRIÇÃO (opção 4 ou 5) ──────────────────
  if (estado.etapa === 'aguardando_descricao') {
    const novoEstado = { ...estado, etapa: 'aguardando_midia', descricao: txt };
    await kvSet(stateKey, novoEstado, TTL);
    await enviarTexto(phone, 'Entendido! 📝 Agora, se tiver *fotos ou vídeos* do problema, pode enviar. Quando terminar, escreva *"pronto"*:');
    return;
  }

  // ── AGUARDANDO MÍDIA (opção 4 ou 5) ──────────────────────
  if (estado.etapa === 'aguardando_midia') {
    // Se recebeu mídia, adicionar à lista
    if (midia) {
      const midias = estado.midias || [];
      midias.push(midia);
      await kvSet(stateKey, { ...estado, midias }, TTL);
      await enviarTexto(phone, 'Mídia recebida! ✅ Envie mais ou escreva *"pronto"* para finalizar.');
      return;
    }
    // Se escreveu "pronto" ou qualquer texto sem mídia — finalizar ticket
    if (txLow === 'pronto' || txLow === 'finalizar' || txLow === 'ok' || !midia) {
      const pedido = estado.pedido || {};
      const ticket = await criarTicket({
        tipo: estado.opcao === '4' ? 'problema' : 'troca',
        telefone: phone,
        nome: pedido.customer ? `${pedido.customer.first_name || ''} ${pedido.customer.last_name || ''}`.trim() : phone,
        pedido: pedido.order_number ? `#${pedido.order_number}` : '—',
        descricao: estado.descricao || '',
        midias: estado.midias || []
      });
      await kvDel(stateKey);
      const tipo = estado.opcao === '4' ? 'problema' : 'solicitação de troca';
      await enviarTexto(phone, `✅ Seu ${tipo} foi registrado com sucesso!\n\nNúmero do ticket: *${ticket.id}*\n\nNossa equipe analisará e entrará em contato em breve. ⌚`);
    }
    return;
  }

  // ── FALLBACK ──────────────────────────────────────────────
  await kvSet(stateKey, { etapa: 'aguardando_opcao' }, TTL);
  await enviarTexto(phone, MENU);
}

// ── PROCESSAR OPÇÃO IDENTIFICADA ─────────────────────────────
async function processarOpcao(phone, opcao, pedido, stateKey, TTL) {
  const nome = pedido.customer
    ? `${pedido.customer.first_name || ''}`.trim()
    : 'Cliente';

  // Extrair CPF e telefone da nota do pedido Shopify
  const { cpf, telefone } = extrairDadosPedido(pedido);
  console.log(`BOT dados: cpf="${cpf}" tel="${telefone}"`);
  console.log(`BOT nota completa: "${pedido.note||''}"`);

  // Buscar no ME — CPF é o mais confiável, telefone como fallback
  let etiqueta = null;
  if (cpf) etiqueta = await buscarEtiquetaMEporCPF(cpf);
  if (!etiqueta && telefone) etiqueta = await buscarEtiquetaMEporTelefone(telefone);
  console.log(`BOT ME etiqueta: status=${etiqueta?.status} tracking=${etiqueta?.tracking}`);

  const meTracking = etiqueta?.tracking || null;
  const meStatus   = etiqueta?.status   || null;

  if (opcao === '1') {
    if (!etiqueta) {
      await enviarTexto(phone, `Olá ${nome}! 😊 Seu pedido *#${pedido.order_number}* está sendo preparado. Assim que a etiqueta for gerada você receberá o código de rastreio! ⌚`);
    } else {
      const statusLabel = statusMELabel(meStatus);
      let msg = `📦 Pedido *#${pedido.order_number}*

Status: ${statusLabel}`;
      if (meTracking) msg += `
Código de rastreio: *${meTracking}*

🔍 Acompanhe: https://rastreamento.correios.com.br/app/index.php?objetos=${meTracking}`;
      await enviarTexto(phone, msg);
    }
    await kvDel(stateKey);

  } else if (opcao === '2') {
    if (!meTracking) {
      await enviarTexto(phone, `Olá ${nome}! O pedido *#${pedido.order_number}* ainda não possui código de rastreio. Assim que for postado você recebe! 📦`);
    } else {
      await enviarTexto(phone, `Olá ${nome}! O código de rastreio do seu pedido *#${pedido.order_number}* é:

*${meTracking}*

📮 Consulte nos Correios: https://rastreamento.correios.com.br/app/index.php?objetos=${meTracking}`);
    }
    await kvDel(stateKey);

  } else if (opcao === '3') {
    const frete = (pedido.shipping_lines || [])[0]?.title || '';
    const prazo = frete.toLowerCase().includes('sedex') ? '2 dias úteis' : 'até 10 dias úteis';
    if (!etiqueta) {
      await enviarTexto(phone, `Olá ${nome}! Seu pedido *#${pedido.order_number}* está sendo preparado.

Modalidade: *${frete || 'PAC'}*
Prazo estimado após envio: *${prazo}* ⌚`);
    } else {
      const statusLabel = statusMELabel(meStatus);
      let msg = `Olá ${nome}! 😊 Pedido *#${pedido.order_number}*

Status: ${statusLabel}
Modalidade: *${frete || 'PAC'}*
Prazo estimado: *${prazo}*`;
      if (meTracking) msg += `

🔍 Rastreie: https://rastreamento.correios.com.br/app/index.php?objetos=${meTracking}`;
      await enviarTexto(phone, msg);
    }
    await kvDel(stateKey);

  } else if (opcao === '4' || opcao === '5') {
    const tipo = opcao === '4' ? 'problema' : 'solicitação de troca';
    await kvSet(stateKey, { etapa: 'aguardando_descricao', opcao, pedido, midias: [] }, TTL);
    await enviarTexto(phone, `Olá ${nome}! 😊 Entendido, vou registrar sua ${tipo} do pedido *#${pedido.order_number}*.

Por favor, *descreva detalhadamente* o ocorrido:`);
  }
}



// ── HANDLER PRINCIPAL ─────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Endpoints do dashboard ────────────────────────────────
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

  // ── Webhook Z-API ─────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      console.log('BOT webhook:', JSON.stringify(body).substring(0, 300));

      if (body.fromMe || body.isGroup) return res.status(200).json({ ok: true });

      const phone = body.phone || body.from || '';
      if (!phone) return res.status(200).json({ ok: true });

      let texto = '';
      if (body.text) texto = typeof body.text === 'string' ? body.text : (body.text.message || '');
      if (!texto && body.caption) texto = body.caption;
      if (!texto && body.message) texto = typeof body.message === 'string' ? body.message : '';

      let midia = null;
      if (body.image) midia = { tipo: 'image', url: body.image.imageUrl || body.image.url || '' };
      else if (body.video) midia = { tipo: 'video', url: body.video.videoUrl || body.video.url || '' };
      else if (body.document) midia = { tipo: 'document', url: body.document.documentUrl || body.document.url || '' };

      try {
        await processarMensagem(phone, texto, midia);
      } catch(e) {
        console.error('BOT erro processamento:', e.message);
      }

      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error('BOT handler erro:', e.message);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).end();
}
