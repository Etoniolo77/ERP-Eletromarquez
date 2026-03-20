import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)
    
    const data = await safeFetch<any[]>(`/proxy/apr_records?data.gte=${startDate}&data.lte=${endDate}`, [])

    if (data.length === 0) {
      return NextResponse.json({
        last_update: new Date().toISOString(),
        period: periodo,
        stats: { total_aprs: 0, media_fotos: 0, total_comentarios: 0, equipes_ativas: 0, pct_conformidade: 100 },
        charts: { labels: [], datasets: [] },
        regionais: [],
        equipes_stats: [],
        insights: [{ type: "info", text: "Sem registros de APR para o período selecionado." }]
      })
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const round1 = (n: number) => Math.round(n * 10) / 10

    const total_aprs = data.length
    const total_fotos = data.reduce((a: number, r: any) => a + (r.fotos_count || 0), 0)
    const media_fotos = total_aprs > 0 ? round1(total_fotos / total_aprs) : 0
    const total_comentarios = data.reduce((a: number, r: any) => a + (r.comentarios_count || 0), 0)
    
    const equipes = [...new Set(data.map((r: any) => r.equipe).filter(Boolean))]
    const equipes_ativas = equipes.length

    // Regionais
    const regionalMap: Record<string, { aprs: number; fotos: number }> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      if (!regionalMap[key]) regionalMap[key] = { aprs: 0, fotos: 0 }
      regionalMap[key].aprs++
      regionalMap[key].fotos += (r.fotos_count || 0)
    })
    const regionais = Object.entries(regionalMap).map(([label, v]) => ({
      label,
      aprs: v.aprs,
      media_fotos: round1(v.fotos / v.aprs)
    }))

    // Equipes Stats
    const equipes_stats = equipes.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      const aprs = eqRows.length
      const fotos = eqRows.reduce((a: number, r: any) => a + (r.fotos_count || 0), 0)
      const regional = eqRows[0]?.regional || ""
      return { equipe: eq, regional, aprs, media_fotos: round1(fotos / aprs) }
    }).sort((a, b) => b.aprs - a.aprs)

    // Daily History Chart
    const histMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const d = r.data ? r.data.split("T")[0] : "N/D"
      histMap[d] = (histMap[d] || 0) + 1
    })
    const sortedDates = Object.keys(histMap).sort()
    const charts = {
      labels: sortedDates,
      datasets: [{ label: "APRs Enviadas", data: sortedDates.map(d => histMap[d]) }]
    }

    // Insights
    const insights = []
    if (media_fotos < 4) {
      insights.push({ type: "warning", text: `Média de fotos por APR (${media_fotos}) está abaixo do padrão recomendado (5).` })
    } else {
      insights.push({ type: "success", text: `Engajamento fotográfico satisfatório: ${media_fotos} fotos/APR.` })
    }
    if (total_comentarios === 0) {
      insights.push({ type: "danger", text: "Nenhum comentário registrado nas APRs — verificar profundidade da análise." })
    }

    return NextResponse.json({
      last_update: new Date().toISOString(),
      period: periodo,
      stats: { total_aprs, media_fotos, total_comentarios, equipes_ativas, pct_conformidade: 100 },
      charts,
      regionais,
      equipes_stats,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
