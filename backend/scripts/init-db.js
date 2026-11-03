/**
 * Cria o banco (se ainda não existir) e as tabelas do PDV.
 *
 *   npm run db:init
 *
 * Idempotente: pode rodar de novo sem apagar nada.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const config = require("../src/config/env");

async function criarBancoSeNaoExistir() {
  const admin = new Client({ ...config.db, database: "postgres" });
  await admin.connect();
  try {
    const existe = await admin.query("select 1 from pg_database where datname = $1", [
      config.db.database,
    ]);
    if (existe.rowCount === 0) {
      // Nome de banco não aceita parâmetro: só letras, números e _.
      if (!/^[a-zA-Z0-9_]+$/.test(config.db.database)) {
        throw new Error(`Nome de banco inválido: ${config.db.database}`);
      }
      await admin.query(`create database ${config.db.database}`);
      console.log(`banco ${config.db.database} criado`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  await criarBancoSeNaoExistir();

  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  const client = new Client(config.db);
  await client.connect();
  try {
    await client.query(sql);
    console.log("tabelas prontas");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Erro ao preparar o banco:", error?.message || error);
  process.exitCode = 1;
});
