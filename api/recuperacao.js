// api/recuperacao.js — Cron de recuperação de carrinhos abandonados
// Configurar no vercel.json: {"crons": [{"path": "/api/recuperacao", "schedule": "*/10 * * * *"}]}

import fetch from 'node-fetch';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ZAPI_BASE = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
const ZAPI_HEADERS = { 'Content-Type': 'application/json', 'client-token': process.env.ZAPI_CLIENT_TOKEN };

const kv = {
  get: async (key) => {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    if (!d.result) return null;
    let v = d.result;
    while (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
    return v;
  },
  set: async (key, value, ex = 604800) => {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex })
    });
  },
  smembers: async (key) => {
    const r = await fetch(`${KV_URL}/smembers/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const d = await r.json();
    return d.result || [];
  }
};

async function enviarWhatsApp(telefone, mensagem) {
  const tel = telefone.replace(/\D/g, '');
  if (!tel || tel.length < 10) return { ok: false, erro: 'Telefone inválido' };
  const phone = tel.startsWith('55') ? tel : `55${tel}`;
  try {
    const r = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST', headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, message: mensagem })
    });
    const d = await r.json();
    return { ok: true, data: d };
  } catch(e) {
    return { ok: false, erro: e.message };
  }
}

function formatarMensagem(template, lead) {
  const primeiroNome = (lead.nome || 'cliente').split(' ')[0];
  const produtos = (lead.carrinho || []).map(i => i.nome).join(', ');
  const checkout = 'https://kcique.com.br/pages/checkout';
  return template
    .replace(/\{nome\}/g, primeiroNome)
    .replace(/\{email\}/g, lead.email || '')
    .replace(/\{produtos\}/g, produtos)
    .replace(/\{link\}/g, checkout);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Aceitar GET (cron Vercel) ou POST (trigger manual)
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // Segurança no trigger manual
  if (req.method === 'POST' && req.query.secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  // Buscar config de recuperação
  const config = await kv.get('recuperacao-config') || {};
  if (!config.ativo) return res.status(200).json({ ok: true, msg: 'Recuperação desativada', disparos: 0 });

  // Buscar todos os leads
  const ids = await kv.smembers('leads-set');
  const leads = (await Promise.all(ids.map(id => kv.get(id)))).filter(Boolean);

  const agora = Date.now();
  const disparos = [];
  const erros = [];

  for (const lead of leads) {
    if (lead.recuperacao_enviada) continue;
    if (!lead.telefone) continue;
    if (!lead.atualizado_em) continue;

    const minutosAbandonado = (agora - new Date(lead.atualizado_em).getTime()) / 60000;
    const estagio = lead.estagio || 'dados';

    // Determinar qual regra se aplica
    let regra = null;

    // Regra 1: Abandonou no frete (calculou ou selecionou mas não pagou)
    if (['calculou_frete','frete_selecionado','endereco'].includes(estagio)) {
      regra = config.regra_frete;
    }
    // Regra 2: Foi pro pagamento e não pagou
    else if (estagio === 'pagamento_pendente') {
      regra = config.regra_pagamento;
    }
    // Regra 3: Só preencheu identificação
    else if (['identificacao','cep_produto'].includes(estagio)) {
      regra = config.regra_identificacao;
    }

    if (!regra || !regra.ativo || !regra.mensagem) continue;

    const delayMinutos = regra.delay_minutos || 30;
    if (minutosAbandonado < delayMinutos) continue;

    // Enviar mensagem
    const mensagem = formatarMensagem(regra.mensagem, lead);
    const resultado = await enviarWhatsApp(lead.telefone, mensagem);

    if (resultado.ok) {
      // Marcar como enviado
      lead.recuperacao_enviada = true;
      lead.recuperacao_enviada_em = new Date().toISOString();
      lead.recuperacao_regra = estagio;
      await kv.set(lead.id, lead);
      disparos.push({ id: lead.id, email: lead.email, estagio, telefone: lead.telefone });
    } else {
      erros.push({ id: lead.id, email: lead.email, erro: resultado.erro });
    }
  }

  return res.status(200).json({ ok: true, disparos: disparos.length, detalhes: disparos, erros });
}
