"use client"

import React, { useState, useEffect, useRef } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList, AreaChart, Area } from "recharts"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { PageError } from "@/components/ui/PageError"
import { formatCurrencyCompact, REGIONAL_COLORS, CHART_COLORS } from "@/lib/utils"
import { useFilter } from "@/components/providers/FilterProvider"
import { EmptyState } from "@/components/ui/EmptyState"
import { useSortableTable } from "@/hooks/useSortableTable"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { CSVExportButton } from "@/components/ui/CSVExportButton"

interface SaidaBaseDashboard {
    last_update: string
    meta: number
    period_label: string
    stats: {
        media_dia: number
        media_mes: number
        equipes_dentro_meta: number
        total_equipes: number
        pct_conformidade: number
        ritmo_comparativo: number
        indice_ipe: number
        total_equipes_periodo: number
    }
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
    custo_projetado: number
    maiores_ofensores_equipes: { equipe: string, setor: string, minutos: number, valor_rs: number }[]
    maiores_ofensores_setor: { label: string, minutos: number, valor_rs: number, percent: number }[]
    maiores_motivos: { label: string, count: number, percent: number, valor_rs: number }[]
    evolucao_semanal: {
        melhoraram: { equipe: string, setor: string, regional: string, variacao_pct: number, semana_atual: number, semana_anterior: number }[]
        pioraram: { equipe: string, setor: string, regional: string, variacao_pct: number, semana_atual: number, semana_anterior: number }[]
    }
    history: { labels: string[], datasets: Record<string, number[]> }
    bases_breakdown: {
        name: string
        last_result: number
        total_equipes: number
        trend_labels: string[]
        trend_data: number[]
        teams: { equipe: string, valores: { dia: number, semana: number, mes: number } }[]
    }[]
}

const formatCurrency = formatCurrencyCompact
const REGION_COLORS = REGIONAL_COLORS

