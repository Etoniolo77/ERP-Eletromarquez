import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const view = searchParams.get("view") || "dia"

    const { startDate, endDate } = getDateRange(periodo)
    
    const data = await safeFetch<any[]>(`/proxy/saida_base_records?data.gte=${startDate}&data.lte=${endDate}`, [])
    const meta = 30 // meta em minutos

    const round1 = (n: number) => Math.round(n * 10) / 10
    const round2 = (n: number) => Math.round(n * 100) / 100

    if (data.length === 0) {
      return NextResponse.json({
        last_update: new Date().toISOString(),
        meta,
        period_label: `${startDate} a ${endDate}`,
        stats: { media_dia: 0, media_mes: 0, equipes_dentro_meta: 0, total_equipes: 0, pct_conformidade: 100, ritmo_comparativo: 0 },
        insights: [{ type: "info", text: "Sem dados de saída de base para o período selecionado." }],
        custo_projetado: 0,
        maiores_ofensores_equipes: [],
        maiores_ofensores_setor: [],
        maiores_motivos: [],
        evolucao_semanal: { melhoraram: [], pioraram: [] },
        history: { labels: [], datasets: {} },
        bases_breakdown: []
      })
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const tempos = data.map((r: any) => r.tempo_embarque || 0)
    const media_dia = round1(avg(tempos))

    const equipes = [...new Set(data.map((r: any) => r.equipe).filter(Boolean))] as string[]
    const total_equipes = equipes.length

    const equipeAvgs = equipes.map(eq => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      return avg(eqRows.map((r: any) => r.tempo_embarque || 0))
    })

    const equipes_dentro_meta = equipeAvgs.filter(v => v <= meta).length
    const pct_conformidade = total_equipes > 0 ? round1((equipes_dentro_meta / total_equipes) * 100) : 100

    const custo_projetado = round2(data.reduce((a: number, r: any) => a + (r.custo_total || 0), 0))

    // Maiores ofensores equipes
    const equipeStats = equipes.map((eq, i) => {
      const eqRows = data.filter((r: any) => r.equipe === eq)
      const setor = eqRows[0]?.regional || ""
      const minutos = round1(avg(eqRows.map((r: any) => r.tempo_embarque || 0)))
      const valor_rs = round2(eqRows.reduce((a: number, r: any) => a + (r.custo_total || 0), 0))
      return { equipe: eq, setor, minutos, valor_rs }
    }).sort((a, b) => b.minutos - a.minutos)

    const maiores_ofensores_equipes = equipeStats.slice(0, 10)

    // Maiores ofensores setor
    const setorMap: Record<string, { minutos: number[]; valor: number }> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      if (!setorMap[key]) setorMap[key] = { minutos: [], valor: 0 }
      setorMap[key].minutos.push(r.tempo_embarque || 0)
      setorMap[key].valor += (r.custo_total || 0)
    })
    const maiores_ofensores_setor = Object.entries(setorMap)
      .map(([label, v]) => ({ label, minutos: round1(avg(v.minutos)), valor_rs: round2(v.valor) }))
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 6)

    // Maiores motivos
    const motivoMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.motivo || "N/D"
      motivoMap[key] = (motivoMap[key] || 0) + 1
    })
    const total_motivos = data.length
    const maiores_motivos = Object.entries(motivoMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({
        label,
        count,
        percent: round1((count / total_motivos) * 100),
        valor_rs: 0
      }))

    // History grouped by period
    const histMap: Record<string, Record<string, number[]>> = {}
    const regionais = [...new Set(data.map((r: any) => r.regional).filter(Boolean))] as string[]

    data.forEach((r: any) => {
      let key = ""
      const d = new Date(r.data || "")
      if (view === "ano") {
        key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      } else if (view === "semana") {
        const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)
        key = `Sem ${weekNum}/${d.getMonth() + 1}`
      } else {
        key = d.toISOString().split("T")[0]
      }
      const reg = r.regional || "N/D"
      if (!histMap[key]) histMap[key] = {}
      if (!histMap[key][reg]) histMap[key][reg] = []
      histMap[key][reg].push(r.tempo_embarque || 0)
    })

    const histLabels = Object.keys(histMap).sort()
    const datasets: Record<string, number[]> = {}
    regionais.forEach(reg => {
      datasets[reg] = histLabels.map(lbl => round1(avg(histMap[lbl][reg] || [])))
    })

    // Bases breakdown
    const bases_breakdown = regionais.map(reg => {
      const regRows = data.filter((r: any) => r.regional === reg)
      const regEquipes = [...new Set(regRows.map((r: any) => r.equipe).filter(Boolean))] as string[]

      const trendMap: Record<string, number[]> = {}
      regRows.forEach((r: any) => {
        const d = new Date(r.data || "").toISOString().split("T")[0]
        if (!trendMap[d]) trendMap[d] = []
        trendMap[d].push(r.tempo_embarque || 0)
      })
      const trendDates = Object.keys(trendMap).sort().slice(-10)
      const trend_labels = trendDates
      const trend_data = trendDates.map(d => round1(avg(trendMap[d])))
      const last_result = trend_data.length > 0 ? trend_data[trend_data.length - 1] : 0

      const teams = regEquipes.map(eq => {
        const eqR = regRows.filter((r: any) => r.equipe === eq)
        const dia = round1(avg(eqR.map((r: any) => r.tempo_embarque || 0)))
        return { equipe: eq, valores: { dia, semana: dia, mes: dia } }
      })

      return { name: reg, last_result, total_equipes: regEquipes.length, trend_labels, trend_data, teams }
    })

    // Evolucao semanal: compare last 2 weeks
    const now = new Date()
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const thisWeek = data.filter((r: any) => new Date(r.data || "") >= weekAgo)
    const lastWeek = data.filter((r: any) => new Date(r.data || "") >= twoWeeksAgo && new Date(r.data || "") < weekAgo)

    const evolucaoMap: Record<string, { curr: number[]; prev: number[]; setor: string; regional: string }> = {}
    equipes.forEach(eq => {
      const currR = thisWeek.filter((r: any) => r.equipe === eq)
      const prevR = lastWeek.filter((r: any) => r.equipe === eq)
      if (currR.length === 0 && prevR.length === 0) return
      const setor = (currR[0] || prevR[0])?.regional || ""
      evolucaoMap[eq] = {
        curr: currR.map((r: any) => r.tempo_embarque || 0),
        prev: prevR.map((r: any) => r.tempo_embarque || 0),
        setor,
        regional: setor
      }
    })

    const melhoraram: any[] = []
    const pioraram: any[] = []
    Object.entries(evolucaoMap).forEach(([eq, v]) => {
      if (v.curr.length === 0 || v.prev.length === 0) return
      const curr = avg(v.curr)
      const prev = avg(v.prev)
      const variacao_pct = round1(Math.abs(((curr - prev) / prev) * 100))
      const entry = { equipe: eq, setor: v.setor, regional: v.regional, variacao_pct, semana_atual: round1(curr), semana_anterior: round1(prev) }
      if (curr < prev) melhoraram.push(entry)
      else if (curr > prev) pioraram.push(entry)
    })

    return NextResponse.json({
      last_update: new Date().toISOString(),
      meta,
      period_label: `${startDate} a ${endDate}`,
      stats: {
        media_dia,
        media_mes: media_dia,
        equipes_dentro_meta,
        total_equipes,
        pct_conformidade,
        ritmo_comparativo: 0
      },
      insights: [
        {
          type: pct_conformidade >= 80 ? "success" : "warning",
          text: `${pct_conformidade}% das equipes dentro da meta de ${meta}min de embarque.`
        }
      ],
      custo_projetado,
      maiores_ofensores_equipes,
      maiores_ofensores_setor,
      maiores_motivos,
      evolucao_semanal: {
        melhoraram: melhoraram.sort((a, b) => b.variacao_pct - a.variacao_pct).slice(0, 5),
        pioraram: pioraram.sort((a, b) => b.variacao_pct - a.variacao_pct).slice(0, 5)
      },
      history: { labels: histLabels, datasets },
      bases_breakdown
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
