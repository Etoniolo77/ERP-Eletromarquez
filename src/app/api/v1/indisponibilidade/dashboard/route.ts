import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "month"
    const supabase = await createClient()

    // 1. Get available months
    const { data: monthsData } = await supabase
      .from("indisponibilidade")
      .select("mes_ref")
      .order("mes_ref", { ascending: false })
    
    const available_months = [...new Set(monthsData?.map(m => String(m.mes_ref)) || [])]
    const max_mes = available_months[0] || null

    // 2. Build Query
    let query = supabase.from("indisponibilidade").select("*")

    if (periodo === "month" && max_mes) {
      query = query.eq("mes_ref", max_mes)
    } else if (periodo !== "all" && available_months.includes(periodo)) {
      query = query.eq("mes_ref", periodo)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
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
        insights: [{ type: "info", text: "Sem dados de indisponibilidade disponíveis para este período." }]
      })
    }

    // 3. Totais e KPIs
    const total_valor = data.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
    const total_itens = data.length
    
    const pendentes = data.filter(r => !r.checado)
    const pendente_valor = pendentes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
    const pendente_itens = pendentes.length
    
    const tratado_itens = total_itens - pendente_itens
    const aderencia = total_itens > 0 ? (tratado_itens / total_itens) * 100 : 100

    // 4. Pareto por Tipo
    const tipoMap: Record<string, number> = {}
    data.forEach(r => {
      const key = String(r.tipo_desvio || "N/D").trim()
      tipoMap[key] = (tipoMap[key] || 0) + (Number(r.valor) || 0)
    })
    const pareto = Object.entries(tipoMap)
      .map(([Tipo, Valor]) => ({ Tipo, Valor }))
      .sort((a, b) => b.Valor - a.Valor)

    // 5. Regionais e Matriz
    const regionais_list = [...new Set(data.map(r => String(r.regional || "N/D").trim()))].sort()
    const tipos_list = [...new Set(data.map(r => String(r.tipo_desvio || "N/D").trim()))].sort()

    const matrix_map: Record<string, Record<string, any>> = {}
    data.forEach(r => {
      const tipo = String(r.tipo_desvio || "N/D").trim()
      const regional = String(r.regional || "N/D").trim()
      
      if (!matrix_map[tipo]) matrix_map[tipo] = {}
      if (!matrix_map[tipo][regional]) {
        matrix_map[tipo][regional] = { tratado: 0, pendente: 0, tempo_total: 0 }
      }
      
      const val = Number(r.valor) || 0
      if (r.checado) {
        matrix_map[tipo][regional].tratado += val
      } else {
        matrix_map[tipo][regional].pendente += val
      }
      matrix_map[tipo][regional].tempo_total += (Number(r.tempo) || 0)
    })

    const matrix = tipos_list.map(tipo => {
      const row: any = { Tipo: tipo }
      let _total_impacto = 0
      let _total_tempo = 0
      
      regionais_list.forEach(reg => {
        const cell = matrix_map[tipo]?.[reg] || { tratado: 0, pendente: 0, tempo_total: 0 }
        row[reg] = cell
        _total_impacto += (cell.tratado + cell.pendente)
        _total_tempo += cell.tempo_total
      })
      
      row._total_impacto = _total_impacto
      row._total_tempo = _total_tempo
      return row
    }).sort((a, b) => b._total_impacto - a._total_impacto)

    // 6. Regionais Summary
    const regionais = regionais_list.map(reg => {
      const r_data = data.filter(r => String(r.regional || "N/D").trim() === reg)
      const r_total = r_data.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
      const r_pend = r_data.filter(r => !r.checado).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
      const r_tratado = r_total - r_pend
      
      return {
        Regional: reg,
        TotalValor: r_total,
        PendenteValor: r_pend,
        TratadoValor: r_tratado,
        TratadoPct: r_total > 0 ? (r_tratado / r_total) * 100 : 100
      }
    })

    // 7. Insights
    const insights = []
    const netDiff = total_valor - pendente_valor
    if (aderencia > 95) {
      insights.push({ type: "success", text: `Excelente aderência ao tratamento de indisponibilidade (${aderencia.toFixed(1)}%).` })
    } else if (aderencia < 80) {
      insights.push({ type: "danger", text: `Baixa aderência (${aderencia.toFixed(1)}%). Necessário agilizar tratamento de pendências.` })
    }
    
    if (pendente_valor > 50000) {
      insights.push({ type: "danger", text: `Valor pendente elevado: R$ ${pendente_valor.toLocaleString('pt-BR')}. Risco financeiro alto.` })
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
    console.error("Error in Indisponibilidade API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
