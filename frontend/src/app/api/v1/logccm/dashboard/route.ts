import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()

    const [
      { data: mb52Rows },
      { data: itemRows },
      { data: rupturaRows },
      { data: serialRows },
    ] = await Promise.all([
      supabase.from("logccm_mb52").select("*"),
      supabase.from("logccm_item").select("*"),
      supabase.from("logccm_ruptura").select("*"),
      supabase.from("logccm_serial").select("*"),
    ])

    const mb52 = mb52Rows || []
    const items = itemRows || []
    const rupturas = rupturaRows || []
    const seriais = serialRows || []

    const round2 = (n: number) => Math.round(n * 100) / 100

    const saldo_virtual = round2(mb52.reduce((a: number, r: any) => a + (r.valor_virtual || 0), 0))
    const saldo_fisico = round2(mb52.reduce((a: number, r: any) => a + (r.valor_fisico || 0), 0))

    const faltas = items.filter((r: any) => (r.saldo || 0) < 0).map((r: any) => ({
      regional: r.regional,
      material: r.material,
      descricao: r.descricao,
      grupo: r.grupo,
      grupo_nome: r.grupo_nome,
      deposito: r.deposito,
      saldo: r.saldo || 0,
      valor: r.valor || 0,
    }))

    const sobras = items.filter((r: any) => (r.saldo || 0) > 0).map((r: any) => ({
      regional: r.regional,
      material: r.material,
      descricao: r.descricao,
      grupo: r.grupo,
      grupo_nome: r.grupo_nome,
      deposito: r.deposito,
      saldo: r.saldo || 0,
      valor: r.valor || 0,
    }))

    const valor_faltas = round2(Math.abs(faltas.reduce((a: number, r: any) => a + (r.valor || 0), 0)))
    const valor_sobras = round2(sobras.reduce((a: number, r: any) => a + (r.valor || 0), 0))
    const compensacao = round2(Math.min(valor_faltas, valor_sobras))

    // Resumo grupos from mb52
    const gruposMap: Record<string, { virtual: number; fisico: number; fisico_sem: number; regional: string }> = {}
    mb52.forEach((r: any) => {
      const key = r.grupo_nome || r.grupo || "N/D"
      if (!gruposMap[key]) gruposMap[key] = { virtual: 0, fisico: 0, fisico_sem: 0, regional: r.regional || "" }
      gruposMap[key].virtual += (r.valor_virtual || 0)
      gruposMap[key].fisico += (r.valor_fisico || 0)
      gruposMap[key].fisico_sem += (r.valor_fisico_sem_pedalada || 0)
    })
    const resumo_grupos = Object.entries(gruposMap).map(([nome, v]) => ({
      grupo_nome: nome,
      regional: v.regional,
      valor_virtual: round2(v.virtual),
      valor_fisico: round2(v.fisico),
      diferenca: round2(v.fisico - v.virtual),
    }))

    const resumo_grupos_sem_pedalada = Object.entries(gruposMap).map(([nome, v]) => ({
      grupo_nome: nome,
      regional: v.regional,
      valor_virtual: round2(v.virtual),
      valor_fisico_sem_pedalada: round2(v.fisico_sem),
      diferenca: round2(v.fisico_sem - v.virtual),
    }))

    // Insights
    const insights = []
    const netDiff = round2(saldo_fisico - saldo_virtual)
    if (Math.abs(netDiff) < 1000) {
      insights.push({ type: "success", text: "Saldo físico e virtual dentro da margem de tolerância." })
    } else if (netDiff < 0) {
      insights.push({ type: "danger", text: `Déficit de R$ ${Math.abs(netDiff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entre saldo virtual e físico.` })
    } else {
      insights.push({ type: "warning", text: `Superávit de R$ ${netDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — verificar inconsistências de inventário.` })
    }
    if (rupturas.length > 0) {
      insights.push({ type: "danger", text: `${rupturas.length} itens em situação de ruptura de estoque.` })
    }

    return NextResponse.json({
      source_file: "supabase",
      last_update: new Date().toISOString(),
      kpis_globais: { saldo_virtual, saldo_fisico, valor_faltas, valor_sobras, compensacao },
      resumo_grupos,
      resumo_grupos_sem_pedalada,
      faltas,
      sobras,
      ruptura: rupturas,
      serializados: seriais,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
