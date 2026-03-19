-- =====================================================
-- ERP Empresarial - Schema do Banco de Dados
-- Módulo: Almoxarifado (SESMT)
-- Baseado na estrutura real da planilha de migração
-- =====================================================

-- =====================================================
-- LIMPEZA (para recriação segura)
-- =====================================================
drop view if exists public.vw_itens_reposicao;
drop view if exists public.vw_estoque_resumo;

drop trigger if exists set_updated_at on public.materiais;
drop trigger if exists set_updated_at on public.profiles;

drop table if exists public.inventario_itens cascade;
drop table if exists public.inventarios cascade;
drop table if exists public.itens_movimentacoes cascade;
drop table if exists public.movimentacoes cascade;
drop table if exists public.itens_estoque cascade;
drop table if exists public.materiais cascade;
drop table if exists public.usuario cascade;
drop table if exists public.estoques cascade;
drop table if exists public.tipo_justificativa cascade;
drop table if exists public.tipo_material cascade;
drop table if exists public.unidade_medida cascade;
drop table if exists public.profiles cascade;

-- =====================================================
-- TABELAS DE SISTEMA (Autenticação)
-- =====================================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  matricula text,
  nome_completo text not null,
  email text not null,
  cargo text,
  departamento text,
  role text not null default 'usuario' check (role in ('admin', 'gestor', 'almoxarife', 'usuario')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome_completo', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================
-- TABELAS DE DOMÍNIO (Dados da Planilha)
-- =====================================================

-- Unidades de Medida
create table public.unidade_medida (
  id serial primary key,
  nome text not null unique
);

-- Tipo de Material
create table public.tipo_material (
  id serial primary key,
  nome text not null,
  justificar boolean not null default false
);

-- Tipo de Justificativa
create table public.tipo_justificativa (
  id serial primary key,
  nome text not null,
  destino text,
  estoque_colaborador text
);

-- Estoques (Locais de armazenamento: Equipe ou Individual)
create table public.estoques (
  id serial primary key,
  nome text not null,
  tipo_estoque text not null default 'Equipe',
  deposito text
);

create index idx_estoques_tipo on public.estoques(tipo_estoque);
create index idx_estoques_deposito on public.estoques(deposito);

-- Materiais
create table public.materiais (
  id serial primary key,
  codigo text not null unique,
  descricao text not null,
  tipo_material_id integer references public.tipo_material(id),
  unidade_id integer references public.unidade_medida(id),
  seriado boolean not null default false,
  custo_unitario numeric(12,2) default 0,
  estoque_minimo numeric(12,2) not null default 0,
  estoque_maximo numeric(12,2),
  ponto_reposicao numeric(12,2),
  lead_time_dias integer default 7,
  ca_numero text,
  ca_validade date,
  localizacao text,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_materiais_codigo on public.materiais(codigo);

-- Usuários (Funcionários - dados da planilha)
create table public.usuario (
  id serial primary key,
  matricula integer,
  nome text not null,
  email text
);

-- Itens de Estoque (saldo por estoque/material)
create table public.itens_estoque (
  id serial primary key,
  estoque_id integer not null references public.estoques(id),
  material_id integer not null references public.materiais(id),
  saldo integer not null default 0
);

create index idx_itens_estoque_estoque on public.itens_estoque(estoque_id);
create index idx_itens_estoque_material on public.itens_estoque(material_id);

-- Movimentações
create table public.movimentacoes (
  id serial primary key,
  tipo text not null,
  estoque_origem_id integer references public.estoques(id),
  estoque_destino_id integer references public.estoques(id),
  criado_por_id integer references public.usuario(id),
  finalizado_por_id integer references public.usuario(id),
  criado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  situacao text not null default 'Pendente',
  referencia text,
  tipo_estoque text,
  mes_ano text
);

create index idx_movimentacoes_criado_em on public.movimentacoes(criado_em);
create index idx_movimentacoes_tipo on public.movimentacoes(tipo);
create index idx_movimentacoes_situacao on public.movimentacoes(situacao);

-- Itens da Movimentação
create table public.itens_movimentacoes (
  id serial primary key,
  movimentacao_id integer not null references public.movimentacoes(id) on delete cascade,
  material_id integer not null references public.materiais(id),
  quantidade integer not null,
  observacao text,
  material_seriado_id text,
  valor numeric(12,2) default 0,
  justificativa_id integer references public.tipo_justificativa(id)
);

create index idx_itens_mov_movimentacao on public.itens_movimentacoes(movimentacao_id);
create index idx_itens_mov_material on public.itens_movimentacoes(material_id);

-- =====================================================
-- TABELAS DE FUNCIONALIDADES DO APP
-- =====================================================

create table public.inventarios (
  id serial primary key,
  estoque_id integer not null references public.estoques(id),
  mes_referencia date not null,
  status text not null default 'ABERTO',
  responsavel_id uuid references public.profiles(id),
  data_inicio timestamptz,
  data_fim timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventario_itens (
  id serial primary key,
  inventario_id integer not null references public.inventarios(id) on delete cascade,
  material_id integer not null references public.materiais(id),
  quantidade_sistema numeric(12,2) not null default 0,
  quantidade_contagem numeric(12,2),
  divergencia numeric(12,2),
  justificativa text,
  contado_por uuid references public.profiles(id),
  contado_em timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================
-- VIEWS
-- =====================================================

create or replace view public.vw_estoque_resumo as
select
  m.id as material_id,
  m.codigo,
  m.descricao,
  m.tipo_material_id,
  tm.nome as tipo_material_nome,
  m.unidade_id,
  um.nome as unidade_nome,
  m.seriado,
  m.custo_unitario,
  m.estoque_minimo,
  m.estoque_maximo,
  m.ponto_reposicao,
  m.lead_time_dias,
  m.ca_numero,
  m.ca_validade,
  m.localizacao,
  m.ativo,
  coalesce(sum(ie.saldo), 0) as saldo_total,
  case
    when coalesce(sum(ie.saldo), 0) <= m.estoque_minimo then 'CRITICO'
    when coalesce(sum(ie.saldo), 0) <= coalesce(m.ponto_reposicao, m.estoque_minimo * 1.5) then 'ALERTA'
    else 'NORMAL'
  end as status_estoque,
  greatest(0, coalesce(m.estoque_maximo, m.estoque_minimo * 3) - coalesce(sum(ie.saldo), 0)) as quantidade_sugerida
from public.materiais m
left join public.itens_estoque ie on ie.material_id = m.id
left join public.tipo_material tm on tm.id = m.tipo_material_id
left join public.unidade_medida um on um.id = m.unidade_id
where m.ativo = true
group by m.id, m.codigo, m.descricao, m.tipo_material_id, tm.nome,
         m.unidade_id, um.nome, m.seriado, m.custo_unitario,
         m.estoque_minimo, m.estoque_maximo, m.ponto_reposicao,
         m.lead_time_dias, m.ca_numero, m.ca_validade, m.localizacao, m.ativo;

create or replace view public.vw_itens_reposicao as
select * from public.vw_estoque_resumo
where saldo_total <= coalesce(ponto_reposicao, estoque_minimo * 1.5)
  and estoque_minimo > 0;

-- =====================================================
-- ROW LEVEL SECURITY (Permissivo para uso inicial)
-- =====================================================

alter table public.profiles enable row level security;
alter table public.unidade_medida enable row level security;
alter table public.tipo_material enable row level security;
alter table public.tipo_justificativa enable row level security;
alter table public.estoques enable row level security;
alter table public.materiais enable row level security;
alter table public.usuario enable row level security;
alter table public.itens_estoque enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.itens_movimentacoes enable row level security;
alter table public.inventarios enable row level security;
alter table public.inventario_itens enable row level security;

create policy "allow_all_profiles" on public.profiles for all using (true) with check (true);
create policy "allow_all_unidade_medida" on public.unidade_medida for all using (true) with check (true);
create policy "allow_all_tipo_material" on public.tipo_material for all using (true) with check (true);
create policy "allow_all_tipo_justificativa" on public.tipo_justificativa for all using (true) with check (true);
create policy "allow_all_estoques" on public.estoques for all using (true) with check (true);
create policy "allow_all_materiais" on public.materiais for all using (true) with check (true);
create policy "allow_all_usuario" on public.usuario for all using (true) with check (true);
create policy "allow_all_itens_estoque" on public.itens_estoque for all using (true) with check (true);
create policy "allow_all_movimentacoes" on public.movimentacoes for all using (true) with check (true);
create policy "allow_all_itens_movimentacoes" on public.itens_movimentacoes for all using (true) with check (true);
create policy "allow_all_inventarios" on public.inventarios for all using (true) with check (true);
create policy "allow_all_inventario_itens" on public.inventario_itens for all using (true) with check (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles for each row execute procedure public.handle_updated_at();
create trigger set_updated_at before update on public.materiais for each row execute procedure public.handle_updated_at();
