export default async function handler(req, res) {
  // Aceitar GET do cron-job.org ou POST
  const secret = req.query.secret || req.headers['x-secret'];
  if (secret !== process.env.OFERTAS_SECRET && secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

  const GRUPOS = [
    '120363407575718083-group', // #1
    '120363407700341013-group', // #2
    '120363407514192649-group', // #3
    '120363406939167357-group', // #4
    '120363425311709688-group', // #5
    '120363407634566182-group', // #6
    '120363426601689014-group', // #7
    '120363407550597963-group', // #8
    '120363424221379294-group', // #9
    '120363425206908330-group', // #10
    '120363409632620470-group', // #11
    '120363426115032457-group', // #12
    '120363426651817338-group', // #13
    '120363406708968616-group', // #14
    '120363425674177408-group', // #15
    '120363428180805162-group', // #16
    '120363406426269657-group', // #17
  ];

  try {
    // Buscar todas as ofertas
    const listaResp = await fetch(`${KV_URL}/lrange/ofertas-lista/0/-1`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const listaData = await listaResp.json();
    const ids = listaData.result || [];

    const agora = new Date();
    const disparadas = [];

    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d = await r.json();
        if (!d.result) continue;

        let oferta = d.result;
        while (typeof oferta === 'string') oferta = JSON.parse(oferta);
        if (oferta && oferta.value) { let v = oferta.value; while (typeof v === 'string') v = JSON.parse(v); oferta = v; }

        if (!oferta || oferta.status !== 'agendada') continue;

        // Converter dataHora para UTC (usuário entra em Brasília UTC-3)
        const dataEnvio = new Date(new Date(oferta.dataHora).getTime() + 3 * 60 * 60 * 1000);

        // Verificar se está na hora (margem de 2 minutos)
        const diff = (agora - dataEnvio) / 1000 / 60;
        if (diff < 0 || diff > 2) continue;

        // Determinar grupos para enviar
        let gruposEnviar = GRUPOS;
        if (oferta.grupos && oferta.grupos !== 'todos') {
          gruposEnviar = oferta.grupos.split(',').filter(Boolean);
        }

        // Enviar para cada grupo
        let erros = 0;
        for (const grupo of gruposEnviar) {
          try {
            // Enviar imagem se tiver
            if (oferta.imagem) {
              await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: grupo,
                  image: oferta.imagem,
                  caption: oferta.texto + (oferta.link ? '\n\n🔗 ' + oferta.link : '')
                })
              });
            } else {
              // Só texto
              await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: grupo,
                  message: oferta.texto + (oferta.link ? '\n\n🔗 ' + oferta.link : '')
                })
              });
            }
            // Aguardar 1s entre grupos para não ser bloqueado
            await new Promise(r => setTimeout(r, 1000));
          } catch(e) {
            erros++;
          }
        }

        // Atualizar status da oferta
        oferta.status = erros === 0 ? 'enviada' : 'erro';
        oferta.enviada_em = new Date().toISOString();
        oferta.grupos_enviados = gruposEnviar.length;
        oferta.erros = erros;

        await fetch(`${KV_URL}/set/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: JSON.stringify(oferta), ex: 60 * 60 * 24 * 30 })
        });

        disparadas.push({ id, grupos: gruposEnviar.length, erros });

      } catch(e) {
        console.error('Erro ao processar oferta:', id, e.message);
      }
    }

    return res.status(200).json({ success: true, disparadas, total: disparadas.length, verificadas: ids.length });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