export default function SaidaBasePage() {
    const { period } = useFilter()
    const [data, setData] = useState<SaidaBaseDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [viewModeReg, setViewModeReg] = useState<'dia' | 'semana' | 'mes'>('dia')
    const [trendView, setTrendView] = useState<'dia' | 'semana' | 'ano'>('dia')
    const [mounted, setMounted] = useState(false)
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (view: string = trendView, forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("saida_base")
            const response = await api.get(`/saida_base/dashboard?view=${view}&periodo=${period}`, { signal: abortRef.current.signal })
            if (response.data.error) {
                setError(response.data.error)
                setData(null)
            } else {
                setData(response.data)
            }
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados de Saídas de Base.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData(trendView, true)
        isInitialMount.current = false
    }, [])

    useEffect(() => {
        if (isInitialMount.current) return
        loadData(trendView, false)
    }, [period])

    const { sorted: sortedOfensores, sortKey: skO, sortDir: sdO, handleSort: hsO } = useSortableTable(data?.maiores_ofensores_equipes ?? [])

    if (!mounted || (loading && !data)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />
    if (error) return <PageError error={`Falha no Processamento: ${error}`} onRetry={() => loadData()} />
    if (!data) return null

    const historyData = (data?.history?.labels ?? []).map((lbl, idx) => {
        let obj: any = { name: lbl }
        const datasets = data?.history?.datasets ?? {};
        Object.keys(datasets).forEach(reg => {
            const arr = datasets[reg] ?? [];
            obj[reg] = arr[idx] ?? 0;
        })
        return obj
    })

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon="schedule"
                title="Inteligência Operacional e Insights"
                insights={data?.insights ?? []}
                fallbackText={`Análise de fluxo de embarque para ${data?.period_label ?? 'período'}.`}
                monitoramento="Tempo Real"
                lastUpdate={data?.last_update}
                onRefresh={() => loadData(trendView, true)}
                loading={loading}
                showPeriodSelector={true}
            />

            {/* Top KPIs - 4 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Tempo Médio"
                    value={`${data?.stats?.media_dia ?? 0}m`}
                    variation={data?.stats?.ritmo_comparativo ?? 0}
                    target={`${data?.meta ?? 30}m`}
                    icon="schedule"
                    subtitle={data?.period_label ?? ''}
                />
                <KpiCard
                    title="Aderência"
                    value={(data?.stats?.equipes_dentro_meta ?? 0).toString()}
                    variation={data?.stats?.pct_conformidade ?? 0}
                    target={(data?.stats?.total_equipes ?? 0).toString()}
                    icon="fact_check"
                    subtitle={data?.period_label ?? ''}
                />
                <KpiCard
                    title="IPE (Índice Produtiva)"
                    value={`${data?.stats?.indice_ipe ?? 0}%`}
                    variation={data?.stats?.total_equipes_periodo ?? 0}
                    target={`Universo: ${data?.stats?.total_equipes_periodo ?? 0} eq.`}
                    icon="trending_up"
                    subtitle={data?.period_label ?? ''}
                />
                <KpiCard
                    title="Risco Projetado"
                    value={formatCurrency(data?.custo_projetado ?? 0)}
                    variation={0}
                    target="R$ 0"
                    icon="warning"
                    subtitle={data?.period_label ?? ''}
                />
            </div>

            {/* Main Content Grid 12 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Historico Chart Area - 8 Columns */}
                <div className="md:col-span-8 bg-surface border border-border p-4 rounded-sm flex flex-col h-[420px] shadow-sm transition-all hover:border-primary/30">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Tendência Regional de Saída</h3>
                            <p className="text-[9px] text-text-muted uppercase font-medium mt-0.5">Visão temporal do tempo médio por base operacional</p>
                        </div>
                        <div className="flex bg-surface/50 border border-border p-1 rounded-sm gap-1">
                            {(['dia', 'semana', 'ano'] as const).map((v) => (
                                <button
                                    key={v}
                                    onClick={() => { setTrendView(v); loadData(v); }}
                                    className={`text-[9px] uppercase font-semibold px-4 py-1 rounded-sm transition-all ${trendView === v
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-text-muted hover:text-primary'
                                        }`}
                                >
                                    {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Ano'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 600, fill: 'var(--text-muted)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 600, fill: 'var(--text-muted)' }} />
                                <Tooltip
                                    cursor={{ stroke: '#1152d4', strokeWidth: 1 }}
                                    contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '12px' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-heading)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }} iconType="rect" />
                                {Object.keys(data?.history?.datasets || {}).filter(k => !['NAN','NONE','N/A'].includes(k.toUpperCase())).map((regName) => {
                                    const color = REGION_COLORS[regName.toUpperCase()] || '#94a3b8'
                                    return (
                                        <Line key={regName} name={regName} type="monotone" dataKey={regName} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                                    )
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Ofensores List - 4 Columns */}
                <div className="md:col-span-4 bg-surface border border-border rounded-sm flex flex-col h-[420px] shadow-sm transition-all hover:border-rose-500/30">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">trending_down</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Ofensores de Custo</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Top 7</span>
                            <CSVExportButton data={sortedOfensores as Record<string, unknown>[]} filename="ofensores_saida_base" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <SortableHeader label="Equipe" sortKey="equipe" activeSortKey={skO} sortDir={sdO} onSort={hsO} className="p-2 pl-4" />
                                    <SortableHeader label="Custo" sortKey="valor_rs" activeSortKey={skO} sortDir={sdO} onSort={hsO} className="p-2 text-right" />
                                    <SortableHeader label="Min" sortKey="minutos" activeSortKey={skO} sortDir={sdO} onSort={hsO} className="p-2 text-right pr-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[11px]">
                                {(sortedOfensores ?? []).length > 0 ? (
                                    (sortedOfensores ?? []).slice(0, 7).map((eq, i) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-2 pl-4">
                                                <p className="font-medium text-text-heading uppercase tracking-tight">{eq.equipe ?? "N/D"}</p>
                                                <p className="text-[9px] text-text-muted font-medium uppercase">{eq.setor ?? "N/D"}</p>
                                            </td>
                                            <td className="p-2 text-right">
                                                <p className="font-semibold text-rose-500 tabular-nums">{formatCurrency(eq.valor_rs ?? 0)}</p>
                                            </td>
                                            <td className="p-2 text-right pr-4">
                                                <p className="text-[9px] text-text-muted font-medium tabular-nums">{Math.round(eq.minutos ?? 0)}m</p>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-0">
                                            <EmptyState icon="warning" title="Nenhum ofensor identificado" description="Sem dados de custo para este período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Row 3: Motivos & Detalhamento */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Motivos Chart - 5 Columns */}
                <div className="md:col-span-12 lg:col-span-5 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm transition-all hover:border-primary/30">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Frequência de Motivos</h3>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(data?.maiores_motivos ?? []).slice(0, 6)} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--text-muted)' }} />
                                <Bar dataKey="count" fill="#1152d4" radius={[0, 2, 2, 0]} barSize={16}>
                                    {(data?.maiores_motivos ?? []).slice(0, 6).map((_, index: number) => (
                                        <Cell key={`cell-${index}`} fill={['#1152d4', '#1e68e4', '#4785ef', '#70a2f7', '#99bffb', '#c2dbff'][index % 6]} />
                                    ))}
                                    <LabelList dataKey="percent" position="right" offset={10} formatter={(v: any) => `${Number(v ?? 0).toFixed(1)}%`} style={{ fontSize: 9, fontWeight: 700, fill: 'var(--text-heading)' }} />
                                </Bar>
                                <Tooltip contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Evolution over time - 7 Columns */}
                <div className="md:col-span-12 lg:col-span-7 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm transition-all hover:border-primary/30">
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary text-[18px]">show_chart</span>
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Evolução do Tempo de Saída (Frequência)</h3>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={(data?.history?.labels || []).map((label: string, i: number) => {
                               const point: any = { data: label };
                               const datasets = data?.history?.datasets ?? {};
                               Object.keys(datasets).forEach((ds: string) => {
                                   point[ds] = (datasets[ds] ?? [])[i] ?? 0;
                               });
                               return point;
                           })}>
                               <defs>
                                   <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                                       <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                               <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }} dy={10} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }} dx={-10} unit="m" />
                               <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '10px' }} />
                               <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }} />
                               {Object.keys(data.history?.datasets || {}).map((ds, idx) => (
                                   <Area key={ds} type="monotone" dataKey={ds} stroke={CHART_COLORS[idx % CHART_COLORS.length]} fillOpacity={1} fill={`url(#colorSaida)`} strokeWidth={2} activeDot={{ r: 4, strokeWidth: 0 }} />
                               ))}
                           </AreaChart>
                       </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Setores Ofensores - 4 Columns */}
                <div className="md:col-span-4 bg-surface border border-border rounded-sm flex flex-col h-[400px] shadow-sm transition-all hover:border-amber-500/30">
                    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[18px]">domain</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Setores Ofensores</h3>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[9px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-2 pl-4">Setor</th>
                                    <th className="p-2 text-right">Prc. (%)</th>
                                    <th className="p-2 text-right pr-4">Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[11px]">
                                {(data?.maiores_ofensores_setor ?? []).length > 0 ? (
                                    (data?.maiores_ofensores_setor ?? []).slice(0, 6).map((s: any, i: number) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight">{s.label ?? "N/D"}</td>
                                            <td className="p-2 text-right text-text-muted/80 font-semibold">{(s.percent ?? 0).toFixed(1)}%</td>
                                            <td className="p-2 text-right pr-4">
                                                <p className="font-semibold text-rose-500 tabular-nums">{(s.valor_rs ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                <p className="text-[9px] text-text-muted font-medium">{Math.round(s.minutos ?? 0)}m</p>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-0">
                                            <EmptyState icon="payments" title="Sem dados de custo" description="Nenhum setor ofensor identificado neste período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pioras/Melhorias - 8 Columns */}
                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
                    <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden shadow-sm transition-all hover:border-emerald-500/30">
                        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500 text-[18px]">trending_up</span>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Melhorias</h3>
                            </div>
                            <span className="text-[9px] font-semibold text-emerald-500 uppercase">Semanal</span>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-border text-[11px]">
                                    {data?.evolucao_semanal?.melhoraram && data.evolucao_semanal.melhoraram.length > 0 ? (
                                        data.evolucao_semanal.melhoraram.slice(0, 6).map((eq: any, i: number) => (
                                            <tr key={i} className="hover:bg-surface/50 transition-colors">
                                                <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight truncate max-w-[200px]">{eq.equipe}</td>
                                                <td className="p-2 text-right pr-4 font-semibold text-emerald-500 tabular-nums">{Math.abs(eq.variacao_pct)}%</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="p-0">
                                                <EmptyState icon="leaderboard" title="Sem classificação disponível" description="Nenhuma melhoria registrada neste período." />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden shadow-sm transition-all hover:border-rose-500/30">
                        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-500 text-[18px]">trending_down</span>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Pioras</h3>
                            </div>
                            <span className="text-[9px] font-semibold text-rose-500 uppercase">Semanal</span>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-border text-[11px]">
                                    {data?.evolucao_semanal?.pioraram && data.evolucao_semanal.pioraram.length > 0 ? (
                                        data.evolucao_semanal.pioraram.slice(0, 6).map((eq: any, i: number) => (
                                            <tr key={i} className="hover:bg-surface/50 transition-colors">
                                                <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight truncate max-w-[200px]">{eq.equipe}</td>
                                                <td className="p-2 text-right pr-4 font-semibold text-rose-500 tabular-nums">+{eq.variacao_pct}%</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="p-0">
                                                <EmptyState icon="leaderboard" title="Sem classificação disponível" description="Nenhuma piora registrada neste período." />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Regional Performance Section */}
            <div>
                <div className="flex flex-col gap-1 mb-6">
                    <h2 className="text-xs font-semibold text-text-heading uppercase tracking-widest">Desempenho por Regional</h2>
                    <p className="text-[10px] text-text-muted font-medium uppercase tracking-tight">Análise detalhada por regional, evolução temporal e performance individual das equipes.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(data?.bases_breakdown ?? []).map((reg, idx) => (
                        <div key={idx} className="bg-surface border border-border rounded-sm p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:border-primary/40 transition-all">
                            {/* Card Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-[14px] font-semibold text-text-heading uppercase">{reg.name ?? "N/D"}</h3>
                                    <p className="text-[11px] text-text-muted font-medium uppercase">
                                        <span className="text-blue-600 font-semibold">{reg.last_result ?? 0}m ({(data?.period_label ?? "").toUpperCase()})</span> • {reg.total_equipes ?? 0} equipes
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-xl font-semibold tabular-nums leading-none ${(reg.last_result ?? 0) <= (data?.meta ?? 30) ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {reg.last_result ?? 0}m
                                    </span>
                                    <span className="text-[9px] text-text-muted font-medium uppercase tracking-tighter">(último)</span>
                                </div>
                            </div>

                            {/* Mini Chart */}
                            <div className="flex flex-col gap-0">
                                <div className="h-[150px] w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={(reg.trend_data ?? []).map((v, i) => ({ name: (reg.trend_labels ?? [])[i] || '', value: v }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid stroke="#f1f5f9" vertical={true} horizontal={true} strokeDasharray="0" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={{ stroke: '#f1f5f9' }}
                                                tickLine={false}
                                                tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                                                interval="preserveStartEnd"
                                                minTickGap={10}
                                            />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                axisLine={{ stroke: '#f1f5f9' }}
                                                tickLine={false}
                                                tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                                            />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-background border border-border p-2 rounded-sm shadow-xl">
                                                                <p className="text-[9px] font-semibold text-text-muted uppercase mb-1">{payload[0].payload.name}</p>
                                                                <p className="text-[12px] font-semibold text-primary">{payload[0].value}m</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#ff7849"
                                                strokeWidth={2}
                                                fillOpacity={0.1}
                                                fill="#ff7849"
                                                dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#ff7849' }}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: '#ff7849' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Teams Performance List */}
                            <div className="flex flex-col gap-2 bg-slate-50/30 -mx-5 -mb-5 p-4 border-t border-border/50 h-[350px] overflow-y-auto custom-scrollbar">
                                {[...(reg.teams ?? [])].sort((a, b) => (b.valores?.dia ?? 0) - (a.valores?.dia ?? 0)).map((team, tIdx) => {
                                    const valDia = team.valores?.dia ?? 0;
                                    const isWin = valDia <= (data?.meta ?? 30);
                                    return (
                                        <div key={tIdx} className="flex flex-col gap-0.5">
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className="text-[11px] font-semibold text-text-heading/80 uppercase tracking-tight truncate pr-2">{team.equipe ?? "N/D"}</span>
                                                <span className={`text-[13px] font-semibold tabular-nums ${isWin ? 'text-blue-700' : 'text-rose-500'}`}>{valDia}m</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${isWin ? 'bg-blue-800' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min((valDia / (data?.meta || 30)) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

