import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    // Try to fetch from Python backend first
    const data = await safeFetch<any>(`/api/v1/indisponibilidade/dashboard?periodo=${periodo}`, null)

    if (data) {
      return NextResponse.json(data)
    }

    // Fallback empty state if backend fails
    return NextResponse.json({
      period: periodo,
      source_file: "N/A",
      last_update: new Date().toISOString(),
      stats: { total_valor: 0, pendente_valor: 0, total_itens: 0, pendente_itens: 0, aderencia: 100 },
      pareto: [],
      regionais_list: [],
      tipos_list: [],
      matrix: [],
      available_months: [],
      regionais: [],
      insights: [{ type: "info", text: "Sem dados de indisponibilidade ou conexão com o motor de gestão falhou." }]
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
