import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const data = await safeFetch<any[]>("/proxy/frota_custos", [])
    
    // Group by regional
    const regionalMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      regionalMap[key] = (regionalMap[key] || 0) + (r.custo_val || 0)
    })

    const result = Object.entries(regionalMap).map(([label, value]) => ({
      label,
      valor: Math.round(value * 100) / 100
    })).sort((a, b) => b.valor - a.valor)

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
