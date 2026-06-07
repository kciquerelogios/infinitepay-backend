export default async function handler(req, res) {
  // Parse body manualmente se necessário
  if (req.method === 'POST' && typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch(e) {
      const params = new URLSearchParams(req.body);
      req.body = Object.fromEntries(params);
    }
  }
  const { secret } = req.query;
  if (secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="text-align:center"><h2>🔒 Acesso Restrito</h2><form onsubmit="window.location.href='/api/ofertas-dashboard?secret='+document.getElementById('s').value;return false" style="margin-top:20px"><input id="s" type="password" placeholder="Senha" style="padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px"><button type="submit" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;margin-left:8px;font-size:15px;cursor:pointer">Entrar</button></form></div></body></html>`);
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // Deletar oferta
  if (req.query.del) {
    await fetch(`${KV_URL}/del/${req.query.del}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/ofertas-lista/0/${req.query.del}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.redirect(`/api/ofertas-dashboard?secret=${secret}&t=${Date.now()}`);
  }

  // Salvar nova oferta
  if (req.method === 'POST') {
    const { texto, imagem, link, dataHora, grupos } = req.body;
    const id = `oferta-${Date.now()}`;
    const oferta = { id, texto, imagem, link, dataHora, grupos: grupos || 'todos', status: 'agendada', criado_em: new Date().toISOString() };
    await fetch(`${KV_URL}/set/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(oferta), ex: 60 * 60 * 24 * 30 }) });
    await fetch(`${KV_URL}/rpush/ofertas-lista`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([id]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/ofertas-dashboard?secret=${secret}&t=${Date.now()}"></head><body>Redirecionando...</body></html>`);
  }

  // Listar ofertas
  let ofertas = [];
  try {
    const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const listaData = await listaResp.json();
    const ids = listaData.result || [];
    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d = await r.json();
        if (d.result !== null && d.result !== undefined) {
          let parsed = d.result;
          while (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch(e) { break; }
          }
          if (parsed && parsed.id) ofertas.push(parsed);
        }
      } catch(e) { console.error('Erro oferta', id, e); }
    }
    ofertas.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  } catch(e) {}

  const grupos = [
    { nome: '#1', id: '120363407575718083-group' },
    { nome: '#2', id: '120363407700341013-group' },
    { nome: '#3', id: '120363407514192649-group' },
    { nome: '#4', id: '120363406939167357-group' },
    { nome: '#5', id: '120363425311709688-group' },
    { nome: '#6', id: '120363407634566182-group' },
    { nome: '#7', id: '120363426601689014-group' },
    { nome: '#8', id: '120363407550597963-group' },
    { nome: '#9', id: '120363424221379294-group' },
    { nome: '#10', id: '120363425206908330-group' },
    { nome: '#11', id: '120363409632620470-group' },
    { nome: '#12', id: '120363426115032457-group' },
    { nome: '#13', id: '120363426651817338-group' },
    { nome: '#14', id: '120363406708968616-group' },
    { nome: '#15', id: '120363425674177408-group' },
    { nome: '#16', id: '120363428180805162-group' },
    { nome: '#17', id: '120363406426269657-group' },
  ];

  const rows = ofertas.map(o => {
    const data = new Date(new Date(o.dataHora).getTime() - 3 * 60 * 60 * 1000);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const statusColor = o.status === 'enviada' ? '#10b981' : o.status === 'erro' ? '#ef4444' : '#f59e0b';
    const statusLabel = o.status === 'enviada' ? '✅ Enviada' : o.status === 'erro' ? '❌ Erro' : '⏳ Agendada';
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">
        ${o.imagem ? `<img src="${o.imagem}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;display:block;margin-bottom:6px">` : ''}
        <div style="font-weight:600;color:#1a1a2e;margin-bottom:4px">${(o.texto || '').substring(0, 80)}${o.texto && o.texto.length > 80 ? '...' : ''}</div>
        ${o.link ? `<a href="${o.link}" target="_blank" style="font-size:11px;color:#2563eb">${o.link.substring(0, 40)}...</a>` : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;white-space:nowrap">${dataStr}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px">${o.grupos === 'todos' ? 'Todos (#1 ao #17)' : o.grupos}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6"><span style="background:${statusColor}20;color:${statusColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${statusLabel}</span></td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;white-space:nowrap">
        ${o.status === 'agendada' ? `<a href="/api/ofertas-dashboard?secret=${secret}&del=${o.id}&t=${Date.now()}" onclick="return confirm('Remover esta oferta?')" style="display:inline-flex;align-items:center;padding:6px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;text-decoration:none;font-size:12px">🗑 Remover</a>` : ''}
      </td>
    </tr>`;
  }).join('');

  const gruposCheckboxes = grupos.map(g => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px;padding:4px 10px;border:1px solid #e8eaf0;border-radius:6px;cursor:pointer;font-size:13px"><input type="checkbox" name="grupo_${g.id}" value="${g.id}" checked> ${g.nome}</label>`).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard — Ofertas WhatsApp</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, sans-serif; background: #f7f8fa; color: #1a1a2e; }
.header { background: #111; color: #fff; padding: 20px 32px; display: flex; align-items: center; justify-content: space-between; }
.header h1 { font-size: 18px; font-weight: 700; }
.container { max-width: 1100px; margin: 0 auto; padding: 24px 32px; }
.form-card { background: #fff; border-radius: 12px; border: 1px solid #e8eaf0; padding: 24px; margin-bottom: 24px; }
.form-card h2 { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.field input, .field textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; }
.field input:focus, .field textarea:focus { border-color: #2563eb; }
.field textarea { resize: vertical; min-height: 80px; }
.btn { padding: 12px 24px; background: #25d366; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
.btn:hover { background: #1da851; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; border: 1px solid #e8eaf0; overflow: hidden; }
th { background: #f9f9fb; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e8eaf0; }
tr:hover td { background: #f9f9fb; }
.grupos-wrap { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 8px; }
.sel-todos { margin-bottom: 8px; }
@media(max-width:768px) { .container { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div><h1>📣 Ofertas WhatsApp — Kcique</h1></div>
  <a href="/api/dashboard?secret=${secret}" style="color:#aaa;font-size:13px;text-decoration:none">← Carrinhos</a>
</div>
<div class="container">

  <div class="form-card">
    <h2>➕ Agendar Nova Oferta</h2>
    <form onsubmit="salvarOferta(event)">
      <div class="field">
        <label>Texto da mensagem</label>
        <textarea name="texto" placeholder="🔥 OFERTA RELÂMPAGO!\n\nRélogio X por R$ 199,90\n\nClique no link e garanta o seu!" required></textarea>
      </div>
      <div class="field">
        <label>URL da imagem (opcional)</label>
        <input type="url" name="imagem" placeholder="https://cdn.shopify.com/...">
      </div>
      <div class="field">
        <label>Link do produto (opcional)</label>
        <input type="url" name="link" placeholder="https://kcique.com.br/products/...">
      </div>
      <div class="field">
        <label>Data e hora do envio (horário de Brasília)</label>
        <input type="datetime-local" name="dataHora" required>
      </div>
      <div class="field">
        <label>Grupos para enviar</label>
        <div class="sel-todos">
          <label style="cursor:pointer;font-size:13px"><input type="checkbox" id="sel-todos" onchange="toggleTodos(this)" checked> Selecionar todos</label>
        </div>
        <div class="grupos-wrap" id="grupos-wrap">
          ${gruposCheckboxes}
        </div>
        <input type="hidden" name="grupos" id="grupos-hidden" value="todos">
      </div>
      <button type="submit" class="btn">📅 Agendar Oferta</button>
      <div id="form-msg" style="margin-top:12px;font-size:13px"></div>
    </form>
  </div>

  <div style="font-size:16px;font-weight:700;margin-bottom:16px">Ofertas Agendadas (${ofertas.length})</div>
  ${ofertas.length === 0 ? '<div style="text-align:center;padding:48px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0">Nenhuma oferta agendada ainda!</div>' : `<table><thead><tr><th>Oferta</th><th>Data/Hora</th><th>Grupos</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table>`}
</div>

<script>
function toggleTodos(cb) {
  document.querySelectorAll('#grupos-wrap input[type=checkbox]').forEach(function(el) { el.checked = cb.checked; });
}

async function salvarOferta(e) {
  e.preventDefault();
  var msg = document.getElementById('form-msg');
  msg.textContent = 'Salvando...';
  msg.style.color = '#6b7280';

  var selecionados = [];
  document.querySelectorAll('#grupos-wrap input[type=checkbox]:checked').forEach(function(el) { selecionados.push(el.value); });
  var total = document.querySelectorAll('#grupos-wrap input[type=checkbox]').length;
  var grupos = selecionados.length === total ? 'todos' : selecionados.join(',');

  var payload = {
    texto: document.querySelector('[name=texto]').value,
    imagem: document.querySelector('[name=imagem]').value,
    link: document.querySelector('[name=link]').value,
    dataHora: document.querySelector('[name=dataHora]').value,
    grupos: grupos
  };

  try {
    var resp = await fetch('/api/ofertas-salvar?secret=${secret}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    if (data.success) {
      msg.textContent = '✅ Oferta agendada com sucesso!';
      msg.style.color = '#10b981';
      setTimeout(function(){ window.location.reload(); }, 1500);
    } else {
      msg.textContent = '❌ Erro: ' + (data.error || 'tente novamente');
      msg.style.color = '#ef4444';
    }
  } catch(err) {
    msg.textContent = '❌ Erro de conexão';
    msg.style.color = '#ef4444';
  }
}

// Definir data mínima como agora
var agora = new Date();
agora.setMinutes(agora.getMinutes() + 5);
var pad = function(n) { return n < 10 ? '0' + n : n; };
var minDate = agora.getFullYear() + '-' + pad(agora.getMonth()+1) + '-' + pad(agora.getDate()) + 'T' + pad(agora.getHours()) + ':' + pad(agora.getMinutes());
document.querySelector('input[type=datetime-local]').min = minDate;
document.querySelector('input[type=datetime-local]').value = minDate;
</script>
</body>
</html>`);
}
