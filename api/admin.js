export default async function handler(req, res) {
  const { secret } = req.query;

  if (secret !== process.env.REPROCESSAR_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kcique Admin</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0f0f0f;display:flex;align-items:center;justify-content:center;height:100vh;color:#fff}
.login{text-align:center;background:#1a1a1a;padding:40px;border-radius:16px;border:1px solid #333;width:320px}
h1{font-size:24px;margin-bottom:8px}p{color:#888;font-size:13px;margin-bottom:24px}
input{width:100%;padding:12px 16px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:15px;outline:none;margin-bottom:12px}
input:focus{border-color:#25d366}button{width:100%;padding:12px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body><div class="login"><h1>⌚ Kcique Admin</h1><p>Painel de controle da loja</p>
<form onsubmit="window.location.href='/api/admin?secret='+document.getElementById('s').value;return false">
<input id="s" type="password" placeholder="Senha de acesso"><button type="submit">Entrar</button></form></div></body></html>`);
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // Retornar membros dos grupos (chamado via AJAX)
  if (req.query.action === 'grupos') {
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const GRUPOS_VIP = [
      {nome:'#1',id:'120363407575718083-group'},{nome:'#2',id:'120363407700341013-group'},
      {nome:'#3',id:'120363407514192649-group'},{nome:'#4',id:'120363406939167357-group'},
      {nome:'#5',id:'120363425311709688-group'},{nome:'#6',id:'120363407634566182-group'},
      {nome:'#7',id:'120363426601689014-group'},{nome:'#8',id:'120363407550597963-group'},
      {nome:'#9',id:'120363424221379294-group'},{nome:'#10',id:'120363425206908330-group'},
      {nome:'#11',id:'120363409632620470-group'},{nome:'#12',id:'120363426115032457-group'},
      {nome:'#13',id:'120363426651817338-group'},{nome:'#14',id:'120363406708968616-group'},
      {nome:'#15',id:'120363425674177408-group'},{nome:'#16',id:'120363428180805162-group'},
      {nome:'#17',id:'120363406426269657-group'},
    ];
    const resultados = [];
    let total = 0;
    await Promise.all(GRUPOS_VIP.map(async g => {
      try {
        const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-members/${g.id}`);
        const d = await r.json();
        const membros = Array.isArray(d) ? d.length : (d.participants ? d.participants.length : 0);
        total += membros;
        resultados.push({ nome: g.nome, membros });
      } catch(e) {
        resultados.push({ nome: g.nome, membros: 0 });
      }
    }));
    resultados.sort((a,b) => a.nome.localeCompare(b.nome, undefined, {numeric:true}));
    return res.status(200).json({ grupos: resultados, total });
  }

  // Deletar lead
  if (req.query.del_lead) {
    await fetch(`${KV_URL}/del/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/leads-lista/0/${req.query.del_lead}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_lead]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/admin?secret=${secret}"></head><body></body></html>`);
  }

  // Deletar oferta
  if (req.query.del_oferta) {
    await fetch(`${KV_URL}/del/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/ofertas-lista/0/${req.query.del_oferta}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify([req.query.del_oferta]) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=/api/admin?secret=${secret}#ofertas"></head><body></body></html>`);
  }

  // ===== DADOS HOME (Shopify) =====
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const inicioDia = hojeStr + 'T00:00:00-03:00';
  const fimDia = hojeStr + 'T23:59:59-03:00';
  const inicioMes = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0') + '-01T00:00:00-03:00';
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0] + 'T00:00:00-03:00';

  let vendas = { hoje: { count: 0, valor: 0 }, semana: { count: 0, valor: 0 }, mes: { count: 0, valor: 0 } };
  let topProdutos = [];
  let novosClientes = 0;
  let totalMembrosGrupos = 0;

  try {
    const [ordersHoje, ordersSemana, ordersMes, clientesHoje] = await Promise.all([
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioDia}&created_at_max=${fimDia}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioSemanaStr}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&created_at_min=${inicioMes}&limit=250&financial_status=paid`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({orders:[]})),
      fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/customers.json?created_at_min=${inicioDia}&created_at_max=${fimDia}&limit=250`, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }).then(r=>r.json()).catch(()=>({customers:[]})),
    ]);

    const calcVendas = (orders) => ({
      count: (orders||[]).length,
      valor: (orders||[]).reduce((s,o) => s + parseFloat(o.total_price||0), 0)
    });

    vendas.hoje = calcVendas(ordersHoje.orders);
    vendas.semana = calcVendas(ordersSemana.orders);
    vendas.mes = calcVendas(ordersMes.orders);
    novosClientes = (clientesHoje.customers||[]).length;

    // Top produtos do mês
    const prodContagem = {};
    (ordersMes.orders||[]).forEach(order => {
      (order.line_items||[]).forEach(item => {
        if (!prodContagem[item.title]) prodContagem[item.title] = { count: 0, valor: 0 };
        prodContagem[item.title].count += item.quantity;
        prodContagem[item.title].valor += parseFloat(item.price) * item.quantity;
      });
    });
    topProdutos = Object.entries(prodContagem).sort((a,b) => b[1].count - a[1].count).slice(0, 5);
  } catch(e) { console.error('Erro Shopify home:', e.message); }

  // Total membros grupos Z-API
  try {
    const gruposResp = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/groups`, { headers: { 'Content-Type': 'application/json' } });
    const gruposData = await gruposResp.json();
    if (Array.isArray(gruposData)) {
      const vip = gruposData.filter(g => g.name && g.name.toLowerCase().includes('kcique'));
      totalMembrosGrupos = vip.reduce((s, g) => s + (g.participants || g.membersCount || 0), 0);
    }
  } catch(e) {}

  // Carregar tudo em paralelo
  let leads = [], ofertas = [], totalValor = 0;

  const [leadsResult, ofertasLista] = await Promise.all([
    fetch(`https://infinitepay-backend.vercel.app/api/leads?secret=${secret}`).then(r => r.json()).catch(() => ({ leads: [] })),
    fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).then(r => r.json()).catch(() => ({ result: [] }))
  ]);

  try {
    leads = leadsResult.leads || [];
    leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
    totalValor = leads.reduce((s, l) => s + (l.carrinho || []).reduce((cs, i) => cs + (i.preco * i.quantidade / 100), 0), 0);
  } catch(e) {}

  try {
    const ids = ofertasLista.result || [];
    const results = await Promise.all(ids.map(id =>
      fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } })
        .then(r => r.json()).then(d => {
          if (!d.result) return null;
          let o = d.result;
          while (typeof o === 'string') { try { o = JSON.parse(o); } catch(e) { break; } }
          return (o && o.id) ? o : null;
        }).catch(() => null)
    ));
    ofertas = results.filter(Boolean).sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  } catch(e) {}

  // ===== ABA CARRINHOS =====
  const agora = new Date();
  const badgeMap = {
    'email': '<span class="badge" style="background:#f3f4f6;color:#374151">⚪ Só email</span>',
    'dados_parciais': '<span class="badge" style="background:#fef3c7;color:#92400e">🟡 Dados parciais</span>',
    'endereco': '<span class="badge" style="background:#dbeafe;color:#1e40af">🔵 Endereço</span>',
    'pagamento_pendente': '<span class="badge" style="background:#fef3c7;color:#92400e">⏳ Aguardando pagamento</span>',
    'abandonou_pagamento': '<span class="badge" style="background:#fee2e2;color:#991b1b">🔴 Abandonou pagamento</span>'
  };
  const abandonouCount = leads.filter(l => {
    let e = l.estagio;
    if (e === 'pagamento_pendente' && (l.atualizado_em || l.criado_em)) {
      if ((agora - new Date(l.atualizado_em || l.criado_em)) / 60000 >= 10) e = 'abandonou_pagamento';
    }
    return e === 'abandonou_pagamento';
  }).length;

  const leadsRows = leads.map(lead => {
    const valor = (lead.carrinho || []).reduce((s, i) => s + (i.preco * i.quantidade / 100), 0);
    const tel = (lead.telefone || '').replace(/\D/g, '');
    const produtos = (lead.carrinho || []).map(i => `<div>• ${i.nome}${i.cor && i.cor !== 'Default Title' ? ' — ' + i.cor : ''} (x${i.quantidade})</div>`).join('') || '<div style="color:#9ca3af">Sem produtos</div>';
    const data = new Date(new Date(lead.criado_em).getTime() - 3 * 60 * 60 * 1000);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const msg = encodeURIComponent(`Olá ${(lead.nome||'').split(' ')[0]}! 😊 Vi que você estava olhando nossos relógios na Kcique. Posso te ajudar?`);
    let estagio = lead.estagio;
    if (estagio === 'pagamento_pendente' && (lead.atualizado_em || lead.criado_em)) {
      if ((agora - new Date(lead.atualizado_em || lead.criado_em)) / 60000 >= 10) estagio = 'abandonou_pagamento';
    }
    return `<tr>
      <td><div style="font-weight:600">${lead.nome||'—'}</div><div style="font-size:12px;color:#6b7280">${lead.email}</div><div style="font-size:12px;color:#6b7280">${lead.telefone||'—'}</div></td>
      <td>${badgeMap[estagio]||`<span class="badge">${estagio}</span>`}</td>
      <td style="font-size:13px">${produtos}</td>
      <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong>${lead.frete?`<br><span style="font-size:11px;color:#6b7280">+ ${lead.frete.nome}</span>`:''}</td>
      <td style="font-size:12px;color:#9ca3af;white-space:nowrap">${dataStr}</td>
      <td style="white-space:nowrap">
        ${tel?`<a href="https://wa.me/55${tel}?text=${msg}" target="_blank" class="btn-wpp">💬 WPP</a>`:''}
        <a href="/api/admin?secret=${secret}&del_lead=${lead.id}" onclick="return confirm('Remover?')" class="btn-del">🗑</a>
      </td>
    </tr>`;
  }).join('');

  const abaCarrinhos = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total de Leads</div><div class="stat-value">${leads.length}</div></div>
      <div class="stat-card"><div class="stat-label">Abandonaram Pagamento</div><div class="stat-value">${abandonouCount}</div></div>
      <div class="stat-card"><div class="stat-label">Valor Potencial</div><div class="stat-value">R$ ${totalValor.toFixed(2).replace('.', ',')}</div></div>
    </div>
    ${leads.length === 0 ? '<div class="vazio">Nenhum carrinho abandonado ainda! 🎉</div>' : `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Estágio</th><th>Produtos</th><th>Valor</th><th>Data</th><th>Ação</th></tr></thead><tbody>${leadsRows}</tbody></table></div>`}`;

  // ===== ABA OFERTAS =====
  const GRUPOS_INFO = [
    {nome:'#1',id:'120363407575718083-group'},{nome:'#2',id:'120363407700341013-group'},
    {nome:'#3',id:'120363407514192649-group'},{nome:'#4',id:'120363406939167357-group'},
    {nome:'#5',id:'120363425311709688-group'},{nome:'#6',id:'120363407634566182-group'},
    {nome:'#7',id:'120363426601689014-group'},{nome:'#8',id:'120363407550597963-group'},
    {nome:'#9',id:'120363424221379294-group'},{nome:'#10',id:'120363425206908330-group'},
    {nome:'#11',id:'120363409632620470-group'},{nome:'#12',id:'120363426115032457-group'},
    {nome:'#13',id:'120363426651817338-group'},{nome:'#14',id:'120363406708968616-group'},
    {nome:'#15',id:'120363425674177408-group'},{nome:'#16',id:'120363428180805162-group'},
    {nome:'#17',id:'120363406426269657-group'},
  ];
  const gruposCheckboxes = GRUPOS_INFO.map(g => `<label class="grupo-label"><input type="checkbox" value="${g.id}" checked> ${g.nome}</label>`).join('');
  const ofertasRows = ofertas.map(o => {
    const dataStr = new Date(o.dataHora).toLocaleDateString('pt-BR') + ' ' + new Date(o.dataHora).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    const sc = o.status==='enviada'?'#10b981':o.status==='erro'?'#ef4444':'#f59e0b';
    const sl = o.status==='enviada'?'✅ Enviada':o.status==='erro'?'❌ Erro':'⏳ Agendada';
    return `<tr>
      <td>${o.imagem?`<img src="${o.imagem}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;display:block;margin-bottom:4px">`:''}
        <div style="font-weight:600;font-size:13px">${(o.texto||'').substring(0,60)}${o.texto&&o.texto.length>60?'...':''}</div>
        ${o.link?`<a href="${o.link}" target="_blank" style="font-size:11px;color:#2563eb">${o.link.substring(0,40)}</a>`:''}
      </td>
      <td style="white-space:nowrap;font-size:13px">${dataStr}</td>
      <td style="font-size:13px">${o.grupos==='todos'?'Todos (#1-#17)':o.grupos}</td>
      <td><span style="background:${sc}20;color:${sc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${sl}</span></td>
      <td><a href="/api/admin?secret=${secret}&del_oferta=${o.id}" onclick="return confirm('Remover?')" class="btn-del">🗑</a></td>
    </tr>`;
  }).join('');

  const abaOfertas = `
    <div class="stats">
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${ofertas.length}</div></div>
      <div class="stat-card"><div class="stat-label">Agendadas</div><div class="stat-value">${ofertas.filter(o=>o.status==='agendada').length}</div></div>
      <div class="stat-card"><div class="stat-label">Enviadas</div><div class="stat-value">${ofertas.filter(o=>o.status==='enviada').length}</div></div>
    </div>
    <div class="form-card">
      <div class="form-title">➕ Agendar Nova Oferta</div>
      <div class="field"><label>Texto da mensagem</label><textarea id="f-texto" rows="4" placeholder="🔥 OFERTA RELÂMPAGO!&#10;&#10;Relógio X por R$ 199,90"></textarea></div>
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
    ${ofertas.length === 0 ? '<div class="vazio">Nenhuma oferta agendada ainda!</div>' : `<div class="table-wrap"><table><thead><tr><th>Oferta</th><th>Data/Hora</th><th>Grupos</th><th>Status</th><th>Ação</th></tr></thead><tbody>${ofertasRows}</tbody></table></div>`}`;

  const abaCupons = `<div class="vazio" style="padding:64px">
    <div style="font-size:48px;margin-bottom:16px">🎟</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">Cupons de Desconto</div>
    <div style="font-size:14px;color:#6b7280">Em breve! Aqui você poderá cadastrar cupons de % off, frete grátis e muito mais.</div>
  </div>`;

  // ===== ABA HOME =====
  const abaHome = `
    <div class="stats" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card"><div class="stat-label">💰 Vendas Hoje</div><div class="stat-value">R$ ${vendas.hoje.valor.toFixed(2).replace('.',',')}</div><div style="font-size:13px;color:#6b7280;margin-top:4px">${vendas.hoje.count} pedido${vendas.hoje.count !== 1 ? 's' : ''}</div></div>
      <div class="stat-card"><div class="stat-label">📅 Esta Semana</div><div class="stat-value">R$ ${vendas.semana.valor.toFixed(2).replace('.',',')}</div><div style="font-size:13px;color:#6b7280;margin-top:4px">${vendas.semana.count} pedidos</div></div>
      <div class="stat-card"><div class="stat-label">📆 Este Mês</div><div class="stat-value">R$ ${vendas.mes.valor.toFixed(2).replace('.',',')}</div><div style="font-size:13px;color:#6b7280;margin-top:4px">${vendas.mes.count} pedidos</div></div>
      <div class="stat-card"><div class="stat-label">👥 Novos Clientes Hoje</div><div class="stat-value">${novosClientes}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
      <div class="stat-card">
        <div class="stat-label" style="margin-bottom:16px">🏆 Top Produtos do Mês</div>
        ${topProdutos.length === 0 ? '<div style="color:#9ca3af;font-size:13px">Nenhum pedido este mês</div>' : topProdutos.map(([nome, dados], i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:18px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#1a1a2e">${nome.substring(0,35)}${nome.length>35?'...':''}</div>
                <div style="font-size:12px;color:#6b7280">${dados.count} unid. — R$ ${dados.valor.toFixed(2).replace('.',',')}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="stat-card">
          <div class="stat-label" style="margin-bottom:12px">🛒 Carrinhos Abandonados</div>
          <div style="font-size:32px;font-weight:700">${leads.length}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px">Valor potencial: R$ ${totalValor.toFixed(2).replace('.',',')}</div>
          <button onclick="mudarAba('carrinhos')" style="margin-top:12px;padding:8px 16px;background:#f0f5ff;color:#2563eb;border:1px solid #2563eb;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">Ver carrinhos →</button>
        </div>
        <div class="stat-card">
          <div class="stat-label" style="margin-bottom:12px">📣 Grupos VIP WhatsApp</div>
          <div style="font-size:32px;font-weight:700">17 grupos</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px">Ofertas agendadas: ${ofertas.filter(o=>o.status==='agendada').length}</div>
          <div id="grupos-membros" style="margin-top:12px;font-size:12px;color:#6b7280">Carregando membros...</div>
          <button onclick="mudarAba('ofertas')" style="margin-top:12px;padding:8px 16px;background:#f0fff4;color:#16a34a;border:1px solid #16a34a;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">Agendar oferta →</button>
        </div>
      </div>
    </div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kcique Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f7f8fa;color:#1a1a2e;display:flex;min-height:100vh}
.sidebar{width:220px;background:#111;color:#fff;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:10}
.sidebar-logo{padding:24px 20px;font-size:16px;font-weight:700;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px}
.sidebar-menu{flex:1;padding:16px 0}
.menu-item{display:flex;align-items:center;gap:10px;padding:12px 20px;color:#aaa;font-size:14px;font-weight:500;transition:all 0.15s;cursor:pointer;border:none;background:none;width:100%;text-align:left;border-left:3px solid transparent}
.menu-item:hover{background:#1a1a1a;color:#fff}
.menu-item.ativo{background:#1a1a1a;color:#fff;border-left:3px solid #25d366}
.menu-icon{font-size:18px;width:24px;text-align:center}
.sidebar-footer{padding:16px 20px;font-size:11px;color:#444;border-top:1px solid #222}
.main{margin-left:220px;flex:1;padding:32px}
.page-title{font-size:22px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.stat-card{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:20px}
.stat-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
.stat-value{font-size:28px;font-weight:700;margin-top:6px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;border:1px solid #e8eaf0;overflow:hidden}
th{background:#f9f9fb;padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:1px solid #e8eaf0}
td{padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:top}
tr:last-child td{border-bottom:none}tr:hover td{background:#f9f9fb}
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
.refresh-btn{padding:8px 16px;background:#f3f4f6;border:1px solid #e8eaf0;border-radius:8px;font-size:13px;color:#374151;cursor:pointer;border:none}
.aba{display:none}.aba.ativa{display:block}
@media(max-width:768px){.sidebar{width:60px}.sidebar-logo span,.menu-label,.sidebar-footer{display:none}.menu-item{padding:14px;justify-content:center}.main{margin-left:60px;padding:16px}.stats{grid-template-columns:1fr}.row-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-logo">⌚ <span>Kcique Admin</span></div>
  <div class="sidebar-menu">
    <button onclick="mudarAba('home')" class="menu-item ativo" id="menu-home"><span class="menu-icon">📊</span><span class="menu-label">Visão Geral</span></button>
    <button onclick="mudarAba('carrinhos')" class="menu-item" id="menu-carrinhos"><span class="menu-icon">🛒</span><span class="menu-label">Carrinhos</span></button>
    <button onclick="mudarAba('ofertas')" class="menu-item" id="menu-ofertas"><span class="menu-icon">📣</span><span class="menu-label">Ofertas WhatsApp</span></button>
    <button onclick="mudarAba('cupons')" class="menu-item" id="menu-cupons"><span class="menu-icon">🎟</span><span class="menu-label">Cupons</span></button>
  </div>
  <div class="sidebar-footer">Kcique Relógios</div>
</div>
<div class="main">
  <div class="page-title">
    <span id="page-title">🛒 Carrinhos Abandonados</span>
    <button onclick="window.location.reload()" class="refresh-btn">🔄 Atualizar</button>
  </div>
  <div id="aba-home" class="aba ativa">${abaHome}</div>
  <div id="aba-carrinhos" class="aba">${abaCarrinhos}</div>
  <div id="aba-ofertas" class="aba">${abaOfertas}</div>
  <div id="aba-cupons" class="aba">${abaCupons}</div>
</div>
<script>
var titulos = { home: '📊 Visão Geral', carrinhos: '🛒 Carrinhos Abandonados', ofertas: '📣 Ofertas WhatsApp', cupons: '🎟 Cupons de Desconto' };
function mudarAba(aba) {
  document.querySelectorAll('.aba').forEach(function(el){ el.classList.remove('ativa'); });
  document.querySelectorAll('.menu-item').forEach(function(el){ el.classList.remove('ativo'); });
  document.getElementById('aba-' + aba).classList.add('ativa');
  document.getElementById('menu-' + aba).classList.add('ativo');
  document.getElementById('page-title').textContent = titulos[aba];
}

// Ir para aba pela hash da URL
if (window.location.hash === '#ofertas') mudarAba('ofertas');
if (window.location.hash === '#cupons') mudarAba('cupons');

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

// Carregar membros dos grupos de forma assíncrona
var GRUPOS_VIP_IDS = [
  {nome:'#1',id:'120363407575718083-group'},{nome:'#2',id:'120363407700341013-group'},
  {nome:'#3',id:'120363407514192649-group'},{nome:'#4',id:'120363406939167357-group'},
  {nome:'#5',id:'120363425311709688-group'},{nome:'#6',id:'120363407634566182-group'},
  {nome:'#7',id:'120363426601689014-group'},{nome:'#8',id:'120363407550597963-group'},
  {nome:'#9',id:'120363424221379294-group'},{nome:'#10',id:'120363425206908330-group'},
  {nome:'#11',id:'120363409632620470-group'},{nome:'#12',id:'120363426115032457-group'},
  {nome:'#13',id:'120363426651817338-group'},{nome:'#14',id:'120363406708968616-group'},
  {nome:'#15',id:'120363425674177408-group'},{nome:'#16',id:'120363428180805162-group'},
  {nome:'#17',id:'120363406426269657-group'},
];

async function carregarMembrosGrupos() {
  var el = document.getElementById('grupos-membros');
  if (!el) return;
  try {
    var resultados = [];
    var totalMembros = 0;
    var resp = await fetch('/api/admin?action=grupos&secret=${secret}');
    var data = await resp.json();
    if (data.grupos) {
      resultados = data.grupos;
      totalMembros = data.total;
    }
    el.innerHTML = '<div style="font-weight:600;color:#1a1a2e;margin-bottom:8px">Total: ' + totalMembros + ' membros</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
      resultados.map(function(g){ return '<span style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:11px">' + g.nome + ': ' + g.membros + '</span>'; }).join('') +
      '</div>';
  } catch(e) {
    el.textContent = 'Erro ao carregar membros';
  }
}

// Carregar membros quando estiver na aba home
setTimeout(carregarMembrosGrupos, 500);

// Data mínima
var agora=new Date();agora.setMinutes(agora.getMinutes()+5);
var pad=function(n){return n<10?'0'+n:n;};
var min=agora.getFullYear()+'-'+pad(agora.getMonth()+1)+'-'+pad(agora.getDate())+'T'+pad(agora.getHours())+':'+pad(agora.getMinutes());
if(document.getElementById('f-data')){document.getElementById('f-data').min=min;document.getElementById('f-data').value=min;}
</script>
</body>
</html>`);
}
