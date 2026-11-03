/**
 * Dados fictícios para rodar o PDV localmente: uma padaria de demonstração com
 * uma loja, dois caixas, operadores, catálogo, estoque e promoções do dia.
 *
 *   npm run seed:demo                     senha padrão Demo@123
 *   SEED_SENHA="OutraSenha@1" npm run seed:demo
 *
 * Pode rodar de novo: o que já existe é mantido, as senhas são redefinidas e
 * as promoções ganham uma nova janela a partir de agora.
 *
 * Trava de segurança: não roda com NODE_ENV=production.
 */
const crypto = require("crypto");
const { Client } = require("pg");
const config = require("../src/config/env");
const { hashSenha } = require("../src/security/auth");

const DOMINIO = "demo.pdv.test";

const USUARIOS = [
  { id: 1, nome: "Ana Operadora", email: `operador@${DOMINIO}`, perfil: 2 },
  { id: 2, nome: "Bruno Gerente", email: `gerente@${DOMINIO}`, perfil: 1 },
  // Conta com hash MD5 antigo, para ver a migração para bcrypt no 1º login.
  { id: 3, nome: "Carla Legado", email: `legado@${DOMINIO}`, perfil: 2, legado: true },
];

// [id, nome, código de barras, unidade, preço, promo?]
const PRODUTOS = [
  [1, "Pão Francês (kg)", "2001", "PESO", 16.9],
  [2, "Pão de Queijo (kg)", "2002", "PESO", 42.0],
  [3, "Queijo Muçarela Fatiado (kg)", "2003", "PESO", 54.9],
  [4, "Presunto Fatiado (kg)", "2004", "PESO", 39.9],
  [5, "Bolo de Cenoura (kg)", "2005", "PESO", 34.0, 29.9],
  [6, "Café Coado 200ml", "7890000000017", "UNIDADE", 5.5],
  [7, "Cappuccino 300ml", "7890000000024", "UNIDADE", 9.9, 7.9],
  [8, "Suco de Laranja 400ml", "7890000000031", "UNIDADE", 8.5],
  [9, "Água Mineral 500ml", "7890000000048", "UNIDADE", 3.0],
  [10, "Refrigerante Lata 350ml", "7890000000055", "UNIDADE", 5.0],
  [11, "Croissant de Chocolate", "7890000000062", "UNIDADE", 8.9, 6.9],
  [12, "Sonho de Creme", "7890000000079", "UNIDADE", 6.5],
  [13, "Coxinha de Frango", "7890000000086", "UNIDADE", 7.0],
  [14, "Pão de Forma Integral 500g", "7890000000093", "UNIDADE", 11.9],
  [15, "Leite Integral 1L", "7890000000109", "UNIDADE", 5.99, 4.99],
  [16, "Manteiga 200g", "7890000000116", "UNIDADE", 12.5],
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Este roteiro cria contas com senha conhecida e não roda em produção.");
  }

  const senha = String(process.env.SEED_SENHA || "").trim() || "Demo@123";
  const hash = await hashSenha(senha);
  const md5 = crypto.createHash("md5").update(senha).digest("hex");

  // Sessão em UTC, igual à da API (as datas de promoção são calculadas aqui).
  const db = new Client({ ...config.db, options: "-c timezone=UTC" });
  await db.connect();
  try {
    await db.query("begin");

    await db.query(
      `insert into empresa (id, nome_fantasia, cnpj, token_api)
       values (1, 'Padaria Modelo (demonstração)', '00.000.000/0000-00', null)
       on conflict (id) do nothing`
    );
    await db.query(
      `insert into filial (id, empresa_id, nome) values (1, 1, 'Loja Centro')
       on conflict (id) do nothing`
    );
    await db.query(
      `insert into caixa (id, empresa_id, filial_id, nome, terminal_id) values
         (1, 1, 1, 'Caixa 01', null),
         (2, 1, 1, 'Caixa 02', null)
       on conflict (id) do nothing`
    );
    await db.query(
      `insert into perfil (id, nome, ativo) values
         (1, 'master', true),
         (2, 'frente de caixa', true)
       on conflict (id) do nothing`
    );

    for (const u of USUARIOS) {
      await db.query(
        `insert into usuario (id, empresa_id, perfil_id, nome, email, senha, ativo)
         values ($1, 1, $2, $3, $4, $5, true)
         on conflict (id) do update set senha = excluded.senha, ativo = true`,
        [u.id, u.perfil, u.nome, u.email, u.legado ? md5 : hash]
      );
    }

    for (const [id, nome, barra, unidade, preco, promo] of PRODUTOS) {
      await db.query(
        `insert into produto (id, empresa_id, nome, cd_barra, unidade_medida, preco_venda, preco_promocional)
         values ($1, 1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [id, nome, barra, unidade, preco, promo ?? null]
      );
      if (unidade === "UNIDADE") {
        await db.query(
          `insert into produto_estoque (produto_id, empresa_id, filial_id, qt_vitrine, qt_estoque, tot_it)
           values ($1, 1, 1, 20, 80, 100)
           on conflict do nothing`,
          [id]
        );
      }
    }

    // Promoções valendo a partir de agora (horário local da loja, UTC-3): uma
    // termina em 45 minutos (contagem regressiva "urgente"), as outras em dias.
    await db.query(
      `update produto set
         inicio_promocao = current_timestamp - interval '3 hours' - interval '1 hour',
         fim_promocao = current_timestamp - interval '3 hours' +
           case when id = 7 then interval '45 minutes' else interval '3 days' end
       where empresa_id = 1 and preco_promocional is not null`
    );

    // Os ids fixos acima não avançam as sequências: acerta para os próximos.
    for (const tabela of ["empresa", "filial", "caixa", "perfil", "usuario", "produto"]) {
      await db.query(
        `select setval(pg_get_serial_sequence('${tabela}', 'id'), (select max(id) from ${tabela}))`
      );
    }

    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }

  for (const u of USUARIOS) {
    console.log(`conta pronta: ${u.email}${u.legado ? " (hash MD5 antigo)" : ""}`);
  }
  console.log(`senha das contas: ${senha}`);
}

main().catch((error) => {
  console.error("Erro ao criar os dados de demonstração:", error?.message || error);
  process.exitCode = 1;
});
