import { getDateRange } from "@/lib/dateRange"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const { startDate, endDate } = getDateRange(periodo)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1"

    // Buscamos dados do setor TURMAS na tabela de APR/SEG como proxy de conformidade
    const res = await fetch(`${API_URL}/proxy/apr_records?sector=TURMAS&data.gte=${startDate}&data.lte=${endDate}`, { cache: "no-store" })
    const data = res.ok ? await res.json() : []

    const media_prod = data.length > 0 
        ? Math.round(data.reduce((acc: number, r: any) => acc + (r.efetividade || 0), 0) / data.length)
        : 0

    return NextResponse.json({
      stats: {
        media_prod,
        trend: 0
      },
      insights: media_prod < 85 && data.length > 0 ? [{ type: "warning", text: `Conformidade RDO Turmas está em ${media_prod}%, abaixo da meta de 85%.` }] : []
    })
  } catch (error) {
    console.error("Turmas RDO API Error:", error)
    return NextResponse.json({ stats: { media_prod: 0, trend: 0 }, insights: [] })
  }
}
