import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const base = searchParams.get("base") || ""

    const { startDate, endDate } = getDateRange(periodo)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1"

    let endpoint = `${API_URL}/proxy/auditorias_5s?data_auditoria.gte=${startDate}&data_auditoria.lte=${endDate}`
    if (base && base !== "Todas") {
      endpoint += `&base=${encodeURIComponent(base)}`
    }

    const res = await fetch(endpoint, { cache: "no-store" })
    const data = res.ok ? await res.json() : []

    const all_bases: string[] = [...new Set((data || []).map((r: any) => r.base).filter(Boolean))] as string[]

    const empty = {
      meta_5s: 85,
      periodo_ref: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        media_conformidade: 0, trend_conformidade: 0, total_auditorias: 0,
        s1: 0, s1_trend: 0, s2: 0, s2_trend: 0, s3: 0, s3_trend: 0,
        s4: 0, s4_trend: 0, s5: 0, s5_trend: 0, bases_auditadas: 0
      },
      evolucao: { labels: [], data: [] },
      all_bases,
      hierarchy: [],
    }

    if (data.length === 0) return NextResponse.json(empty)

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const round1 = (n: number) => Math.round(n * 10) / 10

    const conformidades = data.map((r: any) => r.conformidade_pct || 0)
    const media_conformidade = round1(avg(conformidades))

    // Trend: compare with previous half of period
    const midpoint = new Date((new Date(startDate).getTime() + new Date(endDate).getTime()) / 2)
    const firstHalf = data.filter((r: any) => new Date(r.data_auditoria) < midpoint)
    const secondHalf = data.filter((r: any) => new Date(r.data_auditoria) >= midpoint)
    const firstAvg = avg(firstHalf.map((r: any) => r.conformidade_pct || 0))
    const secondAvg = avg(secondHalf.map((r: any) => r.conformidade_pct || 0))
    const trend_conformidade = firstAvg > 0 ? round1(((secondAvg - firstAvg) / firstAvg) * 100) : 0

    const s1 = round1(avg(data.map((r: any) => r.nota_1s || 0)))
    const s2 = round1(avg(data.map((r: any) => r.nota_2s || 0)))
    const s3 = round1(avg(data.map((r: any) => r.nota_3s || 0)))
    const s4 = round1(avg(data.map((r: any) => r.nota_4s || 0)))
    const s5 = round1(avg(data.map((r: any) => r.nota_5s || 0)))

    const bases_auditadas = all_bases.length

    // Evolucao: group by date
    const evolucaoMap: Record<string, number[]> = {}
    data.forEach((r: any) => {
      const d = r.data_auditoria || ""
      if (!evolucaoMap[d]) evolucaoMap[d] = []
      evolucaoMap[d].push(r.conformidade_pct || 0)
    })
    const evolucaoDates = Object.keys(evolucaoMap).sort()
    const evolucao = {
      labels: evolucaoDates,
      data: evolucaoDates.map(d => round1(avg(evolucaoMap[d])))
    }

    // Hierarchy: group by base then local_auditado
    const hierarchy = all_bases.map(baseName => {
      const baseRows = data.filter((r: any) => r.base === baseName)
      const locais_list: string[] = [...new Set(baseRows.map((r: any) => r.local_auditado).filter(Boolean))] as string[]
      const sorted = [...baseRows].sort((a, b) => new Date(b.data_auditoria).getTime() - new Date(a.data_auditoria).getTime())
      return {
        name: baseName,
        auditorias: baseRows.length,
        s1: round1(avg(baseRows.map((r: any) => r.nota_1s || 0))),
        s2: round1(avg(baseRows.map((r: any) => r.nota_2s || 0))),
        s3: round1(avg(baseRows.map((r: any) => r.nota_3s || 0))),
        s4: round1(avg(baseRows.map((r: any) => r.nota_4s || 0))),
        s5: round1(avg(baseRows.map((r: any) => r.nota_5s || 0))),
        conformidade: round1(avg(baseRows.map((r: any) => r.conformidade_pct || 0))),
        ultima_data: sorted[0]?.data_auditoria || "",
        ultimo_inspetor: sorted[0]?.inspetor || "",
        locais: locais_list.map(local => {
          const localRows = baseRows.filter((r: any) => r.local_auditado === local)
          const ls = [...localRows].sort((a, b) => new Date(b.data_auditoria).getTime() - new Date(a.data_auditoria).getTime())
          return {
            name: local,
            s1: round1(avg(localRows.map((r: any) => r.nota_1s || 0))),
            s2: round1(avg(localRows.map((r: any) => r.nota_2s || 0))),
            s3: round1(avg(localRows.map((r: any) => r.nota_3s || 0))),
            s4: round1(avg(localRows.map((r: any) => r.nota_4s || 0))),
            s5: round1(avg(localRows.map((r: any) => r.nota_5s || 0))),
            conformidade: round1(avg(localRows.map((r: any) => r.conformidade_pct || 0))),
            ultima_data: ls[0]?.data_auditoria || "",
            ultimo_inspetor: ls[0]?.inspetor || "",
          }
        })
      }
    })

    return NextResponse.json({
      meta_5s: 85,
      periodo_ref: `${startDate} a ${endDate}`,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        media_conformidade,
        trend_conformidade,
        total_auditorias: data.length,
        s1, s1_trend: 0,
        s2, s2_trend: 0,
        s3, s3_trend: 0,
        s4, s4_trend: 0,
        s5, s5_trend: 0,
        bases_auditadas
      },
      evolucao,
      all_bases,
      hierarchy
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
