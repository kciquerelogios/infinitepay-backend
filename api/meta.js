// api/meta.js — API de Conversões do Meta (CAPI)
import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function hash(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function hashPhone(phone) {
  if (!phone) return undefined;
  const clean = phone.replace(/\D/g, '');
  // Formato E.164 com DDI Brasil
  const normalized = clean.startsWith('55') ? clean : '55' + clean;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      event_name,     // 'Lead', 'CompleteRegistration', 'Contact', etc
      event_time,     // timestamp unix (opcional, usa agora)
      event_id,       // ID único para deduplicação
      event_source_url,
      email,
      phone,
      nome,
      ip,
      user_agent,
      fbc,            // cookie _fbc
      fbp,            // cookie _fbp
      cidade,
      estado,
      pais,
      cep,
      custom_data,
    } = req.body;

    if (!event_name) return res.status(400).json({ error: 'event_name obrigatório' });

    const user_data = {
      em: hash(email),
      ph: hashPhone(phone),
      fn: hash(nome?.split(' ')[0]),
      ln: hash(nome?.split(' ').slice(1).join(' ')),
      ct: hash(cidade),
      st: hash(estado),
      zp: hash(cep),
      country: hash(pais || 'br'),
      client_ip_address: ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      client_user_agent: user_agent || req.headers['user-agent'],
      fbc: fbc,
      fbp: fbp,
    };

    // Remover campos undefined
    Object.keys(user_data).forEach(k => user_data[k] === undefined && delete user_data[k]);

    // custom_data com value e currency (obrigatório para Lead/Purchase)
    const value = req.body.value || (event_name === 'Lead' ? 189.90 : undefined);
    const currency = req.body.currency || 'BRL';
    const finalCustomData = {
      ...(value !== undefined ? { value: parseFloat(value), currency } : {}),
      ...(custom_data || {}),
    };

    const payload = {
      data: [{
        event_name,
        event_time: event_time || Math.floor(Date.now() / 1000),
        event_id: event_id || `${event_name}_${Date.now()}`,
        event_source_url: event_source_url || 'https://kcique.com.br/pages/vip',
        action_source: 'website',
        user_data,
        ...(Object.keys(finalCustomData).length > 0 ? { custom_data: finalCustomData } : {}),
      }],
      test_event_code: process.env.META_TEST_CODE || 'TEST73050',
    };

    // Só remover se realmente vazio
    if (!payload.test_event_code) delete payload.test_event_code;
    console.log('test_event_code:', payload.test_event_code);

    const response = await fetch(`${API_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Meta CAPI erro:', JSON.stringify(data.error));
      return res.status(400).json({ error: data.error.message });
    }

    console.log('Meta CAPI ok:', event_name, '| events_received:', data.events_received);
    return res.status(200).json({ ok: true, events_received: data.events_received });
  } catch (e) {
    console.error('Meta CAPI exception:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
