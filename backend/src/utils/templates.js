const { randomUUID: uuidv4 } = require("crypto");
const config = require("../config/env");

// Transações do simulador de maquininha: id -> momento em que foi criada.
const transacoesSimuladas = new Map();
const PREFIXO_SIMULADO = "sim_";

// Decide se a cobrança usa a API real do Mercado Pago ou o simulador.
function usarSimulador(api_key, terminal) {
  const modo = config.mercadoPago.mode;
  if (modo === "mock") return true;
  if (modo === "real") return false;
  return !api_key || !terminal;
}

const utils = {
  jsonMount: (boll, data, msg) => {
    return { payload: { boleano: boll, obj: data, mensagem: msg } };
  },

  errorHandle: (error, rota) => {
    console.log(`Erro na rota ${rota}`);
    console.log(error);
    return utils.jsonMount(false, {}, "Tente novamente mais tarde!");
  },

  isTransacaoSimulada: (id) => String(id || "").startsWith(PREFIXO_SIMULADO),

  // A "maquininha" simulada aprova depois de MOCK_PAYMENT_DELAY_MS.
  simulacaoAprovada: (id) => {
    const criadaEm = transacoesSimuladas.get(String(id));
    if (!criadaEm) return true; // API reiniciou no meio: aprova
    return Date.now() - criadaEm >= config.mercadoPago.mockDelayMs;
  },

  /**
   * Cria uma ordem de pagamento na maquininha (Mercado Pago Point, API de
   * Orders). Retorna o id da ordem, que vira o external_id da venda.
   */
  mercado_pago: async (
    vendaId,
    total,
    payment_method,
    parcelas,
    terminal,
    api_key
  ) => {
    if (usarSimulador(api_key, terminal)) {
      const id = `${PREFIXO_SIMULADO}${uuidv4()}`;
      transacoesSimuladas.set(id, Date.now());
      console.log(
        `[simulador] cobrança ${id}: venda ${vendaId}, R$ ${Number(total).toFixed(2)} (${payment_method})`
      );
      return id;
    }

    let metodo = "";
    if (payment_method === "debito") {
      metodo = "debit_card";
    } else if (payment_method === "qr") {
      metodo = "qr";
    } else {
      metodo = "credit_card";
    }
    const myUUID = uuidv4();
    const mpPayload = {
      type: "point",
      external_reference: `venda_${vendaId}`,
      expiration_time: "PT16M",
      transactions: {
        payments: [
          {
            amount: Number(total).toFixed(2),
          },
        ],
      },
      config: {
        point: {
          terminal_id: terminal,
          print_on_terminal: "seller_ticket",
        },
        payment_method: {
          default_type: metodo || "credit_card",
        },
      },
      description: `Venda ID ${vendaId}`,
    };
    if (metodo === "credit_card" && parcelas) {
      mpPayload.config.payment_method.default_installments = parcelas;
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
        "X-Idempotency-Key": myUUID,
      },
      body: JSON.stringify(mpPayload),
    });
    const mpData = await mpResponse.json();
    if (!mpResponse.ok || !mpData.id) {
      console.log("Mercado Pago recusou a ordem:", mpResponse.status, mpData);
      throw new Error("Falha ao criar a ordem no Mercado Pago");
    }
    return mpData.id;
  },

  /**
   * Imprime o comprovante (não fiscal) na própria maquininha, com a API de
   * ações do terminal. Sem maquininha configurada, o comprovante vai para o
   * console da API.
   */
  imprimir: async (
    terminal,
    api_key,
    produtos,
    total,
    empresa,
    venda,
    caixa,
    usuario,
    cnpj,
    forma_pagamento
  ) => {
    const numeroWhatsapp = config.receiptWhatsapp;
    const itensFormatados = (produtos || [])
      .map((p) => {
        let unidade = "";
        if (p.type === "PESO") {
          unidade = "Kg";
        } else {
          unidade = "und";
        }
        // Safe check for unit price calculation
        const unitPrice = p.quantity > 0 ? p.line_total / p.quantity : 0;

        // Multi-line layout for better readability
        return `{s}${p.name}{/s}{br}{s}${
          p.quantity
        } ${unidade}  x R$${unitPrice.toFixed(2)} = R$${Number(p.line_total).toFixed(
          2
        )}{/s}{br}{s}- - - - - - - - - - - - - - - - - -{/s}{br}`;
      })
      .join("");

    const dataAtual = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const text_pagamento = Array.isArray(forma_pagamento)
      ? forma_pagamento.map((p) => p.method).join(", ")
      : "Não Informado";
    const rodapeWhatsapp = numeroWhatsapp
      ? `{center}{s}Atendimento via WhatsApp:{/s}{/center}{br}
{center}{qr}https://wa.me/${numeroWhatsapp}{/qr}{/center}{br}{br}`
      : "";
    // Organized content structure
    const conteudo = `
{br}{center}{w}{b}${empresa || ""}{/b}{/w}{/center}
{center}{s}CNPJ: ${cnpj || ""}{/s}{/center}{br}
{center}--------------------------------{/center}{br}
{center}{b}COMPROVANTE DE ENTREGA{/b}{/center}{br}
{center}{s}*** NÃO É DOCUMENTO FISCAL ***{/s}{/center}{br}
{center}--------------------------------{/center}{br}
{s}DATA: ${dataAtual}{/s}{br}
{s}PEDIDO: ${venda} | CAIXA: ${caixa}{/s}{br}
{s}ATENDENTE: ${usuario || ""}{/s}{br}
{center}--------------------------------{/center}{br}{br}
{s}{b}ITENS CONSUMIDOS{/b}{/s}{br}
{center}--------------------------------{/center}{br}
${itensFormatados}
{br}
{center}{w}{b}TOTAL: R$ ${Number(total).toFixed(2)}{/b}{/w}{/center}{br}
{br}
{center}--------------------------------{/center}{br}
{s}FORMA DE PAGAMENTO:{/s}{br}
{s}{b}${text_pagamento}{/b}{/s}{br}
{center}--------------------------------{/center}{br}
{br}
{center}{s}Obrigado pela preferência!{/s}{/center}{br}
${rodapeWhatsapp}`;

    if (usarSimulador(api_key, terminal)) {
      console.log("[simulador] comprovante que iria para a maquininha:");
      console.log(conteudo);
      return;
    }

    const mpPayload = {
      type: "print",
      config: {
        point: {
          terminal_id: terminal,
          subtype: "custom",
        },
      },
      external_reference: uuidv4().slice(0, 12),
      content: conteudo,
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/terminals/v1/actions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api_key}`,
          "X-Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify(mpPayload),
      }
    );

    const mpData = await mpResponse.json();
    console.log(mpData);
  },

  cancelar_pagamento_mercado: async (venda_id, api_key) => {
    if (!api_key) return;
    const myUUID = uuidv4();
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(venda_id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api_key}`,
          "X-Idempotency-Key": myUUID,
        },
        body: JSON.stringify({ status: "cancelled" }),
      }
    );
    const mpData = await mpResponse.json();
    console.log(mpData);
  },
};

module.exports = utils;
