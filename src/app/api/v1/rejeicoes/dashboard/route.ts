import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)
    const supabase = await createClient()
    
    // Attempt to fetch data for the selected period
    let { data, error } = await supabase
      .from("rejeicoes_records")
      .select("*")
      .gte("data", startDate)
      .lte("data", endDate)

    if (error) throw error

    // Fallback logic: if no data, fetch the latest available month
    if (!data || data.length === 0) {
      const { data: latestRecord } = await supabase
        .from("rejeicoes_records")
        .select("data")
        .order("data", { ascending: false })
        .limit(1)
        .single()

      if (latestRecord) {
        const latestDate = new Date(latestRecord.data)
        const fbStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1).toISOString()
        const fbEnd = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0).toISOString()
        
        const { data: fallbackData } = await supabase
          .from("rejeicoes_records")
          .select("*")
          .gte("data", fbStart)
          .lte("data", fbEnd)
        
        data = fallbackData
      }
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        last_update: new Date().toISOString(),
        stats: { total_rejeicoes: 0, media_rejeicoes_dia: 0, principal_motivo: "N/A", conformidade: 100 },
        charts: { labels: [], datasets: [] },
        regionais: [],
        ofensores: [],
        insights: [{ type: "info", text: "Sem registros de rejeições disponíveis." }]
      })
    }

    const round1 = (n: number) => Math.round(n * 10) / 10
    const total_rejeicoes = data.length
    
    // Group by Motivo
    const motivoMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.motivo || "N/D"
      motivoMap[key] = (motivoMap[key] || 0) + 1
    })
    const sortedMotivos = Object.entries(motivoMap).sort((a, b) => b[1] - a[1])
    const principal_motivo = sortedMotivos.length > 0 ? sortedMotivos[0][0] : "N/A"

    // Group by Regional
    const regionalMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      regionalMap[key] = (regionalMap[key] || 0) + 1
    })
    const regionais = Object.entries(regionalMap).map(([label, valor]) => ({ label, valor }))

    // Ofensores: teams with most rejections
    const equipeMap: Record<string, { count: number; regional: string }> = {}
    data.forEach((r: any) => {
      const key = r.equipe || "N/D"
      if (!equipeMap[key]) equipeMap[key] = { count: 0, regional: r.regional || "" }
      equipeMap[key].count++
    })
    const ofensores = Object.entries(equipeMap)
      .map(([equipe, v]) => ({ equipe, regional: v.regional, total: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10) // Show top 10 instead of 5

    // History: daily
    const histMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const d = r.data ? r.data.split("T")[0] : "N/D"
      histMap[d] = (histMap[d] || 0) + 1
    })
    const sortedDates = Object.keys(histMap).sort()
    const charts = {
      labels: sortedDates,
      datasets: [{ label: "Rejeições", data: sortedDates.map(d => histMap[d]) }]
    }

    // Insights
    const insights = []
    if (total_rejeicoes > 20) {
      insights.push({ type: "danger", text: `Volume de rejeições elevado (${total_rejeicoes}). Impacto direto na produtividade.` })
    } else if (total_rejeicoes > 0) {
      insights.push({ type: "warning", text: `${total_rejeicoes} rejeições identificadas. Monitorar principais ofensores.` })
    }
    if (principal_motivo !== "N/A") {
      insights.push({ type: "info", text: `Ofensor principal: "${principal_motivo}".` })
    }

    return NextResponse.json({
      last_update: new Date().toISOString(),
      stats: { 
        total_rejeicoes, 
        media_rejeicoes_dia: round1(total_rejeicoes / (sortedDates.length || 1)), 
        principal_motivo, 
        conformidade: 0 
      },
      charts,
      regionais,
      ofensores,
      insights
    })
  } catch (err: any) {
    console.error("Error in Rejeicoes API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
