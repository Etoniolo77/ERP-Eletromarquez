export type UserRole = "admin" | "gestor" | "almoxarife" | "usuario"
export type InventarioStatus = "ABERTO" | "EM_ANDAMENTO" | "FINALIZADO" | "CANCELADO"

export interface Profile {
  id: string
  matricula: string | null
  nome_completo: string
  email: string
  cargo: string | null
  departamento: string | null
  role: UserRole
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface UnidadeMedida {
  id: number
  nome: string
}

export interface TipoMaterial {
  id: number
  nome: string
  justificar: boolean
}

export interface TipoJustificativa {
  id: number
  nome: string
  destino: string | null
  estoque_colaborador: string | null
}

export interface EstoqueLocal {
  id: number
  nome: string
  tipo_estoque: string
  deposito: string | null
}

export interface Material {
  id: number
  codigo: string
  descricao: string
  tipo_material_id: number | null
  unidade_id: number | null
  seriado: boolean
  custo_unitario: number
  estoque_minimo: number
  estoque_maximo: number | null
  ponto_reposicao: number | null
  lead_time_dias: number | null
  ca_numero: string | null
  ca_validade: string | null
  localizacao: string | null
  ativo: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
  // Relations
  tipo_material?: TipoMaterial
  unidade_medida?: UnidadeMedida
}

export interface Usuario {
  id: number
  matricula: number | null
  nome: string
  email: string | null
}

export interface ItemEstoque {
  id: number
  estoque_id: number
  material_id: number
  saldo: number
  // Relations
  estoque?: EstoqueLocal
  material?: Material
}

export interface Movimentacao {
  id: number
  tipo: string
  estoque_origem_id: number | null
  estoque_destino_id: number | null
  criado_por_id: number | null
  finalizado_por_id: number | null
  criado_em: string
  finalizado_em: string | null
  situacao: string
  referencia: string | null
  tipo_estoque: string | null
  mes_ano: string | null
  // Relations
  estoque_origem?: EstoqueLocal
  estoque_destino?: EstoqueLocal
  criado_por?: Usuario
  finalizado_por?: Usuario
  itens?: ItemMovimentacao[]
}

export interface ItemMovimentacao {
  id: number
  movimentacao_id: number
  material_id: number
  quantidade: number
  observacao: string | null
  material_seriado_id: string | null
  valor: number
  justificativa_id: number | null
  // Relations
  material?: Material
  justificativa?: TipoJustificativa
}

export interface Inventario {
  id: number
  estoque_id: number
  mes_referencia: string
  status: InventarioStatus
  responsavel_id: string | null
  data_inicio: string | null
  data_fim: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
  // Relations
  estoque?: EstoqueLocal
}

export interface InventarioItem {
  id: number
  inventario_id: number
  material_id: number
  quantidade_sistema: number
  quantidade_contagem: number | null
  divergencia: number | null
  justificativa: string | null
  contado_por: string | null
  contado_em: string | null
  created_at: string
  // Relations
  material?: Material
}

export interface EstoqueResumo {
  material_id: number
  codigo: string
  descricao: string
  tipo_material_id: number | null
  tipo_material_nome: string | null
  unidade_id: number | null
  unidade_nome: string | null
  seriado: boolean
  custo_unitario: number
  estoque_minimo: number
  estoque_maximo: number | null
  ponto_reposicao: number | null
  lead_time_dias: number | null
  ca_numero: string | null
  ca_validade: string | null
  localizacao: string | null
  ativo: boolean
  saldo_total: number
  status_estoque: "CRITICO" | "ALERTA" | "NORMAL"
  quantidade_sugerida: number
}
