import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const data = await safeFetch<any[]>("/proxy/frota_custos", [])
    
    // Group by setor
    const setorMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.setor || "N/D"
      setorMap[key] = (setorMap[key] || 0) + (r.custo_val || 0)
    })

    const result = Object.entries(setorMap).map(([label, value]) => ({
      label,
      valor: Math.round(value * 100) / 100
    })).sort((a, b) => b.valor - a.valor)

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
