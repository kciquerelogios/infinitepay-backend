export default async function handler(req, res) {
  const { secret } = req.query;
  if (secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).send(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f7f8fa">
        <div style="text-align:center">
          <h2>🔒 Acesso Restrito</h2>
          <form onsubmit="window.location.href='/api/dashboard?secret='+document.getElementById('s').value;return false" style="margin-top:20px">
            <input id="s" type="password" placeholder="Senha" style="padding:10px;border:1px solid #ddd;border-radius:8px;font-size:15px">
            <button type="submit" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;margin-left:8px;font-size:15px;cursor:pointer">Entrar</button>
          </form>
        </div>
      </body></html>
    `);
  }

  // Deletar lead se solicitado
  if (req.query.del) {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const delId = req.query.del;

    // Deletar o lead
    await fetch(`${KV_URL}/del/${delId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    // Remover da lista
    await fetch(`${KV_URL}/lrem/leads-lista/0/${delId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    return res.redirect(`/api/dashboard?secret=${secret}`);
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  let leads = [];
  try {
    const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/200`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const listaData = await listaResp.json();
    const idsRaw = listaData.result || [];

    // Normalizar IDs — Upstash retorna {"value":"lead-xxx"}
    const ids = idsRaw.map(i => {
      if (typeof i === 'string') {
        try {
          const p = JSON.parse(i);
          return p.value || i;
        } catch(e) { return i; }
      }
      return i.value || i;
    });

    const idsVistos = [];
    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const d = await r.json();
        if (!d.result) continue;

        let parsed = d.result;
        // Desencapsular todos os níveis de JSON string
        for (let i = 0; i < 5; i++) {
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch(e) { break; }
          } else if (parsed && typeof parsed === 'object' && parsed.value !== undefined) {
            parsed = parsed.value;
          } else {
            break;
          }
        }

        if (!parsed || !parsed.email) continue;
        if (idsVistos.includes(parsed.id)) continue;
        idsVistos.push(parsed.id);

        // Verificar leads pagamento_pendente com mais de 10 minutos → marcar como abandonou
        if (parsed.estagio === 'pagamento_pendente' && parsed.atualizado_em) {
          const minutos = (new Date() - new Date(parsed.atualizado_em)) / 1000 / 60;
          if (minutos >= 10) {
            parsed.estagio = 'abandonou_pagamento';
            parsed.atualizado_em = new Date().toISOString();
            await fetch(`${KV_URL}/set/${id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: JSON.stringify(parsed), ex: 604800 })
            });
          }
        }

        leads.push(parsed);
      } catch(e) {}
    }

    leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
  } catch(e) {}

  const totalValor = leads.reduce((s, l) => {
    return s + (l.carrinho || []).reduce((cs, i) => cs + (i.preco * i.quantidade / 100), 0);
  }, 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard — Carrinhos Abandonados</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #f7f8fa; color: #1a1a2e; }
  
  .header {
    background: #111;
    color: #fff;
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header-sub { font-size: 13px; color: #aaa; margin-top: 4px; }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 24px 32px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .stat-card {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e8eaf0;
    padding: 20px;
  }
  .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-top: 6px; }

  .container { max-width: 1200px; margin: 0 auto; padding: 0 32px 32px; }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-refresh {
    padding: 8px 16px;
    background: #f3f4f6;
    border: 1px solid #e8eaf0;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    text-decoration: none;
    color: #374151;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e8eaf0;
    overflow: hidden;
  }

  th {
    background: #f9f9fb;
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e8eaf0;
  }

  td {
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 14px;
    vertical-align: top;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f9f9fb; }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .badge-dados { background: #fef3c7; color: #92400e; }
  .badge-pagamento { background: #fee2e2; color: #991b1b; }

  .btn-wpp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #25d366;
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .btn-del {
    display: inline-flex;
    align-items: center;
    padding: 8px;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    cursor: pointer;
    margin-left: 6px;
    text-decoration: none;
  }

  .produtos-lista { font-size: 13px; color: #374151; line-height: 1.6; }
  .nome { font-weight: 600; color: #1a1a2e; }
  .email { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .tel { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .data { font-size: 12px; color: #9ca3af; }

  .vazio {
    text-align: center;
    padding: 48px;
    color: #9ca3af;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e8eaf0;
  }

  @media (max-width: 768px) {
    .stats { grid-template-columns: 1fr; padding: 16px; }
    .container { padding: 0 16px 32px; }
    .header { padding: 16px; }
    table { font-size: 12px; }
    th, td { padding: 8px 10px; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🛒 Carrinhos Abandonados</h1>
    <div class="header-sub">Kcique Relógios — Dashboard de Leads</div>
  </div>
  <a href="/api/dashboard?secret=${secret}" class="btn-refresh">🔄 Atualizar</a>
</div>

<div class="stats">
  <div class="stat-card">
    <div class="stat-label">Total de Leads</div>
    <div class="stat-value">${leads.length}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Abandonaram no Pagamento</div>
    <div class="stat-value">${leads.filter(l => l.estagio === 'pagamento').length}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Valor Potencial</div>
    <div class="stat-value">R$ ${totalValor.toFixed(2).replace('.', ',')}</div>
  </div>
</div>

<div class="container">
  <div class="section-title">
    <span>Leads Recentes</span>
  </div>

  ${leads.length === 0 ? '<div class="vazio">Nenhum carrinho abandonado ainda! 🎉</div>' : `
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Estágio</th>
        <th>Produtos</th>
        <th>Valor</th>
        <th>Data</th>
        <th>Ação</th>
      </tr>
    </thead>
    <tbody>
      ${leads.map(lead => {
        const valor = (lead.carrinho || []).reduce((s, i) => s + (i.preco * i.quantidade / 100), 0);
        const telefone = (lead.telefone || '').replace(/\D/g, '');
        const produtos = (lead.carrinho || []).map(i =>
          `<div>• ${i.nome}${i.cor && i.cor !== 'Default Title' ? ' — ' + i.cor : ''} (x${i.quantidade}) — R$ ${(i.preco * i.quantidade / 100).toFixed(2).replace('.', ',')}</div>`
        ).join('') || '<div style="color:#9ca3af">Sem produtos</div>';

        const data = new Date(lead.criado_em);
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const msg = encodeURIComponent(
          `Olá ${(lead.nome || '').split(' ')[0]}! 😊 Vi que você estava olhando nossos relógios na Kcique e gostaria de te ajudar a finalizar sua compra. Posso te ajudar?`
        );

        const badges = {
          'email': '<span class="badge" style="background:#f3f4f6;color:#374151">⚪ Só email</span>',
          'dados_parciais': '<span class="badge badge-dados">🟡 Dados parciais</span>',
          'endereco': '<span class="badge" style="background:#dbeafe;color:#1e40af">🔵 Preencheu endereço</span>',
          'pagamento_pendente': '<span class="badge" style="background:#fef3c7;color:#92400e">⏳ Aguardando pagamento</span>',
          'abandonou_pagamento': '<span class="badge badge-pagamento">🔴 Abandonou no pagamento</span>',
          'pagamento': '<span class="badge badge-pagamento">🔴 Abandonou no pagamento</span>'
        };
        const badge = badges[lead.estagio] || '<span class="badge badge-dados">🟡 ' + (lead.estagio || 'dados') + '</span>';
        
        const enderecoStr = lead.rua ? 
          `${lead.rua}${lead.numero ? ', ' + lead.numero : ''}${lead.complemento ? ' ' + lead.complemento : ''} — ${lead.bairro || ''} — ${lead.cidade || ''}/${lead.estado || ''} — CEP: ${lead.cep || ''}` 
          : '';

        return `<tr>
          <td>
            <div class="nome">${lead.nome || '—'}</div>
            <div class="email">${lead.email}</div>
            <div class="tel">${lead.telefone || '—'}</div>
            ${enderecoStr ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px">${enderecoStr}</div>` : ''}
          </td>
          <td>${badge}</td>
          <td><div class="produtos-lista">${produtos}</div></td>
          <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong>${lead.frete ? '<br><span style="font-size:11px;color:#6b7280">+ frete ' + lead.frete.nome + '</span>' : ''}</td>
          <td><div class="data">${dataStr}</div></td>
          <td style="white-space:nowrap">
            ${telefone ? `<a href="https://wa.me/55${telefone}?text=${msg}" target="_blank" class="btn-wpp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.553 4.122 1.522 5.862L.057 23.57a.5.5 0 00.614.612l5.807-1.524A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.856 9.856 0 01-5.031-1.378l-.36-.214-3.733.979.997-3.648-.235-.374A9.856 9.856 0 012.118 12C2.118 6.52 6.52 2.118 12 2.118S21.882 6.52 21.882 12 17.48 21.882 12 21.882z"/></svg>
              WhatsApp
            </a>` : '<span style="font-size:12px;color:#9ca3af">Sem telefone</span>'}
            <a href="/api/dashboard?secret=${secret}&del=${lead.id}" class="btn-del" title="Remover" onclick="return confirm('Remover este lead?')">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
            </a>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`}
</div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
