export default async function handler(req, res) {
  if (req.query.secret !== process.env.OFERTAS_SECRET && req.query.secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

  const GRUPOS = [
    '120363407575718083-group',
    '120363407700341013-group',
    '120363407514192649-group',
    '120363406939167357-group',
    '120363425311709688-group',
    '120363407634566182-group',
    '120363426601689014-group',
    '120363407550597963-group',
    '120363424221379294-group',
    '120363425206908330-group',
    '120363409632620470-group',
    '120363426115032457-group',
    '120363426651817338-group',
    '120363406708968616-group',
    '120363425674177408-group',
    '120363428180805162-group',
    '120363406426269657-group',
  ];

  try {
    const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const listaData = await listaResp.json();
    const ids = listaData.result || [];

    const agora = new Date();
    const disparadas = [];

    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const d = await r.json();
        if (!d.result) continue;

        let oferta = d.result;
        if (typeof oferta === 'string') oferta = JSON.parse(oferta);

        if (!oferta || oferta.status !== 'agendada') continue;

        // dataHora está em Brasília (UTC-3), converter para UTC somando 3h
        const dataEnvio = new Date(new Date(oferta.dataHora).getTime() + 3 * 60 * 60 * 1000);
        const diffMin = (agora - dataEnvio) / 1000 / 60;
        if (diffMin < 0 || diffMin > 2) continue;

        // Grupos para enviar
        let gruposEnviar = GRUPOS;
        if (oferta.grupos && oferta.grupos !== 'todos') {
          gruposEnviar = oferta.grupos.split(',').filter(Boolean);
        }

        let erros = 0;
        for (const grupo of gruposEnviar) {
          try {
            const endpoint = oferta.imagem ? 'send-image' : 'send-text';
            const body = oferta.imagem
              ? { phone: grupo, image: oferta.imagem, caption: oferta.texto + (oferta.link ? '\n\n🔗 ' + oferta.link : '') }
              : { phone: grupo, message: oferta.texto + (oferta.link ? '\n\n🔗 ' + oferta.link : '') };

            await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            await new Promise(r => setTimeout(r, 1000));
          } catch(e) { erros++; }
        }

        oferta.status = erros === 0 ? 'enviada' : 'erro';
        oferta.enviada_em = new Date().toISOString();

        await fetch(`${KV_URL}/set/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(JSON.stringify(oferta))
        });

        disparadas.push({ id, grupos: gruposEnviar.length, erros });
      } catch(e) { console.error('Erro oferta', id, e.message); }
    }

    return res.status(200).json({ success: true, disparadas, total: disparadas.length, verificadas: ids.length });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
