export default async function handler(req, res) {
  // Verificar se é chamada do Vercel Cron
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
      req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    // Buscar lista de leads pendentes
    const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/500`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const listaData = await listaResp.json();
    const idsRaw = listaData.result || [];

    const ids = idsRaw.map(i => {
      if (typeof i === 'string') {
        try { const p = JSON.parse(i); return p.value || i; } catch(e) { return i; }
      }
      return i.value || i;
    });

    let atualizados = 0;

    for (const id of ids) {
      try {
        const r = await fetch(`${KV_URL}/get/${id}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const d = await r.json();
        if (!d.result) continue;

        let lead = d.result;
        while (typeof lead === 'string') {
          try { lead = JSON.parse(lead); } catch(e) { break; }
        }
        if (lead && lead.value) {
          let inner = lead.value;
          while (typeof inner === 'string') {
            try { inner = JSON.parse(inner); } catch(e) { break; }
          }
          lead = inner;
        }

        // Verificar leads pagamento_pendente com mais de 10 minutos
        if (lead && lead.estagio === 'pagamento_pendente' && lead.atualizado_em) {
          const agora = new Date();
          const atualizado = new Date(lead.atualizado_em);
          const minutos = (agora - atualizado) / 1000 / 60;

          if (minutos >= 10) {
            // Marcar como abandonou no pagamento
            lead.estagio = 'abandonou_pagamento';
            lead.atualizado_em = new Date().toISOString();

            await fetch(`${KV_URL}/set/${id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 })
            });

            atualizados++;
            console.log(`Lead ${id} marcado como abandonou_pagamento`);
          }
        }
      } catch(e) {
        console.log('Erro ao processar lead:', id, e.message);
      }
    }

    return res.status(200).json({ ok: true, atualizados });
  } catch(e) {
    return res.status(500).json({ erro: e.message });
  }
}
