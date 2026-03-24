import { NextRequest, NextResponse } from "next/server"
import { getDateRange } from "@/lib/dateRange"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const { startDate, endDate } = getDateRange(periodo)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("frota_custos")
      .select("data_solicitacao, custo_val")
      .gte("data_solicitacao", startDate)
      .lte("data_solicitacao", endDate)

    if (error) throw new Error(error.message)
    const records = data || []
    
    // Group by month
    const monthMap: Record<string, { total: number; count: number }> = {}
    records.forEach((r: any) => {
      const d = r.data_solicitacao ? r.data_solicitacao.substring(0, 7) : "N/D"
      if (!monthMap[d]) monthMap[d] = { total: 0, count: 0 }
      monthMap[d].total += (r.custo_val || 0)
      monthMap[d].count++
    })

    const result = Object.entries(monthMap).map(([mes, v]) => ({
      mes,
      valor: Math.round((v.total / (v.count || 1)) * 100) / 100
    })).sort((a, b) => a.mes.localeCompare(b.mes))

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
