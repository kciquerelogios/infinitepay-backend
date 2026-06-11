export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  // ===== VALIDAR CUPOM (público, usado no checkout) =====
  if (req.method === 'POST' && req.body && req.body.action === 'validar') {
    const { codigo, carrinho } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'Código inválido' });

    try {
      const chave = 'cupom_' + codigo.toUpperCase().trim();
      const r = await fetch(`${KV_URL}/get/${chave}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      if (!d.result) return res.status(404).json({ erro: 'Cupom não encontrado' });

      let cupom = d.result;
      while (typeof cupom === 'string') { try { cupom = JSON.parse(cupom); } catch(e) { break; } }

      if (!cupom || !cupom.codigo) return res.status(404).json({ erro: 'Cupom inválido' });
      if (!cupom.ativo) return res.status(400).json({ erro: 'Cupom inativo' });

      // Verificar validade
      if (cupom.validade) {
        const validade = new Date(cupom.validade);
        validade.setHours(23, 59, 59);
        if (new Date() > validade) return res.status(400).json({ erro: 'Cupom expirado' });
      }

      // Verificar limite de usos
      if (cupom.limiteUsos && cupom.usosAtuais >= cupom.limiteUsos) {
        return res.status(400).json({ erro: 'Cupom esgotado' });
      }

      // Calcular desconto
      const subtotal = (carrinho || []).reduce((s, i) => s + (i.preco * i.quantidade), 0);
      let desconto = 0;
      let freteGratis = false;
      let descontoDesc = '';

      if (cupom.tipo === 'percentual') {
        desconto = Math.round(subtotal * cupom.valor / 100);
        descontoDesc = cupom.valor + '% off';
      } else if (cupom.tipo === 'fixo') {
        desconto = Math.min(Math.round(cupom.valor * 100), subtotal);
        descontoDesc = 'R$ ' + cupom.valor.toFixed(2).replace('.', ',') + ' off';
      } else if (cupom.tipo === 'frete_gratis') {
        freteGratis = true;
        descontoDesc = 'Frete grátis';
      } else if (cupom.tipo === 'percentual_frete') {
        desconto = Math.round(subtotal * cupom.valor / 100);
        freteGratis = true;
        descontoDesc = cupom.valor + '% off + Frete grátis';
      }

      return res.status(200).json({
        ok: true,
        cupom: {
          codigo: cupom.codigo,
          tipo: cupom.tipo,
          valor: cupom.valor,
          desconto,
          freteGratis,
          descontoDesc,
          produto: cupom.produto || 'todos'
        }
      });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // ===== ROTAS ADMIN (requer secret) =====
  const secret = req.query.secret || (req.body && req.body.secret);
  if (secret !== process.env.REPROCESSAR_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  // Listar cupons
  if (req.method === 'GET' && req.query.action === 'listar') {
    try {
      const r = await fetch(`${KV_URL}/keys/cupom_*`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      const keys = d.result || [];
      const cupons = await Promise.all(keys.map(async key => {
        const r2 = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d2 = await r2.json();
        let c = d2.result;
        while (typeof c === 'string') { try { c = JSON.parse(c); } catch(e) { break; } }
        return c;
      }));
      return res.status(200).json({ cupons: cupons.filter(Boolean) });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // Criar/editar cupom
  if (req.method === 'POST' && req.body && req.body.action === 'salvar') {
    const { codigo, tipo, valor, validade, limiteUsos, produto, ativo } = req.body;
    if (!codigo || !tipo) return res.status(400).json({ erro: 'Código e tipo são obrigatórios' });

    const cupom = {
      codigo: codigo.toUpperCase().trim(),
      tipo,
      valor: parseFloat(valor) || 0,
      validade: validade || null,
      limiteUsos: limiteUsos ? parseInt(limiteUsos) : null,
      usosAtuais: 0,
      produto: produto || 'todos',
      ativo: ativo !== false,
      criado_em: new Date().toISOString()
    };

    try {
      const chave = 'cupom_' + cupom.codigo;
      await fetch(`${KV_URL}/set/${chave}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(cupom) })
      });
      return res.status(200).json({ ok: true, cupom });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // Deletar cupom
  if (req.method === 'POST' && req.body && req.body.action === 'deletar') {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'Código obrigatório' });
    try {
      await fetch(`${KV_URL}/del/cupom_${codigo.toUpperCase()}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  // Ativar/desativar cupom
  if (req.method === 'POST' && req.body && req.body.action === 'toggle') {
    const { codigo } = req.body;
    try {
      const chave = 'cupom_' + codigo.toUpperCase();
      const r = await fetch(`${KV_URL}/get/${chave}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
      const d = await r.json();
      let cupom = d.result;
      while (typeof cupom === 'string') { try { cupom = JSON.parse(cupom); } catch(e) { break; } }
      cupom.ativo = !cupom.ativo;
      await fetch(`${KV_URL}/set/${chave}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(cupom) })
      });
      return res.status(200).json({ ok: true, ativo: cupom.ativo });
    } catch(e) {
      return res.status(500).json({ erro: e.message });
    }
  }

  return res.status(400).json({ erro: 'Ação inválida' });
}
