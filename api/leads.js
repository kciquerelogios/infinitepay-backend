export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // LIMPAR TODOS OS LEADS (verificar ANTES do salvar)
  if (req.method === 'POST' && req.body?.action === 'limpar_leads') {
    if (req.body.secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    try {
      const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/500`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const listaData = await listaResp.json();
      const ids = [...new Set(listaData.result || [])];
      await Promise.all([
        ...ids.map(id => fetch(`${KV_URL}/del/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } })),
        fetch(`${KV_URL}/del/leads-lista`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } })
      ]);
      return res.status(200).json({ ok: true, deletados: ids.length });
    } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // SALVAR LEAD
  if (req.method === 'POST') {
    const body = req.body;
    const email = body.email;
    if (!email) return res.status(400).json({ erro: 'Email obrigatório' });

    const id = `lead-${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    const lead = {
      id,
      nome: body.nome || '',
      email,
      telefone: body.telefone || '',
      cpf: body.cpf || '',
      estagio: body.estagio || 'dados',
      carrinho: body.carrinho || [],
      frete: body.frete || null,
      cep: body.cep || '',
      rua: body.rua || '',
      numero: body.numero || '',
      complemento: body.complemento || '',
      bairro: body.bairro || '',
      cidade: body.cidade || '',
      estado: body.estado || '',
      atualizado_em: new Date().toISOString(),
      contatado: false
    };

    try {
      // Verificar se já existe lead com esse email
      const existeResp = await fetch(`${KV_URL}/get/${id}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const existeData = await existeResp.json();
      const jaExiste = !!existeData.result;

      if (jaExiste) {
        // Atualizar lead existente preservando criado_em e só avançar estágio
        let leadAtual = existeData.result;
        while (typeof leadAtual === 'string') { try { leadAtual = JSON.parse(leadAtual); } catch(e) { break; } }
        // Estágio será recalculado pelo merge de tags abaixo
        // Atualizar campos preenchidos
        ['nome','telefone','cpf','cep','rua','numero','complemento','bairro','cidade','estado','frete','carrinho'].forEach(k => {
          if (lead[k] && lead[k] !== '' && lead[k] !== null) leadAtual[k] = lead[k];
        });
        // Merge tags — nunca perder tags anteriores
        const tagsAntigas = leadAtual.tags || [];
        const tagsNovas = lead.tags || [];
        const tagsMerged = [...new Set([...tagsAntigas, ...tagsNovas])];
        leadAtual.tags = tagsMerged;
        // Estagio = tag mais avançada
        const ordemTags = ['cep_produto','identificacao','endereco','calculou_frete','frete_selecionado','pagamento_pendente'];
        const melhorTag = tagsMerged.filter(t => ordemTags.includes(t)).sort((a,b) => ordemTags.indexOf(b) - ordemTags.indexOf(a))[0];
        if (melhorTag) leadAtual.estagio = melhorTag;
        leadAtual.atualizado_em = new Date().toISOString();
        await fetch(`${KV_URL}/set/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: JSON.stringify(leadAtual), ex: 604800 })
        });
      } else {
        // Criar novo lead
        lead.id = id;
        lead.criado_em = new Date().toISOString();
        await fetch(`${KV_URL}/set/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: JSON.stringify(lead), ex: 604800 })
        });
        // Adicionar na lista só uma vez
        await fetch(`${KV_URL}/lpush/leads-lista/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
      }

      return res.status(200).json({ ok: true, id });
    } catch(e) {
      console.error('Erro leads POST:', e.message);
      return res.status(500).json({ erro: e.message });
    }
  }

  // LISTAR LEADS
  if (req.method === 'GET') {
    const { secret } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });

    try {
      const listaResp = await fetch(`${KV_URL}/lrange/leads-lista/0/500`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const listaData = await listaResp.json();
      const idsRaw = listaData.result || [];

      const ids = idsRaw.map(i => {
        if (typeof i === 'string') { try { const p = JSON.parse(i); return p.value || i; } catch(e) { return i; } }
        return i.value || i;
      });

      function desencapsular(val) {
        let v = val;
        for (let i = 0; i < 10; i++) {
          if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { break; } }
          else if (v && typeof v === 'object') {
            if (v.value !== undefined) { v = v.value; continue; }
            if (v.result !== undefined) { v = v.result; continue; }
            break;
          } else break;
        }
        return v;
      }

      // Buscar todos em paralelo (muito mais rápido que sequencial)
      const idsUnicos = [...new Set(ids)].slice(0, 200); // max 200
      const resultados = await Promise.all(
        idsUnicos.map(id =>
          fetch(`${KV_URL}/get/${id}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } })
            .then(r => r.json()).catch(() => ({}))
        )
      );

      const leads = [];
      const idsVistos = new Set();
      for (const d of resultados) {
        try {
          if (!d.result) continue;
          const parsed = desencapsular(d.result);
          if (parsed && parsed.email && !idsVistos.has(parsed.id)) {
            idsVistos.add(parsed.id);
            leads.push(parsed);
          }
        } catch(e) {}
      }

      leads.sort((a, b) => new Date(b.atualizado_em || b.criado_em) - new Date(a.atualizado_em || a.criado_em));
      return res.status(200).json({ leads });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // DELETAR LEAD
  if (req.method === 'DELETE') {
    const { secret, id } = req.query;
    if (secret !== process.env.REPROCESSAR_SECRET) return res.status(401).json({ erro: 'Não autorizado' });
    await fetch(`${KV_URL}/del/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    await fetch(`${KV_URL}/lrem/leads-lista/0/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
