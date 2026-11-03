const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

const BCRYPT_ROUNDS = 10;

// Hash legado (MD5 sem sal) usado pelas primeiras versões do cadastro. Só é
// usado para reconhecer senhas antigas no login e migrá-las para bcrypt.
function md5Legado(data) {
  return crypto.createHash("md5").update(String(data)).digest("hex");
}

function isHashLegado(hash) {
  return typeof hash === "string" && /^[a-f0-9]{32}$/i.test(hash);
}

async function hashSenha(senha) {
  return bcrypt.hash(String(senha), BCRYPT_ROUNDS);
}

/**
 * Confere a senha contra o hash salvo. Retorna { ok, rehash }: `rehash` vem
 * preenchido quando o hash salvo é legado (MD5) e a senha confere, para o
 * chamador gravar o novo hash bcrypt (migração transparente no login).
 */
async function conferirSenha(senha, hashSalvo) {
  if (!hashSalvo) return { ok: false, rehash: null };

  if (isHashLegado(hashSalvo)) {
    const a = Buffer.from(md5Legado(senha), "hex");
    const b = Buffer.from(hashSalvo.toLowerCase(), "hex");
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, rehash: ok ? await hashSenha(senha) : null };
  }

  const ok = await bcrypt.compare(String(senha), hashSalvo);
  return { ok, rehash: null };
}

function jwtencript(obj) {
  return jwt.sign(obj, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function jwtdecript(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return null;
  }
}

/**
 * Exige o token de sessão do operador (Authorization: Bearer ...). A empresa e
 * o usuário passam a vir do token, nunca do corpo/query da requisição: os
 * campos que o front envia (empresa_id, user_id, usuario_id, ?e=) são
 * sobrescritos aqui, então um operador não consegue agir em outra empresa.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const sessao = token ? jwtdecript(token) : null;

  if (!sessao || !sessao.user_id || !sessao.empresa_id) {
    return res.status(401).json({
      payload: {
        boleano: false,
        obj: {},
        mensagem: "Sessão expirada. Faça login novamente.",
      },
    });
  }

  req.auth = { user_id: sessao.user_id, empresa_id: sessao.empresa_id };

  req.query.e = String(sessao.empresa_id);
  if (req.body && typeof req.body === "object") {
    req.body.empresa_id = sessao.empresa_id;
    req.body.user_id = sessao.user_id;
    req.body.usuario_id = sessao.user_id;
  }
  return next();
}

module.exports = {
  hashSenha,
  conferirSenha,
  jwtencript,
  jwtdecript,
  requireAuth,
};
