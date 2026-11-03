const models = require("../models/models_api");
const { postgres } = require("../server/connect");

const execute = {
  execute_busca_produto: async (busca, empresa_id) => {
    const client = await postgres.connect();
    try {
      const nome = "%" + busca + "%";
      const ret = await client.query(models.busca_produto(), [
        nome,
        busca,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_produtos_peso: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_products_peso(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_criar_intencao_venda: async (
    usuario,
    metodo,
    pagamento,
    caixa,
    empresa_id,
    filial_id,
    troco,
    recebido
  ) => {
    const client = await postgres.connect();
    try {
      let status = "";
      if (metodo === "especie") {
        status = "processed";
      } else {
        status = "pending";
      }
      const valor_troco = metodo === "especie" ? troco : 0;
      const valor_recebido = metodo === "especie" ? recebido : 0;
      const ret = await client.query(models.criar_intencao_venda(), [
        usuario,
        metodo,
        pagamento,
        status,
        caixa,
        empresa_id,
        filial_id,
        valor_troco,
        valor_recebido,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_products_intention: async (venda_id, produtos) => {
    const client = await postgres.connect();
    try {
      if (!Array.isArray(produtos) || produtos.length === 0) {
        throw new Error("Lista de produtos inválida.");
      }

      const values = [];
      const placeholders = produtos
        .map((p, i) => {
          const baseIndex = i * 4; // 4 colunas a inserir
          values.push(
            venda_id, // $1
            p.id, // $2
            p.quantity, // $3
            p.line_total // $4
          );
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${
            baseIndex + 4
          })`;
        })
        .join(", ");

      const sql = `
      INSERT INTO venda_produto (venda_id, produto_id, qt_it, valor)
      VALUES ${placeholders}
    `;

      await client.query(sql, values);
      console.log("✅ Produtos inseridos com sucesso!");
    } catch (err) {
      console.error("Erro ao inserir produtos:", err);
      throw err;
    } finally {
      client.release();
    }
  },

  execute_update_venda: async (venda_id, mp_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.update_venda(), [venda_id, mp_id]);
    } finally {
      client.release();
    }
  },

  execute_append_external_id: async (venda_id, mp_id, metodo, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.append_external_id(), [
        venda_id,
        mp_id,
        metodo,
        empresa_id,
      ]);
      return ret.rowCount;
    } finally {
      client.release();
    }
  },

  execute_valida_pagamento: async (venda_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.valida_pagamento(), [
        `%${venda_id}%`,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_get_products: async (venda_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_products(), [venda_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_consolida_estoque: async (
    produto_id,
    vitrine,
    estoque,
    total,
    empresa_id,
    filial_id
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.consolida_estoque(), [
        produto_id,
        vitrine,
        estoque,
        total,
        empresa_id,
        filial_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_get_produtos: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_all_produtos(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_terminal: async (empresa_id, filial_id, caixa) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_terminal(), [
        empresa_id,
        filial_id,
        caixa,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_api_key: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_api_key(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_user: async (usuario_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_user(), [usuario_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_promocoes: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_promocoes(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_cancelar_pagamento: async (venda_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.cancelar_pagamento(), [
        venda_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_abertura_caixa: async (
    usuario_id,
    caixa_id,
    filial_id,
    empresa_id,
    valor_abertura
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.abertura_caixa(), [
        usuario_id,
        caixa_id,
        filial_id,
        empresa_id,
        valor_abertura,
        valor_abertura,
        valor_abertura,
      ]);
    } finally {
      client.release();
    }
  },

  execute_fechamento_caixa: async (caixa_id, filial_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.fechamento_caixa(), [
        caixa_id,
        filial_id,
        empresa_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_ruptura: async (
    usuario_id,
    caixa_id,
    filial_id,
    empresa_id,
    valor_ruptura,
    motivo
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.ruptura(), [
        caixa_id,
        usuario_id,
        filial_id,
        empresa_id,
        valor_ruptura,
        motivo,
      ]);
    } finally {
      client.release();
    }
  },

  execute_get_valor_fechamneto_especie: async (
    caixa_id,
    filial_id,
    empresa_id,
    data_abertura
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_valor_fechamneto_especie(), [
        caixa_id,
        filial_id,
        empresa_id,
        data_abertura,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_valor_fechamneto: async (
    caixa_id,
    filial_id,
    empresa_id,
    data_abertura
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_valor_fechamneto(), [
        caixa_id,
        filial_id,
        empresa_id,
        data_abertura,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_dados_abertura: async (caixa_id, filial_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_dados_abertura(), [
        caixa_id,
        filial_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_rupturas: async (
    caixa_id,
    filial_id,
    empresa_id,
    data_abertura
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_rupturas(), [
        caixa_id,
        filial_id,
        empresa_id,
        data_abertura,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_aprovar_pagamento_simulado: async (external_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.aprovar_pagamento_simulado(), [
        external_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
