import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)

    // Try current period
    let data = await safeFetch<any[]>(`/proxy/frota_custos?data.gte=${startDate}&data.lte=${endDate}`, [])

    // Fallback: If current month has no data, fetch ALL and determine latest month
    if (data.length === 0) {
      console.log(`[Frota API] No data for ${startDate} to ${endDate}. Attempting fallback to latest month.`)
      const allData = await safeFetch<any[]>("/proxy/frota_custos", [])
      if (allData.length > 0) {
        const sorted = allData.sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime())
        const latestMonth = sorted[0].data_solicitacao.substring(0, 7) // "YYYY-MM"
        data = allData.filter(r => r.data_solicitacao.startsWith(latestMonth))
        console.log(`[Frota API] Falling back to month: ${latestMonth} (${data.length} records)`)
      }
    }

    if (data.length === 0) {
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

    const total_custo = round2(data.reduce((a: number, r: any) => a + (r.custo_val || 0), 0))
    const total_manutencoes = data.length
    const veiculos = [...new Set(data.map((r: any) => r.placa).filter(Boolean))]
    const total_veiculos = veiculos.length
    const media_por_veiculo = total_veiculos > 0 ? round2(total_custo / total_veiculos) : 0

    // Group by regional
    const regionalMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      regionalMap[key] = (regionalMap[key] || 0) + (r.custo_val || 0)
    })
    const regionais = Object.entries(regionalMap).map(([label, valor]) => ({ label, valor: round2(valor) }))

    // Group by setor
    const setorMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.setor || "N/D"
      setorMap[key] = (setorMap[key] || 0) + (r.custo_val || 0)
    })
    const setores = Object.entries(setorMap).map(([label, valor]) => ({ label, valor: round2(valor) }))

    // Group by manutencao
    const manuMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.tipo_manutencao || "Geral"
      manuMap[key] = (manuMap[key] || 0) + (r.custo_val || 0)
    })
    const manutencoes = Object.entries(manuMap).map(([label, valor]) => ({ label, valor: round2(valor) }))

    // Top Veículos
    const placaMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.placa || "N/D"
      placaMap[key] = (placaMap[key] || 0) + (r.custo_val || 0)
    })
    const top_veiculos = Object.entries(placaMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([placa, valor]) => ({ placa, valor: round2(valor) }))

    // Insights
    const insights = []
    if (total_custo > 50000) {
      insights.push({ type: "warning", text: `Custo total de frota elevado no período: R$ ${total_custo.toLocaleString('pt-BR')}.` })
    }
    const mediaRef = 1500
    if (media_por_veiculo > mediaRef) {
      insights.push({ type: "danger", text: `Média por veículo (R$ ${media_por_veiculo}) acima da referência sugerida (R$ ${mediaRef}).` })
    } else {
      insights.push({ type: "success", text: `Custo médio por veículo está dentro da normalidade operacional.` })
    }

    return NextResponse.json({
      period: periodo,
      last_update: new Date().toISOString(),
      stats: { total_custo, total_veiculos, media_por_veiculo, total_manutencoes },
      regionais,
      setores,
      manutencoes,
      top_veiculos,
      evolucao: [],
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
