const models = {
  busca_produto: () => {
    return `
    select 
    id,
    nome as name,
    case when preco_promocional is not null and current_timestamp - INTERVAL '3 hours' between inicio_promocao and fim_promocao then
      preco_promocional
      else
    preco_venda end as price,
    cd_barra as sku,
    unidade_medida as type
    from produto where (upper(nome) ilike($1) or cd_barra = $2) and empresa_id = $3`;
  },

  criar_intencao_venda: () => {
    return `
insert into venda (usuario_id, pagamento, valor_venda, status_venda, caixa_id, empresa_id, filial_id, troco, recebido) values ($1,$2,$3,$4, $5, $6, $7, $8, $9) returning id
        `;
  },

  insert_products_intention: () => {
    return `
        insert into venda_produto (venda_id, produto_id, qt_it, valor) VALUES $1
        `;
  },

  update_venda: () => {
    return `update venda set external_id = $2 where id = $1`;
  },

  append_external_id: () => {
    return `update venda set old_id = external_id, external_id =  $2, pagamento = $3, status_venda = 'pending' where id = $1 and empresa_id = $4`;
  },

  valida_pagamento: () => {
    return `select * from venda where external_id like $1 and empresa_id = $2`;
  },

  get_products: () => {
    return `select 
vp.produto_id,
vp.qt_it as saida,
coalesce(pe.qt_estoque,0) as estoque,
coalesce(pe.qt_vitrine,0) as vitrine,
coalesce(pe.tot_it,0) as total,
p.unidade_medida as type
from 
venda_produto vp
left join produto_estoque pe on
pe.produto_id = vp.produto_id
left join produto p on
p.id = vp.produto_id
where venda_id = $1`;
  },

  consolida_estoque: () => {
    return `
        update produto_estoque set qt_vitrine = $2, qt_estoque = $3, tot_it = $4 where produto_id = $1 and empresa_id = $5 and filial_id = $6
        `;
  },

  get_all_produtos: () => {
    return `select 
    id,
    nome as name,
     case when preco_promocional is not null and current_timestamp - INTERVAL '3 hours' between inicio_promocao and fim_promocao then
      preco_promocional
      else
    preco_venda end as price,
    cd_barra as sku,
    unidade_medida as type
    from produto where empresa_id = $1 limit 12`;
  },

  get_terminal: () => {
    return `
        select terminal_id from caixa where empresa_id = $1 and filial_id = $2 and id = $3
        `;
  },

  get_api_key: () => {
    return `
        select token_api as api_key,nome_fantasia,cnpj from empresa where id = $1 
        `;
  },

  get_user: () => {
    return `
    select nome from usuario where id = $1
    `;
  },

  get_products_peso: () => {
    return `select 
    id,
    nome as name,
    preco_venda as price,
    cd_barra as sku,
    unidade_medida as type
    from produto where empresa_id = $1 and unidade_medida = 'PESO'`;
  },

  get_promocoes: () => {
    return `
    select 
      id,
      nome as name,
      preco_promocional as price,
      cd_barra as sku,
      unidade_medida as type,
      -- horário local da loja (UTC-3) com o fuso explícito para o front
      to_char(inicio_promocao, 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00' as inicio_promocao,
      to_char(fim_promocao, 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00' as fim_promocao
    from produto 
    where empresa_id = $1 
      and preco_promocional is not null 
      and preco_promocional > 0
      and current_timestamp - INTERVAL '3 hours' between inicio_promocao and fim_promocao
    limit 20
    `;
  },

  cancelar_pagamento: () => {
    return `UPDATE venda
SET status_venda = 'canceled'
WHERE external_id = $1 and empresa_id = $2
RETURNING empresa_id;`;
  },

  abertura_caixa: () => {
    return `
    INSERT INTO public.caixa_abertura(
	usuario_id, caixa_id, filial_id, empresa_id, valor_abertura, data_abertura, valor_fechamento_especie, valor_fechamento_total)
	VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - INTERVAL '3 hours', $6, $7);
    `;
  },

  fechamento_caixa: () => {
    return `
    update 
caixa_abertura
set
data_fechamento = CURRENT_TIMESTAMP - INTERVAL '3 hours'
where caixa_id = $1 and filial_id = $2 and empresa_id = $3
and data_fechamento is null
    `;
  },

  ruptura: () => {
    return `
    INSERT INTO public.caixa_ruptura(
	caixa_id, usuario_id, filial_id, empresa_id, valor_ruptura, motivo_ruptura, data_ruptura)
	VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - INTERVAL '3 hours');
    `;
  },

  get_valor_fechamneto_especie: () => {
    return `
      select 
coalesce(sum(valor_venda), 0) as valor
from venda
where pagamento = 'especie'
and caixa_id = $1
and filial_id = $2
and empresa_id = $3
and status_venda = 'processed'
and data_venda between (cast($4 as timestamp) + interval '3 hours') and current_timestamp
    `;
  },

  get_valor_fechamneto: () => {
    return `
    select 
coalesce(sum(valor_venda), 0) as valor
from venda
where  caixa_id = $1
and filial_id = $2
and empresa_id = $3
and status_venda = 'processed'
and data_venda between (cast($4 as timestamp) + interval '3 hours') and current_timestamp


    `;
  },

  get_dados_abertura: () => {
    return `
    select * from caixa_abertura where caixa_id = $1 and filial_id = $2 and empresa_id = $3 and data_fechamento is null 
    `;
  },

  get_rupturas: () => {
    return `
    select 
coalesce(sum(valor_ruptura), 0) as valor
from caixa_ruptura
where  caixa_id = $1
and filial_id = $2
and empresa_id = $3
and data_ruptura between $4 and current_timestamp

    `;
  },

  // Simulador de maquininha: aprova a cobrança pendente.
  aprovar_pagamento_simulado: () => {
    return `update venda set status_venda = 'processed' where external_id = $1 and empresa_id = $2 and status_venda = 'pending' returning id, filial_id`;
  },
};
module.exports = models;
