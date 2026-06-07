export default async function handler(req, res) {
  const { secret, pagina } = req.query;

  if (secret !== process.env.REPROCESSAR_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kcique Admin</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0f0f0f;display:flex;align-items:center;justify-content:center;height:100vh;color:#fff}
.login{text-align:center;background:#1a1a1a;padding:40px;border-radius:16px;border:1px solid #333;width:320px}
.login h1{font-size:24px;margin-bottom:8px}
.login p{color:#888;font-size:13px;margin-bottom:24px}
input{width:100%;padding:12px 16px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:15px;outline:none;margin-bottom:12px}
input:focus{border-color:#25d366}
button{width:100%;padding:12px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body>
<div class="login">
  <h1>⌚ Kcique Admin</h1>
  <p>Painel de controle da loja</p>
  <form onsubmit="window.location.href='/api/admin?secret='+document.getElementById('s').value+'&pagina=carrinhos';return false">
    <input id="s" type="password" placeholder="Senha de acesso">
    <button type="submit">Entrar</button>
  </form>
</div>
</body></html>`);
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const paginaAtual = pagina || 'carrinhos';

  // ===== AÇÕES =====

  // Deletar lead
  if (req.query.del_lead) {
    await fetch(`${KV_URL}/del/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/leads-lista/0/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_lead]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/admin?secret=${secret}&pagina=carrinhos"></head><body></body></html>`);
  }

  // Deletar oferta
  if (req.query.del_oferta) {
    await fetch(`${KV_URL}/del/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/ofertas-lista/0/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_oferta]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/admin?secret=${secret}&pagina=ofertas"></head><body></body></html>`);
  }

  // ===== DADOS =====
  let leads = [], ofertas = [], totalValor = 0;

  // Carregar leads
  try {
    const leadsResp = await fetch(`https://infinitepay-backend.vercel.app/api/leads?secret=${secret}`);
    const leadsData = await leadsResp.json();
    leads = leadsData.leads || [];
    leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
    totalValor = leads.reduce((s, l) => s + (l.carrinho || []).reduce((cs, i) => cs + (i.preco * i.quantidade / 100), 0), 0);
  } catch(e) {}

  // Carregar ofertas
  try {
    const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const listaData = await listaResp.json();
    const ids = listaData.result || [];
    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d = await r.json();
        if (!d.result) continue;
        let o = d.result;
        while (typeof o === 'string') { try { o = JSON.parse(o); } catch(e) { break; } }
        if (o && o.id) ofertas.push(o);
      } catch(e) {}
    }
    ofertas.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  } catch(e) {}

  // ===== CONTEÚDO POR PÁGINA =====
  const agora = new Date();
  let conteudo = '';

  if (paginaAtual === 'carrinhos') {
    const badgeMap = {
      'email': '<span class="badge" style="background:#f3f4f6;color:#374151">⚪ Só email</span>',
      'dados_parciais': '<span class="badge" style="background:#fef3c7;color:#92400e">🟡 Dados parciais</span>',
      'endereco': '<span class="badge" style="background:#dbeafe;color:#1e40af">🔵 Preencheu endereço</span>',
      'pagamento_pendente': '<span class="badge" style="background:#fef3c7;color:#92400e">⏳ Aguardando pagamento</span>',
      'abandonou_pagamento': '<span class="badge" style="background:#fee2e2;color:#991b1b">🔴 Abandonou no pagamento</span>'
    };

    const rows = leads.map(lead => {
      const valor = (lead.carrinho || []).reduce((s, i) => s + (i.preco * i.quantidade / 100), 0);
      const telefone = (lead.telefone || '').replace(/\D/g, '');
      const produtos = (lead.carrinho || []).map(i => `<div>• ${i.nome}${i.cor && i.cor !== 'Default Title' ? ' — ' + i.cor : ''} (x${i.quantidade}) — R$ ${(i.preco * i.quantidade / 100).toFixed(2).replace('.', ',')}</div>`).join('') || '<div style="color:#9ca3af">Sem produtos</div>';
      const data = new Date(new Date(lead.criado_em).getTime() - 3 * 60 * 60 * 1000);
      const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const msg = encodeURIComponent(`Olá ${(lead.nome || '').split(' ')[0]}! 😊 Vi que você estava olhando nossos relógios na Kcique e gostaria de te ajudar a finalizar sua compra. Posso te ajudar?`);
      const ref = lead.atualizado_em || lead.criado_em || '';
      let estagio = lead.estagio;
      if (estagio === 'pagamento_pendente' && ref) {
        const minutos = (agora - new Date(ref)) / 1000 / 60;
        if (minutos >= 10) estagio = 'abandonou_pagamento';
      }
      const badge = badgeMap[estagio] || `<span class="badge" style="background:#fef3c7;color:#92400e">🟡 ${estagio}</span>`;
      const enderecoStr = lead.rua ? `${lead.rua}${lead.numero ? ', ' + lead.numero : ''} — ${lead.bairro || ''} — ${lead.cidade || ''}/${lead.estado || ''}` : '';
      return `<tr>
        <td><div style="font-weight:600">${lead.nome || '—'}</div><div style="font-size:12px;color:#6b7280">${lead.email}</div><div style="font-size:12px;color:#6b7280">${lead.telefone || '—'}</div>${enderecoStr ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">${enderecoStr}</div>` : ''}</td>
        <td>${badge}</td>
        <td><div style="font-size:13px">${produtos}</div></td>
        <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong>${lead.frete ? `<br><span style="font-size:11px;color:#6b7280">+ ${lead.frete.nome}</span>` : ''}</td>
        <td><div style="font-size:12px;color:#9ca3af">${dataStr}</div></td>
        <td style="white-space:nowrap">
          ${telefone ? `<a href="https://wa.me/55${telefone}?text=${msg}" target="_blank" class="btn-wpp">💬 WhatsApp</a>` : ''}
          <a href="/api/admin?secret=${secret}&pagina=carrinhos&del_lead=${lead.id}" onclick="return confirm('Remover?')" class="btn-del">🗑</a>
        </td>
      </tr>`;
    }).join('');

    const abandonouCount = leads.filter(l => {
      let e = l.estagio;
      if (e === 'pagamento_pendente' && (l.atualizado_em || l.criado_em)) {
        const min = (agora - new Date(l.atualizado_em || l.criado_em)) / 1000 / 60;
        if (min >= 10) e = 'abandonou_pagamento';
      }
      return e === 'abandonou_pagamento';
    }).length;

    conteudo = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total de Leads</div><div class="stat-value">${leads.length}</div></div>
      <div class="stat-card"><div class="stat-label">Abandonaram no Pagamento</div><div class="stat-value">${abandonouCount}</div></div>
      <div class="stat-card"><div class="stat-label">Valor Potencial</div><div class="stat-value">R$ ${totalValor.toFixed(2).replace('.', ',')}</div></div>
    </div>
    <div class="section-title">Leads Recentes</div>
    ${leads.length === 0 ? '<div class="vazio">Nenhum carrinho abandonado ainda! 🎉</div>' : `
    <div class="table-wrap"><table>
      <thead><tr><th>Cliente</th><th>Estágio</th><th>Produtos</th><th>Valor</th><th>Data</th><th>Ação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`}`;
  }

  else if (paginaAtual === 'ofertas') {
    const GRUPOS_INFO = [
      { nome: '#1', id: '120363407575718083-group' }, { nome: '#2', id: '120363407700341013-group' },
      { nome: '#3', id: '120363407514192649-group' }, { nome: '#4', id: '120363406939167357-group' },
      { nome: '#5', id: '120363425311709688-group' }, { nome: '#6', id: '120363407634566182-group' },
      { nome: '#7', id: '120363426601689014-group' }, { nome: '#8', id: '120363407550597963-group' },
      { nome: '#9', id: '120363424221379294-group' }, { nome: '#10', id: '120363425206908330-group' },
      { nome: '#11', id: '120363409632620470-group' }, { nome: '#12', id: '120363426115032457-group' },
      { nome: '#13', id: '120363426651817338-group' }, { nome: '#14', id: '120363406708968616-group' },
      { nome: '#15', id: '120363425674177408-group' }, { nome: '#16', id: '120363428180805162-group' },
      { nome: '#17', id: '120363406426269657-group' },
    ];

    const gruposCheckboxes = GRUPOS_INFO.map(g => `<label class="grupo-label"><input type="checkbox" value="${g.id}" checked> ${g.nome}</label>`).join('');

    const rows = ofertas.map(o => {
      const dataStr = new Date(o.dataHora).toLocaleDateString('pt-BR') + ' ' + new Date(o.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const sc = o.status === 'enviada' ? '#10b981' : o.status === 'erro' ? '#ef4444' : '#f59e0b';
      const sl = o.status === 'enviada' ? '✅ Enviada' : o.status === 'erro' ? '❌ Erro' : '⏳ Agendada';
      return `<tr>
        <td>${o.imagem ? `<img src="${o.imagem}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;display:block;margin-bottom:4px">` : ''}
          <div style="font-weight:600;font-size:13px">${(o.texto||'').substring(0,60)}${o.texto&&o.texto.length>60?'...':''}</div>
          ${o.link ? `<a href="${o.link}" target="_blank" style="font-size:11px;color:#2563eb">${o.link.substring(0,40)}</a>` : ''}</td>
        <td style="white-space:nowrap;font-size:13px">${dataStr}</td>
        <td style="font-size:13px">${o.grupos === 'todos' ? 'Todos (#1-#17)' : o.grupos}</td>
        <td><span style="background:${sc}20;color:${sc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${sl}</span></td>
        <td><a href="/api/admin?secret=${secret}&pagina=ofertas&del_oferta=${o.id}" onclick="return confirm('Remover?')" class="btn-del">🗑</a></td>
      </tr>`;
    }).join('');

    const enviadas = ofertas.filter(o => o.status === 'enviada').length;
    const agendadas = ofertas.filter(o => o.status === 'agendada').length;

    conteudo = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total de Ofertas</div><div class="stat-value">${ofertas.length}</div></div>
      <div class="stat-card"><div class="stat-label">Agendadas</div><div class="stat-value">${agendadas}</div></div>
      <div class="stat-card"><div class="stat-label">Enviadas</div><div class="stat-value">${enviadas}</div></div>
    </div>

    <div class="form-card">
      <div class="form-title">➕ Agendar Nova Oferta</div>
      <div class="field"><label>Texto da mensagem</label><textarea id="f-texto" rows="4" placeholder="🔥 OFERTA RELÂMPAGO!&#10;&#10;Relógio X por R$ 199,90&#10;&#10;Garanta o seu!"></textarea></div>
      <div class="row-2">
        <div class="field"><label>URL da imagem (opcional)</label><input type="url" id="f-imagem" placeholder="https://cdn.shopify.com/..."></div>
        <div class="field"><label>Link do produto (opcional)</label><input type="url" id="f-link" placeholder="https://kcique.com.br/..."></div>
      </div>
      <div class="field"><label>Data e hora (Brasília)</label><input type="datetime-local" id="f-data"></div>
      <div class="field">
        <label>Grupos</label>
        <div style="margin-bottom:8px"><label style="cursor:pointer;font-size:13px"><input type="checkbox" id="sel-todos" onchange="toggleTodos(this)" checked> Selecionar todos</label></div>
        <div class="grupos-wrap" id="grupos-wrap">${gruposCheckboxes}</div>
      </div>
      <button class="btn-green" onclick="salvarOferta()">📅 Agendar Oferta</button>
      <div id="form-msg" style="margin-top:10px;font-size:13px"></div>
    </div>

    <div class="section-title">Ofertas (${ofertas.length})</div>
    ${ofertas.length === 0 ? '<div class="vazio">Nenhuma oferta agendada ainda!</div>' : `
    <div class="table-wrap"><table>
      <thead><tr><th>Oferta</th><th>Data/Hora</th><th>Grupos</th><th>Status</th><th>Ação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`}

    <script>
    function toggleTodos(cb) { document.querySelectorAll('#grupos-wrap input').forEach(function(el){ el.checked = cb.checked; }); }
    async function salvarOferta() {
      var msg = document.getElementById('form-msg');
      var texto = document.getElementById('f-texto').value.trim();
      var dataHora = document.getElementById('f-data').value;
      if (!texto) { msg.textContent='⚠️ Digite o texto'; msg.style.color='#ef4444'; return; }
      if (!dataHora) { msg.textContent='⚠️ Selecione data e hora'; msg.style.color='#ef4444'; return; }
      var sel=[]; document.querySelectorAll('#grupos-wrap input:checked').forEach(function(el){ sel.push(el.value); });
      var total=document.querySelectorAll('#grupos-wrap input').length;
      var grupos=sel.length===total?'todos':sel.join(',');
      msg.textContent='Salvando...'; msg.style.color='#6b7280';
      try {
        var resp=await fetch('/api/ofertas?action=salvar&secret=${secret}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto,imagem:document.getElementById('f-imagem').value.trim(),link:document.getElementById('f-link').value.trim(),dataHora,grupos})});
        var data=await resp.json();
        if(data.success){msg.textContent='✅ Agendada!';msg.style.color='#10b981';setTimeout(function(){window.location.reload();},1500);}
        else{msg.textContent='❌ '+(data.error||'Erro');msg.style.color='#ef4444';}
      } catch(e){msg.textContent='❌ Erro de conexão';msg.style.color='#ef4444';}
    }
    var agora=new Date();agora.setMinutes(agora.getMinutes()+5);
    var pad=function(n){return n<10?'0'+n:n;};
    var min=agora.getFullYear()+'-'+pad(agora.getMonth()+1)+'-'+pad(agora.getDate())+'T'+pad(agora.getHours())+':'+pad(agora.getMinutes());
    document.getElementById('f-data').min=min;document.getElementById('f-data').value=min;
    </script>`;
  }

  else if (paginaAtual === 'cupons') {
    conteudo = `
    <div class="vazio" style="padding:64px">
      <div style="font-size:48px;margin-bottom:16px">🎟</div>
      <div style="font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:8px">Cupons de Desconto</div>
      <div style="font-size:14px;color:#6b7280">Em breve! Aqui você poderá cadastrar cupons de % off, frete grátis e muito mais.</div>
    </div>`;
  }

  // ===== HTML FINAL =====
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kcique Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f7f8fa;color:#1a1a2e;display:flex;min-height:100vh}
.sidebar{width:220px;background:#111;color:#fff;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:10}
.sidebar-logo{padding:24px 20px;font-size:16px;font-weight:700;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px}
.sidebar-menu{flex:1;padding:16px 0}
.menu-item{display:flex;align-items:center;gap:10px;padding:12px 20px;color:#aaa;text-decoration:none;font-size:14px;font-weight:500;transition:all 0.15s;cursor:pointer;border:none;background:none;width:100%;text-align:left}
.menu-item:hover{background:#1a1a1a;color:#fff}
.menu-item.ativo{background:#1a1a1a;color:#fff;border-left:3px solid #25d366}
.menu-icon{font-size:18px;width:24px;text-align:center}
.sidebar-footer{padding:16px 20px;font-size:11px;color:#444;border-top:1px solid #222}
.main{margin-left:220px;flex:1;padding:32px}
.page-title{font-size:22px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:10px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.stat-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px}
.stat-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
.stat-value{font-size:28px;font-weight:700;margin-top:6px}
.section-title{font-size:15px;font-weight:700;margin-bottom:14px;margin-top:8px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden}
th{background:#f9f9fb;padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e8eaf0}
td{padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#f9f9fb}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;white-space:nowrap}
.btn-wpp{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#25d366;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;margin-right:4px}
.btn-del{display:inline-flex;align-items:center;padding:6px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;text-decoration:none;font-size:12px}
.vazio{text-align:center;padding:48px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}
.form-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:24px;margin-bottom:24px}
.form-title{font-size:15px;font-weight:700;margin-bottom:18px}
.field{margin-bottom:14px}
.field label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
.field input,.field textarea{width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
.field input:focus,.field textarea:focus{border-color:#25d366}
.field textarea{resize:vertical}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grupos-wrap{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.grupo-label{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid #e8eaf0;border-radius:6px;cursor:pointer;font-size:12px}
.btn-green{padding:12px 24px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.btn-green:hover{background:#1da851}
.refresh-btn{padding:8px 16px;background:#f3f4f6;border:1px solid #e8eaf0;border-radius:8px;font-size:13px;text-decoration:none;color:#374151;float:right}
@media(max-width:768px){.sidebar{width:60px}.sidebar-logo span,.menu-label,.sidebar-footer{display:none}.menu-item{padding:14px;justify-content:center}.menu-icon{width:auto}.main{margin-left:60px;padding:16px}.stats{grid-template-columns:1fr}.row-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-logo">⌚ <span>Kcique Admin</span></div>
  <div class="sidebar-menu">
    <a href="/api/admin?secret=${secret}&pagina=carrinhos" class="menu-item ${paginaAtual === 'carrinhos' ? 'ativo' : ''}">
      <span class="menu-icon">🛒</span><span class="menu-label">Carrinhos</span>
    </a>
    <a href="/api/admin?secret=${secret}&pagina=ofertas" class="menu-item ${paginaAtual === 'ofertas' ? 'ativo' : ''}">
      <span class="menu-icon">📣</span><span class="menu-label">Ofertas WhatsApp</span>
    </a>
    <a href="/api/admin?secret=${secret}&pagina=cupons" class="menu-item ${paginaAtual === 'cupons' ? 'ativo' : ''}">
      <span class="menu-icon">🎟</span><span class="menu-label">Cupons</span>
    </a>
  </div>
  <div class="sidebar-footer">Kcique Relógios</div>
</div>

<div class="main">
  <div class="page-title">
    ${ paginaAtual === 'carrinhos' ? '🛒 Carrinhos Abandonados' : paginaAtual === 'ofertas' ? '📣 Ofertas WhatsApp' : '🎟 Cupons de Desconto' }
    <a href="/api/admin?secret=${secret}&pagina=${paginaAtual}&t=${Date.now()}" class="refresh-btn">🔄 Atualizar</a>
  </div>
  ${conteudo}
</div>
</body>
</html>`);
}
