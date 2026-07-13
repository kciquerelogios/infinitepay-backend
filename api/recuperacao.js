// api/recuperacao.js — Cron de recuperação de carrinhos abandonados
// vercel.json: {"crons": [{"path": "/api/recuperacao", "schedule": "*/10 * * * *"}]}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ZAPI_BASE = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

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
    return { ok: true, data: d };
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
    // 1. Buscar config
    const config = await kvGet('recuperacao-config');
    log.push({ step: 'config', value: config });

    if (!config || !config.ativo) {
      return res.status(200).json({ ok: true, msg: 'Recuperação desativada', disparos: 0, log });
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

      // Enviar
      const mensagem = formatarMensagem(regra.mensagem, lead);
      const resultado = await enviarWhatsApp(lead.telefone, mensagem);

      if (resultado.ok) {
        lead.recuperacao_enviada = true;
        lead.recuperacao_enviada_em = new Date().toISOString();
        lead.recuperacao_regra = regraKey;
        await kvSet(lead.id, lead);
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
