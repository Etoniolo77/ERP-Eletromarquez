import { getDateRange, getPrevDateRange } from "@/lib/dateRange"
import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const sector = searchParams.get("sector") || "CCM"

    const { startDate, endDate } = getDateRange(periodo)
    const { startDate: prevStart, endDate: prevEnd } = getPrevDateRange(periodo)
    
    // Convert to safeFetch calls
    const [data, prev] = await Promise.all([
      safeFetch<any[]>(`/proxy/apr_records?sector=${encodeURIComponent(sector)}&data.gte=${startDate}&data.lte=${endDate}`, []),
      safeFetch<any[]>(`/proxy/apr_records?sector=${encodeURIComponent(sector)}&data.gte=${prevStart}&data.lte=${prevEnd}&select=efetividade`, []),
    ])

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
        regional_breakdown: [],
        insights: [{ type: "info", text: "Sem dados para o período selecionado." }]
      })
    }

    const efets = data.map((r: any) => r.efetividade || 0)
    const aderencia_global = round1(avg(efets))
    const prevEfet = avg(prev.map((r: any) => r.efetividade || 0))
    const aderencia_var = prevEfet > 0 ? round1(aderencia_global - prevEfet) : 0

    const equipes = [...new Set(data.map((r: any) => r.equipe).filter(Boolean))]
    const total_equipes = equipes.length
    const equipes_fora_meta = equipes.filter(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return avg(eqRows.map((r: any) => r.efetividade || 0)) < meta
    }).length

    // History: group by date
    const histMap: Record<string, number[]> = {}
    data.forEach((r: any) => {
      const d = r.data ? r.data.split("T")[0] : "N/D"
      if (!histMap[d]) histMap[d] = []
      histMap[d].push(r.efetividade || 0)
    })
    const sortedDates = Object.keys(histMap).sort()
    const history = {
      labels: sortedDates,
      values: sortedDates.map(d => round1(avg(histMap[d])))
    }

    // Equipe stats
    const equipeStats = equipes.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return {
        equipe: eq,
        regional: eqRows[0]?.regional || "",
        efetividade: round1(avg(eqRows.map((r: any) => r.efetividade || 0))),
        count: eqRows.length
      }
    }).sort((a, b) => b.efetividade - a.efetividade)

    const top_melhores = equipeStats.slice(0, 5)
    const top_piores = [...equipeStats].reverse().slice(0, 5)

    // Regional breakdown
    const regionais = [...new Set(data.map((r: any) => r.regional).filter(Boolean))]
    const regional_breakdown = regionais.map(reg => {
      const regRows = data.filter((r: any) => r.regional === reg)
      const regEquipes = [...new Set(regRows.map((r: any) => r.equipe))]
      return {
        regional: reg,
        efetividade: round1(avg(regRows.map((r: any) => r.efetividade || 0))),
        equipes_total: regEquipes.length,
        equipes_fora: regEquipes.filter(eq => {
          const eqR = regRows.filter((r: any) => r.equipe === eq)
          return avg(eqR.map((r: any) => r.efetividade || 0)) < meta
        }).length
      }
    })

    // Insights
    const insights = []
    if (aderencia_global >= meta) {
      insights.push({ type: "success", text: `Aderência global de ${aderencia_global}% está acima da meta de ${meta}%.` })
    } else {
      insights.push({ type: "warning", text: `Aderência global de ${aderencia_global}% está abaixo da meta de ${meta}%.` })
    }
    if (equipes_fora_meta > 0) {
      insights.push({ type: "danger", text: `${equipes_fora_meta} equipes operando abaixo da meta de efetividade.` })
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
      regional_breakdown,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
