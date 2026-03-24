import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { createClient } from "@/lib/supabase/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)
    
    const supabase = await createClient()
    let { data, error } = await supabase
      .from("apr_records")
      .select("*")
      .gte("data", startDate)
      .lte("data", endDate)

    if (error) {
      console.error("[APR Dashboard] Supabase error:", error)
      throw new Error(error.message)
    }

    let records = data || []

    // FALLBACK: If current period has no data, fetch latest month available
    if (records.length === 0) {
      console.log(`[APR Dashboard] No data for ${startDate} to ${endDate}. Falling back to latest.`)
      const { data: latestData, error: latestError } = await supabase
        .from("apr_records")
        .select("*")
        .order("data", { ascending: false })
        .limit(200)
      
      if (latestError) throw new Error(latestError.message)
      
      if (latestData && latestData.length > 0) {
        const latestDate = latestData[0].data
        const latestMonth = latestDate.substring(0, 7)
        records = latestData.filter(r => r.data && r.data.startsWith(latestMonth))
        console.log(`[APR Dashboard] Fallback to ${latestMonth} (${records.length} records)`)
      }
    }

    const finalRecords = records

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const round1 = (n: number) => Math.round(n * 10) / 10

    if (finalRecords.length === 0) {
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

    const total_aprs = finalRecords.length
    const total_fotos = finalRecords.reduce((a: number, r: any) => a + (r.fotos_count || 0), 0)
    const media_fotos = total_aprs > 0 ? round1(total_fotos / total_aprs) : 0
    const total_comentarios = finalRecords.reduce((a: number, r: any) => a + (r.comentarios_count || 0), 0)
    
    const equipes = [...new Set(finalRecords.map((r: any) => r.equipe).filter(Boolean))]
    const equipes_ativas = equipes.length

    // Regionais
    const regionalMap: Record<string, { aprs: number; fotos: number }> = {}
    finalRecords.forEach((r: any) => {
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
      const eqRows = finalRecords.filter((r: any) => r.equipe === eq)
      const aprs = eqRows.length
      const fotos = eqRows.reduce((a: number, r: any) => a + (r.fotos_count || 0), 0)
      const regional = eqRows[0]?.regional || ""
      return { equipe: eq, regional, aprs, media_fotos: round1(fotos / aprs) }
    }).sort((a, b) => b.aprs - a.aprs)

    // Daily History Chart
    const histMap: Record<string, number> = {}
    finalRecords.forEach((r: any) => {
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

    // 5. Formatar Resposta para o Componente APR do Frontend
    // O frontend espera: { stats, history, bases_breakdown, insights, last_update, source_file, period_label }
    const historyLabels = [...new Set(finalRecords.map((r: any) => r.data ? r.data.split("T")[0] : "N/D"))].sort()
    const historyValues = historyLabels.map(label => {
      const dayRecs = finalRecords.filter((r: any) => (r.data ? r.data.split("T")[0] : "N/D") === label)
      return avg(dayRecs.map((r: any) => r.fotos_count || 0))
    })

    const bases = [...new Set(finalRecords.map((r: any) => r.regional || "N/D"))].sort()
    const bases_breakdown = bases.map(baseName => {
      const baseRecs = finalRecords.filter((r: any) => (r.regional || "N/D") === baseName)
      const latest = baseRecs[baseRecs.length - 1]
      
      // Aggregating history by day for this specific base
      const baseHistValues = historyLabels.map(label => {
        const dayRecs = baseRecs.filter((r: any) => (r.data ? r.data.split("T")[0] : "N/D") === label)
        return avg(dayRecs.map((r: any) => r.fotos_count || 0))
      })

      return {
        name: baseName,
        last_result: baseRecs.length > 0 ? avg(baseRecs.map((r: any) => r.fotos_count || 0)) : 100,
        total_equipes: [...new Set(baseRecs.map((r: any) => r.equipe))].length,
        icon: "location_on",
        color: "text-primary",
        pct: 100,
        trend: "+0%",
        sparkline: baseHistValues.map((v, i) => ({ name: historyLabels[i], value: v })),
        top_offenders: baseRecs.slice(0, 10).map((r: any) => ({
          equipe: r.equipe || "S/E",
          efetividade: r.fotos_count || 0
        }))
      }
    })

    return NextResponse.json({
      last_update: new Date().toISOString(),
      source_file: "supabase",
      period_label: periodo,
      stats: {
        total_aprs,
        media_fotos,
        total_comentarios,
        equipes_ativas,
        pct_conformidade: 100
      },
      history: {
        labels: historyLabels,
        values: historyValues
      },
      bases_breakdown,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
