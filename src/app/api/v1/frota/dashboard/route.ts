import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodo = searchParams.get("periodo") || "all"
    const sector = searchParams.get("sector") || ""
    const regional = searchParams.get("regional") || ""

    const supabase = createServiceClient()

    let query = supabase.from("frota_custos").select("*")

    if (periodo && periodo !== "all") {
      // periodo can be "MM/YYYY"
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

    const round1 = (n: number) => Math.round(n * 10) / 10
    const round2 = (n: number) => Math.round(n * 100) / 100

    const total_custo = round2(data.reduce((a: number, r: any) => a + (r.custo_val || 0), 0))
    const qtd_servicos = data.length
    const placas = [...new Set(data.map((r: any) => r.placa).filter(Boolean))] as string[]
    const total_frota = placas.length
    const ticket_medio = total_frota > 0 ? round2(total_custo / total_frota) : 0

    // History by MesAno
    const histMap: Record<string, number> = {}
    data.forEach((r: any) => {
      if (!r.data_solicitacao) return
      const d = new Date(r.data_solicitacao)
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      histMap[key] = (histMap[key] || 0) + (r.custo_val || 0)
    })
    const history = Object.entries(histMap)
      .sort((a, b) => {
        const [am, ay] = a[0].split('/').map(Number)
        const [bm, by] = b[0].split('/').map(Number)
        return ay !== by ? ay - by : am - bm
      })
      .map(([MesAno, Val]) => ({ MesAno, Val: round2(Val) }))

    // Regionais
    const regMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.regional || "N/D"
      regMap[key] = (regMap[key] || 0) + (r.custo_val || 0)
    })
    const regionais = Object.entries(regMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: round2(value) }))

    // Fornecedores
    const fornMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.fornecedor || "N/D"
      fornMap[key] = (fornMap[key] || 0) + (r.custo_val || 0)
    })
    const fornecedores = Object.entries(fornMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: round2(value) }))

    // Manutencoes
    const mantMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.tipo_manutencao || "N/D"
      mantMap[key] = (mantMap[key] || 0) + (r.custo_val || 0)
    })
    const manutencoes = Object.entries(mantMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: round2(value) }))

    // Idades: group by (current_year - ano_veiculo)
    const currentYear = new Date().getFullYear()
    const idadesMap: Record<string, { total: number; count: number }> = {}
    data.forEach((r: any) => {
      if (!r.ano_veiculo) return
      const age = currentYear - r.ano_veiculo
      const bucket = age <= 2 ? "0-2 anos" : age <= 5 ? "3-5 anos" : age <= 10 ? "6-10 anos" : "10+ anos"
      if (!idadesMap[bucket]) idadesMap[bucket] = { total: 0, count: 0 }
      idadesMap[bucket].total += (r.custo_val || 0)
      idadesMap[bucket].count += 1
    })
    const bucketOrder = ["0-2 anos", "3-5 anos", "6-10 anos", "10+ anos"]
    const idades = bucketOrder
      .filter(b => idadesMap[b])
      .map(b => ({
        name: b,
        value: round2(idadesMap[b].total),
        media: round2(idadesMap[b].count > 0 ? idadesMap[b].total / idadesMap[b].count : 0)
      }))

    // Top offenders by placa
    const placaMap: Record<string, { modelo: string; custo: number }> = {}
    data.forEach((r: any) => {
      if (!r.placa) return
      if (!placaMap[r.placa]) placaMap[r.placa] = { modelo: r.modelo || "", custo: 0 }
      placaMap[r.placa].custo += (r.custo_val || 0)
    })
    const topOffendersArr = Object.entries(placaMap)
      .sort((a, b) => b[1].custo - a[1].custo)
      .slice(0, 15)
    const top_offenders = topOffendersArr.map(([id, v]) => ({
      id,
      modelo: v.modelo,
      custo: round2(v.custo),
      percent: round1(total_custo > 0 ? (v.custo / total_custo) * 100 : 0)
    }))

    // Pareto
    const veiculos_ofensores = top_offenders.filter(v => v.custo > ticket_medio).length
    const custo_ofensores = top_offenders.filter(v => v.custo > ticket_medio).reduce((a, v) => a + v.custo, 0)
    const pareto = {
      total_veiculos: total_frota,
      veiculos_ofensores,
      percentual_ofensores: round1(total_frota > 0 ? (veiculos_ofensores / total_frota) * 100 : 0),
      custo_ofensores: round2(custo_ofensores)
    }

    // Custo medio tipo
    const tipoMap: Record<string, { total: number; veiculos: Set<string> }> = {}
    data.forEach((r: any) => {
      const key = r.tipo || "N/D"
      if (!tipoMap[key]) tipoMap[key] = { total: 0, veiculos: new Set() }
      tipoMap[key].total += (r.custo_val || 0)
      if (r.placa) tipoMap[key].veiculos.add(r.placa)
    })
    const custo_medio_tipo = Object.entries(tipoMap).map(([name, v]) => ({
      name,
      veiculos: v.veiculos.size,
      custo: round2(v.veiculos.size > 0 ? v.total / v.veiculos.size : 0)
    }))

    // Custo medio setor
    const setorMap: Record<string, { total: number; veiculos: Set<string> }> = {}
    data.forEach((r: any) => {
      const key = r.setor || "N/D"
      if (!setorMap[key]) setorMap[key] = { total: 0, veiculos: new Set() }
      setorMap[key].total += (r.custo_val || 0)
      if (r.placa) setorMap[key].veiculos.add(r.placa)
    })
    const custo_medio_setor = Object.entries(setorMap).map(([name, v]) => ({
      name,
      veiculos: v.veiculos.size,
      custo: round2(v.veiculos.size > 0 ? v.total / v.veiculos.size : 0)
    }))

    // Top servicos
    const servMap: Record<string, number> = {}
    data.forEach((r: any) => {
      const key = r.nome_servico || "N/D"
      servMap[key] = (servMap[key] || 0) + (r.custo_val || 0)
    })
    const top_servicos = Object.entries(servMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: round2(value) }))

    // Matrix regional x setor
    const matrixMap: Record<string, Record<string, { total: number; veiculos: Set<string> }>> = {}
    data.forEach((r: any) => {
      const reg = r.regional || "N/D"
      const set = r.setor || "N/D"
      if (!matrixMap[reg]) matrixMap[reg] = {}
      if (!matrixMap[reg][set]) matrixMap[reg][set] = { total: 0, veiculos: new Set() }
      matrixMap[reg][set].total += (r.custo_val || 0)
      if (r.placa) matrixMap[reg][set].veiculos.add(r.placa)
    })
    const matrix: any[] = []
    Object.entries(matrixMap).forEach(([reg, setores]) => {
      Object.entries(setores).forEach(([set, v]) => {
        matrix.push({
          regional: reg,
          setor: set,
          total: round2(v.total),
          veiculos: v.veiculos.size,
          medio: round2(v.veiculos.size > 0 ? v.total / v.veiculos.size : 0)
        })
      })
    })

    // Insights
    const insights = []
    if (ticket_medio > 0) {
      insights.push({ type: "info", text: `Ticket médio por veículo: R$ ${ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` })
    }
    if (veiculos_ofensores > 0) {
      insights.push({ type: "warning", text: `${veiculos_ofensores} veículos acima do ticket médio, representando custo elevado.` })
    }
    const prevData = manutencoes.find(m => m.name.toUpperCase().includes("CORRETIVA"))
    const prevPct = prevData && total_custo > 0 ? round1((prevData.value / total_custo) * 100) : 0
    if (prevPct > 50) {
      insights.push({ type: "danger", text: `Manutenção corretiva representa ${prevPct}% do custo total — revisar plano preventivo.` })
    } else if (prevPct > 0) {
      insights.push({ type: "success", text: `Manutenção corretiva controlada em ${prevPct}% do total.` })
    }

    return NextResponse.json({
      period_label: periodo === "all" ? "Todo Histórico" : periodo,
      source_file: "supabase",
      last_update: new Date().toISOString(),
      stats: {
        total_custo, trend_custo: 0,
        ticket_medio, trend_ticket: 0,
        qtd_servicos, trend_servicos: 0,
        total_frota, trend_frota: 0
      },
      pareto,
      history,
      regionais,
      fornecedores,
      manutencoes,
      idades,
      top_offenders,
      custo_medio_tipo,
      custo_medio_setor,
      top_servicos,
      matrix,
      insights
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
