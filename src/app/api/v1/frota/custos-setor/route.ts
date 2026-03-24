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
      .select("setor, custo_val")
      .gte("data_solicitacao", startDate)
      .lte("data_solicitacao", endDate)

    if (error) throw new Error(error.message)
    const records = data || []
    
    // Group by setor
    const setorMap: Record<string, number> = {}
    records.forEach((r: any) => {
      const key = r.setor || "N/D"
      setorMap[key] = (setorMap[key] || 0) + (r.custo_val || 0)
    })

    const result = Object.entries(setorMap).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    })).sort((a, b) => b.value - a.value)

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
