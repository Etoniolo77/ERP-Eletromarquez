import { NextRequest, NextResponse } from "next/server"
import { getDateRange, getPrevDateRange } from "@/lib/dateRange"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const { startDate, endDate } = getDateRange(periodo)
    const { startDate: prevStart, endDate: prevEnd } = getPrevDateRange(periodo)

    const supabase = await createClient()

    const [
      { data: initialData, error: dataError },
      { data: prevData, error: prevError },
      { data: configData, error: configError }
    ] = await Promise.all([
      supabase.from("produtividade").select("*").gte("data", startDate).lte("data", endDate),
      supabase.from("produtividade").select("produtividade_pct").gte("data", prevStart).lte("data", prevEnd),
      supabase.from("system_configs").select("*").eq("key", "meta_produtividade")
    ])

    if (dataError) throw new Error(dataError.message)
    if (prevError) throw new Error(prevError.message)
    if (configError) throw new Error(configError.message)

    let records = initialData || []

    // FALLBACK: If current period has no data, fetch latest month available
    if (records.length === 0) {
      console.log(`[Produtividade API] No data for ${startDate} to ${endDate}. Falling back.`)
      const { data: latestData, error: latestError } = await supabase
        .from("produtividade")
        .select("*")
        .order("data", { ascending: false })
        .limit(500)
      
      if (latestError) throw new Error(latestError.message)
      
      if (latestData && latestData.length > 0) {
        const latestDate = latestData[0].data
        const latestMonth = latestDate.substring(0, 7)
        records = latestData.filter(r => r.data && r.data.startsWith(latestMonth))
      }
    }

    const prev = prevData || []

    const configRow = configData.length > 0 ? configData[0] : null
    const meta_prod = configRow?.value ? parseFloat(configRow.value) : 85

    if (records.length === 0) {
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

    const prods = records.map((r: any) => r.produtividade_pct || 0)
    const media_prod = Math.round(avg(prods) * 10) / 10
    const prevMedia = avg(prev.map((r: any) => r.produtividade_pct || 0))
    const trend_prod = prevMedia > 0 ? Math.round(((media_prod - prevMedia) / prevMedia) * 1000) / 10 : 0
 
    const total_ociosidade_hrs = Math.round(records.reduce((a: number, r: any) => a + (r.ociosidade_min || 0), 0) / 60 * 10) / 10
    const total_desvios_hrs = Math.round(records.reduce((a: number, r: any) => a + (r.desvios_min || 0), 0) / 60 * 10) / 10
    const total_notas = records.reduce((a: number, r: any) => a + (r.notas_executadas || 0), 0)
    const total_rejeicoes = records.reduce((a: number, r: any) => a + (r.notas_rejeitadas || 0), 0)
 
    const equipes = [...new Set(records.map((r: any) => r.equipe).filter(Boolean))]
    const total_equipes = equipes.length
    const acima_meta = equipes.filter(eq => {
      const eqRows = records.filter((r: any) => r.equipe === eq)
      return avg(eqRows.map((r: any) => r.produtividade_pct || 0)) >= meta_prod
    }).length
    const atingimento_meta = total_equipes > 0 ? Math.round((acima_meta / total_equipes) * 1000) / 10 : 0
 
    // Chart: group by equipe
    const chartLabels = equipes.slice(0, 20)
    const chartData = chartLabels.map(eq => {
      const eqRows = records.filter((r: any) => r.equipe === eq)
      return Math.round(avg(eqRows.map((r: any) => r.produtividade_pct || 0)) * 10) / 10
    })
 
    // Top piores / melhores
    const equipeStats = equipes.map(eq => {
      const eqRows = records.filter((r: any) => r.equipe === eq)
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
    const csds = [...new Set(records.map((r: any) => r.csd).filter(Boolean))]
    const breakdown_csd = csds.map(csd => {
      const csdRows = records.filter((r: any) => r.csd === csd)
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

    // Final response structure aligned with main.py
    return NextResponse.json({
      meta_prod,
      periodo_ref: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        media_prod,
        trend_prod,
        media_ociosidade: Math.round(avg(records.map((r: any) => r.ociosidade_min || 0)) * 10) / 10,
        trend_ociosidade: 0,
        media_saida_base: Math.round(avg(records.map((r: any) => r.saida_base_min || 0)) * 10) / 10,
        trend_saida: 0,
        media_retorno_base: Math.round(avg(records.map((r: any) => r.retorno_base_min || 0)) * 10) / 10,
        trend_retorno: 0,
        total_ociosidade_hrs,
        total_desvios_hrs,
        total_hora_extra_hrs: Math.round(records.reduce((a: number, r: any) => a + (r.hora_extra_min || 0), 0) / 60 * 10) / 10,
        total_notas,
        total_rejeicoes,
        total_equipes,
        atingimento_meta,
        num_dias: new Set(records.map((r: any) => r.data ? (typeof r.data === 'string' ? r.data.split("T")[0] : new Date(r.data).toISOString().split("T")[0]) : null).filter(Boolean)).size
      },
      chart: { labels: chartLabels, data: chartData },
      charts: {
        ocupacao: { labels: chartLabels, data: chartData },
        ociosidade: { 
          labels: equipes.slice(0, 15), 
          data: equipes.slice(0, 15).map(eq => Math.round(avg(records.filter((r: any) => r.equipe === eq).map((r: any) => r.ociosidade_min || 0)) * 10) / 10)
        },
        desvios: {
          labels: equipes.slice(0, 15),
          data: equipes.slice(0, 15).map(eq => Math.round(avg(records.filter((r: any) => r.equipe === eq).map((r: any) => r.desvios_min || 0)) * 10) / 10)
        }
      },
      top_desvios: [],
      top_piores,
      top_melhores,
      breakdown_csd,
      insights,
      evolucao: [...new Set(records.map((r: any) => r.data))].sort().map(d => ({
         name: typeof d === 'string' ? d.substring(8, 10) + '/' + d.substring(5, 7) : new Date(d as any).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
         value: Math.round(avg(records.filter((r: any) => r.data === d).map((r: any) => r.produtividade_pct || 0)) * 10) / 10
      }))
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
