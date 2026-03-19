import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"
import { getDateRange, getPrevDateRange } from "@/lib/dateRange"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const view = searchParams.get("view") || "equipe"

    const supabase = createServiceClient()
    const { startDate, endDate } = getDateRange(periodo)
    const { startDate: prevStart, endDate: prevEnd } = getPrevDateRange(periodo)

    const [{ data: rows }, { data: prevRows }, { data: configRow }] = await Promise.all([
      supabase.from("produtividade").select("*").gte("data", startDate).lte("data", endDate),
      supabase.from("produtividade").select("produtividade_pct").gte("data", prevStart).lte("data", prevEnd),
      supabase.from("system_configs").select("value").eq("key", "meta_produtividade").maybeSingle(),
    ])

    const data = rows || []
    const prev = prevRows || []

    const meta_prod = configRow?.value ? parseFloat(configRow.value) : 85

    if (data.length === 0) {
      return NextResponse.json({
        meta_prod,
        periodo_ref: `${startDate} a ${endDate}`,
        source_file: "supabase",
        last_update: new Date().toISOString(),
        stats: {
          media_prod: 0, trend_prod: 0, total_ociosidade_hrs: 0,
          total_desvios_hrs: 0, total_notas: 0, total_rejeicoes: 0,
          total_equipes: 0, atingimento_meta: 0
        },
        chart: { labels: [], data: [] },
        top_desvios: [],
        top_piores: [],
        top_melhores: [],
        breakdown_csd: [],
        insights: [{ type: "info", text: "Sem dados para o período selecionado." }]
      })
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const prods = data.map((r: any) => r.produtividade_pct || 0)
    const media_prod = Math.round(avg(prods) * 10) / 10
    const prevMedia = avg(prev.map((r: any) => r.produtividade_pct || 0))
    const trend_prod = prevMedia > 0 ? Math.round(((media_prod - prevMedia) / prevMedia) * 1000) / 10 : 0

    const total_ociosidade_hrs = Math.round(data.reduce((a: number, r: any) => a + (r.ociosidade_min || 0), 0) / 60 * 10) / 10
    const total_desvios_hrs = Math.round(data.reduce((a: number, r: any) => a + (r.desvios_min || 0), 0) / 60 * 10) / 10
    const total_notas = data.reduce((a: number, r: any) => a + (r.notas_executadas || 0), 0)
    const total_rejeicoes = data.reduce((a: number, r: any) => a + (r.notas_rejeitadas || 0), 0)

    const equipes = [...new Set(data.map((r: any) => r.equipe).filter(Boolean))]
    const total_equipes = equipes.length
    const acima_meta = equipes.filter(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return avg(eqRows.map((r: any) => r.produtividade_pct || 0)) >= meta_prod
    }).length
    const atingimento_meta = total_equipes > 0 ? Math.round((acima_meta / total_equipes) * 1000) / 10 : 0

    // Chart: group by equipe
    const chartLabels = equipes.slice(0, 20)
    const chartData = chartLabels.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return Math.round(avg(eqRows.map((r: any) => r.produtividade_pct || 0)) * 10) / 10
    })

    // Top piores / melhores
    const equipeStats = equipes.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      const csd = eqRows[0]?.csd || ""
      return {
        equipe: eq,
        csd,
        produtividade: Math.round(avg(eqRows.map((r: any) => r.produtividade_pct || 0)) * 10) / 10,
        ociosidade: Math.round(avg(eqRows.map((r: any) => r.ociosidade_min || 0)) * 10) / 10,
        notas: eqRows.reduce((a: number, r: any) => a + (r.notas_executadas || 0), 0),
        rejeitadas: eqRows.reduce((a: number, r: any) => a + (r.notas_rejeitadas || 0), 0),
        interrompidas: eqRows.reduce((a: number, r: any) => a + (r.notas_interrompidas || 0), 0),
      }
    })

    const sorted = [...equipeStats].sort((a, b) => a.produtividade - b.produtividade)
    const top_piores = sorted.slice(0, 10)
    const top_melhores = [...sorted].reverse().slice(0, 10)

    // Breakdown by CSD
    const csds = [...new Set(data.map((r: any) => r.csd).filter(Boolean))]
    const breakdown_csd = csds.map(csd => {
      const csdRows = data.filter((r: any) => r.csd === csd)
      const csdEquipes = [...new Set(csdRows.map((r: any) => r.equipe).filter(Boolean))]
      const csdMedia = Math.round(avg(csdRows.map((r: any) => r.produtividade_pct || 0)) * 10) / 10
      const csdAcima = csdEquipes.filter(eq => {
        const eqR = csdRows.filter((r: any) => r.equipe === eq)
        return avg(eqR.map((r: any) => r.produtividade_pct || 0)) >= meta_prod
      }).length
      return {
        name: csd,
        num_equipes: csdEquipes.length,
        acima_meta: csdAcima,
        produtividade: csdMedia,
        ociosidade: Math.round(avg(csdRows.map((r: any) => r.ociosidade_min || 0)) * 10) / 10,
        equipes: csdEquipes.slice(0, 10).map(eq => {
          const eqR = csdRows.filter((r: any) => r.equipe === eq)
          return { equipe: eq, prod: Math.round(avg(eqR.map((r: any) => r.produtividade_pct || 0)) * 10) / 10 }
        })
      }
    })

    // Insights
    const insights = []
    if (media_prod >= meta_prod) {
      insights.push({ type: "success", text: `Produtividade média de ${media_prod}% está acima da meta de ${meta_prod}%.` })
    } else {
      insights.push({ type: "warning", text: `Produtividade média de ${media_prod}% está abaixo da meta de ${meta_prod}%.` })
    }
    if (total_rejeicoes > 0) {
      insights.push({ type: "danger", text: `${total_rejeicoes} notas rejeitadas no período. Verificar causas.` })
    }
    if (atingimento_meta < 50) {
      insights.push({ type: "danger", text: `Apenas ${atingimento_meta}% das equipes atingiram a meta de produtividade.` })
    } else {
      insights.push({ type: "info", text: `${atingimento_meta}% das equipes atingiram a meta de produtividade.` })
    }

    return NextResponse.json({
      meta_prod,
      periodo_ref: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        media_prod,
        trend_prod,
        total_ociosidade_hrs,
        total_desvios_hrs,
        total_notas,
        total_rejeicoes,
        total_equipes,
        atingimento_meta
      },
      chart: { labels: chartLabels, data: chartData },
      top_desvios: [],
      top_piores,
      top_melhores,
      breakdown_csd,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
