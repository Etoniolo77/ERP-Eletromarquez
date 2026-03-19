import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"
import { getDateRange, getPrevDateRange } from "@/lib/dateRange"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sector = searchParams.get("sector") || "CCM"
    const periodo = searchParams.get("periodo") || "month"

    const supabase = createServiceClient()
    const { startDate, endDate } = getDateRange(periodo)
    const { startDate: prevStart, endDate: prevEnd } = getPrevDateRange(periodo)

    const [{ data: rows }, { data: prevRows }] = await Promise.all([
      supabase.from("apr_records").select("*").eq("sector", sector).gte("data", startDate).lte("data", endDate),
      supabase.from("apr_records").select("efetividade").eq("sector", sector).gte("data", prevStart).lte("data", prevEnd),
    ])

    const data = rows || []
    const prev = prevRows || []
    const meta = 95

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const round1 = (n: number) => Math.round(n * 10) / 10

    if (data.length === 0) {
      return NextResponse.json({
        sector,
        period_label: `${startDate} a ${endDate}`,
        source_file: "supabase",
        last_update: new Date().toISOString(),
        meta,
        stats: { aderencia_global: 0, aderencia_var: 0, equipes_fora_meta: 0, equipes_fora_var: 0, total_equipes: 0, total_equipes_var: 0 },
        history: { labels: [], values: [] },
        top_melhores: [],
        top_piores: [],
        bases_breakdown: [],
        insights: [{ type: "info", text: "Sem dados de APR para o período selecionado." }]
      })
    }

    const efetividades = data.map((r: any) => r.efetividade || 0)
    const aderencia_global = round1(avg(efetividades))
    const prevEfet = prev.map((r: any) => r.efetividade || 0)
    const prevAvg = round1(avg(prevEfet))
    const aderencia_var = prevAvg > 0 ? round1(((aderencia_global - prevAvg) / prevAvg) * 100) : 0

    const equipes = [...new Set(data.map((r: any) => r.equipe).filter(Boolean))] as string[]
    const total_equipes = equipes.length
    const equipes_fora_meta = equipes.filter(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return avg(eqRows.map((r: any) => r.efetividade || 0)) < meta
    }).length

    // History: group by date
    const histMap: Record<string, number[]> = {}
    data.forEach((r: any) => {
      const d = r.data || ""
      if (!histMap[d]) histMap[d] = []
      histMap[d].push(r.efetividade || 0)
    })
    const histDates = Object.keys(histMap).sort()
    const history = {
      labels: histDates,
      values: histDates.map(d => round1(avg(histMap[d])))
    }

    // Top melhores / piores
    const regionais = [...new Set(data.map((r: any) => r.setor_name || r.setor || "").filter(Boolean))] as string[]
    const equipeStats = equipes.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      const regional = eqRows[0]?.setor_name || eqRows[0]?.setor || ""
      return {
        equipe: eq,
        regional,
        efetividade: round1(avg(eqRows.map((r: any) => r.efetividade || 0)))
      }
    })
    const sortedByEf = [...equipeStats].sort((a, b) => b.efetividade - a.efetividade)
    const top_melhores = sortedByEf.slice(0, 10)
    const top_piores = [...sortedByEf].reverse().slice(0, 10)

    // Bases breakdown
    const bases_breakdown = regionais.map(reg => {
      const regRows = data.filter((r: any) => (r.setor_name || r.setor || "") === reg)
      const regEquipes = [...new Set(regRows.map((r: any) => r.equipe).filter(Boolean))] as string[]

      // Sparkline by date
      const regHistMap: Record<string, number[]> = {}
      regRows.forEach((r: any) => {
        const d = r.data || ""
        if (!regHistMap[d]) regHistMap[d] = []
        regHistMap[d].push(r.efetividade || 0)
      })
      const regDates = Object.keys(regHistMap).sort()
      const sparkline = regDates.map(d => ({ name: d, value: round1(avg(regHistMap[d])) }))
      const last_result = sparkline.length > 0 ? sparkline[sparkline.length - 1].value : 0

      const equipes_meta = regEquipes.filter(eq => {
        const eqR = regRows.filter((r: any) => r.equipe === eq)
        return avg(eqR.map((r: any) => r.efetividade || 0)) >= meta
      }).length

      const top_offenders = regEquipes.map(eq => {
        const eqR = regRows.filter((r: any) => r.equipe === eq)
        return { equipe: eq, efetividade: round1(avg(eqR.map((r: any) => r.efetividade || 0))) }
      }).sort((a, b) => a.efetividade - b.efetividade)

      return {
        name: reg,
        last_result,
        efetividade_str: `${last_result}%`,
        total_equipes: regEquipes.length,
        equipes_meta,
        equipes_fora: regEquipes.length - equipes_meta,
        sparkline,
        top_offenders
      }
    })

    // Insights
    const insights = []
    if (aderencia_global >= meta) {
      insights.push({ type: "destaque", text: `Aderência global de ${aderencia_global}% atinge a meta de ${meta}%.` })
    } else {
      insights.push({ type: "preocupacao", text: `Aderência de ${aderencia_global}% abaixo da meta de ${meta}%. ${equipes_fora_meta} equipes precisam de atenção.` })
    }
    if (top_piores.length > 0) {
      insights.push({ type: "alerta", text: `${top_piores[0].equipe} com efetividade de ${top_piores[0].efetividade}% requer intervenção imediata.` })
    }

    return NextResponse.json({
      sector,
      period_label: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      meta,
      stats: {
        aderencia_global,
        aderencia_var,
        equipes_fora_meta,
        equipes_fora_var: 0,
        total_equipes,
        total_equipes_var: 0
      },
      history,
      top_melhores,
      top_piores,
      bases_breakdown,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
