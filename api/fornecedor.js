export default async function handler(req, res) {
  const SENHA = process.env.FORNECEDOR_SECRET || 'kcique-fornecedor-2026';
  const { senha } = req.query;

  // ── STATUS: marcar pedido como enviado ──────────────────────
  if (req.query.action === 'marcar-enviado' && req.method === 'POST') {
    if (senha !== SENHA) return res.status(401).json({ erro: 'Não autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const orderId = req.body?.orderId;
    if (!orderId) return res.status(400).json({ erro: 'orderId obrigatório' });
    await fetch(`${KV_URL}/set/forn-enviado-${orderId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '1', ex: 604800 })
    });
    return res.status(200).json({ ok: true });
  }

  // ── ETIQUETA: baixar PDF do Melhor Envio ────────────────────
  if (req.query.action === 'etiqueta') {
    if (senha !== SENHA) return res.status(401).json({ erro: 'Não autorizado' });
    const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
    const PDF_SERVICE = 'https://kcique-pdf-service-production.up.railway.app';
    const PDF_SECRET = 'kcique2026';
    const email = req.query.email || '';
    const nome = req.query.nome || '';
    try {
      const pages = await Promise.all([1,2,3,4,5].map(p =>
        fetch(`https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=${p}`, {
          headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
        }).then(r => r.json()).catch(() => ({ data: [] }))
      ));
      const allOrders = pages.flatMap(p => (p.data||[]).flatMap(pu => pu.orders||[]));
      const found = allOrders.find(o => {
        const toEmail = (o.to?.email||'').toLowerCase();
        const toName = (o.to?.name||'').toLowerCase().trim();
        const cn = nome.toLowerCase().trim();
        const ce = email.toLowerCase().trim();
        return (ce && toEmail === ce) || (cn && (toName === cn || toName.includes(cn.split(' ')[0])));
      });
      if (!found) return res.status(404).json({ erro: 'Pedido não encontrado no Melhor Envio' });
      const meOrderId = found.id;
      const tracking = found.tracking || '';
      const printResp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/print', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ME_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify({ orders: [meOrderId] })
      });
      const printData = await printResp.json();
      const printUrl = printData.url || '';
      const printHash = printUrl.split('/imprimir/')[1] || meOrderId;
      const pdfResp = await fetch(`${PDF_SERVICE}/pdf/${printHash}?secret=${PDF_SECRET}`);
      if (!pdfResp.ok) throw new Error('PDF service erro: ' + pdfResp.status);
      const pdfBuf = await pdfResp.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="etiqueta-' + (tracking || meOrderId) + '.pdf"');
      res.setHeader('Content-Length', pdfBuf.byteLength);
      return res.status(200).send(Buffer.from(pdfBuf));
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ── PEDIDOS JSON ─────────────────────────────────────────────
  if (req.query.action === 'pedidos-json') {
    if (senha !== SENHA) return res.status(401).json({ erro: 'Não autorizado' });
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    try {
      const agora = new Date();
      const agoraBR = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
      const ontem = new Date(agoraBR);
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = ontem.toISOString().split('T')[0];
      const inicioOntem = ontemStr + 'T00:00:00-03:00';
      const fimOntem = ontemStr + 'T23:59:59-03:00';

      const [pedidosR, prodShopify] = await Promise.all([
        fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/orders.json?status=any&financial_status=paid&created_at_min=${inicioOntem}&created_at_max=${fimOntem}&limit=250`, {
          headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
        }).then(r => r.json()).catch(() => ({ orders: [] })),
        fetch(`https://${SHOPIFY_STORE}/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants`, {
          headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
        }).then(r => r.json()).catch(() => ({ products: [] })),
      ]);

      const prods = prodShopify.products || [];
      const variantImgMap = {};
      prods.forEach(p => {
        (p.variants||[]).forEach(v => {
          if (v.featured_image && v.featured_image.src) variantImgMap[String(v.id)] = v.featured_image.src;
          else if (v.image_id) { const img = (p.images||[]).find(i => i.id === v.image_id); if (img) variantImgMap[String(v.id)] = img.src; }
          if (!variantImgMap[String(v.id)] && p.image) variantImgMap[String(v.id)] = p.image.src;
        });
      });

      const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/  +/g,' ').trim();
      const getImg = (nome) => {
        if (!nome) return '';
        const base = nome.split(' - Cor:')[0].split(' - ')[0].trim();
        const baseNorm = norm(base);
        const modelo = (nome.match(/[A-Z]{1,5}-[0-9]{3,5}[A-Z0-9]*/i)||[])[0];
        const modeloUp = modelo ? modelo.toUpperCase() : '';
        const corMatch = nome.match(/Cor:([^-]+)/i);
        const corTitulo = corMatch ? norm(corMatch[1]) : '';
        let melhor = null, melhorPts = 0;
        for (const p of prods) {
          const pt = norm(p.title);
          let pts = 0;
          if (pt === baseNorm) pts = 200;
          else if (modeloUp && p.title.toUpperCase().includes(modeloUp)) pts = 100;
          else if (pt.includes(baseNorm) || baseNorm.includes(pt)) pts = 50;
          else pts = baseNorm.split(' ').filter(w=>w.length>2).filter(w=>pt.includes(w)).length * 10;
          if (pts > melhorPts) { melhorPts = pts; melhor = p; }
        }
        if (!melhor) return '';
        if (corTitulo) {
          const vi = v => {
            if (v.featured_image && v.featured_image.src) return v.featured_image.src;
            if (v.image_id) { const i = (melhor.images||[]).find(i=>i.id===v.image_id); if(i) return i.src; }
            return '';
          };
          const vv = melhor.variants || [];
          const exato = vv.find(v => norm(v.title) === corTitulo);
          if (exato) { const i = vi(exato); if (i) return i; }
          const porLen = [...vv].sort((a,b) => b.title.length - a.title.length);
          const contido = porLen.find(v => { const vt=norm(v.title); return corTitulo===vt||corTitulo.startsWith(vt+' ')||corTitulo.endsWith(' '+vt); });
          if (contido) { const i = vi(contido); if (i) return i; }
          const best = porLen.find(v => { const pw=norm(v.title).split(' ').filter(w=>w.length>2); return pw.length>0&&pw.every(w=>corTitulo.includes(w)); });
          if (best) { const i = vi(best); if (i) return i; }
        }
        return melhor.image ? melhor.image.src : '';
      };

      // Buscar status enviado no Redis
      const ids = (pedidosR.orders||[]).map(o => 'forn-enviado-' + o.id);
      let enviadosSet = new Set();
      if (ids.length) {
        const pipeline = ids.map(k => ['GET', k]);
        const kvResp = await fetch(`${KV_URL}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(pipeline)
        }).then(r => r.json()).catch(() => []);
        ids.forEach((k, i) => { if (kvResp[i] && kvResp[i].result) enviadosSet.add(k); });
      }

      const pedidos = (pedidosR.orders||[]).map(o => ({
        id: o.id,
        numero: o.order_number,
        nome: o.customer ? ((o.customer.first_name||'') + ' ' + (o.customer.last_name||'')).trim() : 'Cliente',
        email: o.customer ? (o.customer.email||o.email||'') : (o.email||''),
        telefone: (o.shipping_address ? o.shipping_address.phone : '') || (o.billing_address ? o.billing_address.phone : '') || (o.customer ? o.customer.phone : '') || '',
        endereco: o.shipping_address ? (o.shipping_address.address1||'') + ', ' + (o.shipping_address.city||'') + ' - ' + (o.shipping_address.province_code||'') + ', CEP ' + (o.shipping_address.zip||'') : '',
        fulfillment: o.fulfillment_status || 'unfulfilled',
        tracking: o.fulfillments && o.fulfillments[0] ? (o.fulfillments[0].tracking_number||'') : '',
        enviado_fornecedor: enviadosSet.has('forn-enviado-' + o.id),
        criado_em: o.created_at,
        itens: (o.line_items||[]).map(i => ({
          nome: i.title,
          variante: i.variant_title || '',
          quantidade: i.quantity,
          preco: i.price,
          img: (i.image && i.image.src) ? i.image.src : getImg(i.title)
        })),
      }));

      return res.status(200).json({ pedidos, data: ontemStr, total: pedidos.length });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ── PÁGINA HTML ───────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const senhaOk = senha === SENHA;
  const senhaEsc = JSON.stringify(senha || '');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kcique — Pedidos Fornecedor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f8fa;color:#1a1a2e;min-height:100vh}
.header{background:#111;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px}
.header h1{font-size:17px;font-weight:700;flex:1}
.header span.data{font-size:12px;color:#999}
.content{padding:24px;max-width:900px;margin:0 auto}
.login-box{max-width:360px;margin:80px auto;background:#fff;border-radius:16px;border:1px solid #e8eaf0;padding:40px;text-align:center}
.login-box h2{font-size:20px;margin-bottom:8px}
.login-box p{color:#6b7280;font-size:13px;margin-bottom:24px}
input[type=password]{width:100%;padding:12px 16px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;margin-bottom:12px}
input[type=password]:focus{border-color:#111}
.btn-login{width:100%;padding:13px;background:#111;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
.stat{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
.stat-num{font-size:32px;font-weight:800;color:#111}
.stat-label{font-size:13px;color:#6b7280}
.pedido{background:#fff;border-radius:12px;border:1px solid #e8eaf0;margin-bottom:10px;overflow:hidden}
.pedido-header{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;user-select:none}
.pedido-header:hover{background:#fafafa}
.pedido-num{font-weight:800;font-size:15px;color:#111}
.pedido-nome{font-size:14px;color:#374151;flex:1}
.badge{display:inline-flex;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.badge-ok{background:#dcfce7;color:#16a34a}
.badge-pend{background:#fef3c7;color:#92400e}
.badge-forn{background:#dbeafe;color:#1e40af}
.pedido-body{display:none;padding:20px;border-top:1px solid #f3f4f6}
.pedido-body.open{display:block}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.info-card{background:#f9fafb;border-radius:8px;padding:12px}
.info-label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.info-val{font-size:13px;font-weight:600;word-break:break-word}
.item{display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f3f4f6}
.item:last-child{border-bottom:none}
.item img{width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.item-icon{width:90px;height:90px;background:#f3f4f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:36px}
.item-nome{font-size:14px;font-weight:700;line-height:1.4}
.item-var{font-size:12px;color:#6b7280;background:#f3f4f6;display:inline-block;padding:2px 8px;border-radius:20px;margin-top:4px}
.item-qtd{font-size:13px;color:#374151;font-weight:600;margin-top:6px}
.tracking-box{background:#f0f9ff;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;color:#1e40af;margin-bottom:12px}
.btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
.btn-etiqueta{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.btn-etiqueta:hover{background:#333}
.btn-etiqueta:disabled{opacity:.5;cursor:not-allowed}
.btn-enviado{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;background:#fff;color:#16a34a;border:2px solid #16a34a;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.btn-enviado:hover{background:#f0fff4}
.btn-enviado.done{background:#dcfce7;border-color:#16a34a;cursor:default}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out}
.overlay.on{display:flex}
.overlay img{max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;cursor:default}
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{text-align:center;padding:60px;color:#9ca3af}
.vazio{text-align:center;padding:60px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}
</style>
</head>
<body>
<div class="header">
  <span>⌚</span>
  <h1>Kcique Relógios — Pedidos para Separar</h1>
  <span class="data" id="data-label"></span>
</div>

${senhaOk ? '<div class="content" id="app"><div class="loading">⏳ Carregando pedidos...</div></div>' : `<div class="content"><div class="login-box">
  <h2>🔒 Acesso Restrito</h2>
  <p>Digite a senha para acessar os pedidos</p>
  <form onsubmit="entrar(event)">
    <input type="password" id="inp-senha" placeholder="Senha" autofocus>
    <button class="btn-login" type="submit">Entrar</button>
  </form>
  <div id="msg-erro" style="color:#ef4444;font-size:13px;margin-top:10px"></div>
</div></div>`}

<div class="overlay" id="overlay" onclick="fecharFoto()">
  <img id="overlay-img" src="" onclick="event.stopPropagation()">
</div>

<script>
var SENHA = ${senhaEsc};
var API = '/api/fornecedor';

function entrar(e) {
  e.preventDefault();
  var s = document.getElementById('inp-senha').value;
  if (!s) return;
  window.location.href = API + '?senha=' + encodeURIComponent(s);
}

function abrirFoto(src) {
  document.getElementById('overlay-img').src = src;
  document.getElementById('overlay').classList.add('on');
}
function fecharFoto() { document.getElementById('overlay').classList.remove('on'); }
document.addEventListener('keydown', function(e) { if(e.key==='Escape') fecharFoto(); });

function togglePedido(id) {
  var body = document.getElementById('body-' + id);
  if (body) body.classList.toggle('open');
}

async function baixarEtiqueta(btn, nome, email) {
  btn.disabled = true;
  var orig = btn.innerHTML;
  btn.innerHTML = '<span class="spin"></span> Buscando...';
  try {
    var url = API + '?senha=' + encodeURIComponent(SENHA) + '&action=etiqueta&nome=' + encodeURIComponent(nome) + '&email=' + encodeURIComponent(email);
    var r = await fetch(url);
    if (!r.ok) {
      var d = await r.json().catch(function(){return {};});
      alert('Erro: ' + (d.erro || r.status));
      btn.disabled = false; btn.innerHTML = orig; return;
    }
    var blob = await r.blob();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'etiqueta-' + nome.split(' ')[0] + '.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    btn.innerHTML = '✅ Baixado!';
    setTimeout(function(){ btn.disabled=false; btn.innerHTML=orig; }, 3000);
  } catch(e) {
    alert('Erro: ' + e.message);
    btn.disabled = false; btn.innerHTML = orig;
  }
}

async function marcarEnviado(btn, orderId) {
  btn.disabled = true;
  var orig = btn.innerHTML;
  btn.innerHTML = '<span class="spin"></span>';
  try {
    var r = await fetch(API + '?senha=' + encodeURIComponent(SENHA) + '&action=marcar-enviado', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ orderId: orderId })
    });
    var d = await r.json();
    if (d.ok) {
      btn.innerHTML = '✅ Marcado como enviado';
      btn.classList.add('done');
      var badge = document.getElementById('badge-' + orderId);
      if (badge) { badge.className = 'badge badge-forn'; badge.textContent = '📦 Enviado pelo fornecedor'; }
    } else {
      btn.disabled = false; btn.innerHTML = orig;
    }
  } catch(e) {
    btn.disabled = false; btn.innerHTML = orig;
  }
}

async function carregarPedidos() {
  if (!SENHA) return;
  var app = document.getElementById('app');
  if (!app) return;
  try {
    var r = await fetch(API + '?senha=' + encodeURIComponent(SENHA) + '&action=pedidos-json');
    var d = await r.json();
    if (!r.ok || d.erro) { app.innerHTML = '<div class="vazio">Erro: ' + (d.erro||'acesso negado') + '</div>'; return; }

    var pedidos = d.pedidos || [];
    var dataOntem = d.data || '';
    var labelEl = document.getElementById('data-label');
    if (labelEl && dataOntem) {
      var partes = dataOntem.split('-');
      labelEl.textContent = 'Pedidos de ' + partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    if (!pedidos.length) { app.innerHTML = '<div class="vazio">Nenhum pedido ontem 🎉</div>'; return; }

    var html = '<div class="stat"><div><div class="stat-num">' + pedidos.length + '</div><div class="stat-label">pedidos de ontem para separar</div></div></div>';

    pedidos.forEach(function(p) {
      var foiEnviado = p.enviado_fornecedor || p.fulfillment === 'fulfilled';
      var badgeHtml = foiEnviado
        ? '<span class="badge badge-forn" id="badge-' + p.id + '">📦 Enviado</span>'
        : '<span class="badge badge-pend" id="badge-' + p.id + '">⏳ Pendente</span>';

      html += '<div class="pedido">';
      html += '<div class="pedido-header" onclick="togglePedido(' + p.id + ')">';
      html += '<span class="pedido-num">#' + p.numero + '</span>';
      html += badgeHtml;
      html += '<span class="pedido-nome">' + p.nome + '</span>';
      html += '<span style="color:#9ca3af;font-size:12px">▼</span>';
      html += '</div>';
      html += '<div class="pedido-body" id="body-' + p.id + '">';

      html += '<div class="info-grid">';
      html += '<div class="info-card"><div class="info-label">Cliente</div><div class="info-val">' + p.nome + '</div></div>';
      html += '<div class="info-card"><div class="info-label">Telefone</div><div class="info-val">' + (p.telefone ? '+55 ' + p.telefone.replace(/\D/g,'') : '—') + '</div></div>';
      html += '<div class="info-card" style="grid-column:span 2"><div class="info-label">Endereço de Entrega</div><div class="info-val">' + (p.endereco||'—') + '</div></div>';
      html += '</div>';

      if (p.tracking) {
        html += '<div class="tracking-box">📦 Rastreio: ' + p.tracking + '</div>';
      }

      html += '<div style="margin-bottom:16px">';
      (p.itens||[]).forEach(function(it) {
        html += '<div class="item">';
        if (it.img) {
          html += '<img src="' + it.img + '" onclick="abrirFoto(this.src)" alt="foto">';
        } else {
          html += '<div class="item-icon">⌚</div>';
        }
        html += '<div style="flex:1">';
        html += '<div class="item-nome">' + it.nome + '</div>';
        if (it.variante && it.variante !== 'Default Title') {
          html += '<div class="item-var">' + it.variante + '</div>';
        }
        html += '<div class="item-qtd">Quantidade: <strong>' + it.quantidade + '</strong></div>';
        html += '</div></div>';
      });
      html += '</div>';

      html += '<div class="btn-row">';
      html += '<button class="btn-etiqueta" onclick="baixarEtiqueta(this,' + JSON.stringify(p.nome) + ',' + JSON.stringify(p.email) + ')">📄 Baixar Etiqueta</button>';
      if (!foiEnviado) {
        html += '<button class="btn-enviado" onclick="marcarEnviado(this,' + JSON.stringify(String(p.id)) + ')">✅ Marcar como Enviado</button>';
      } else {
        html += '<button class="btn-enviado done" disabled>✅ Marcado como Enviado</button>';
      }
      html += '</div>';
      html += '</div></div>';
    });

    app.innerHTML = html;
  } catch(e) {
    if (app) app.innerHTML = '<div class="vazio">Erro: ' + e.message + '</div>';
  }
}

${senhaOk ? 'carregarPedidos();' : ''}
</script>
</body>
</html>`;

  return res.status(200).send(html);
}
