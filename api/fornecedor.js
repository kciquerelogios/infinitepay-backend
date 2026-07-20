export default async function handler(req, res) {
  const SENHA_CORRETA = process.env.FORNECEDOR_SECRET || 'kcique-fornecedor-2026';
  const senha = req.query.senha || '';
  const action = req.query.action || '';

  // ── UPLOAD FOTO ──────────────────────────────────────────────
  if (action === 'upload-foto' && req.method === 'POST') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;
    const orderId = (req.body && req.body.orderId) || '';
    const fotoBase64 = (req.body && req.body.foto) || '';
    if (!orderId || !fotoBase64) return res.status(400).json({ erro: 'orderId e foto obrigatorios' });
    if (!CLOUD_NAME || !UPLOAD_PRESET) return res.status(500).json({ erro: 'Cloudinary nao configurado. Adicione CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET no Vercel.' });
    try {
      // Upload via FormData (mais confiável que JSON)
      const formData = new FormData();
      formData.append('file', fotoBase64);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'kcique-pedidos');
      formData.append('public_id', 'pedido_' + orderId + '_' + Date.now());
      const cloudResp = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', {
        method: 'POST',
        body: formData
      });
      const cloudData = await cloudResp.json();
      if (!cloudData.secure_url) {
        const msg = (cloudData.error && cloudData.error.message) || JSON.stringify(cloudData);
        console.error('Cloudinary error:', JSON.stringify(cloudData));
        console.error('CLOUD_NAME:', CLOUD_NAME, 'UPLOAD_PRESET:', UPLOAD_PRESET);
        console.error('foto preview:', fotoBase64 ? fotoBase64.substring(0,50) : 'empty');
        return res.status(500).json({ erro: 'Cloudinary: ' + msg, debug: { cloud: CLOUD_NAME, preset: UPLOAD_PRESET, fotoInicio: fotoBase64 ? fotoBase64.substring(0,30) : 'vazio' } });
      }
      const fotoUrl = cloudData.secure_url;
      await fetch(KV_URL + '/pipeline', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify([['LPUSH', 'forn-fotos-' + orderId, fotoUrl]])
      });
      return res.status(200).json({ ok: true, url: fotoUrl });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ── EXCLUIR FOTO ─────────────────────────────────────────────
  if (action === 'excluir-foto' && req.method === 'POST') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const orderId = (req.body && req.body.orderId) || '';
    const url = (req.body && req.body.url) || '';
    if (!orderId || !url) return res.status(400).json({ erro: 'Parametros faltando' });
    await fetch(KV_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([['LREM', 'forn-fotos-' + orderId, '0', url]])
    }).catch(function(){});
    return res.status(200).json({ ok: true });
  }

  // ── LISTAR FOTOS ──────────────────────────────────────────────
  if (action === 'fotos' && req.method === 'GET') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const orderId = req.query.orderId || '';
    if (!orderId) return res.status(400).json({ erro: 'orderId obrigatorio' });
    const r = await fetch(KV_URL + '/lrange/forn-fotos-' + orderId + '/0/-1', {
      headers: { Authorization: 'Bearer ' + KV_TOKEN }
    }).then(function(r){return r.json();}).catch(function(){return {result:[]};});
    return res.status(200).json({ fotos: r.result || [] });
  }

  // ── MARCAR ENVIADO ───────────────────────────────────────────
  if (action === 'set-status' && req.method === 'POST') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const orderId = (req.body && req.body.orderId) || '';
    const status = (req.body && req.body.status) || 'nao_enviado';
    if (!orderId) return res.status(400).json({ erro: 'orderId obrigatorio' });
    await fetch(KV_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', 'forn-status-' + orderId, String(status)]])
    }).catch(function(){});
    return res.status(200).json({ ok: true });
  }

  // ── ETIQUETA: recebe meOrderId direto, sem busca ─────────────
  if (action === 'etiqueta') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
    const meOrderId = req.query.meOrderId || '';
    const tracking = req.query.tracking || meOrderId;
    if (!meOrderId) return res.status(400).json({ erro: 'meOrderId obrigatorio' });
    try {
      // Tentar Railway PDF
      const printResp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/print', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
        body: JSON.stringify({ orders: [meOrderId] })
      });
      const printData = await printResp.json();
      const printHash = ((printData.url || '').split('/imprimir/')[1]) || meOrderId;
      const pdfResp = await fetch('https://kcique-pdf-service-production.up.railway.app/pdf/' + printHash + '?secret=kcique2026');
      if (pdfResp.ok) {
        const pdfBuf = await pdfResp.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="etiqueta-' + tracking + '.pdf"');

  return res.status(200).send(Buffer.from(pdfBuf));
      }
    } catch(e) { console.log('Railway falhou:', e.message); }
    // Fallback S3
    try {
      const s3Resp = await fetch('https://melhorenvio.com.br/api/v2/me/imprimir/pdf/' + meOrderId, {
        headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
      });
      const s3Data = await s3Resp.json();
      const s3Urls = Array.isArray(s3Data) ? s3Data : [];
      if (s3Urls.length > 0) {
        // Baixar o PDF no servidor e repassar (evita CORS no browser)
        const s3Download = await fetch(s3Urls[0]);
        if (s3Download.ok) {
          const s3Buf = await s3Download.arrayBuffer();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename="etiqueta-' + tracking + '.pdf"');
          return res.status(200).send(Buffer.from(s3Buf));
        }
      }
    } catch(e) {}
    return res.status(404).json({ erro: 'Etiqueta nao disponivel. Gere no Melhor Envio primeiro.' });
  }

  // ── PEDIDOS JSON ─────────────────────────────────────────────
  if (action === 'pedidos-json') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Nao autorizado' });
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    try {
      const agoraBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
      // Usar data passada pelo cliente, ou ontem como padrão
      let dataStr = req.query.data || '';
      if (!dataStr || !/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        const ontem = new Date(agoraBR); ontem.setDate(ontem.getDate() - 1);
        dataStr = ontem.toISOString().split('T')[0];
      }
      const ontemStr = dataStr;

      const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
      const [pedidosResp, prodResp, meResp] = await Promise.all([
        fetch('https://' + SHOPIFY_STORE + '/admin/api/2026-04/orders.json?status=any&financial_status=paid&created_at_min=' + ontemStr + 'T00:00:00-03:00&created_at_max=' + ontemStr + 'T23:59:59-03:00&limit=250',
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        ).then(function(r){return r.json();}).catch(function(){return {orders:[]};}),
        fetch('https://' + SHOPIFY_STORE + '/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants',
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        ).then(function(r){return r.json();}).catch(function(){return {products:[]};}),
        Promise.all([1,2].map(function(p) {
          return fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + p, {
            headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
          }).then(function(r){return r.json();}).catch(function(){return {data:[]};});
        }))
      ]);

      const prods = prodResp.products || [];
      const meOrders = [].concat.apply([], (Array.isArray(meResp) ? meResp : []).map(function(p) {
        return [].concat.apply([], (p.data||[]).map(function(pu){return pu.orders||[];}));
      }));

      function norm(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/  +/g,' ').trim(); }
      function getImg(nome) {
        if (!nome) return '';
        var bn = norm(nome.split(' - Cor:')[0].trim()); // título completo antes da cor
        var mm = nome.match(/[A-Z]{1,5}-[0-9]{3,5}[A-Z0-9]*/i);
        var modelo = mm ? mm[0].toUpperCase() : '';
        var cm = nome.match(/Cor:([^-]+)/i);
        var cor = cm ? norm(cm[1]) : '';
        var best = null, bestPts = 0;
        for (var i=0;i<prods.length;i++) {
          var p=prods[i]; var pt=norm(p.title); var pts=0;
          if(pt===bn) pts=200;
          else if(modelo&&p.title.toUpperCase().indexOf(modelo)>=0) pts=100;
          else if(pt.indexOf(bn)>=0||bn.indexOf(pt)>=0) pts=50;
          if(pts>bestPts){bestPts=pts;best=p;}
        }
        if(!best) return '';
        if(cor&&best.variants){
          var vv=best.variants; var ii=best.images||[];
          function vi(v){if(v.featured_image&&v.featured_image.src)return v.featured_image.src;if(v.image_id){for(var j=0;j<ii.length;j++)if(ii[j].id===v.image_id)return ii[j].src;}return '';}
          for(var k=0;k<vv.length;k++)if(norm(vv[k].title)===cor){var s=vi(vv[k]);if(s)return s;}
          var sorted=vv.slice().sort(function(a,b){return b.title.length-a.title.length;});
          for(var k=0;k<sorted.length;k++){var vt=norm(sorted[k].title);if(cor===vt||cor.indexOf(vt+' ')===0){var s=vi(sorted[k]);if(s)return s;}}
        }
        return best.image?best.image.src:'';
      }

      var orders = pedidosResp.orders || [];
      var statusKeys = orders.map(function(o){return 'forn-status-'+o.id;});
      var statusMap = {};
      if (statusKeys.length > 0) {
        var kvR = await fetch(KV_URL + '/pipeline', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify(statusKeys.map(function(k){return ['GET',k];}))
        }).then(function(r){return r.json();}).catch(function(){return [];});
        statusKeys.forEach(function(k,i){
          if(kvR[i]&&kvR[i].result) {
            var v = kvR[i].result;
            if (typeof v === 'object' && v.value) v = v.value;
            try { var p2 = JSON.parse(v); if (typeof p2 === 'string') v = p2; } catch(e) {}
            statusMap[k] = v;
          }
        });
      }

      var pedidos = orders.map(function(o) {
        var addr = o.shipping_address;
        var tel = (addr&&addr.phone)||(o.billing_address&&o.billing_address.phone)||(o.customer&&o.customer.phone)||'';
        var email = (o.customer&&o.customer.email)||o.email||'';
        // Encontrar meOrderId pelo email do cliente
        var meOrder = meOrders.find(function(mo){
          return ((mo.to&&mo.to.email)||'').toLowerCase() === email.toLowerCase();
        });
        return {
          id: o.id, numero: o.order_number,
          nome: o.customer?((o.customer.first_name||'')+' '+(o.customer.last_name||'')).trim():'Cliente',
          email: email,
          telefone: tel.replace(/\D/g,''),
          endereco: addr?(addr.address1||'')+', '+(addr.city||'')+'-'+(addr.province_code||'')+' CEP '+(addr.zip||''):'',
          fulfillment: o.fulfillment_status||'unfulfilled',
          tracking: (o.fulfillments&&o.fulfillments[0]&&o.fulfillments[0].tracking_number)||( meOrder&&meOrder.tracking)||'',
          meOrderId: meOrder?String(meOrder.id):'',
          status_forn: statusMap['forn-status-'+o.id] || 'nao_enviado',

          criado_em: o.created_at,
          itens: (o.line_items||[]).map(function(i){return {
            nome:i.title, variante:i.variant_title||'', quantidade:i.quantity,
            img:(i.image&&i.image.src)||getImg(i.title)
          };})
        };
      });
      return res.status(200).json({ pedidos:pedidos, data:ontemStr, total:pedidos.length });
    } catch(e) { return res.status(500).json({ erro: e.message }); }
  }

  // ── HTML ──────────────────────────────────────────────────────
  const senhaOk = senha === SENHA_CORRETA;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const CSS = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f7f8fa;min-height:100vh}.hd{background:#111;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:10px}.hd h1{font-size:16px;font-weight:700;flex:1}.hd .dt{font-size:12px;color:#999}.ct{padding:20px;max-width:900px;margin:0 auto}.lb{max-width:340px;margin:80px auto;background:#fff;border-radius:16px;border:1px solid #e8eaf0;padding:40px;text-align:center}.lb h2{font-size:20px;margin-bottom:8px}.lb p{color:#6b7280;font-size:13px;margin-bottom:20px}input[type=password]{width:100%;padding:12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;margin-bottom:12px}input:focus{border-color:#111}.bl{width:100%;padding:13px;background:#111;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}.st{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:16px 20px;margin-bottom:20px}.sn{font-size:32px;font-weight:800}.sl{font-size:13px;color:#6b7280}.pd{background:#fff;border-radius:12px;border:1px solid #e8eaf0;margin-bottom:10px;overflow:hidden}.ph{display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;user-select:none}.ph:hover{background:#fafafa}.pn{font-weight:800;font-size:15px}.pm{font-size:14px;flex:1}.bg{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}.bok{background:#dcfce7;color:#16a34a}.bpd{background:#fef3c7;color:#92400e}.bfn{background:#dbeafe;color:#1e40af}.pb{display:none;padding:20px;border-top:1px solid #f3f4f6}.pb.op{display:block}.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.ic{background:#f9fafb;border-radius:8px;padding:12px}.il{font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px}.iv{font-size:13px;font-weight:600;word-break:break-word}.it{display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f3f4f6}.it:last-child{border-bottom:none}.it img{width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,.1)}.ii{width:90px;height:90px;background:#f3f4f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:36px}.in{font-size:14px;font-weight:700;line-height:1.4}.iv2{font-size:12px;color:#6b7280;background:#f3f4f6;display:inline-block;padding:2px 8px;border-radius:20px;margin-top:4px}.iq{font-size:13px;font-weight:600;margin-top:6px}.tk{background:#f0f9ff;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;color:#1e40af;margin-bottom:12px}.br{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.be{padding:11px 18px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.be:hover{background:#333}.be:disabled{opacity:.5;cursor:not-allowed}.bm{padding:11px 18px;background:#fff;color:#16a34a;border:2px solid #16a34a;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.bm:hover{background:#f0fff4}.bm.dn{background:#dcfce7;color:#16a34a;cursor:default}.bn{padding:11px 18px;background:#fff;color:#dc2626;border:2px solid #dc2626;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.bn:hover{background:#fef2f2}.bn.dn{background:#fee2e2;cursor:default}.bd{padding:11px 18px;background:#fff;color:#7c3aed;border:2px solid #7c3aed;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.bd:hover{background:#f5f3ff}.bd.dn{background:#ede9fe;color:#7c3aed;cursor:default}.bp{padding:11px 18px;background:#fff;color:#92400e;border:2px solid #f59e0b;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.bp:hover{background:#fffbeb}.bp.dn{background:#fef3c7;color:#92400e;cursor:default}.bd2{background:#ede9fe;color:#7c3aed}.ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out}.ov.on{display:flex}.ov img{max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;cursor:default}.ld{text-align:center;padding:60px;color:#9ca3af}.vz{text-align:center;padding:60px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}.foto-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;background:#fff;color:#2563eb;border:2px solid #2563eb;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.foto-btn:hover{background:#eff6ff}.fotos-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.foto-thumb{width:90px;height:90px;object-fit:cover;border-radius:10px;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,.1);border:2px solid #e8eaf0}.foto-count{font-size:12px;color:#6b7280;margin-top:6px}.ds{display:flex;align-items:center;gap:12px;background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:14px 20px;margin-bottom:20px;flex-wrap:wrap}.dl2{font-size:13px;font-weight:600;color:#374151;white-space:nowrap}input[type=date]{padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;cursor:pointer}input[type=date]:focus{border-color:#111}.db{padding:9px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.db:hover{background:#333}';

  const senhaJS = JSON.stringify(senha);

const JS_CODE = `var S=` + senhaJS + `;var A='/api/fornecedor';
function go(e){e.preventDefault();var v=document.getElementById("sp").value;if(v)window.location.href=A+"?senha="+encodeURIComponent(v);}
function af(s){document.getElementById("oi").src=s;document.getElementById("ov").classList.add("on");}
function ff(){document.getElementById("ov").classList.remove("on");}
document.addEventListener("keydown",function(e){if(e.key==="Escape")ff();});
function tp(id){
  var b=document.getElementById("pb"+id);if(!b)return;
  b.classList.toggle("op");
  if(b.classList.contains("op")&&!b.getAttribute("data-fotos-loaded")){
    b.setAttribute("data-fotos-loaded","1");
    carregarFotos(id);
  }
}
async function baixar(btn,meId,trk){
  if(!meId){alert("Etiqueta nao encontrada no Melhor Envio para este pedido.");return;}
  btn.disabled=true;var orig=btn.textContent;btn.textContent="Buscando...";
  try{
    var url=A+"?senha="+encodeURIComponent(S)+"&action=etiqueta&meOrderId="+encodeURIComponent(meId)+"&tracking="+encodeURIComponent(trk||meId);
    var r=await fetch(url);
    if(!r.ok){var d=await r.json().catch(function(){return{};});alert(d.erro||"Erro ao baixar etiqueta");btn.disabled=false;btn.textContent=orig;return;}
    var blob=await r.blob();var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="etiqueta-"+(trk||meId)+".pdf";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    btn.textContent="Baixado!";setTimeout(function(){btn.disabled=false;btn.textContent=orig;},3000);
  }catch(e){alert("Erro: "+e.message);btn.disabled=false;btn.textContent=orig;}
}
function ss(btn){setStatus(btn,btn.getAttribute('data-id'),btn.getAttribute('data-s'));}
async function setStatus(btn,id,status){
  var lbl={enviado:"Enviado",nao_enviado:"Nao Enviado",enviado_diferente:"Enviado Diferente",pendente:"Pendente"};
  var bgC={enviado:"bg bfn",nao_enviado:"bg bpd",enviado_diferente:"bg bd2",pendente:"bg bpd"};var lbl2={enviado:"Enviado",nao_enviado:"Nao Enviado",enviado_diferente:"Enviado Diferente",pendente:"Pendente"};
  var orig=btn.textContent;
  try{var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=set-status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id,status:status})});
  var d=await r.json();
  if(d.ok){var bg=document.getElementById("bg"+id);if(bg){bg.className=bgC[status]||"bg bpd";bg.textContent=lbl[status]||status;}
    var pb=document.getElementById("pb"+id);if(pb){pb.querySelectorAll(".bm,.bn,.bd").forEach(function(b){b.disabled=false;b.classList.remove("dn");});btn.disabled=true;btn.classList.add("dn");}
  }else{btn.disabled=false;btn.textContent=orig;}
  }catch(e){btn.disabled=false;btn.textContent=orig;}
}
async function carregarFotos(orderId){
  try{
    var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=fotos&orderId="+orderId);
    var d=await r.json();
    var grid=document.getElementById("fg"+orderId);
    if(grid&&d.fotos&&d.fotos.length){
      grid.innerHTML="";
      d.fotos.forEach(function(f){adicionarFotoGrid(grid,f,orderId);});
    }
  }catch(e){}
}
async function uFoto(input){
  var orderId=input.getAttribute("data-oid");
  if(!orderId){alert("Erro: orderId nao encontrado");return;}
  var file=input.files[0];
  if(!file){return;}
  // Encontrar o botao pelo data-fid correspondente
  var btn=document.querySelector("[data-fid='"+orderId+"']");
  var orig=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="Processando...";}
  try{
    var jpeg=await new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(e){
        var dataUrl=e.target.result;
        var img=new Image();
        img.onload=function(){
          try{
            var max=1000;
            var w=img.width||800,h=img.height||600;
            if(w>max){h=Math.round(h*max/w);w=max;}
            if(h>max){w=Math.round(w*max/h);h=max;}
            var canvas=document.createElement("canvas");
            canvas.width=w;canvas.height=h;
            var ctx=canvas.getContext("2d");
            ctx.fillStyle="#fff";
            ctx.fillRect(0,0,w,h);
            ctx.drawImage(img,0,0,w,h);
            var result=canvas.toDataURL("image/jpeg",0.75);
            resolve(result);
          }catch(err){reject(err);}
        };
        img.onerror=function(){
          // Fallback: send original dataUrl without canvas processing
          resolve(dataUrl);
        };
        img.src=dataUrl;
      };
      reader.onerror=function(e){reject(new Error("FileReader erro: "+e));};
      reader.readAsDataURL(file);
    });
    if(btn)btn.textContent="Enviando...";
    var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=upload-foto",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({orderId:String(orderId),foto:jpeg})
    });
    var d=await r.json();
    if(d.ok&&d.url){
      var grid=document.getElementById("fg"+orderId);
      if(grid)adicionarFotoGrid(grid,d.url,orderId);
      if(btn){btn.disabled=false;btn.textContent=orig;}
      input.value="";
    }else{
      alert("Erro upload: "+(d.erro||JSON.stringify(d)));
      if(btn){btn.disabled=false;btn.textContent=orig;}
    }
  }catch(e){
    alert("Erro: "+e.message);
    if(btn){btn.disabled=false;btn.textContent=orig;}
  }
}
function adicionarFotoGrid(grid,url,orderId){
  var wrap=document.createElement("div");
  wrap.style.cssText="position:relative;display:inline-block;";
  var img=document.createElement("img");
  img.src=url;img.className="foto-thumb";
  img.onclick=function(){af(url);};
  var del=document.createElement("button");
  del.textContent="×";
  del.style.cssText="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:700;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;";
  del.onclick=function(e){e.stopPropagation();excluirFoto(url,orderId,wrap);};
  wrap.appendChild(img);
  wrap.appendChild(del);
  grid.appendChild(wrap);
}
async function excluirFoto(url,orderId,wrap){
  if(!confirm("Excluir esta foto?"))return;
  try{
    var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=excluir-foto",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({orderId:String(orderId),url:url})
    });
    var d=await r.json();
    if(d.ok){wrap.remove();}
    else{alert(d.erro||"Erro ao excluir");}
  }catch(e){alert("Erro: "+e.message);}
}
async function load(data){
  var dt=data||(document.getElementById("dt")?document.getElementById("dt").value:"");
  var app=document.getElementById("app");if(!S)return;
  if(app)app.innerHTML="Carregando...";
  try{var url=A+"?senha="+encodeURIComponent(S)+"&action=pedidos-json"+(dt?"&data="+encodeURIComponent(dt):"");
  var r=await fetch(url);
  var d=await r.json();
  if(!r.ok||d.erro){app.innerHTML="<div class='vz'>Erro: "+(d.erro||"acesso negado")+"</div>";return;}
  var ps=d.pedidos||[];
  if(d.data){var pt=d.data.split("-");var dl=document.getElementById("dl");if(dl)dl.textContent="Pedidos de "+pt[2]+"/"+pt[1]+"/"+pt[0];var dti=document.getElementById("dt");if(dti&&!data)dti.value=d.data;}
  if(!ps.length){app.innerHTML="<div class='vz'>Nenhum pedido ontem</div>";return;}
  var dataLabel=dt?dt.split("-").reverse().join("/"):"data selecionada";
  var h="<div class='st'><div class='sn'>"+ps.length+"</div><div class='sl'>pedido"+(ps.length!==1?"s":"")+" — "+dataLabel+"</div></div>";
  ps.forEach(function(p){
    var st=p.status_forn||"nao_enviado";var env=st==="enviado"||p.fulfillment==="fulfilled";
    var lbl2={enviado:"Enviado",nao_enviado:"Nao Enviado",enviado_diferente:"Enviado Diferente",pendente:"Pendente"};
    var bgCls=st==="enviado"?"bg bfn":st==="enviado_diferente"?"bg bd2":"bg bpd";
    var bgTxt=lbl2[st]||"Pendente";
    h+="<div class='pd'>";
    h+="<div class='ph' onclick='tp("+p.id+")'><span class='pn'>#"+p.numero+"</span><span id='bg"+p.id+"' class='"+bgCls+"'>"+( bgTxt)+"</span><span class='pm'>"+p.nome+"</span></div>";
    h+="<div class='pb' id='pb"+p.id+"'>";
    h+="<div class='ig'>";
    h+="<div class='ic'><div class='il'>Cliente</div><div class='iv'>"+p.nome+"</div></div>";
    h+="<div class='ic' style='grid-column:span 2'><div class='il'>Endereco</div><div class='iv'>"+(p.endereco||"nao informado")+"</div></div>";
    h+="</div>";
    if(p.tracking)h+="<div class='tk'>Rastreio: "+p.tracking+"</div>";
    h+="<div>";
    (p.itens||[]).forEach(function(it){
      h+="<div class='it'>";
      h+=it.img?"<img src='"+it.img+"' onclick='af(this.src)'>":"<div class='ii'>&#8987;</div>";
      h+="<div style='flex:1'><div class='in'>"+it.nome+"</div>";
      if(it.variante&&it.variante!=="Default Title")h+="<div class='iv2'>"+it.variante+"</div>";
      h+="<div class='iq'>Quantidade: <strong>"+it.quantidade+"</strong></div></div></div>";
    });
    h+="</div>";
    h+="<div class='br'>";
    h+="<button class='be' onclick='baixar(this,"+JSON.stringify(p.meOrderId||"")+","+JSON.stringify(p.tracking||"")+")'>"+(p.meOrderId?"Baixar Etiqueta":"Sem etiqueta no ME")+"</button>";
    var st=p.status_forn||"nao_enviado";
    h+="<button class='bm"+(st==="enviado"?" dn":"")+"'  data-id='"+p.id+"' data-s='enviado'  onclick='ss(this)'>Enviado</button>";
    h+="<button class='bn"+(st==="nao_enviado"?" dn":"")+"'  data-id='"+p.id+"' data-s='nao_enviado'  onclick='ss(this)'>Nao Enviado</button>";
    h+="<button class='bd"+(st==="enviado_diferente"?" dn":"")+"'  data-id='"+p.id+"' data-s='enviado_diferente'  onclick='ss(this)'>Enviado Diferente</button>";
    h+="<button class='bp"+(st==="pendente"||st==="nao_enviado"?" dn":"")+"'  data-id='"+p.id+"' data-s='pendente'  onclick='ss(this)'>Pendente</button>";
    h+="<input type='file' accept='image/*' capture='environment' id='fi"+p.id+"' style='display:none' data-oid='"+(p.id)+"' onchange='uFoto(this)'>";
    h+="<button class='foto-btn' data-fid='"+(p.id)+"'>Foto do Pacote</button>";
    h+="</div>";
    h+="<div class='fotos-grid' id='fg"+p.id+"'></div>";
    h+="</div></div></div>";
  });
  app.innerHTML=h;
  app.addEventListener("click",function handler(e){var b=e.target.closest("[data-fid]");if(!b)return;document.getElementById("fi"+b.getAttribute("data-fid")).click();app.removeEventListener("click",handler);});
  }catch(e){if(app)app.innerHTML="<div class='vz'>Erro: "+e.message+"</div>";}
}
` + (senhaOk ? 'load();' : '') + `
`;

  const loginHTML = '<div class="ct"><div class="lb"><h2>Acesso Restrito</h2><p>Digite a senha para ver os pedidos</p><form onsubmit="go(event)"><input type="password" id="sp" placeholder="Senha" autofocus><button class="bl" type="submit">Entrar</button></form></div></div>';
  // Calcular ontem e hoje para os limites do seletor
  const agoraBR2 = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hojeStr = agoraBR2.toISOString().split('T')[0];
  const ontemDefault = new Date(agoraBR2); ontemDefault.setDate(ontemDefault.getDate() - 1);
  const ontemStr2 = ontemDefault.toISOString().split('T')[0];

  const appHTML = '<div class="ct">' +
    '<div class="ds">' +
    '<label class="dl2">Data dos pedidos:</label>' +
    '<input type="date" id="dt" value="' + ontemStr2 + '" max="' + hojeStr + '" onchange="load(this.value)">' +
    '<button onclick="load(document.getElementById(\'dt\').value)" class="db">Buscar</button>' +
    '</div>' +
    '<div id="app"><div class="ld">Carregando...</div></div>' +
    '</div>';

  return res.status(200).send(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kcique Fornecedor</title><style>' + CSS + '</style></head><body>' +
    '<div class="hd"><h1>Kcique - Pedidos para Separar</h1><span class="dt" id="dl"></span></div>' +
    (senhaOk ? appHTML : loginHTML) +
    '<div class="ov" id="ov" onclick="ff()"><img id="oi" src=""></div>' +
    '<script>' + JS_CODE + '<\/script></body></html>'
  );
}
