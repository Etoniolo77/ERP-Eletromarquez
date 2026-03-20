import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "all"
    const sector = searchParams.get("sector") || ""
    const regional = searchParams.get("regional") || ""
    const compare = searchParams.get("compare") || "regional"

    const supabase = createServiceClient()

    let query = supabase.from("frota_custos").select("regional, setor, placa, custo_val, data_solicitacao")

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

    if (sector) query = query.eq("setor", sector)
    if (regional) query = query.eq("regional", regional)

    const { data: rows } = await query
    const data = rows || []

    // Group by MesAno and compare dimension
    const groupKey = compare === "setor" ? "setor" : "regional"
    const dimensions = [...new Set(data.map((r: any) => r[groupKey] || "N/D").filter(Boolean))] as string[]

    const monthMap: Record<string, Record<string, { total: number; veiculos: Set<string> }>> = {}
    data.forEach((r: any) => {
      if (!r.data_solicitacao) return
      const d = new Date(r.data_solicitacao)
      const mesAno = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      const dim = (r[groupKey] || "N/D") as string
      if (!monthMap[mesAno]) monthMap[mesAno] = {}
      if (!monthMap[mesAno][dim]) monthMap[mesAno][dim] = { total: 0, veiculos: new Set() }
      monthMap[mesAno][dim].total += (r.custo_val || 0)
      if (r.placa) monthMap[mesAno][dim].veiculos.add(r.placa)
    })

    const sortedMonths = Object.keys(monthMap).sort((a, b) => {
      const [am, ay] = a.split('/').map(Number)
      const [bm, by] = b.split('/').map(Number)
      return ay !== by ? ay - by : am - bm
    })

    const result = sortedMonths.map(mes => {
      const entry: Record<string, number | string> = { name: mes }
      dimensions.forEach(dim => {
        const cell = monthMap[mes][dim]
        if (cell) {
          entry[dim] = Math.round((cell.veiculos.size > 0 ? cell.total / cell.veiculos.size : 0) * 100) / 100
        }
      })
      return entry
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
