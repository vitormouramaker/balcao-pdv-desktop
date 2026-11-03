const { Pool, types } = require("pg");

// NUMERIC (preços, quantidades em kg, valores do caixa) chega como número no
// JSON, igual ao que o front espera.
types.setTypeParser(1700, (valor) => (valor === null ? null : parseFloat(valor)));
const config = require("../config/env");

const postgres = new Pool({
  ...config.db,

  // Sessão sempre em UTC: as colunas "data_*" guardam o horário local da loja
  // (America/Sao_Paulo, UTC-3) como timestamp sem fuso, e as consultas fazem a
  // conversão explicitamente.
  options: "-c timezone=UTC",

  // Configurações importantes para evitar vazamento
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 300000, // Fecha conexões inativas após 5 min
  connectionTimeoutMillis: 2000, // Timeout para obter conexão
  allowExitOnIdle: true, // Permite que o processo termine

  // Configurações de query timeout
  statement_timeout: 300000,
  query_timeout: 300000,
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Fechando pool de conexões...");
  await postgres.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Fechando pool de conexões...");
  await postgres.end();
  process.exit(0);
});

module.exports = { postgres: postgres };
