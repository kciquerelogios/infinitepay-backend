// api/grupo.js — Redireciona para o grupo VIP ativo
//
// Prioridade:
//   1) grupo-ativo-manual (trava manual definida no dashboard, se existir)
//   2) snapshot do dia (vip-snapshot-*) — primeiro grupo #1..#17, em ordem, com < 1000 membros
//   3) link fixo do Grupo #1 como último recurso (sem snapshot algum)
//
// Importante: nada aqui consulta a Z-API ao vivo. O link de convite de cada grupo é
// capturado e salvo dentro do snapshot diário (salvarSnapshotGrupos, em ofertas.js) —
// esse redirect só LÊ o que já está salvo no Redis, pra não gerar rajada de chamadas
// à Z-API a cada clique de visitante em horário de pico (um dos fatores que contribuem
// pra bloqueios de conta no WhatsApp).

const FALLBACK = 'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1';
const LIMITE = 1000;

const GRUPOS = [
  {nome:'#1',link:'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1'},
  {nome:'#2',link:'https://chat.whatsapp.com/GtwnsNKOBhBFphx80IbGRi'},
  {nome:'#3',link:'https://chat.whatsapp.com/Gp0z5rooPJn4xJ9vMuu5mq'},
  {nome:'#4',link:'https://chat.whatsapp.com/CwNI8EJ4YYE3l87dnkPsfF'},
  {nome:'#5',link:'https://chat.whatsapp.com/Gdm2fldetx4CgQTlXIU4Hr'},
  {nome:'#6',link:'https://chat.whatsapp.com/FqcXp5lj5Iv6fln8aOls41'},
  {nome:'#7',link:'https://chat.whatsapp.com/IsQ8zsma0e83xULh9GoSf2'},
  {nome:'#8',link:'https://chat.whatsapp.com/DfaAcQXJdBqH8NiEJoRxmH'},
  {nome:'#9',link:'https://chat.whatsapp.com/H86IAANo3wC5vJLpGLruN5'},
  {nome:'#10',link:'https://chat.whatsapp.com/EKL8Pi3nSDFEnfFysWd6vV'},
  {nome:'#11',link:'https://chat.whatsapp.com/LUekubqMZ1fFBzNc6nr1eh'},
  {nome:'#12',link:'https://chat.whatsapp.com/DiCkqI5M1rc9fD4Uo0Uhpb'},
  {nome:'#13',link:'https://chat.whatsapp.com/JcmJFfNeCTxFCqhNaTK3UL?s=cl&p=a&ilr=1'},
  {nome:'#14',link:'https://chat.whatsapp.com/EZqlQfswqOvCSJgWmP8TpZ'},
  {nome:'#15',link:'https://chat.whatsapp.com/KWGkIwonwYVClO5y44DJPh?s=cl&p=a&ilr=1'},
  {nome:'#16',link:'https://chat.whatsapp.com/EsAXwsLfNQ4BIKHWF20Gxh?s=cl&p=a&ilr=1'},
  {nome:'#17',link:'https://chat.whatsapp.com/Ln7miz76B0BH8EjvaN57YC'},
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const debug = !!req.query.debug;
  const info = { etapas: [] };
  const finalizar = (link, motivo) => {
    info.motivo = motivo;
    info.linkFinal = link;
    if (debug) return res.status(200).json(info);
    return res.redirect(302, link);
  };

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    if (!KV_URL || !KV_TOKEN) return finalizar(FALLBACK, 'sem KV configurado');

    // 1) Trava manual
    const manualR = await fetch(`${KV_URL}/get/grupo-ativo-manual`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const manualJ = await manualR.json();
    let manual = manualJ.result;
    while (typeof manual === 'string') { try { manual = JSON.parse(manual); } catch (e) { break; } }
    info.etapas.push({ etapa: 'trava-manual', valor: manual || null });
    if (manual && manual.link) {
      return finalizar(manual.link, 'trava manual ativa (grupo ' + manual.nome + ')');
    }

    // 2) Snapshot do dia — primeiro grupo (#1..#17, em ordem) com vaga; link já vem salvo nele
    for (let i = 0; i <= 2; i++) {
      const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const r = await fetch(`${KV_URL}/get/vip-snapshot-${ds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const j = await r.json();
      let snap = j.result;
      while (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { break; } }
      if (snap && Array.isArray(snap.grupos)) {
        let ativo = snap.grupos[snap.grupos.length - 1];
        for (const g of snap.grupos) {
          if ((g.membros || 0) < LIMITE) { ativo = g; break; }
        }
        info.etapas.push({ etapa: 'snapshot', data: ds, grupoEscolhido: ativo.nome, membrosGrupoEscolhido: ativo.membros, todosOsGrupos: snap.grupos.map(g => ({ nome: g.nome, membros: g.membros, falhou: !!g.falhou })) });
        const linkFixo = (GRUPOS.find(g => g.nome === ativo.nome) || GRUPOS[0]).link;
        return finalizar(ativo.link || linkFixo, 'lido do snapshot de ' + ds);
      }
    }

    // 3) Sem snapshot algum (não deveria acontecer com o cron rodando) — link fixo do #1
    info.etapas.push({ etapa: 'sem-snapshot' });
    return finalizar(GRUPOS[0].link, 'sem snapshot disponível, usando link fixo');
  } catch (e) {
    info.erroGeral = e.message;
    console.error('grupo.js erro:', e.message);
  }

  return finalizar(FALLBACK, 'erro geral, usando fallback fixo');
}
