{% comment %} Template: page.roleta — criar em Shopify > Temas > Editar código > Templates {% endcomment %}

{{ 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap' | stylesheet_tag }}

<style>
  .rk-page { background: #f8f7f4; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 16px; font-family: 'Inter', -apple-system, sans-serif; }
  .rk-card { background: #fff; border-radius: 28px; padding: 44px 36px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 2px 40px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.04); }
  .rk-brand { font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #bbb; text-transform: uppercase; margin-bottom: 20px; }
  .rk-headline { font-size: 28px; font-weight: 900; color: #111; letter-spacing: -1px; line-height: 1.15; margin-bottom: 6px; }
  .rk-sub { font-size: 14px; color: #999; margin-bottom: 32px; }
  .rk-wheel-wrap { position: relative; width: 300px; height: 300px; margin: 0 auto 32px; }
  .rk-wheel-shadow { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 8px 48px rgba(0,0,0,.16); }
  #rk-canvas { border-radius: 50%; display: block; position: relative; z-index: 1; }
  .rk-pin { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); z-index: 10; }
  .rk-pin::before { content: ''; display: block; width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent; border-top: 28px solid #111; border-radius: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.3)); }
  .rk-page .rk-btn { width: 100% !important; padding: 17px !important; background: #111 !important; color: #fff !important; border: none !important; border-radius: 14px !important; font-size: 16px !important; font-weight: 700 !important; cursor: pointer !important; letter-spacing: -0.3px !important; transition: all .15s !important; margin-bottom: 10px !important; font-family: inherit !important; box-shadow: none !important; text-transform: none !important; }
  .rk-page .rk-btn:hover { background: #222 !important; transform: translateY(-1px) !important; }
  .rk-page .rk-btn:disabled { background: #e5e7eb !important; color: #aaa !important; cursor: not-allowed !important; transform: none !important; }
  .rk-tc { font-size: 12px; color: #ccc; margin-bottom: 0; }
  .rk-result { background: #f8f7f4; border-radius: 18px; padding: 28px 24px; margin-top: 20px; display: none; animation: rk-pop .45s cubic-bezier(.175,.885,.32,1.275); }
  @keyframes rk-pop { from { opacity:0; transform:scale(.85) } to { opacity:1; transform:scale(1) } }
  .rk-won-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #bbb; text-transform: uppercase; margin-bottom: 10px; }
  .rk-won-prize { font-size: 24px; font-weight: 900; color: #111; letter-spacing: -0.5px; margin-bottom: 18px; }
  .rk-cupom-box { background: #fff; border: 1.5px dashed #ddd; border-radius: 14px; padding: 16px 24px; display: inline-block; cursor: pointer; transition: border-color .15s, transform .1s; margin-bottom: 8px; }
  .rk-cupom-box:hover { border-color: #111; transform: scale(1.02); }
  .rk-cupom-code { font-size: 22px; font-weight: 900; letter-spacing: 5px; color: #111; }
  .rk-copy-hint { font-size: 12px; color: #aaa; margin-top: 6px; }
  .rk-no-prize { font-size: 15px; color: #777; line-height: 1.6; }
  .rk-already { background: #f8f7f4; border-radius: 18px; padding: 28px; margin-top: 20px; display: none; }
  .rk-already-icon { font-size: 36px; margin-bottom: 12px; }
  .rk-already-txt { font-size: 15px; color: #777; }
</style>

<div class="rk-page">
  <div class="rk-card">
    <div class="rk-brand">Kcique Relógios</div>
    <div class="rk-headline">Gire e ganhe<br>um prêmio!</div>
    <div class="rk-sub">Tente sua sorte — pode ser seu dia de sorte</div>

    <div class="rk-wheel-wrap">
      <div class="rk-pin"></div>
      <div class="rk-wheel-shadow"></div>
      <canvas id="rk-canvas" width="300" height="300"></canvas>
    </div>

    <button class="rk-btn" id="rk-btn" onclick="rkSpin()">Girar agora</button>
    <div class="rk-tc">Uma chance por dia &nbsp;•&nbsp; Cupom válido por 48h</div>

    <div class="rk-result" id="rk-result">
      <div class="rk-won-label">Você ganhou</div>
      <div class="rk-won-prize" id="rk-prize-name"></div>
      <div id="rk-cupom-area">
        <div class="rk-cupom-box" onclick="rkCopy()">
          <div class="rk-cupom-code" id="rk-cupom-code"></div>
        </div>
        <div class="rk-copy-hint" id="rk-copy-hint">Toque para copiar &nbsp;•&nbsp; Use no checkout</div>
      </div>
      <div class="rk-no-prize" id="rk-no-prize" style="display:none"></div>
    </div>

    <div class="rk-already" id="rk-already">
      <div class="rk-already-icon">⏰</div>
      <div class="rk-won-label" style="margin-bottom:6px">Você já girou hoje</div>
      <div class="rk-already-txt">Volte amanhã para uma nova chance!</div>
    </div>
  </div>
</div>

<script>
(function(){
  var API = 'https://infinitepay-backend.vercel.app/api/roleta';
  var ITEMS = [];
  var angle = 0, spinning = false;

  function draw(a, its) {
    if (!its || !its.length) return;
    var c = document.getElementById('rk-canvas');
    var ctx = c.getContext('2d');
    var N = its.length, ARC = 2*Math.PI/N;
    var CX=150, CY=150, R=142;
    ctx.clearRect(0,0,300,300);
    its.forEach(function(it,i){
      var s=a+i*ARC, e=s+ARC;
      ctx.beginPath(); ctx.moveTo(CX,CY); ctx.arc(CX,CY,R,s,e); ctx.closePath();
      ctx.fillStyle = it.cor||'#333'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(CX,CY); ctx.rotate(s+ARC/2);
      ctx.textAlign='right'; ctx.fillStyle = it.fg||'#fff';
      ctx.font = '700 12px Inter,-apple-system,sans-serif';
      (it.label||'').split('\n').forEach(function(l,li,arr){
        ctx.fillText(l, R-12, -3+(li-arr.length/2+.5)*16);
      });
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(CX,CY,R,0,2*Math.PI);
    ctx.strokeStyle='rgba(0,0,0,.07)'; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.arc(CX,CY,26,0,2*Math.PI);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.08)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#111'; ctx.font='700 10px Inter,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('GIRAR',CX,CY);
  }

  function pick(its) {
    var total = its.reduce(function(a,b){return a+(b.prob||10);},0);
    var r = Math.random()*total;
    for(var i=0;i<its.length;i++){r-=its[i].prob||10;if(r<=0)return i;}
    return 0;
  }

  function getKey(){ return 'rk_spin_'+new Date().toISOString().split('T')[0]; }

  function showAlready(){
    document.getElementById('rk-btn').style.display='none';
    document.getElementById('rk-already').style.display='block';
  }

  window.rkCopy = function(){
    var code = document.getElementById('rk-cupom-code').textContent;
    if(navigator.clipboard){ navigator.clipboard.writeText(code); }
    else { var t=document.createElement('textarea');t.value=code;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t); }
    document.getElementById('rk-copy-hint').textContent = '✓ Copiado!';
  };

  window.rkSpin = function(){
    if(spinning) return;
    if(localStorage.getItem(getKey())){ showAlready(); return; }
    spinning=true;
    var btn = document.getElementById('rk-btn');
    btn.disabled=true;
    document.getElementById('rk-result').style.display='none';
    var idx = pick(ITEMS);
    var N=ITEMS.length, ARC=2*Math.PI/N;
    var seg=idx*ARC+ARC/2;
    var target=-Math.PI/2-seg;
    var delta=target-(angle%(2*Math.PI))+(6+Math.random()*4)*2*Math.PI;
    var dur=4500, t0=performance.now(), a0=angle;
    function frame(now){
      var t=Math.min((now-t0)/dur,1);
      var ease=1-Math.pow(1-t,4.5);
      angle=a0+delta*ease;
      draw(angle,ITEMS);
      if(t<1){ requestAnimationFrame(frame); }
      else {
        spinning=false;
        localStorage.setItem(getKey(),'1');
        var it=ITEMS[idx];
        // Registrar giro
        fetch(API+'?action=registrar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({premio:it.label.replace('\n',' '),cupom:it.cupom||''})}).catch(function(){});
        // Mostrar resultado
        document.getElementById('rk-prize-name').textContent=(it.label||'').replace('\n',' ');
        if(it.cupom){
          document.getElementById('rk-cupom-code').textContent=it.cupom;
          document.getElementById('rk-cupom-area').style.display='block';
          document.getElementById('rk-no-prize').style.display='none';
        } else {
          document.getElementById('rk-cupom-area').style.display='none';
          document.getElementById('rk-no-prize').textContent=it.mensagem||'Não foi dessa vez. Volte amanhã para tentar de novo!';
          document.getElementById('rk-no-prize').style.display='block';
        }
        document.getElementById('rk-result').style.display='block';
        btn.textContent='Volte amanhã!';
      }
    }
    requestAnimationFrame(frame);
  };

  // Carregar config
  fetch(API+'?action=config')
    .then(function(r){return r.json();})
    .then(function(d){
      ITEMS = d.itens||[];
      draw(0,ITEMS);
      if(localStorage.getItem(getKey())) showAlready();
    })
    .catch(function(){
      ITEMS=[
        {label:'10% OFF',      cor:'#1a1a1a',fg:'#fff',prob:30,cupom:'SPIN10'},
        {label:'Frete Grátis', cor:'#2d6a4f',fg:'#fff',prob:20,cupom:'FRETEFREE'},
        {label:'15% OFF',      cor:'#1d4e89',fg:'#fff',prob:15,cupom:'SPIN15'},
        {label:'Tente\nNovamente',cor:'#e8e8e8',fg:'#888',prob:20,cupom:''},
        {label:'20% OFF',      cor:'#5c2a8c',fg:'#fff',prob:10,cupom:'SPIN20'},
        {label:'Brinde\nEspecial',cor:'#b5451b',fg:'#fff',prob:5,cupom:'BRINDE'},
      ];
      draw(0,ITEMS);
      if(localStorage.getItem(getKey())) showAlready();
    });
})();
</script>
