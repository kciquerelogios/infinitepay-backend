// api/grupo.js — Redireciona para o grupo VIP ativo
//
// Prioridade:
//   1) grupo-ativo-manual (trava manual definida no dashboard, se existir)
//   2) snapshot do dia (vip-snapshot-*) — primeiro grupo #1..#17, em ordem, com < 1000 membros
//   3) busca ao vivo na Z-API (sem snapshot disponível)
//   4) link fixo do Grupo #1 como último recurso
//
// Em todos os casos o link de convite é buscado NA HORA via Z-API a partir do ID do grupo,
// em vez de usar uma lista de links fixos — assim continua funcionando mesmo se o link
// for revogado/regenerado no WhatsApp. A lista fixa só entra como fallback se a Z-API falhar.

const FALLBACK = 'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1';
const LIMITE = 1000;

const GRUPOS = [
  {nome:'#1',id:'120363407575718083-group',link:'https://chat.whatsapp.com/FyN2AqbnmSRA3LSGOyGA4A?s=cl&p=a&ilr=1'},
  {nome:'#2',id:'120363407700341013-group',link:'https://chat.whatsapp.com/GtwnsNKOBhBFphx80IbGRi'},
  {nome:'#3',id:'120363407514192649-group',link:'https://chat.whatsapp.com/Gp0z5rooPJn4xJ9vMuu5mq'},
  {nome:'#4',id:'120363406939167357-group',link:'https://chat.whatsapp.com/CwNI8EJ4YYE3l87dnkPsfF'},
  {nome:'#5',id:'120363425311709688-group',link:'https://chat.whatsapp.com/Gdm2fldetx4CgQTlXIU4Hr'},
  {nome:'#6',id:'120363407634566182-group',link:'https://chat.whatsapp.com/FqcXp5lj5Iv6fln8aOls41'},
  {nome:'#7',id:'120363426601689014-group',link:'https://chat.whatsapp.com/IsQ8zsma0e83xULh9GoSf2'},
  {nome:'#8',id:'120363407550597963-group',link:'https://chat.whatsapp.com/DfaAcQXJdBqH8NiEJoRxmH'},
  {nome:'#9',id:'120363424221379294-group',link:'https://chat.whatsapp.com/H86IAANo3wC5vJLpGLruN5'},
  {nome:'#10',id:'120363425206908330-group',link:'https://chat.whatsapp.com/EKL8Pi3nSDFEnfFysWd6vV'},
  {nome:'#11',id:'120363409632620470-group',link:'https://chat.whatsapp.com/LUekubqMZ1fFBzNc6nr1eh'},
  {nome:'#12',id:'120363426115032457-group',link:'https://chat.whatsapp.com/DiCkqI5M1rc9fD4Uo0Uhpb'},
  {nome:'#13',id:'120363426651817338-group',link:'https://chat.whatsapp.com/JcmJFfNeCTxFCqhNaTK3UL?s=cl&p=a&ilr=1'},
  {nome:'#14',id:'120363406708968616-group',link:'https://chat.whatsapp.com/EZqlQfswqOvCSJgWmP8TpZ'},
  {nome:'#15',id:'120363425674177408-group',link:'https://chat.whatsapp.com/KWGkIwonwYVClO5y44DJPh?s=cl&p=a&ilr=1'},
  {nome:'#16',id:'120363428180805162-group',link:'https://chat.whatsapp.com/EsAXwsLfNQ4BIKHWF20Gxh?s=cl&p=a&ilr=1'},
  {nome:'#17',id:'120363406426269657-group',link:'https://chat.whatsapp.com/Ln7miz76B0BH8EjvaN57YC'},
];

async function buscarLinkConvite(groupId, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN) {
  try {
    const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-invitation-link/${groupId}`, {
      headers: { 'client-token': ZAPI_CLIENT_TOKEN }
    });
    const d = await r.json();
    const link = d.invitationLink || d.link || d.url || d.inviteLink || null;
    return (link && link.startsWith('http')) ? link : null;
  } catch (e) {
    return null;
  }
}

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
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
  const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

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

    // 2) Snapshot do dia — primeiro grupo (#1..#17, em ordem) com vaga
    let grupoAtivoNome = null;
    let snapshotUsado = null;
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
        grupoAtivoNome = ativo.nome;
        snapshotUsado = { data: ds, grupos: snap.grupos };
        break;
      }
    }
    info.etapas.push({ etapa: 'snapshot', usado: snapshotUsado, grupoEscolhido: grupoAtivoNome });

    // 3) Sem snapshot: busca ao vivo na Z-API (mais lento, só usado como fallback)
    if (!grupoAtivoNome && ZAPI_INSTANCE && ZAPI_TOKEN) {
      try {
        const membrosArr = await Promise.all(GRUPOS.map(async g => {
          try {
            const r = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/group-metadata/${g.id}`, { headers: { 'client-token': ZAPI_CLIENT_TOKEN } });
            const d = await r.json();
            return { nome: g.nome, membros: d.participants ? d.participants.length : 0 };
          } catch (e) { return { nome: g.nome, membros: 0 }; }
        }));
        let ativo = membrosArr[membrosArr.length - 1];
        for (const g of membrosArr) {
          if (g.membros < LIMITE) { ativo = g; break; }
        }
        grupoAtivoNome = ativo.nome;
        info.etapas.push({ etapa: 'busca-ao-vivo', membros: membrosArr, grupoEscolhido: grupoAtivoNome });
      } catch (e) {
        info.etapas.push({ etapa: 'busca-ao-vivo', erro: e.message });
      }
    }

    const grupoInfo = GRUPOS.find(g => g.nome === grupoAtivoNome) || GRUPOS[0];
    info.grupoInfo = grupoInfo;

    // Link de convite buscado na hora via Z-API; se falhar, usa o link fixo como respaldo
    let link = null;
    if (ZAPI_INSTANCE && ZAPI_TOKEN) {
      link = await buscarLinkConvite(grupoInfo.id, ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN);
    }
    info.linkZapi = link;
    info.linkFixoRespaldo = grupoInfo.link;
    return finalizar(link || grupoInfo.link || FALLBACK, link ? 'link buscado ao vivo na Z-API' : 'Z-API falhou, usando link fixo salvo');
  } catch (e) {
    info.erroGeral = e.message;
    console.error('grupo.js erro:', e.message);
  }

  return finalizar(FALLBACK, 'erro geral, usando fallback fixo');
}
