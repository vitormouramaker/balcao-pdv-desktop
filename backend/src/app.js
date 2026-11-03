const config = require("./config/env");
const express = require("express");
const app = express();
const cors = require("cors");
const { postgres } = require("./server/connect");
const { requireAuth } = require("./security/auth");

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      // Sem cabeçalho Origin (curl, app nativo) ou origem da lista: liberado.
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.set("trust proxy", 1);

app.get("/health", async (req, res) => {
  try {
    await postgres.query("select 1");
    return res.json({ ok: true, db: true });
  } catch (error) {
    return res.status(503).json({ ok: false, db: false });
  }
});

// Import rotas
const web = require("./routes/web");
const api = require("./routes/api");
app.use("/web", web);
app.use("/api", requireAuth, api);

app.listen(config.port, () => {
  console.log(`Rodando na porta ${config.port}`);
});
