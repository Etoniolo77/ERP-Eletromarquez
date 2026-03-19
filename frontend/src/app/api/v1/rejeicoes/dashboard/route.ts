import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"
import { getDateRange, getPrevDateRange } from "@/lib/dateRange"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const supabase = createServiceClient()
    const { startDate, endDate } = getDateRange(periodo)
    const { startDate: prevStart, endDate: prevEnd } = getPrevDateRange(periodo)

    const [{ data: rows }, { data: prevRows }, { data: allRows }] = await Promise.all([
      supabase.from("rejeicoes").select("*").gte("data_conclusao", startDate).lte("data_conclusao", endDate),
      supabase.from("rejeicoes").select("num_rejeicoes").gte("data_conclusao", prevStart).lte("data_conclusao", prevEnd),
      supabase.from("rejeicoes").select("data_conclusao, num_rejeicoes").order("data_conclusao", { ascending: true }),
    ])

    const data = rows || []
    const prev = prevRows || []
    const all = allRows || []

    if (data.length === 0) {
      return NextResponse.json({
        period_label: `${startDate} a ${endDate}`,
        source_file: "supabase",
        last_update: new Date().toISOString(),
        stats: {
          total: 0, media_dia: 0, media_prev: 0, aderencia_pct: 100,
          status_resumo: { auditadas: 0, pendentes: 0 },
          kpi1: null, kpi2: null, kpi3: null, kpi4: null
        },
        top_equipes: [],
        top_eletricistas: [],
        pareto: [],
        backoffice_data: [],
        global_status: {},
        history: [],
        insights: [{ type: "info", text: "Sem dados de rejeições para o período selecionado." }]
      })
    }

    const total = data.reduce((a: number, r: any) => a + (r.num_rejeicoes || 1), 0)
    const prevTotal = prev.reduce((a: number, r: any) => a + (r.num_rejeicoes || 1), 0)

    const daysDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    const prevDaysDiff = Math.max(1, Math.ceil((new Date(prevEnd).getTime() - new Date(prevStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    const media_dia = Math.round((total / daysDiff) * 10) / 10
    const media_prev = Math.round((prevTotal / prevDaysDiff) * 10) / 10

    // Top equipes
    const equipeMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.equipe || "N/D"
      equipeMap[key] = (equipeMap[key] || 0) + (r.num_rejeicoes || 1)
    })
    const top_equipes = Object.entries(equipeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([Equipe, Qtd]) => ({ Equipe, Qtd }))

    // Top eletricistas
    const eletMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.eletricista || "N/D"
      eletMap[key] = (eletMap[key] || 0) + (r.num_rejeicoes || 1)
    })
    const top_eletricistas = Object.entries(eletMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([Equipe, Qtd]) => ({ Equipe, Qtd }))

    // Pareto by motivo
    const motivoMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.motivo || r.codigo_motivo || "N/D"
      motivoMap[key] = (motivoMap[key] || 0) + (r.num_rejeicoes || 1)
    })
    const paretoSorted = Object.entries(motivoMap).sort((a, b) => b[1] - a[1])
    const pareto = paretoSorted.map(([Motivo, Qtd]) => ({
      Motivo,
      Qtd,
      Pct: Math.round((Qtd / total) * 1000) / 10
    }))

    // Backoffice data
    const backofficeMap: Record<string, { Procedente: number; Improcedente: number; "Em Análise": number }> = {}
    data.forEach((r: any) => {
      const bo = r.backoffice_em || "N/D"
      if (!backofficeMap[bo]) backofficeMap[bo] = { Procedente: 0, Improcedente: 0, "Em Análise": 0 }
      const status = (r.status || "").toLowerCase()
      if (status.includes("procedente") && !status.includes("im")) backofficeMap[bo].Procedente += (r.num_rejeicoes || 1)
      else if (status.includes("improcedente")) backofficeMap[bo].Improcedente += (r.num_rejeicoes || 1)
      else backofficeMap[bo]["Em Análise"] += (r.num_rejeicoes || 1)
    })
    const backoffice_data = Object.entries(backofficeMap).map(([Backoffice, vals]) => ({ Backoffice, ...vals }))

    // Global status
    const global_status: Record<string, number> = {}
    data.forEach((r: any) => {
      const s = r.status || "N/D"
      global_status[s] = (global_status[s] || 0) + (r.num_rejeicoes || 1)
    })

    const auditadas = data.filter((r: any) => r.status && !r.status.toLowerCase().includes("pend")).length
    const pendentes = data.filter((r: any) => r.status && r.status.toLowerCase().includes("pend")).length

    // History: group by month
    const historyMap: Record<string, number> = {}
    all.forEach((r: any) => {
      if (!r.data_conclusao) return
      const d = new Date(r.data_conclusao)
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      historyMap[key] = (historyMap[key] || 0) + (r.num_rejeicoes || 1)
    })
    const history = Object.entries(historyMap)
      .sort((a, b) => {
        const [am, ay] = a[0].split('/').map(Number)
        const [bm, by] = b[0].split('/').map(Number)
        return ay !== by ? ay - by : am - bm
      })
      .map(([MesAno, Qtd]) => ({ MesAno, Qtd }))

    // Insights
    const insights = []
    if (total < prevTotal && prevTotal > 0) {
      insights.push({ type: "success", text: `Rejeições reduziram de ${prevTotal} para ${total} (${Math.round(((prevTotal - total) / prevTotal) * 100)}% de melhora).` })
    } else if (total > prevTotal && prevTotal > 0) {
      insights.push({ type: "danger", text: `Rejeições aumentaram de ${prevTotal} para ${total} no período.` })
    }
    if (pareto.length > 0) {
      insights.push({ type: "warning", text: `Principal motivo: "${pareto[0].Motivo}" com ${pareto[0].Pct}% das rejeições.` })
    }
    if (top_equipes.length > 0) {
      insights.push({ type: "info", text: `Equipe com mais rejeições: ${top_equipes[0].Equipe} (${top_equipes[0].Qtd} rejeições).` })
    }

    return NextResponse.json({
      period_label: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        total,
        media_dia,
        media_prev,
        aderencia_pct: 100 - Math.min(100, Math.round((pendentes / Math.max(1, data.length)) * 100)),
        status_resumo: { auditadas, pendentes },
        kpi1: { label: "Total", value: total, variation: 0 },
        kpi2: { label: "Média/Dia", value: media_dia, variation: 0 },
        kpi3: { label: "Auditadas", value: auditadas, variation: 0 },
        kpi4: { label: "Pendentes", value: pendentes, variation: 0 },
      },
      top_equipes,
      top_eletricistas,
      pareto,
      backoffice_data,
      global_status,
      history,
      insights,
      recent_records: data.slice(0, 20).map((r: any) => ({
        data: r.data_conclusao || "",
        status: r.status || "",
        equipe: r.equipe || "",
        nota: r.nota || "",
        motivo: r.motivo || "",
        observacao: r.descricao || "",
        regional: r.regional || "",
      }))
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
