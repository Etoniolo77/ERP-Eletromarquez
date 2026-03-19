import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"

    const supabase = createServiceClient()

    // Get all available months
    const { data: allRows } = await supabase
      .from("indisponibilidade")
      .select("mes_ref, regional, tipo_desvio, checado, valor, tempo")
      .order("mes_ref", { ascending: false })

    const all = allRows || []

    const available_months: string[] = [...new Set(all.map((r: any) => r.mes_ref).filter(Boolean))] as string[]

    // Filter by period
    let rows = all
    if (periodo !== "month" && available_months.includes(periodo)) {
      rows = all.filter((r: any) => r.mes_ref === periodo)
    } else if (available_months.length > 0) {
      // Use latest month
      rows = all.filter((r: any) => r.mes_ref === available_months[0])
    }

    if (rows.length === 0) {
      return NextResponse.json({
        period: periodo,
        source_file: "supabase",
        last_update: new Date().toISOString(),
        stats: { total_valor: 0, pendente_valor: 0, total_itens: 0, pendente_itens: 0, aderencia: 100 },
        pareto: [],
        regionais_list: [],
        tipos_list: [],
        matrix: [],
        available_months,
        regionais: [],
        insights: [{ type: "info", text: "Sem dados de indisponibilidade para o período." }]
      })
    }

    const total_valor = rows.reduce((a: number, r: any) => a + (r.valor || 0), 0)
    const pendente_rows = rows.filter((r: any) => !r.checado)
    const pendente_valor = pendente_rows.reduce((a: number, r: any) => a + (r.valor || 0), 0)
    const total_itens = rows.length
    const pendente_itens = pendente_rows.length
    const aderencia = total_itens > 0 ? Math.round(((total_itens - pendente_itens) / total_itens) * 1000) / 10 : 100

    // Pareto by tipo_desvio
    const paretoMap: Record<string, number> = {}
    rows.forEach((r: any) => {
      const key = r.tipo_desvio || "N/D"
      paretoMap[key] = (paretoMap[key] || 0) + (r.valor || 0)
    })
    const pareto = Object.entries(paretoMap)
      .sort((a, b) => b[1] - a[1])
      .map(([Tipo, Valor]) => ({ Tipo, Valor: Math.round(Valor * 100) / 100 }))

    // Regionais
    const regionais_list: string[] = [...new Set(rows.map((r: any) => r.regional).filter(Boolean))] as string[]
    const tipos_list: string[] = [...new Set(rows.map((r: any) => r.tipo_desvio).filter(Boolean))] as string[]

    const regionais = regionais_list.map(reg => {
      const regRows = rows.filter((r: any) => r.regional === reg)
      const regPend = regRows.filter((r: any) => !r.checado)
      const TotalValor = regRows.reduce((a: number, r: any) => a + (r.valor || 0), 0)
      const PendenteValor = regPend.reduce((a: number, r: any) => a + (r.valor || 0), 0)
      const TratadoValor = TotalValor - PendenteValor
      const TratadoPct = TotalValor > 0 ? Math.round((TratadoValor / TotalValor) * 1000) / 10 : 100
      return { Regional: reg, TotalValor, PendenteValor, TratadoValor, TratadoPct }
    })

    // Matrix: tipo x regional
    const matrix = tipos_list.map(tipo => {
      const tipoRows = rows.filter((r: any) => r.tipo_desvio === tipo)
      const entry: Record<string, any> = { Tipo: tipo }
      let _total_impacto = 0
      regionais_list.forEach(reg => {
        const cell = tipoRows.filter((r: any) => r.regional === reg)
        const tratado = cell.filter((r: any) => r.checado).reduce((a: number, r: any) => a + (r.valor || 0), 0)
        const pendente = cell.filter((r: any) => !r.checado).reduce((a: number, r: any) => a + (r.valor || 0), 0)
        entry[reg] = { tratado, pendente }
        _total_impacto += tratado + pendente
      })
      entry._total_impacto = _total_impacto
      return entry
    })

    // Insights
    const insights = []
    if (aderencia >= 90) {
      insights.push({ type: "success", text: `Aderência de ${aderencia}% no tratamento de indisponibilidades.` })
    } else {
      insights.push({ type: "warning", text: `Aderência de ${aderencia}% abaixo da meta de 95%. ${pendente_itens} itens pendentes.` })
    }
    if (pareto.length > 0) {
      insights.push({ type: "info", text: `Principal desvio: "${pareto[0].Tipo}" representa maior impacto financeiro.` })
    }

    return NextResponse.json({
      period: periodo,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: { total_valor, pendente_valor, total_itens, pendente_itens, aderencia },
      pareto,
      regionais_list,
      tipos_list,
      matrix,
      available_months,
      regionais,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
