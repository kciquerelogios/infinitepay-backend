// api/recuperacao.js — Cron de recuperação de carrinhos abandonados
// vercel.json: {"crons": [{"path": "/api/recuperacao", "schedule": "*/10 * * * *"}]}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
// Recuperação usa a instância do bot de atendimento (transacional/1:1, conversa de
// verdade), separada da instância principal que faz broadcast em grupo.
const ZAPI_BASE = `https://api.z-api.io/instances/${process.env.ZAPI_BOT_INSTANCE}/token/${process.env.ZAPI_BOT_TOKEN}`;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ── KV helpers ────────────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const d = await r.json();
  if (!d.result) return null;
  let v = d.result;
  // Desencapsular strings aninhadas
  for (let i = 0; i < 5; i++) {
    if (typeof v !== 'string') break;
    try { v = JSON.parse(v); } catch(e) { break; }
  }
  // Desencapsular {value: "..."}
  if (v && typeof v === 'object' && typeof v.value === 'string') {
    try { v = JSON.parse(v.value); } catch(e) {}
  }
  return v;
}

async function kvSet(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: str, ex: 604800 })
  });
}

async function kvSmembers(key) {
  const r = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SMEMBERS', key]])
  });
  const d = await r.json();
  return (Array.isArray(d) && d[0]?.result) ? d[0].result : [];
}

// ── WhatsApp ──────────────────────────────────────────────────
async function enviarWhatsApp(telefone, mensagem) {
  const tel = telefone.replace(/\D/g, '');
  if (!tel || tel.length < 10) return { ok: false, erro: 'Telefone inválido' };
  const phone = tel.startsWith('55') ? tel : `55${tel}`;
  try {
    const r = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone, message: mensagem })
    });
    const d = await r.json();
    return { ok: true, data: d, phone };
  } catch(e) {
    return { ok: false, erro: e.message };
  }
}

function formatarMensagem(template, lead) {
  const nome = (lead.nome || 'cliente').split(' ')[0];
  const produtos = (lead.carrinho || []).map(i => i.nome).filter(Boolean).join(', ') || 'seu produto';
  const link = 'https://kcique.com.br/pages/checkout';
  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{email\}/g, lead.email || '')
    .replace(/\{produtos\}/g, produtos)
    .replace(/\{link\}/g, link);
}

// ── Mensagem gerada por IA (Claude) ─────────────────────────────
async function chamarClaude(mensagens, systemPrompt) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system: systemPrompt, messages: mensagens })
    });
    const d = await r.json();
    if (d.error) { console.error('Claude erro (recuperacao):', JSON.stringify(d.error)); return ''; }
    return d.content?.[0]?.text || '';
  } catch(e) {
    console.error('Claude erro (recuperacao):', e.message);
    return '';
  }
}

async function gerarMensagemIA(lead, regra, regraKey) {
  if (!ANTHROPIC_KEY) return formatarMensagem(regra.mensagem, lead);

  const nome = (lead.nome || 'cliente').split(' ')[0];
  const produtos = (lead.carrinho || []).map(i => i.nome + (i.cor && i.cor !== 'Default Title' ? ' - ' + i.cor : '')).filter(Boolean).join(', ') || 'os produtos que você separou';
  const valorTotal = (lead.carrinho || []).reduce((s, i) => s + (i.preco || 0) * (i.quantidade || 1), 0) / 100;
  const link = 'https://kcique.com.br/pages/checkout';

  const situacao = {
    regra_identificacao: 'O cliente começou a comprar mas ainda nem preencheu os dados de entrega — provavelmente só olhou o produto.',
    regra_frete: 'O cliente já calculou o frete pro endereço dele mas não finalizou o pagamento.',
    regra_pagamento: 'O cliente chegou até a tela de pagamento (já preencheu tudo) mas não concluiu a compra.'
  }[regraKey] || '';

  const systemPrompt = `Você é a assistente da Kcique Relógios (loja online de relógios). Escreva UMA mensagem curta de WhatsApp (2-4 frases, tom caloroso e natural, sem parecer "copy" de vendas agressiva) para reengajar um cliente que abandonou o carrinho.

DADOS REAIS — use exatamente estes, não invente nada além disso:
- Nome: ${nome}
- Produto(s) no carrinho: ${produtos}
- Valor total: R$ ${valorTotal.toFixed(2).replace('.', ',')}
- Situação: ${situacao}
- Link para finalizar a compra: ${link}

ESTILO DE REFERÊNCIA configurado pelo lojista (use como guia de tom/comprimento, não copie literalmente): "${regra.mensagem || ''}"

REGRAS OBRIGATÓRIAS:
1. Nunca invente cupom, desconto ou frete grátis — só mencione se já estiver explícito no texto de referência acima.
2. Sempre inclua o link de checkout.
3. Use *negrito* do WhatsApp com moderação, no máximo 2 emojis.
4. Responda APENAS com o texto da mensagem, sem explicações nem aspas.`;

  const texto = await chamarClaude([{ role: 'user', content: 'Gere a mensagem.' }], systemPrompt);
  return texto.trim() || formatarMensagem(regra.mensagem, lead);
}

