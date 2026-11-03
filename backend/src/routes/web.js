const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_web");
const utils = require("../utils/templates");
const security = require("../security/auth");

rota.post("/login", async (req, res) => {
  try {
    const data = req.body;
    const login = await execute.execute_login(data.user, data.pass);
    if (login.length <= 0) {
      return res.json(utils.jsonMount(false, [], "Usuario/senha incorretos"));
    }
    const is_aberto = await execute.execute_get_is_aberto(
      data.caixa_id,
      data.filial_id,
      login[0].empresa_id
    );
    let aberto = true;
    if (is_aberto.length <= 0) {
      aberto = false;
    }
    login[0].is_open = aberto;
    // Token de sessão: as rotas /api tiram a empresa e o usuário daqui.
    login[0].token = security.jwtencript({
      user_id: login[0].id,
      empresa_id: login[0].empresa_id,
    });
    return res.json(utils.jsonMount(true, login[0], "Bem vindo!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/login"));
  }
});

rota.post("/verificar_caixa_aberto", security.requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const is_aberto = await execute.execute_get_is_aberto(
      data.caixa_id,
      data.filial_id,
      data.empresa_id
    );
    let aberto = true;
    if (is_aberto.length <= 0) {
      aberto = false;
    }
    return res.json(
      utils.jsonMount(true, { is_open: aberto }, "Status do caixa recuperado")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/verificar_caixa_aberto"));
  }
});

module.exports = rota;
