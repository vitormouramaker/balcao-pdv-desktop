const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_api");
const utils = require("../utils/templates");

// Todas as rotas daqui passam pelo requireAuth (app.js): empresa_id, user_id e
// usuario_id do corpo e o ?e= da query já vêm preenchidos a partir do token.

// Baixa o estoque dos itens da venda: tira primeiro da vitrine e o que faltar
// do estoque. Produtos vendidos por peso não têm controle de estoque aqui.
async function consolidarEstoque(venda_id, empresa_id, filial_id) {
  const produtos = await execute.execute_get_products(venda_id);
  await Promise.all(
    produtos.map(async (produto) => {
      if (produto.type !== "PESO") {
        let vitrine = 0;
        let estoque = 0;
        const total = produto.total - produto.saida;

        if (produto.vitrine - produto.saida < 0) {
          estoque = produto.estoque - (produto.saida - produto.vitrine);
        } else {
          vitrine = produto.vitrine - produto.saida;
          estoque = produto.estoque;
        }
        await execute.execute_consolida_estoque(
          produto.produto_id,
          vitrine,
          estoque,
          total,
          empresa_id,
          filial_id
        );
      }
    })
  );
}

rota.get("/search", async (req, res) => {
  try {
    const { q, e } = req.query;
    const produtos = await execute.execute_busca_produto(String(q || ""), e);
    return res.json(utils.jsonMount(true, produtos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/search"));
  }
});

rota.get("/products", async (req, res) => {
  try {
    const { e } = req.query;
    const produtos = await execute.execute_get_produtos(e);
    return res.json(utils.jsonMount(true, produtos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/products"));
  }
});

rota.get("/produtos_peso", async (req, res) => {
  try {
    const { e } = req.query;
    const produtos = await execute.execute_get_produtos_peso(e);
    return res.json(utils.jsonMount(true, produtos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/produtos_peso"));
  }
});

rota.get("/promocoes", async (req, res) => {
  try {
    const { e } = req.query;
    const produtos = await execute.execute_get_promocoes(e);
    return res.json(utils.jsonMount(true, produtos, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/promocoes"));
  }
});

rota.post("/gerar_venda", async (req, res) => {
  try {
    const data = req.body;

    const metodoPrincipal =
      data.payments && data.payments.length > 0
        ? data.payments[0].method
        : data.method;

    const venda = await execute.execute_criar_intencao_venda(
      data.user_id,
      metodoPrincipal,
      data.total,
      data.caixa,
      data.empresa_id,
      data.filial_id,
      data.change_amount,
      data.amount_tendered
    );
    await execute.execute_insert_products_intention(venda[0].id, data.products);

    // Identifica o PRIMEIRO pagamento eletrônico para iniciar o processo
    let firstElectronicPayment = null;
    if (data.payments && Array.isArray(data.payments)) {
      firstElectronicPayment = data.payments.find(
        (p) => p.method !== "especie"
      );
    } else if (data.method !== "especie") {
      firstElectronicPayment = {
        method: data.method,
        amount: data.total,
        installments: data.installments,
      };
    }

    if (firstElectronicPayment) {
      const terminal = await execute.execute_get_terminal(
        data.empresa_id,
        data.filial_id,
        data.caixa
      );
      const api_key = await execute.execute_get_api_key(data.empresa_id);

      const response_mercado_pago = await utils.mercado_pago(
        venda[0].id,
        firstElectronicPayment.amount,
        firstElectronicPayment.method,
        firstElectronicPayment.installments,
        terminal[0]?.terminal_id,
        api_key[0]?.api_key
      );

      await execute.execute_update_venda(venda[0].id, response_mercado_pago);

      return res.json(
        utils.jsonMount(
          true,
          { transaction_id: response_mercado_pago, venda_id: venda[0].id },
          ""
        )
      );
    } else {
      // Apenas espécie
      await consolidarEstoque(venda[0].id, data.empresa_id, data.filial_id);
      return res.json(
        utils.jsonMount(
          true,
          { transaction_id: null, venda_id: venda[0].id },
          ""
        )
      );
    }
  } catch (error) {
    return res.json(utils.errorHandle(error, "/gerar_venda"));
  }
});

rota.post("/continuar_pagamento", async (req, res) => {
  try {
    const data = req.body;

    const terminal = await execute.execute_get_terminal(
      data.empresa_id,
      data.filial_id,
      data.caixa
    );
    const api_key = await execute.execute_get_api_key(data.empresa_id);

    const response_mercado_pago = await utils.mercado_pago(
      data.venda_id,
      data.amount,
      data.method,
      data.installments,
      terminal[0]?.terminal_id,
      api_key[0]?.api_key
    );

    // Adiciona o novo ID ao campo external_id (o anterior vai para old_id).
    // Só altera vendas da empresa do operador logado.
    const alteradas = await execute.execute_append_external_id(
      data.venda_id,
      response_mercado_pago,
      data.method,
      data.empresa_id
    );
    if (!alteradas) {
      return res.json(utils.jsonMount(false, {}, "Venda não encontrada"));
    }

    return res.json(
      utils.jsonMount(true, { transaction_id: response_mercado_pago }, "")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/continuar_pagamento"));
  }
});

// Recebe o id da transação (external_id) da venda em andamento.
rota.get("/cancelar/:venda_id", async (req, res) => {
  try {
    const { venda_id } = req.params; // pega o parâmetro da URL
    const empresa_id = req.auth.empresa_id;
    const venda = await execute.execute_cancelar_pagamento(venda_id, empresa_id);
    if (!venda || !venda[0]) {
      return res.json(utils.jsonMount(false, {}, "Venda não encontrada"));
    }
    if (!utils.isTransacaoSimulada(venda_id)) {
      const api_key = await execute.execute_get_api_key(venda[0].empresa_id);
      await utils.cancelar_pagamento_mercado(venda_id, api_key[0]?.api_key);
    }
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cancelar"));
  }
});

rota.get("/valida_pagamento/:venda_id", async (req, res) => {
  try {
    const { venda_id } = req.params; // pega o parâmetro da URL
    const empresa_id = req.auth.empresa_id;

    // Simulador: depois do tempo configurado, a "maquininha" aprova. Em
    // produção quem muda o status é o retorno do Mercado Pago.
    if (utils.isTransacaoSimulada(venda_id) && utils.simulacaoAprovada(venda_id)) {
      // O estoque já foi baixado no /gerar_venda (o front sempre cria a
      // venda antes da primeira cobrança eletrônica), então aqui só muda o
      // status.
      await execute.execute_aprovar_pagamento_simulado(venda_id, empresa_id);
    }

    const venda = await execute.execute_valida_pagamento(venda_id, empresa_id);
    if (!venda || !venda[0]) {
      return res.json(utils.jsonMount(false, {}, "Venda não encontrada"));
    }
    return res.json(
      utils.jsonMount(true, { status: venda[0].status_venda }, "")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/valida_pagamento"));
  }
});

rota.post("/imprimir", async (req, res) => {
  try {
    const data = req.body;
    const terminal = await execute.execute_get_terminal(
      data.empresa_id,
      data.filial_id,
      data.caixa
    );
    const user = await execute.execute_get_user(data.user_id);
    const api_key = await execute.execute_get_api_key(data.empresa_id);
    await utils.imprimir(
      terminal[0]?.terminal_id,
      api_key[0]?.api_key,
      data.products,
      data.total,
      api_key[0]?.nome_fantasia,
      data.venda_id,
      data.caixa,
      user[0]?.nome,
      api_key[0]?.cnpj,
      data.payments
    );
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/imprimir"));
  }
});

rota.post("/abertura", async (req, res) => {
  try {
    const data = req.body;
    await execute.execute_abertura_caixa(
      data.usuario_id,
      data.caixa_id,
      data.filial_id,
      data.empresa_id,
      data.valor_abertura
    );
    return res.json(utils.jsonMount(true, {}, "Caixa aberto com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/abertura"));
  }
});

rota.post("/valor_fechamento", async (req, res) => {
  try {
    const data = req.body;
    const dados_abertura = await execute.execute_get_dados_abertura(
      data.caixa_id,
      data.filial_id,
      data.empresa_id
    );
    if (!dados_abertura[0]) {
      return res.json(utils.jsonMount(false, {}, "Caixa não está aberto"));
    }
    const valor_fechamento = await execute.execute_get_valor_fechamneto_especie(
      data.caixa_id,
      data.filial_id,
      data.empresa_id,
      dados_abertura[0].data_abertura
    );
    const rupturas = await execute.execute_get_rupturas(
      data.caixa_id,
      data.filial_id,
      data.empresa_id,
      dados_abertura[0].data_abertura
    );
    const valores_gerais = await execute.execute_get_valor_fechamneto(
      data.caixa_id,
      data.filial_id,
      data.empresa_id,
      dados_abertura[0].data_abertura
    );
    const totais = {
      // A chave "valor_abertua" (sic) é a que o front lê.
      valor_abertua: dados_abertura[0].valor_abertura,
      valor_especie:
        dados_abertura[0].valor_abertura +
        valor_fechamento[0].valor -
        rupturas[0].valor,
      valor_total:
        dados_abertura[0].valor_abertura +
        valores_gerais[0].valor -
        rupturas[0].valor,
    };
    return res.json(utils.jsonMount(true, totais, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/valor_fechamento"));
  }
});

rota.post("/fechamento", async (req, res) => {
  try {
    const data = req.body;
    await execute.execute_fechamento_caixa(
      data.caixa_id,
      data.filial_id,
      data.empresa_id
    );
    return res.json(utils.jsonMount(true, {}, "Caixa fechado com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/fechamento"));
  }
});

rota.post("/ruptura", async (req, res) => {
  try {
    const data = req.body;
    await execute.execute_ruptura(
      data.usuario_id,
      data.caixa_id,
      data.filial_id,
      data.empresa_id,
      data.valor_ruptura,
      data.motivo
    );
    return res.json(
      utils.jsonMount(true, {}, "Ruptura registrada com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/ruptura"));
  }
});

module.exports = rota;
