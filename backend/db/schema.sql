-- Esquema do banco usado pelo PDV. Idempotente: pode rodar de novo sem perder
-- dados (CREATE ... IF NOT EXISTS).
--
-- Em produção estas tabelas fazem parte do banco do ERP da loja (cadastro de
-- produtos, estoque, usuários); o PDV só lê o catálogo e grava vendas e
-- movimentos de caixa. Aqui está só o recorte de que o PDV precisa.
--
-- Convenção de datas: as colunas data_abertura, data_fechamento, data_ruptura,
-- inicio_promocao e fim_promocao guardam o horário LOCAL da loja
-- (America/Sao_Paulo, UTC-3) sem fuso; data_venda guarda UTC. As consultas do
-- back fazem a conversão (+/- 3 horas) de forma explícita.

CREATE TABLE IF NOT EXISTS empresa (
  id            SERIAL PRIMARY KEY,
  nome_fantasia TEXT NOT NULL,
  cnpj          TEXT,
  -- Access token do Mercado Pago da loja. Vazio = PDV usa o simulador.
  token_api     TEXT
);

CREATE TABLE IF NOT EXISTS filial (
  id         SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresa(id),
  nome       TEXT NOT NULL
);

-- Cada computador de caixa tem um id (config.json do app desktop) e pode ter
-- uma maquininha Mercado Pago Point vinculada (terminal_id).
CREATE TABLE IF NOT EXISTS caixa (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL REFERENCES empresa(id),
  filial_id   INTEGER NOT NULL REFERENCES filial(id),
  nome        TEXT,
  terminal_id TEXT
);

CREATE TABLE IF NOT EXISTS perfil (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS usuario (
  id         SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresa(id),
  perfil_id  INTEGER REFERENCES perfil(id),
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  -- bcrypt. Hashes MD5 antigos são aceitos uma vez e regravados em bcrypt.
  senha      TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS produto (
  id                SERIAL PRIMARY KEY,
  empresa_id        INTEGER NOT NULL REFERENCES empresa(id),
  nome              TEXT NOT NULL,
  cd_barra          TEXT,
  -- UNIDADE ou PESO (preço por kg, pede a pesagem no caixa)
  unidade_medida    TEXT NOT NULL DEFAULT 'UNIDADE',
  preco_venda       NUMERIC(12,2) NOT NULL,
  preco_promocional NUMERIC(12,2),
  inicio_promocao   TIMESTAMP,
  fim_promocao      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS produto_empresa_barra_idx ON produto (empresa_id, cd_barra);

-- Estoque separado em vitrine (exposto na loja) e estoque (depósito).
CREATE TABLE IF NOT EXISTS produto_estoque (
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  empresa_id INTEGER NOT NULL REFERENCES empresa(id),
  filial_id  INTEGER NOT NULL REFERENCES filial(id),
  qt_vitrine NUMERIC(12,3) NOT NULL DEFAULT 0,
  qt_estoque NUMERIC(12,3) NOT NULL DEFAULT 0,
  tot_it     NUMERIC(12,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (produto_id, empresa_id, filial_id)
);

CREATE TABLE IF NOT EXISTS venda (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER REFERENCES usuario(id),
  empresa_id      INTEGER NOT NULL REFERENCES empresa(id),
  filial_id       INTEGER REFERENCES filial(id),
  caixa_id        INTEGER REFERENCES caixa(id),
  -- especie, credito, debito ou qr
  pagamento       TEXT,
  valor_venda     NUMERIC(12,2) NOT NULL,
  -- pending, processed ou canceled
  status_venda    TEXT NOT NULL,
  troco           NUMERIC(12,2) DEFAULT 0,
  recebido        NUMERIC(12,2) DEFAULT 0,
  -- id da ordem no Mercado Pago (ou do simulador) e o id anterior, quando a
  -- venda é paga em mais de uma cobrança
  external_id     TEXT,
  old_id          TEXT,
  data_venda      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS venda_external_idx ON venda (external_id);
CREATE INDEX IF NOT EXISTS venda_caixa_data_idx ON venda (empresa_id, filial_id, caixa_id, data_venda);

CREATE TABLE IF NOT EXISTS venda_produto (
  id         SERIAL PRIMARY KEY,
  venda_id   INTEGER NOT NULL REFERENCES venda(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  qt_it      NUMERIC(12,3) NOT NULL,
  valor      NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS caixa_abertura (
  id                       SERIAL PRIMARY KEY,
  usuario_id               INTEGER REFERENCES usuario(id),
  caixa_id                 INTEGER NOT NULL REFERENCES caixa(id),
  filial_id                INTEGER NOT NULL REFERENCES filial(id),
  empresa_id               INTEGER NOT NULL REFERENCES empresa(id),
  valor_abertura           NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_abertura            TIMESTAMP NOT NULL,
  valor_fechamento_especie NUMERIC(12,2),
  valor_fechamento_total   NUMERIC(12,2),
  data_fechamento          TIMESTAMP
);

-- Sangria: retirada de dinheiro da gaveta durante o expediente.
CREATE TABLE IF NOT EXISTS caixa_ruptura (
  id             SERIAL PRIMARY KEY,
  caixa_id       INTEGER NOT NULL REFERENCES caixa(id),
  usuario_id     INTEGER REFERENCES usuario(id),
  filial_id      INTEGER NOT NULL REFERENCES filial(id),
  empresa_id     INTEGER NOT NULL REFERENCES empresa(id),
  valor_ruptura  NUMERIC(12,2) NOT NULL,
  motivo_ruptura TEXT,
  data_ruptura   TIMESTAMP NOT NULL
);
