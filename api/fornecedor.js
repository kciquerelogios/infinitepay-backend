export default async function handler(req, res) {
  const SENHA_CORRETA = process.env.FORNECEDOR_SECRET || 'kcique-fornecedor-2026';
  const senha = req.query.senha || '';
  const action = req.query.action || '';

  // ── MARCAR ENVIADO ───────────────────────────────────────────
  if (action === 'marcar-enviado' && req.method === 'POST') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Não autorizado' });
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    const orderId = req.body && req.body.orderId;
    if (!orderId) return res.status(400).json({ erro: 'orderId obrigatório' });
    await fetch(KV_URL + '/set/forn-enviado-' + orderId, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '1', ex: 604800 })
    });
    return res.status(200).json({ ok: true });
  }

  // ── ETIQUETA PDF ─────────────────────────────────────────────
  if (action === 'etiqueta') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Não autorizado' });
    const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
    const email = req.query.email || '';
    const nome = req.query.nome || '';
    try {
      const pages = await Promise.all([1,2,3,4,5].map(function(p) {
        return fetch('https://melhorenvio.com.br/api/v2/me/purchases?limit=100&page=' + p, {
          headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
        }).then(function(r) { return r.json(); }).catch(function() { return { data: [] }; });
      }));
      const allOrders = pages.reduce(function(acc, p) {
        return acc.concat((p.data||[]).reduce(function(a, pu) { return a.concat(pu.orders||[]); }, []));
      }, []);
      const found = allOrders.find(function(o) {
        const toEmail = ((o.to && o.to.email) || '').toLowerCase();
        const toName = ((o.to && o.to.name) || '').toLowerCase().trim();
        const cn = nome.toLowerCase().trim();
        const ce = email.toLowerCase().trim();
        return (ce && toEmail === ce) || (cn && (toName === cn || toName.indexOf(cn.split(' ')[0]) === 0));
      });
      if (!found) return res.status(404).json({ erro: 'Pedido não encontrado no Melhor Envio. Verifique se a etiqueta foi gerada.' });
      const meOrderId = found.id;
      const tracking = found.tracking || meOrderId;

      // Tentar Railway PDF
      const PDF_SERVICE = 'https://kcique-pdf-service-production.up.railway.app';
      const PDF_SECRET = 'kcique2026';
      try {
        const printResp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/print', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' },
          body: JSON.stringify({ orders: [meOrderId] })
        });
        const printData = await printResp.json();
        const printUrl = printData.url || '';
        const printHash = printUrl.split('/imprimir/')[1] || meOrderId;
        const pdfResp = await fetch(PDF_SERVICE + '/pdf/' + printHash + '?secret=' + PDF_SECRET);
        if (pdfResp.ok) {
          const pdfBuf = await pdfResp.arrayBuffer();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename="etiqueta-' + tracking + '.pdf"');
          return res.status(200).send(Buffer.from(pdfBuf));
        }
      } catch(e) { console.log('Railway falhou:', e.message); }

      // Fallback S3
      const s3Resp = await fetch('https://melhorenvio.com.br/api/v2/me/imprimir/pdf/' + meOrderId, {
        headers: { Authorization: 'Bearer ' + ME_TOKEN, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Kcique/1.0 (kciqueadm@gmail.com)' }
      });
      const s3Data = await s3Resp.json();
      const s3Urls = Array.isArray(s3Data) ? s3Data : [];
      if (s3Urls.length > 0) return res.redirect(302, s3Urls[0]);
      return res.status(404).json({ erro: 'Etiqueta não disponível. Gere a etiqueta no Melhor Envio primeiro.' });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ── PEDIDOS JSON ─────────────────────────────────────────────
  if (action === 'pedidos-json') {
    if (senha !== SENHA_CORRETA) return res.status(401).json({ erro: 'Não autorizado' });
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

      const pedidosResp = await fetch(
        'https://' + SHOPIFY_STORE + '/admin/api/2026-04/orders.json?status=any&financial_status=paid&created_at_min=' + inicioOntem + '&created_at_max=' + fimOntem + '&limit=250',
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      ).then(function(r) { return r.json(); }).catch(function() { return { orders: [] }; });

      const prodResp = await fetch(
        'https://' + SHOPIFY_STORE + '/admin/api/2026-04/products.json?limit=250&fields=id,title,image,images,variants',
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
      ).then(function(r) { return r.json(); }).catch(function() { return { products: [] }; });

      const prods = prodResp.products || [];

      function norm(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/  +/g,' ').trim(); }
      function getImg(nome) {
        if (!nome) return '';
        const base = nome.split(' - Cor:')[0].split(' - ')[0].trim();
        const baseNorm = norm(base);
        const mMatch = nome.match(/[A-Z]{1,5}-[0-9]{3,5}[A-Z0-9]*/i);
        const modelo = mMatch ? mMatch[0].toUpperCase() : '';
        const cMatch = nome.match(/Cor:([^-]+)/i);
        const cor = cMatch ? norm(cMatch[1]) : '';
        let best = null, bestPts = 0;
        for (let i = 0; i < prods.length; i++) {
          const p = prods[i];
          const pt = norm(p.title);
          let pts = 0;
          if (pt === baseNorm) pts = 200;
          else if (modelo && p.title.toUpperCase().indexOf(modelo) >= 0) pts = 100;
          else if (pt.indexOf(baseNorm) >= 0 || baseNorm.indexOf(pt) >= 0) pts = 50;
          if (pts > bestPts) { bestPts = pts; best = p; }
        }
        if (!best) return '';
        if (cor) {
          const vv = best.variants || [];
          const imgs = best.images || [];
          function vi(v) {
            if (v.featured_image && v.featured_image.src) return v.featured_image.src;
            if (v.image_id) { const img = imgs.find(function(i){return i.id===v.image_id;}); if(img) return img.src; }
            return '';
          }
          const exato = vv.find(function(v){return norm(v.title)===cor;});
          if (exato) { const s=vi(exato); if(s) return s; }
          const sorted = vv.slice().sort(function(a,b){return b.title.length-a.title.length;});
          const contido = sorted.find(function(v){const vt=norm(v.title);return cor===vt||cor.indexOf(vt+' ')===0||cor.slice(-(vt.length+1))===' '+vt;});
          if (contido) { const s=vi(contido); if(s) return s; }
        }
        return best.image ? best.image.src : '';
      }

      const orders = pedidosResp.orders || [];
      const envKeys = orders.map(function(o){return 'forn-enviado-'+o.id;});
      let enviadosSet = {};
      if (envKeys.length > 0) {
        const pipeline = envKeys.map(function(k){return ['GET',k];});
        const kvR = await fetch(KV_URL + '/pipeline', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify(pipeline)
        }).then(function(r){return r.json();}).catch(function(){return [];});
        envKeys.forEach(function(k,i){ if(kvR[i]&&kvR[i].result) enviadosSet[k]=true; });
      }

      const pedidos = orders.map(function(o) {
        const tel = (o.shipping_address&&o.shipping_address.phone)||(o.billing_address&&o.billing_address.phone)||(o.customer&&o.customer.phone)||'';
        const addr = o.shipping_address;
        return {
          id: o.id,
          numero: o.order_number,
          nome: o.customer ? ((o.customer.first_name||'')+' '+(o.customer.last_name||'')).trim() : 'Cliente',
          email: (o.customer&&o.customer.email)||o.email||'',
          telefone: tel.replace(/\D/g,''),
          endereco: addr ? (addr.address1||'')+', '+(addr.city||'')+' - '+(addr.province_code||'')+', CEP '+(addr.zip||'') : '',
          fulfillment: o.fulfillment_status||'unfulfilled',
          tracking: (o.fulfillments&&o.fulfillments[0]&&o.fulfillments[0].tracking_number)||'',
          enviado_fornecedor: !!enviadosSet['forn-enviado-'+o.id],
          criado_em: o.created_at,
          itens: (o.line_items||[]).map(function(i){return {
            nome: i.title,
            variante: i.variant_title||'',
            quantidade: i.quantity,
            img: (i.image&&i.image.src)||getImg(i.title)
          };})
        };
      });
      return res.status(200).json({ pedidos: pedidos, data: ontemStr, total: pedidos.length });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ── PÁGINA HTML ───────────────────────────────────────────────
  const senhaOk = senha === SENHA_CORRETA;
  const senhaJS = JSON.stringify(senha);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const loginHtml = '<div class="content"><div class="login-box"><h2>Acesso Restrito</h2><p>Digite a senha para acessar os pedidos</p><form onsubmit="entrar(event)"><input type="password" id="s" placeholder="Senha" autofocus><br><br><button class="btn-login" type="submit">Entrar</button></form><div id="err" style="color:#ef4444;font-size:13px;margin-top:10px"></div></div></div>';
  const appHtml = '<div class="content" id="app"><div class="loading">Carregando pedidos...</div></div>';

  res.status(200).send('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kcique - Pedidos Fornecedor</title><style>' +
  '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f7f8fa;color:#1a1a2e;min-height:100vh}' +
  '.header{background:#111;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px}.header h1{font-size:17px;font-weight:700;flex:1}.header .data{font-size:12px;color:#999}' +
  '.content{padding:24px;max-width:900px;margin:0 auto}' +
  '.login-box{max-width:360px;margin:80px auto;background:#fff;border-radius:16px;border:1px solid #e8eaf0;padding:40px;text-align:center}.login-box h2{font-size:20px;margin-bottom:8px}.login-box p{color:#6b7280;font-size:13px;margin-bottom:24px}' +
  'input[type=password]{width:100%;padding:12px 16px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;margin-bottom:12px}input[type=password]:focus{border-color:#111}' +
  '.btn-login{width:100%;padding:13px;background:#111;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}' +
  '.stat{background:#fff;border-radius:12px;border:1px solid #e8eaf0;padding:16px 20px;margin-bottom:20px}.stat-num{font-size:32px;font-weight:800;color:#111}.stat-label{font-size:13px;color:#6b7280}' +
  '.pedido{background:#fff;border-radius:12px;border:1px solid #e8eaf0;margin-bottom:10px;overflow:hidden}' +
  '.ph{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;user-select:none}.ph:hover{background:#fafafa}' +
  '.pnum{font-weight:800;font-size:15px}.pnome{font-size:14px;flex:1}' +
  '.badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}' +
  '.b-ok{background:#dcfce7;color:#16a34a}.b-pend{background:#fef3c7;color:#92400e}.b-forn{background:#dbeafe;color:#1e40af}' +
  '.pb{display:none;padding:20px;border-top:1px solid #f3f4f6}.pb.open{display:block}' +
  '.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}' +
  '.ic{background:#f9fafb;border-radius:8px;padding:12px}.il{font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px}.iv{font-size:13px;font-weight:600;word-break:break-word}' +
  '.item{display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f3f4f6}.item:last-child{border-bottom:none}' +
  '.item img{width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:zoom-in;box-shadow:0 2px 8px rgba(0,0,0,.1)}' +
  '.ii{width:90px;height:90px;background:#f3f4f6;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:36px}' +
  '.in{font-size:14px;font-weight:700;line-height:1.4}.iv2{font-size:12px;color:#6b7280;background:#f3f4f6;display:inline-block;padding:2px 8px;border-radius:20px;margin-top:4px}' +
  '.iq{font-size:13px;color:#374151;font-weight:600;margin-top:6px}' +
  '.trk{background:#f0f9ff;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;color:#1e40af;margin-bottom:12px}' +
  '.br{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}' +
  '.be{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;background:#111;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.be:hover{background:#333}.be:disabled{opacity:.5;cursor:not-allowed}' +
  '.bm{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;background:#fff;color:#16a34a;border:2px solid #16a34a;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}.bm:hover{background:#f0fff4}.bm.done{background:#dcfce7;cursor:default}' +
  '.ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out}.ov.on{display:flex}.ov img{max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;cursor:default}' +
  '.sp{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}' +
  '@keyframes spin{to{transform:rotate(360deg)}}' +
  '.loading{text-align:center;padding:60px;color:#9ca3af}.vazio{text-align:center;padding:60px;color:#9ca3af;background:#fff;border-radius:12px;border:1px solid #e8eaf0}' +
  '</style></head><body>' +
  '<div class="header"><span>&#8987;</span><h1>Kcique Relogios - Pedidos para Separar</h1><span class="data" id="dl"></span></div>' +
  (senhaOk ? appHtml : loginHtml) +
  '<div class="ov" id="ov" onclick="ff()"><img id="oi" src="" onclick="event.stopPropagation()"></div>' +
  '<script>' +
  'var S=' + senhaJS + ';var A="/api/fornecedor";' +
  'function entrar(e){e.preventDefault();var v=document.getElementById("s").value;if(!v)return;window.location.href=A+"?senha="+encodeURIComponent(v);}' +
  'function af(src){document.getElementById("oi").src=src;document.getElementById("ov").classList.add("on");}' +
  'function ff(){document.getElementById("ov").classList.remove("on");}' +
  'document.addEventListener("keydown",function(e){if(e.key==="Escape")ff();});' +
  'function tp(id){var b=document.getElementById("pb"+id);if(b)b.classList.toggle("open");}' +
  'async function be(btn,nome,email){' +
  '  btn.disabled=true;var orig=btn.innerHTML;btn.innerHTML='<span class="sp"></span> Buscando...';' +
  '  try{var url=A+"?senha="+encodeURIComponent(S)+"&action=etiqueta&nome="+encodeURIComponent(nome)+"&email="+encodeURIComponent(email);' +
  '  var r=await fetch(url);if(!r.ok){var d=await r.json().catch(function(){return{};});alert("Erro: "+(d.erro||r.status));btn.disabled=false;btn.innerHTML=orig;return;}' +
  '  var blob=await r.blob();var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="etiqueta-"+nome.split(" ")[0]+".pdf";document.body.appendChild(a);a.click();document.body.removeChild(a);' +
  '  btn.innerHTML="Baixado!";setTimeout(function(){btn.disabled=false;btn.innerHTML=orig;},3000);' +
  '  }catch(e){alert("Erro: "+e.message);btn.disabled=false;btn.innerHTML=orig;}}' +
  'async function bm(btn,id){btn.disabled=true;var orig=btn.innerHTML;btn.innerHTML='<span class="sp"></span>';' +
  '  try{var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=marcar-enviado",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:id})});' +
  '  var d=await r.json();if(d.ok){btn.innerHTML="Marcado como Enviado";btn.classList.add("done");var b=document.getElementById("badge"+id);if(b){b.className="badge b-forn";b.textContent="Enviado pelo fornecedor";}}' +
  '  else{btn.disabled=false;btn.innerHTML=orig;}}catch(e){btn.disabled=false;btn.innerHTML=orig;}}' +
  'async function load(){var app=document.getElementById("app");if(!app||!S)return;' +
  '  try{var r=await fetch(A+"?senha="+encodeURIComponent(S)+"&action=pedidos-json");var d=await r.json();' +
  '  if(!r.ok||d.erro){app.innerHTML='<div class="vazio">Erro: '+(d.erro||"acesso negado")+"</div>";return;}' +
  '  var ps=d.pedidos||[];if(d.data){var pt=d.data.split("-");var dl=document.getElementById("dl");if(dl)dl.textContent="Pedidos de "+pt[2]+"/"+pt[1]+"/"+pt[0];}' +
  '  if(!ps.length){app.innerHTML='<div class="vazio">Nenhum pedido ontem</div>';return;}' +
  '  var h='<div class="stat"><div class="stat-num">'+ps.length+'</div><div class="stat-label">pedidos de ontem para separar</div></div>';' +
  '  ps.forEach(function(p){' +
  '    var env=p.enviado_fornecedor||p.fulfillment==="fulfilled";' +
  '    var bdg=env?'<span class="badge b-forn" id="badge'+p.id+'">Enviado</span>':'<span class="badge b-pend" id="badge'+p.id+'">Pendente</span>';' +
  '    h+='<div class="pedido"><div class="ph" onclick="tp('+p.id+')"><span class="pnum">#'+p.numero+'</span>'+bdg+'<span class="pnome">'+p.nome+'</span><span style="color:#9ca3af;font-size:12px">&#9660;</span></div>';' +
  '    h+='<div class="pb" id="pb'+p.id+'">';' +
  '    h+='<div class="ig"><div class="ic"><div class="il">Cliente</div><div class="iv">'+p.nome+'</div></div>';' +
  '    h+='<div class="ic"><div class="il">Telefone</div><div class="iv">'+( p.telefone?"+55 "+p.telefone:"—")+'</div></div>';' +
  '    h+='<div class="ic" style="grid-column:span 2"><div class="il">Endereco de Entrega</div><div class="iv">'+( p.endereco||"—")+'</div></div></div>';' +
  '    if(p.tracking)h+='<div class="trk">Rastreio: '+p.tracking+'</div>';' +
  '    h+='<div style="margin-bottom:16px">';' +
  '    (p.itens||[]).forEach(function(it){' +
  '      h+='<div class="item">';' +
  '      h+=it.img?'<img src="'+it.img+'" onclick="af(this.src)" alt="foto">'  :'<div class="ii">&#8987;</div>';' +
  '      h+='<div style="flex:1"><div class="in">'+it.nome+'</div>';' +
  '      if(it.variante&&it.variante!=="Default Title")h+='<div class="iv2">'+it.variante+'</div>';' +
  '      h+='<div class="iq">Quantidade: <strong>'+it.quantidade+'</strong></div></div></div>';' +
  '    });' +
  '    h+='</div><div class="br">';' +
  '    h+='<button class="be" onclick="be(this,'+JSON.stringify(p.nome)+','+JSON.stringify(p.email)+')">Baixar Etiqueta</button>';' +
  '    if(!env)h+='<button class="bm" onclick="bm(this,'+JSON.stringify(String(p.id))+')">Marcar como Enviado</button>';' +
  '    else h+='<button class="bm done" disabled>Marcado como Enviado</button>';' +
  '    h+='</div></div></div>';' +
  '  });' +
  '  app.innerHTML=h;' +
  '  }catch(e){if(app)app.innerHTML='<div class="vazio">Erro: '+e.message+'</div>';}}' +
  (senhaOk ? 'load();' : '') +
  '<\/script></body></html>');
}
