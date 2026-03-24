import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)
    const supabase = await createClient()

    // Try current period
    let { data, error } = await supabase
      .from("frota_custos")
      .select("*")
      .gte("data_solicitacao", startDate)
      .lte("data_solicitacao", endDate)

    if (error) throw new Error(error.message)

    let records = data || []

    // Fallback: If current month has no data, fetch latest month available
    if (records.length === 0) {
      console.log(`[Frota API] No data for ${startDate} to ${endDate}. Falling back to latest data.`)
      const { data: allData, error: allErr } = await supabase
        .from("frota_custos")
        .select("*")
        .order("data_solicitacao", { ascending: false })
        .limit(100)
      
      if (allErr) throw new Error(allErr.message)
      
      if (allData && allData.length > 0) {
        const latestDate = allData[0].data_solicitacao
        const latestMonth = latestDate.substring(0, 7)
        records = allData.filter(r => r.data_solicitacao && r.data_solicitacao.startsWith(latestMonth))
      } else {
        records = []
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        period: periodo,
        last_update: new Date().toISOString(),
        stats: { total_custo: 0, total_veiculos: 0, media_por_veiculo: 0, total_manutencoes: 0 },
        regionais: [],
        setores: [],
        manutencoes: [],
        top_veiculos: [],
        evolucao: [],
        insights: [{ type: "info", text: "Sem dados de custos de frota disponíveis." }]
      })
    }
 
    const round2 = (n: number) => Math.round(n * 100) / 100
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const total_custo = round2(records.reduce((a, r) => a + (r.custo_val || 0), 0))
    const veiculos = [...new Set(records.map(r => r.placa).filter(Boolean))]
    const total_frota = veiculos.length
    const ticket_medio = total_frota > 0 ? round2(total_custo / total_frota) : 0
    const qtd_servicos = records.length

    // Mock constants for trends if prev data not available
    const stats = {
      total_custo,
      trend_custo: 0,
      ticket_medio,
      trend_ticket: 0,
      qtd_servicos,
      trend_servicos: 0,
      total_frota,
      trend_frota: 0
    }

    // Pareto Logic (Top 20% vehicles usually account for 80% of cost)
    const placaMap: Record<string, number> = {}
    records.forEach(r => {
      const key = r.placa || "N/D"
      placaMap[key] = (placaMap[key] || 0) + (r.custo_val || 0)
    })
    const sortedVehicles = Object.entries(placaMap).sort((a,b) => b[1] - a[1])
    const paretoCount = Math.ceil(total_frota * 0.2)
    const costOfensores = sortedVehicles.slice(0, paretoCount).reduce((a,b) => a + b[1], 0)

    const pareto = {
      total_veiculos: total_frota,
      veiculos_ofensores: paretoCount,
      percentual_ofensores: total_frota > 0 ? round2((paretoCount/total_frota)*100) : 0,
      custo_ofensores: round2(costOfensores)
    }

    // History
    const months = [...new Set(records.map(r => r.MesAno))].sort()
    const history = months.map(m => ({
      MesAno: m,
      Val: round2(avg(records.filter(r => r.MesAno === m).map(r => r.custo_val || 0)))
    }))

    // Breakdowns
    const regionMap: Record<string, number> = {}
    records.forEach(r => { regionMap[r.regional || "N/A"] = (regionMap[r.regional || "N/A"] || 0) + (r.custo_val || 0) })
    const regionais = Object.entries(regionMap).map(([name, value]) => ({ name, value: round2(value) }))

    const fornerMap: Record<string, number> = {}
    records.forEach(r => { fornerMap[r.fornecedor || "Outros"] = (fornerMap[r.fornecedor || "Outros"] || 0) + (r.custo_val || 0) })
    const fornecedores = Object.entries(fornerMap).map(([name, value]) => ({ name, value: round2(value) })).sort((a,b) => b.value - a.value)

    const manuMap: Record<string, number> = {}
    records.forEach(r => { manuMap[r.tipo_manutencao || "Geral"] = (manuMap[r.tipo_manutencao || "Geral"] || 0) + (r.custo_val || 0) })
    const manutencoes = Object.entries(manuMap).map(([name, value]) => ({ name, value: round2(value) }))

    const idades = ["0-2 Anos", "3-5 Anos", "6-8 Anos", "9+ Anos"].map(id => {
       // Placeholder logic for age since we might not have 'ano_modelo' in the simplified view
       return { name: id, value: 0, media: ticket_medio }
    })

    const top_offenders = sortedVehicles.slice(0, 15).map(([id, custo]) => ({
      id,
      modelo: records.find(r => r.placa === id)?.modelo || "Veículo",
      custo: round2(custo),
      percent: total_custo > 0 ? round2((custo/total_custo)*100) : 0
    }))

    const top_servicos = records.slice(0, 20).map(r => ({ name: r.os_servico || "Serviço", value: round2(r.custo_val || 0) }))

    // Matrix
    const sectors = [...new Set(records.map(r => r.setor))].filter(Boolean)
    const regions = [...new Set(records.map(r => r.regional))].filter(Boolean)
    const matrix: any[] = []
    regions.forEach(reg => {
      sectors.forEach(set => {
        const cellRecs = records.filter(r => r.regional === reg && r.setor === set)
        if (cellRecs.length > 0) {
          const total = round2(cellRecs.reduce((a,b) => a + (b.custo_val || 0), 0))
          const veic = new Set(cellRecs.map(r => r.placa)).size
          matrix.push({ regional: reg, setor: set, total, veiculos: veic, medio: veic > 0 ? round2(total/veic) : 0 })
        }
      })
    })

    const insights = []
    if (ticket_medio > 2000) insights.push({ type: "danger", text: "Custos por veículo elevados. Priorizar manutenções preventivas." })
    else insights.push({ type: "success", text: "Performance de custos dentro do Benchmark Eletromarquez." })

    return NextResponse.json({
      period_label: periodo,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats,
      pareto,
      history,
      regionais,
      fornecedores,
      manutencoes,
      idades,
      top_offenders,
      custo_medio_tipo: [],
      custo_medio_setor: [],
      top_servicos,
      matrix,
      insights
    })
  } catch (err: any) {
    console.error("[API_FROTA] Erro Crítico:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
