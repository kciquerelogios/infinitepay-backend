export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const ZAPI_INSTANCE    = process.env.ZAPI_INSTANCE;
const ZAPI_TOKEN       = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const KV_URL           = process.env.KV_REST_API_URL;
const KV_TOKEN         = process.env.KV_REST_API_TOKEN;
const SHOPIFY_STORE    = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN    = process.env.SHOPIFY_TOKEN;
const SECRET           = process.env.REPROCESSAR_SECRET || 'kcique2026';
const ZAPI_BASE        = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;
const MEU_NUMERO       = '5511955925365';

// ── Redis helpers ──────────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  let v = d.result;
  while (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
  return v || null;
}
async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}
async function kvRpush(key, value) {
  await fetch(`${KV_URL}/rpush/${key}/${encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value))}`, {
    method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
}
async function kvSadd(key, value) {
  await fetch(`${KV_URL}/sadd/${key}/${encodeURIComponent(value)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
}
async function kvSmembers(key) {
  const r = await fetch(`${KV_URL}/smembers/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  return d.result || [];
}
async function kvIncr(key) {
  await fetch(`${KV_URL}/incr/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}
async function kvLrange(key, start, end) {
  const r = await fetch(`${KV_URL}/lrange/${key}/${start}/${end}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  return d.result || [];
}

// ── Buscar cliente no Shopify ──────────────────────────────────
async function buscarClienteShopify(phone) {
  const nums = phone.replace(/\D/g, '').replace(/^55/, '');
  try {
    const r = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/search.json?query=phone:${encodeURIComponent('+55' + nums)}&limit=1`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    ).then(r => r.json());
    if ((r.customers || []).length) {
      const c = r.customers[0];
      const pedidos = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2026-04/customers/${c.id}/orders.json?status=any&limit=5`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      ).then(r => r.json()).catch(() => ({ orders: [] }));
      return {
        ehCliente: true,
        nome: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email || '',
        totalPedidos: (pedidos.orders || []).length,
        ultimoPedido: (pedidos.orders || [])[0]?.order_number || null,
        totalGasto: (pedidos.orders || []).reduce((s, o) => s + parseFloat(o.total_price || 0), 0)
      };
    }
  } catch(e) {}
  return { ehCliente: false };
}

// ── Salvar mensagem ────────────────────────────────────────────
async function salvarMensagem(phone, msg) {
  // ID com timestamp para garantir ordem cronológica
  const ts = msg.timestamp || Date.now();
  const msgId = `inbox:msg:${ts}_${msg.id || Math.random().toString(36).slice(2,8)}`;
  const dataBR = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Salvar em paralelo o que for possível
  const contatoAtual = await kvGet(`inbox:contato:${phone}`) || {};

  await Promise.all([
    kvSet(msgId, msg),
    kvRpush(`inbox:msgs:${phone}`, msgId),
    kvSadd('inbox:contatos', phone),
    kvIncr(`inbox:stats:${dataBR}`),
  ]);

  await kvSet(`inbox:contato:${phone}`, {
    ...contatoAtual,
    phone,
    nome: contatoAtual.nome || msg.nomeRemetente || phone,
    foto: contatoAtual.foto || msg.foto || null,
    ultimaMensagem: msg.texto || (msg.tipo !== 'text' ? `[${msg.tipo}]` : ''),
    ultimoContato: msg.timestamp,
    naoLidas: (contatoAtual.naoLidas || 0) + (msg.fromMe ? 0 : 1),
    etiqueta: contatoAtual.etiqueta || null,
    ehCliente: contatoAtual.ehCliente || false,
    dadosShopify: contatoAtual.dadosShopify || null,
  });
}

// ── Enviar mensagem ────────────────────────────────────────────
async function enviarMensagem(phone, texto) {
  const r = await fetch(`${ZAPI_BASE}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'client-token': ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message: texto })
  });
  return r.json().catch(() => ({}));
}

// ── HANDLER ────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = req.query.secret || '';

  // ── GET: listar contatos ───────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'contatos') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const phones = await kvSmembers('inbox:contatos');
      const contatos = await Promise.all(phones.map(p => kvGet(`inbox:contato:${p}`)));
      const lista = contatos.filter(Boolean).sort((a, b) => b.ultimoContato - a.ultimoContato);
      return res.status(200).json({ contatos: lista });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── GET: mensagens de um contato ──────────────────────────
  if (req.method === 'GET' && req.query.action === 'mensagens') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    const phone = req.query.phone || '';
    if (!phone) return res.status(400).json({ erro: 'phone obrigatório' });
    try {
      const ids = await kvLrange(`inbox:msgs:${phone}`, -100, -1); // últimas 100
      const msgs = await Promise.all(ids.map(id => kvGet(id)));
      return res.status(200).json({ mensagens: msgs.filter(Boolean) });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── GET: stats (gráfico) ──────────────────────────────────
  if (req.method === 'GET' && req.query.action === 'stats') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const hoje = new Date();
      const dias = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(hoje); d.setDate(hoje.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const count = await kvGet(`inbox:stats:${ds}`);
        dias.push({ data: ds, total: parseInt(count || 0) });
      }
      // Totais
      const contatos = await kvSmembers('inbox:contatos');
      const totalContatos = contatos.length;
      const msgsHoje = dias[dias.length - 1]?.total || 0;
      const msgsOntem = dias[dias.length - 2]?.total || 0;
      return res.status(200).json({ dias, totalContatos, msgsHoje, msgsOntem });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── POST: atualizar etiqueta ──────────────────────────────
  if (req.method === 'POST' && req.query.action === 'etiqueta') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const { phone, etiqueta } = req.body || {};
      const contato = await kvGet(`inbox:contato:${phone}`) || {};
      await kvSet(`inbox:contato:${phone}`, { ...contato, etiqueta });
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── POST: marcar como lido ────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'marcar-lido') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const { phone } = req.body || {};
      const contato = await kvGet(`inbox:contato:${phone}`) || {};
      await kvSet(`inbox:contato:${phone}`, { ...contato, naoLidas: 0 });
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── POST: enviar mensagem pelo painel ─────────────────────
  if (req.method === 'POST' && req.query.action === 'enviar') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const { phone, texto } = req.body || {};
      if (!phone || !texto) return res.status(400).json({ erro: 'phone e texto obrigatórios' });
      await enviarMensagem(phone, texto);
      const msg = {
        id: `msg_${Date.now()}`,
        phone, texto, tipo: 'text',
        fromMe: true,
        timestamp: Date.now(),
        nomeRemetente: 'Kcique'
      };
      await salvarMensagem(phoneKey, msg);
      return res.status(200).json({ ok: true });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── POST: identificar cliente no Shopify ──────────────────
  if (req.method === 'POST' && req.query.action === 'identificar') {
    if (secret !== SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const { phone } = req.body || {};
      const shopify = await buscarClienteShopify(phone);
      const contato = await kvGet(`inbox:contato:${phone}`) || {};
      await kvSet(`inbox:contato:${phone}`, {
        ...contato,
        ehCliente: shopify.ehCliente,
        dadosShopify: shopify.ehCliente ? shopify : null,
        etiqueta: shopify.ehCliente ? (contato.etiqueta || 'cliente') : contato.etiqueta
      });
      return res.status(200).json({ ok: true, shopify });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── POST: webhook Z-API (receber mensagens) ───────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (body.isGroup || body.isNewsletter) return res.status(200).json({ ok: true });

      // Normalizar telefone — sempre com DDI 55, sem +, sem espaços
      const phoneRaw = body.phone || body.from || '';
      if (!phoneRaw) return res.status(200).json({ ok: true });
      const phone = phoneRaw.replace(/\D/g, '').replace(/^0+/, '');
      const phoneNorm = phone.startsWith('55') ? phone : '55' + phone;
      if (phoneNorm === MEU_NUMERO) return res.status(200).json({ ok: true });
      // Usar sempre o número normalizado
      const phoneKey = phoneNorm;

      // Extrair texto
      let texto = '';
      if (body.text) texto = typeof body.text === 'string' ? body.text : (body.text.message || '');
      if (!texto && body.caption) texto = body.caption;

      // Extrair mídia
      let tipo = 'text';
      let mediaUrl = null;
      let mediaThumbnail = null;
      if (body.image) { tipo = 'image'; mediaUrl = body.image.imageUrl || body.image.url || null; mediaThumbnail = body.image.thumbnailUrl || mediaUrl; }
      else if (body.video) { tipo = 'video'; mediaUrl = body.video.videoUrl || body.video.url || null; mediaThumbnail = body.video.thumbnailUrl || null; }
      else if (body.audio) { tipo = 'audio'; mediaUrl = body.audio.audioUrl || body.audio.url || null; }
      else if (body.document) { tipo = 'document'; mediaUrl = body.document.documentUrl || body.document.url || null; }
      else if (body.sticker) { tipo = 'sticker'; mediaUrl = body.sticker.stickerUrl || null; }

      const msg = {
        id: body.messageId || `msg_${Date.now()}`,
        phone: phoneKey,
        texto: texto || null,
        tipo,
        mediaUrl,
        mediaThumbnail,
        fromMe: body.fromMe || false,
        timestamp: body.momment || Date.now(),
        nomeRemetente: body.senderName || body.chatName || phone,
        foto: body.senderPhoto || body.photo || null,
        status: 'received'
      };

      await salvarMensagem(phoneKey, msg);

      // Identificar cliente automaticamente (async, sem bloquear)
      buscarClienteShopify(phoneKey).then(async shopify => {
        if (shopify.ehCliente) {
          const contato = await kvGet(`inbox:contato:${phone}`) || {};
          if (!contato.ehCliente) {
            await kvSet(`inbox:contato:${phone}`, {
              ...contato,
              ehCliente: true,
              dadosShopify: shopify,
              etiqueta: contato.etiqueta || 'cliente'
            });
          }
        }
      }).catch(() => {});

      console.log(`INBOX msg recebida: phone=${phone} tipo=${tipo} texto="${(texto||'').substring(0,50)}"`);
      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error('INBOX erro:', e.message);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).end();
}
