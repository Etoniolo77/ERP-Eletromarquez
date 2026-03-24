"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts"
import { TrendLineChart } from "@/components/dashboard/TrendLineChart"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { PageError } from "@/components/ui/PageError"
import { formatCurrencyCompact, CHART_COLORS } from "@/lib/utils"
import { EmptyState } from "@/components/ui/EmptyState"
import { useFilter } from "@/components/providers/FilterProvider"

interface FrotaDashboard {
    period_label: string
    source_file: string
    last_update: string
    stats: {
        total_custo: number
        trend_custo: number
        ticket_medio: number
        trend_ticket: number
        qtd_servicos: number
        trend_servicos: number
        total_frota: number
        trend_frota: number
    }
    pareto: {
        total_veiculos: number
        veiculos_ofensores: number
        percentual_ofensores: number
        custo_ofensores: number
    }
    history: { MesAno: string; Val: number }[]
    regionais: { name: string; value: number }[]
    fornecedores: { name: string; value: number }[]
    manutencoes: { name: string; value: number }[]
    idades: { name: string; value: number; media: number }[]
    top_offenders: { id: string; modelo: string; custo: number; percent: number }[]
    custo_medio_tipo: { name: string; custo: number; veiculos: number }[]
    custo_medio_setor: { name: string; custo: number; veiculos: number }[]
    top_servicos: { name: string; value: number }[]
    matrix: { regional: string; setor: string; total: number; veiculos: number; medio: number }[]
    has_future_data?: boolean
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

const formatCurrency = formatCurrencyCompact
const COLORS = CHART_COLORS

interface PieLabelProps {
    cx?: number
    cy?: number
    midAngle?: number
    innerRadius?: number
    outerRadius?: number
    percent?: number
}

const renderPercentageLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: PieLabelProps) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
        <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="600">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export default function FrotaPage() {
    const { period: periodo } = useFilter()
    const [data, setData] = useState<FrotaDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    const [custosRegional, setCustosRegional] = useState<{ name: string; value: number }[]>([])
    const [custosSetor, setCustosSetor] = useState<{ name: string; value: number }[]>([])
    const [evolucaoMedio, setEvolucaoMedio] = useState<Record<string, number | string>[]>([])
    const [compareMode, setCompareMode] = useState<string>("regional")

    const [filterSetor, setFilterSetor] = useState("")
    const [filterRegional, setFilterRegional] = useState("")

    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)
    const abortEvolucaoRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            // if (forceSync) await triggerSync("frota")
            const signal = abortRef.current.signal
            const [dashRes, regRes, setRes] = await Promise.all([
                api.get(`/frota/dashboard`, {
                    params: {
                        periodo: periodo,
                        sector: filterSetor,
                        regional: filterRegional
                    },
                    signal
                }),
                api.get(`/frota/custos-regional?periodo=${periodo}`, { signal }),
                api.get(`/frota/custos-setor?periodo=${periodo}`, { signal })
            ])
            setData(dashRes.data)
            setCustosRegional(regRes.data)
            setCustosSetor(setRes.data)
        } catch (err: unknown) {
            const e = err as { name?: string; code?: string; message?: string }
            if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return
            setError(e.message || 'Erro ao carregar dados.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData(true)
        isInitialMount.current = false
    }, [])

    useEffect(() => {
        if (isInitialMount.current) return
        loadData(false)
    }, [periodo, filterRegional, filterSetor])

    useEffect(() => {
        async function loadEvolucao() {
            if (abortEvolucaoRef.current) abortEvolucaoRef.current.abort()
            abortEvolucaoRef.current = new AbortController()
            try {
                const res = await api.get(`/frota/evolucao-medio`, {
                    params: {
                        periodo: periodo,
                        sector: filterSetor,
                        regional: filterRegional,
                        compare: compareMode
                    },
                    signal: abortEvolucaoRef.current.signal
                })
                // Filtra os dados para exibir apenas a partir de 2025
                const filteredEvolution = (res.data || []).filter((item: Record<string, number | string>) => {
                    const dateParts = String(item.name).split('/');
                    if (dateParts.length < 2) return false;
                    const year = parseInt(dateParts[1]);
                    return year >= 2025;
                });
                setEvolucaoMedio(filteredEvolution)
            } catch (err: unknown) {
                const e = err as { name?: string; code?: string }
                if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return
                console.error("Erro ao carregar evolução médio", err)
            }
        }
        if (mounted) loadEvolucao()
    }, [periodo, filterSetor, filterRegional, compareMode, mounted])

    // Filtra histórico para iniciar em 2025 e remove meses futuros se houver
    const filteredHistory = useMemo(() => {
        if (!data?.history) return [];
        return data.history
            .filter(h => {
                const parts = h.MesAno.split('/');
                if (parts.length < 2) return false;
                const year = parseInt(parts[1]);
                return year >= 2025;
            });
    }, [data?.history]);

    if (!mounted || (loading && !data)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />
    if (error) return <PageError error={`Erro no rastreio de ativos: ${error}`} onRetry={() => loadData()} />
    if (!data) return null

    const stats = data.stats;
    const pareto = data.pareto;
    const trendLabel = "";

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon="directions_car"
                title="Inteligência de Frota e Custos"
                insights={data.insights}
                fallbackText={`Análise consolidada de ativos operativos para o período ${data.period_label}.`}
                sourceFile={data.source_file}
                lastUpdate={data.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
                showPeriodSelector={true}
            >
                {/* Outros Filtros na Toolbar */}
                <div className="flex items-center gap-1.5 ml-1">
                    <span className="material-symbols-outlined text-[14px] text-primary">filter_alt</span>
                    <select
                        value={filterRegional}
                        onChange={(e) => setFilterRegional(e.target.value)}
                        className="bg-transparent border-none outline-none text-[9px] font-bold uppercase tracking-tighter text-text-heading cursor-pointer min-w-[100px]"
                    >
                        <option value="">Região (Todas)</option>
                        {custosRegional.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                    </select>
                    <div className="w-px h-3 bg-border mx-0.5" />
                    <select
                        value={filterSetor}
                        onChange={(e) => setFilterSetor(e.target.value)}
                        className="bg-transparent border-none outline-none text-[9px] font-bold uppercase tracking-tighter text-text-heading cursor-pointer min-w-[100px]"
                    >
                        <option value="">Setor (Todos)</option>
                        {custosSetor.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                </div>
            </PageHeader>

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Custo Acumulado"
                    value={formatCurrency(stats?.total_custo ?? 0)}
                    variation={`${stats?.trend_custo ?? 0}%`}
                    icon="payments"
                />
                <KpiCard
                    title="Ticket Médio OS"
                    value={formatCurrency(stats?.ticket_medio ?? 0)}
                    variation={`${stats?.trend_ticket ?? 0}%`}
                    icon="trending_up"
                />
                <KpiCard
                    title="Volume Serviços"
                    value={`${stats?.qtd_servicos ?? 0} OS`}
                    variation={`${stats?.trend_servicos ?? 0}%`}
                    icon="engineering"
                />
                <KpiCard
                    title="Frota Gerenciada"
                    value={stats?.total_frota ?? 0}
                    variation={`${stats?.trend_frota ?? 0}%`}
                    icon="directions_car"
                />
            </div>

            {/* Main Trend Chart */}
            <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[480px] shadow-sm">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-10">
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Histórico de Custo Médio por Regional</h3>
                        <p className="text-[9px] text-text-muted uppercase font-medium mt-1 tracking-wider">Benchmark temporal comparativo de gastos operativos</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10 shadow-sm ml-2">
                            <button
                                onClick={() => setCompareMode("regional")}
                                className={`text-[10px] uppercase font-semibold px-4 py-1 rounded-sm transition-all ${compareMode === 'regional' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                Regionais
                            </button>
                            <button
                                onClick={() => setCompareMode("setor")}
                                className={`text-[10px] uppercase font-semibold px-4 py-1 rounded-sm transition-all ${compareMode === 'setor' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                Setores
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full relative">
                    <TrendLineChart
                        data={evolucaoMedio}
                        tooltipLabel="Custo Médio"
                        lines={
                            evolucaoMedio.length > 0
                                ? Array.from(new Set(evolucaoMedio.flatMap(d => Object.keys(d))))
                                    .filter(k => k !== 'name' && k.toLowerCase() !== 'nan' && k.toLowerCase() !== 'n/d')
                                    .map((key, i) => ({
                                        key,
                                        color: COLORS[i % COLORS.length],
                                        label: key.toUpperCase()
                                    }))
                                : []
                        }
                    />
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/50">
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Matriz de Alocação de Custos</h3>
                        <p className="text-[10px] text-text-muted uppercase font-medium mt-1 tracking-widest truncate">Visão detalhada de desembolso por centro de custo e região</p>
                    </div>
                    <span className="px-2 py-1 bg-primary text-white text-[9px] font-semibold uppercase rounded-sm shadow-md">Benchmark: {formatCurrency(stats?.ticket_medio ?? 0)} / Veículo</span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-surface/20 border-b border-border">
                                <th className="p-4 text-[10px] font-semibold text-text-muted uppercase sticky left-0 z-20 bg-surface border-r border-border min-w-[200px]">Unidade \ Setor</th>
                                {(() => {
                                    const sectors = [...new Set((data?.matrix ?? []).map(m => m.setor))].sort();
                                    return (
                                        <>
                                            {sectors.map(s => (
                                                <th key={s} className="p-4 text-center text-[10px] font-semibold text-text-muted uppercase border-r border-border/10">{s}</th>
                                            ))}
                                            <th className="p-4 text-right text-[10px] font-semibold text-primary uppercase bg-primary/5">Total Geral</th>
                                        </>
                                    );
                                })()}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[12px]">
                            {(data?.matrix ?? []).length > 0 ? (() => {
                                const sectors = [...new Set((data?.matrix ?? []).map(m => m?.setor ?? "N/D"))].sort();
                                const regionals = [...new Set((data?.matrix ?? []).map(m => m?.regional ?? "N/D"))].sort();

                                return regionals.map(reg => {
                                    const rowItems = (data?.matrix ?? []).filter(m => m?.regional === reg);
                                    const rowTotal = rowItems.reduce((acc, curr) => acc + (curr?.total ?? 0), 0);
                                    const rowVeic = rowItems.reduce((acc, curr) => acc + (curr?.veiculos ?? 0), 0);
                                    const rowMedio = rowVeic > 0 ? rowTotal / rowVeic : 0;

                                    return (
                                        <tr key={reg} className="hover:bg-surface/50 transition-colors group">
                                            <td className="p-4 font-semibold text-text-heading sticky left-0 z-10 bg-inherit border-r border-border uppercase tabular-nums">
                                                {reg}
                                            </td>
                                            {sectors.map(set => {
                                                const cell = (data?.matrix ?? []).find(m => m?.regional === reg && m?.setor === set);
                                                const total = cell?.total || 0;
                                                const medio = cell?.medio || 0;
                                                const isHigh = medio > (stats?.ticket_medio ?? 0) * 1.5;
                                                return (
                                                    <td key={set} className="p-4 text-center border-r border-border/5">
                                                        {total > 0 ? (
                                                            <div>
                                                                <p className={`text-xs font-semibold ${isHigh ? 'text-rose-500' : 'text-text-heading'}`}>{formatCurrency(total)}</p>
                                                                <p className="text-[10px] text-text-muted font-medium uppercase mt-0.5">{(cell?.veiculos ?? 0)} Ativos • {formatCurrency(medio)}</p>
                                                            </div>
                                                        ) : <span className="text-border">—</span>}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-4 text-right bg-primary/5 border-l border-border">
                                                <p className="text-xs font-semibold text-primary">{formatCurrency(rowTotal)}</p>
                                                <p className="text-[10px] text-text-muted font-medium uppercase mt-0.5">{rowVeic} Ativos • {formatCurrency(rowMedio)}</p>
                                            </td>
                                        </tr>
                                    );
                                });
                            })() : (
                                <tr>
                                    <td colSpan={99} className="p-0">
                                        <EmptyState icon="payments" title="Sem dados de custo" description="Nenhum dado de alocação disponível para este período." />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Age Profile */}
                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary text-[18px]">speed</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Gasto Médio vs Idade Veicular</h3>
                    </div>
                    <div className="flex-1 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.idades}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.05)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 500 }} />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                                    contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}
                                />
                                <Bar dataKey="media" radius={[2, 2, 0, 0]} barSize={40}>
                                    {data.idades.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : (index >= 3 ? '#f43f5e' : '#1152d4')} fillOpacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Maintenance Profile */}
                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary text-[18px]">donut_large</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Tipo Manutenção</h3>
                    </div>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.manutencoes ?? []}
                                    cx="50%" cy="45%" innerRadius={70} outerRadius={100}
                                    paddingAngle={4} dataKey="value" stroke="none"
                                    labelLine={false}
                                    label={renderPercentageLabel}
                                >
                                    {(data?.manutencoes ?? []).map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={(entry?.name ?? "").toUpperCase().includes('PREVENTIVA') ? '#10b981' : ((entry?.name ?? "").toUpperCase().includes('CORRETIVA') ? '#f43f5e' : COLORS[index % COLORS.length])}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                                    contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="rect" wrapperStyle={{ fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Pareto Vendors */}
                <div className="lg:col-span-7 bg-surface border border-border p-4 rounded-sm flex flex-col h-[420px] shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-rose-500 text-[18px]">handshake</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Principais Parceiros Ofensores</h3>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(data?.fornecedores ?? []).slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(148, 163, 184, 0.05)" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={200} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 500 }} />
                                <Tooltip
                                    formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                                    contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}
                                />
                                <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={16}>
                                    {(data?.fornecedores ?? []).slice(0, 8).map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#f43f5e' : '#1152d4'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Services */}
                <div className="lg:col-span-5 bg-surface border border-border rounded-sm flex flex-col h-[420px] overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-rose-500/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">build</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Matriz de Itens Ofensores</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50">
                                <tr className="border-b border-border">
                                    <th className="p-3 text-[10px] font-semibold text-text-muted uppercase min-w-[250px] tracking-wider">Serviço/Peça</th>
                                    <th className="p-3 text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider">Dispêndio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {data?.top_servicos && (data?.top_servicos ?? []).length > 0 ? (
                                    (data?.top_servicos ?? []).slice(0, 10).map((s, i) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-3 text-text-heading uppercase truncate min-w-[250px] font-semibold">{s?.name ?? "N/D"}</td>
                                            <td className="p-3 text-right text-rose-500 font-semibold tabular-nums">{formatCurrency(s?.value ?? 0)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="p-0">
                                            <EmptyState icon="warning" title="Nenhum ofensor identificado" description="Nenhum serviço registrado para este período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
                {/* Plate Offenders */}
                <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">warning</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top 15 Placas Ofensoras</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[400px] custom-scrollbar">
                        <table className="w-full text-left text-[12px] font-medium">
                            <thead className="sticky top-0 z-10 bg-surface border-b border-border shadow-sm">
                                <tr className="uppercase tracking-wider text-text-muted text-[10px] font-semibold">
                                    <th className="p-3">Placa</th>
                                    <th className="p-3">Modelo</th>
                                    <th className="p-3 text-right pr-4">Total Reg.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(data?.top_offenders ?? []).length > 0 ? (
                                    (data?.top_offenders ?? []).slice(0, 15).map((v, i) => (
                                        <tr key={v.id} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-3 text-rose-500 font-semibold tabular-nums">{v.id}</td>
                                            <td className="p-3 text-text-muted uppercase tracking-tight">{v.modelo}</td>
                                            <td className="p-3 text-right pr-4 text-rose-500 font-semibold tabular-nums">{formatCurrency(v.custo)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-0">
                                            <EmptyState icon="directions_car" title="Sem veículos registrados" description="Nenhum veículo ofensor identificado para este período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Category performance */}
                <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-emerald-500/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-[18px]">category</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Performance por Categoria</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[400px] custom-scrollbar">
                        <table className="w-full text-left text-[12px] font-medium">
                            <thead className="sticky top-0 z-10 bg-surface border-b border-border shadow-sm">
                                <tr className="uppercase tracking-wider text-text-muted text-[10px] font-semibold">
                                    <th className="p-3">Categoria do Ativo</th>
                                    <th className="p-3 text-right">Total Bruto</th>
                                    <th className="p-3 text-right pr-4">Ticket Médio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(data?.custo_medio_tipo ?? []).length > 0 ? (
                                    (data?.custo_medio_tipo ?? []).map((v, i) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-4 text-text-heading uppercase tracking-tight">{v.name}</td>
                                            <td className="p-4 text-right text-text-muted tabular-nums">{formatCurrency((v?.custo ?? 0) * (v?.veiculos || 1))}</td>
                                            <td className="p-4 text-right pr-4 text-emerald-500 font-semibold tabular-nums">{formatCurrency(v?.custo ?? 0)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-0">
                                            <EmptyState icon="payments" title="Sem dados de custo" description="Nenhuma categoria de ativo registrada para este período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Footer */}

        </div>
    )
}


