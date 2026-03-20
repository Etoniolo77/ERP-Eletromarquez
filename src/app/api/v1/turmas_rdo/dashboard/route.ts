import { NextRequest, NextResponse } from "next/server"

// turmas_rdo uses a dedicated table not currently in the schema.
// Returns a sensible empty structure matching RDODashboardData interface.
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    period_label: "Período atual",
    source_file: "supabase",
    last_update: new Date().toISOString(),
    stats: {
      kpi1: { label: "Nota Média", value: "0%", legend: "Geral", trend: 0 },
      kpi2: { label: "Conformidade", value: "0%", legend: "No período", trend: 0 },
      kpi3: { label: "Equipes", value: "0", legend: "Avaliadas", trend: 0 },
      kpi4: { label: "Alertas", value: "0", legend: "Pendentes", trend: 0 },
    },
    matriz: [],
    indicadores_labels: [],
    matriz_presenca: [],
    regionais_presenca_labels: [],
    history: [],
    top_melhores: [],
    top_piores: [],
    top_piores_indicadores: [],
    presenca_history: [],
    insights: [{ type: "info", text: "Dados de RDO serão carregados após sincronização." }]
  })
}
