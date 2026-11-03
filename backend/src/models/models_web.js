const models = {
    login:() =>{
    return `select
u.id,
u.nome,
u.email,
u.ativo,
u.senha,
p.id as cargo_id,
p.nome as cargo_nome,
u.empresa_id
from usuario u
left join perfil p on
p.id = u.perfil_id
where u.ativo = true and p.ativo = true and lower(u.email) = lower($1)
limit 1`
    },

    atualizar_hash_senha:() =>{
        return `update usuario set senha = $2 where id = $1`
    },

    get_is_aberto:() =>{
        return `select * from caixa_abertura where caixa_id = $1 and filial_id = $2 and empresa_id = $3 and data_fechamento is null `
    }

}
module.exports = models
