import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const data = await safeFetch<any[]>("/proxy/frota_custos", [])
    
    // Group by month
    const monthMap: Record<string, { total: number; count: number }> = {}
    data.forEach((r: any) => {
      const d = r.data_solicitacao ? r.data_solicitacao.substring(0, 7) : "N/D"
      if (!monthMap[d]) monthMap[d] = { total: 0, count: 0 }
      monthMap[d].total += (r.custo_val || 0)
      monthMap[d].count++
    })

    const result = Object.entries(monthMap).map(([mes, v]) => ({
      mes,
      valor: Math.round((v.total / v.count) * 100) / 100
    })).sort((a, b) => a.mes.localeCompare(b.mes))

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
