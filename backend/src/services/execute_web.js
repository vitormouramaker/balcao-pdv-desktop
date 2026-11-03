const models = require("../models/models_web");
const { postgres } = require("../server/connect");
const security = require("../security/auth");

const execute = {
  // Busca o usuário pelo e-mail e confere a senha com bcrypt. Senhas antigas
  // (MD5 sem sal) ainda entram e são regravadas em bcrypt no mesmo login.
  execute_login: async (user, pass) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.login(), [String(user || "").trim()]);
      const usuario = ret.rows[0];
      if (!usuario) return [];

      const { ok, rehash } = await security.conferirSenha(pass, usuario.senha);
      if (!ok) return [];
      if (rehash) {
        await client.query(models.atualizar_hash_senha(), [usuario.id, rehash]);
      }

      delete usuario.senha;
      return [usuario];
    } finally {
      client.release();
    }
  },

  execute_get_is_aberto: async (caixa_id, filial_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_is_aberto(), [
        caixa_id,
        filial_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