// ── Continuidade: registra a mensagem no mesmo histórico que o bot.js usa,
// pra que, se o lead responder, a IA de atendimento já tenha o contexto do
// carrinho e continue a conversa naturalmente (ver buscarLeadPorTelefone em bot.js) ──
async function salvarNoHistoricoBot(phoneNormalizado, mensagem) {
  try {
    const histKey = `bot:hist:${phoneNormalizado}`;
    const r = await fetch(`${KV_URL}/get/${histKey}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    let v = d.result;
    while (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
    const historico = Array.isArray(v) ? v : [];
    historico.push({ role: 'assistant', content: mensagem });
    await fetch(`${KV_URL}/set/${histKey}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(historico.slice(-100))
    });
  } catch(e) { console.error('Erro ao salvar historico bot (recuperacao):', e.message); }
}

// ── Handler ───────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  if (req.method === 'POST' && req.query.secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const log = [];

  try {
    // 1. Buscar config (recuperação sempre ativa — não existe mais chave geral de liga/desliga;
    // cada regra por etapa continua controlando individualmente se dispara ou não)
    const config = await kvGet('recuperacao-config');
    log.push({ step: 'config', value: config });

    if (!config) {
      return res.status(200).json({ ok: true, msg: 'Nenhuma configuração salva ainda', disparos: 0, log });
    }

    // 2. Buscar IDs dos leads
    const ids = await kvSmembers('leads-set');
    log.push({ step: 'ids', count: ids.length, ids });

    if (!ids.length) {
      return res.status(200).json({ ok: true, msg: 'Nenhum lead', disparos: 0, log });
    }

    // 3. Buscar leads
    const leadsRaw = await Promise.all(ids.map(id => kvGet(id)));
    const leads = leadsRaw.filter(l => l && l.email);
    log.push({ step: 'leads', count: leads.length });

    const agora = Date.now();
    const disparos = [];
    const erros = [];
    const pulados = [];

    for (const lead of leads) {
      const estagio = lead.estagio || 'dados';
      const minutosAbandonado = (agora - new Date(lead.atualizado_em).getTime()) / 60000;

      // Determinar regra
      let regra = null;
      let regraKey = '';
      if (['frete_selecionado','calculou_frete','endereco'].includes(estagio)) {
        regra = config.regra_frete; regraKey = 'regra_frete';
      } else if (estagio === 'pagamento_pendente') {
        regra = config.regra_pagamento; regraKey = 'regra_pagamento';
      } else if (['identificacao','cep_produto','dados'].includes(estagio)) {
        regra = config.regra_identificacao; regraKey = 'regra_identificacao';
      }

      if (!regra || !regra.ativo || !regra.mensagem) {
        pulados.push({ email: lead.email, motivo: 'regra inativa ou sem mensagem', regraKey });
        continue;
      }
      if (lead.recuperacao_enviada) {
        pulados.push({ email: lead.email, motivo: 'já enviado' });
        continue;
      }
      if (!lead.telefone) {
        pulados.push({ email: lead.email, motivo: 'sem telefone' });
        continue;
      }

      const delayMinutos = parseFloat(regra.delay_minutos) || 30;
      if (minutosAbandonado < delayMinutos) {
        pulados.push({ email: lead.email, motivo: `aguardando delay (${minutosAbandonado.toFixed(1)}min de ${delayMinutos}min)` });
        continue;
      }

      // Enviar — mensagem escrita pela IA a partir dos dados reais do carrinho
      const mensagem = await gerarMensagemIA(lead, regra, regraKey);
      const resultado = await enviarWhatsApp(lead.telefone, mensagem);

      if (resultado.ok) {
        lead.recuperacao_enviada = true;
        lead.recuperacao_enviada_em = new Date().toISOString();
        lead.recuperacao_regra = regraKey;
        await kvSet(lead.id, lead);
        // Registra no histórico do bot pra continuar a conversa com contexto se o lead responder
        await salvarNoHistoricoBot(resultado.phone, mensagem);
        disparos.push({ email: lead.email, estagio, telefone: lead.telefone });
      } else {
        erros.push({ email: lead.email, erro: resultado.erro });
      }
    }

    log.push({ step: 'resultado', disparos: disparos.length, pulados, erros });
    return res.status(200).json({ ok: true, disparos: disparos.length, detalhes: disparos, pulados, erros, log });

  } catch(e) {
    return res.status(500).json({ ok: false, erro: e.message, log });
  }
}
