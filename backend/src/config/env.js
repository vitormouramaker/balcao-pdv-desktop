// Carrega o .env (se existir) e centraliza a leitura das variáveis de ambiente.
// Todos os timestamps "sem fuso" do banco são tratados como UTC pelo driver.
process.env.TZ = "UTC";
require("dotenv").config();

const env = process.env;

const config = {
  port: Number(env.PORT) || 4444,
  db: {
    user: env.DB_USER || "postgres",
    host: env.DB_HOST || "localhost",
    database: env.DB_NAME || "balcao_pdv",
    password: env.DB_PASSWORD || "postgres",
    port: Number(env.DB_PORT) || 5432,
  },
  jwtSecret: env.JWT_SECRET || "",
  jwtExpiresIn: env.JWT_EXPIRES_IN || "12h",
  // Origens liberadas no CORS. As do Tauri (tauri://localhost e
  // http://tauri.localhost) e a do Vite em modo dev já vêm por padrão.
  corsOrigins: (env.CORS_ORIGINS ||
    "http://localhost:1420,tauri://localhost,http://tauri.localhost")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  mercadoPago: {
    // "auto": usa a API real quando a empresa tem token cadastrado e cai no
    // simulador quando não tem. "mock": sempre simula. "real": nunca simula.
    mode: (env.MERCADO_PAGO_MODE || "auto").toLowerCase(),
    mockDelayMs: Number(env.MOCK_PAYMENT_DELAY_MS) || 6000,
  },
  // Número de atendimento impresso como QR code no comprovante. Opcional.
  receiptWhatsapp: env.RECEIPT_WHATSAPP || "",
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET ausente ou curto (mínimo 32 caracteres). Copie backend/.env.example para backend/.env."
  );
}

module.exports = config;
