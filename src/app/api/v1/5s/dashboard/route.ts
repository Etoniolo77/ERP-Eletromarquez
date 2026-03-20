import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const base = searchParams.get("base") || ""

    const { startDate, endDate } = getDateRange(periodo)
    
    let path = `/proxy/audit_5s?data_auditoria.gte=${startDate}&data_auditoria.lte=${endDate}`
    if (base && base !== "Todas") {
      path += `&base=${encodeURIComponent(base)}`
    }

    const data = await safeFetch<any[]>(path, [])

    const round1 = (n: number) => Math.round(n * 10) / 10

    if (data.length === 0) {
      return NextResponse.json({
        last_update: new Date().toISOString(),
        stats: { media_pontuacao: 0, total_auditorias: 0, conformidade_pct: 100, planos_abertos: 0 },
        charts: { labels: [], datasets: [] },
        setores: [],
        ofensores: [],
        all_bases: [],
        insights: [{ type: "info", text: "Sem auditorias de 5S no período selecionado." }]
      })
    }

    const all_bases: string[] = [...new Set(data.map((r: any) => r.base).filter(Boolean))] as string[]

    const total_auditorias = data.length
    const pts = data.map((r: any) => r.pontuacao || 0)
    const media_pontuacao = round1(pts.reduce((a: number, b: number) => a + b, 0) / pts.length)
    const conformidade_pct = round1((data.filter((r: any) => (r.pontuacao || 0) >= 90).length / total_auditorias) * 100)
    
    const planos = await safeFetch<any[]>("/proxy/planos_5s?status=Aberto", [])
    const planos_abertos = planos.length

    // Group by Setor
    const setorMap: Record<string, number[]> = {}
    data.forEach((r: any) => {
      const key = r.setor || "N/D"
      if (!setorMap[key]) setorMap[key] = []
      setorMap[key].push(r.pontuacao || 0)
    })
    const setores = Object.entries(setorMap).map(([label, v]) => ({
      label,
      valor: round1(v.reduce((a, b) => a + b, 0) / v.length)
    })).sort((a, b) => b.valor - a.valor)

    // Ofensores: lower scores
    const ofensores = [...setores].reverse().slice(0, 5)

    // History: daily
    const histMap: Record<string, number[]> = {}
    data.forEach((r: any) => {
      const d = r.data_auditoria ? r.data_auditoria.split("T")[0] : "N/D"
      if (!histMap[d]) histMap[d] = []
      histMap[d].push(r.pontuacao || 0)
    })
    const sortedDates = Object.keys(histMap).sort()
    const charts = {
      labels: sortedDates,
      datasets: [{ label: "Pontuação Média", data: sortedDates.map(d => round1(histMap[d].reduce((a, b) => a + b, 0) / histMap[d].length)) }]
    }

    // Insights
    const insights = []
    if (media_pontuacao >= 90) {
      insights.push({ type: "success", text: `Média de 5S (${media_pontuacao}) está excelente.` })
    } else if (media_pontuacao >= 80) {
      insights.push({ type: "warning", text: `Média de 5S (${media_pontuacao}) regular. Foco em melhoria contínua.` })
    } else {
      insights.push({ type: "danger", text: `Média de 5S (${media_pontuacao}) crítica. Ações imediatas necessárias.` })
    }
    if (planos_abertos > 10) {
      insights.push({ type: "danger", text: `${planos_abertos} planos de ação pendentes. Alto risco de recorrência.` })
    }

    return NextResponse.json({
      last_update: new Date().toISOString(),
      stats: { media_pontuacao, total_auditorias, conformidade_pct, planos_abertos },
      charts,
      setores,
      ofensores,
      all_bases,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
