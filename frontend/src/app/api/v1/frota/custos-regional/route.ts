import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "all"

    const supabase = createServiceClient()

    let query = supabase.from("frota_custos").select("regional, custo_val")

    if (periodo && periodo !== "all") {
      const parts = periodo.split("/")
      if (parts.length === 2) {
        const [mm, yyyy] = parts
        const firstDay = `${yyyy}-${mm.padStart(2, '0')}-01`
        const lastDay = new Date(parseInt(yyyy), parseInt(mm), 0)
        const lastDayStr = `${yyyy}-${mm.padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
        query = query.gte("data_solicitacao", firstDay).lte("data_solicitacao", lastDayStr)
      }
    }

    const { data: rows } = await query

    const map: Record<string, number> = {}
    ;(rows || []).forEach((r: any) => {
      const key = r.regional || "N/D"
      map[key] = (map[key] || 0) + (r.custo_val || 0)
    })

    const result = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
