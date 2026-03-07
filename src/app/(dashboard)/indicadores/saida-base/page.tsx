"use client"

import React, { useState, useEffect } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList, AreaChart, Area } from "recharts"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { KpiCard } from "@/components/dashboard/KpiCard"

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
    }
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
    custo_projetado: number
    maiores_ofensores_equipes: { equipe: string, setor: string, minutos: number, valor_rs: number }[]
    maiores_ofensores_setor: { label: string, minutos: number, valor_rs: number }[]
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

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

const REGION_COLORS: Record<string, string> = {
    'ITA': '#1152d4',
    'ITARANA': '#1152d4',
    'NVE': '#f43f5e',
    'NOVA VENÉCIA': '#f43f5e',
    'VNO': '#64748b',
    'VENDA NOVA DO IMIGRANTE': '#64748b'
}

export default function SaidaBasePage() {
    const [data, setData] = useState<SaidaBaseDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [viewModeReg, setViewModeReg] = useState<'dia' | 'semana' | 'mes'>('dia')
    const [trendView, setTrendView] = useState<'dia' | 'semana' | 'ano'>('dia')
    const [mounted, setMounted] = useState(false)

    const loadData = async (view: string = trendView, forceSync = false) => {
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("saida_base")
            const response = await api.get(`/saida_base/dashboard?view=${view}`)
            if (response.data.error) {
                setError(response.data.error)
                setData(null)
            } else {
                setData(response.data)
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados de Saídas de Base.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    if (!mounted || (loading && !data)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-semibold text-text-muted animate-pulse uppercase tracking-wider">Sincronizando Tempos...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-wider text-center">Falha no Processamento: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">Tentar Novamente</button>
        </div>
    )
    if (!data) return null

    const historyData = data.history?.labels?.map((lbl, idx) => {
        let obj: any = { name: lbl }
        if (data.history?.datasets) {
            Object.keys(data.history.datasets).forEach(reg => {
                obj[reg] = data.history.datasets[reg][idx]
            })
        }
        return obj
    }) || []

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-700">
            {/* Header Area - Best in Class Design */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-6">
                <div className="flex-1 bg-surface border border-border p-4 min-h-[105px] rounded-sm flex items-stretch gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                        <span className="material-symbols-outlined text-primary text-[28px]">schedule</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 className="text-[9px] font-semibold uppercase text-text-muted tracking-widest">Inteligência Operacional e Insights</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {data.insights?.slice(0, 2).map((ins: any, i: number) => (
                                <p key={i} className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                    {ins.text.replace(/(\d+(\.\d+)?)(%)/g, (_match: string, p1: string) => `${parseFloat(p1).toFixed(1)}%`)}
                                </p>
                            )) || (
                                    <p className="text-[12px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                        Análise de fluxo de embarque indica estabilidade nas plataformas principais para {data.period_label}.
                                    </p>
                                )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end justify-center gap-2 min-w-[240px]">
                    <RefreshButton onClick={() => loadData(trendView, true)} loading={loading} />
                    <div className="text-right">
                        <p className="text-[9px] text-text-muted font-medium uppercase tracking-tight leading-relaxed">
                            Monitoramento: <span className="text-text-heading/70 font-medium">Tempo Real</span>
                        </p>
                        <p className="text-[9px] text-text-muted font-medium uppercase tracking-tight leading-relaxed">
                            Último Update: <span className="text-text-heading/70 font-medium">{data.last_update}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Top KPIs - 4 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Tempo Médio"
                    value={`${data.stats.media_dia}m`}
                    variation={data.stats.ritmo_comparativo}
                    target={`${data.meta}m`}
                    icon="schedule"
                />
                <KpiCard
                    title="Aderência"
                    value={data.stats.equipes_dentro_meta.toString()}
                    variation={data.stats.pct_conformidade}
                    target={data.stats.total_equipes.toString()}
                    icon="fact_check"
                />
                <KpiCard
                    title="Pedidos Totais"
                    value="355"
                    variation={-35.7}
                    target="550"
                    icon="package_2"
                />
                <KpiCard
                    title="Risco Projetado"
                    value={formatCurrency(data.custo_projetado)}
                    variation={2.4}
                    target="R$ 0"
                    icon="warning"
                />
            </div>

            {/* Main Content Grid 12 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Historico Chart Area - 8 Columns */}
                <div className="md:col-span-8 bg-surface border border-border p-4 rounded-sm flex flex-col h-[420px]">
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
                                {Object.keys(data.history?.datasets || {}).map((regName) => {
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
                <div className="md:col-span-4 bg-surface border border-border rounded-sm flex flex-col h-[420px]">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">trending_down</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Ofensores de Custo</h3>
                        </div>
                        <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Top 5</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-2 pl-4">Equipe</th>
                                    <th className="p-2 text-right pr-4">Custo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[11px]">
                                {data.maiores_ofensores_equipes?.slice(0, 5).map((eq, i) => (
                                    <tr key={i} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-2 pl-4">
                                            <p className="font-medium text-text-heading uppercase tracking-tight">{eq.equipe}</p>
                                            <p className="text-[9px] text-text-muted font-medium uppercase">{eq.setor}</p>
                                        </td>
                                        <td className="p-2 text-right pr-4">
                                            <p className="font-semibold text-rose-500 tabular-nums">{formatCurrency(eq.valor_rs)}</p>
                                            <p className="text-[9px] text-text-muted font-medium">{Math.round(eq.minutos)}m</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Row 3: Motivos & Detalhamento */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Motivos Chart - 5 Columns */}
                <div className="md:col-span-5 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px]">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Frequência de Motivos</h3>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.maiores_motivos.slice(0, 6)} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--text-muted)' }} />
                                <Bar dataKey="percent" fill="#1152d4" radius={[0, 2, 2, 0]} barSize={16}>
                                    {data.maiores_motivos?.slice(0, 6).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#0b50da' : '#1152d4'} fillOpacity={1 - index * 0.12} />
                                    ))}
                                    <LabelList dataKey="percent" position="right" formatter={(v: any) => `${Number(v).toFixed(1)}%`} style={{ fontSize: 9, fontWeight: 600, fill: 'var(--text-heading)' }} />
                                </Bar>
                                <Tooltip contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Setores Ofensores - 3 Columns */}
                <div className="md:col-span-3 bg-surface border border-border rounded-sm flex flex-col h-[400px]">
                    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[18px]">domain</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Setores Ofensores</h3>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[9px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-2 pl-4">Setor</th>
                                    <th className="p-2 text-right pr-4">Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[11px]">
                                {data.maiores_ofensores_setor?.slice(0, 6).map((s, i) => (
                                    <tr key={i} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight">{s.label}</td>
                                        <td className="p-2 text-right pr-4">
                                            <p className="font-semibold text-rose-500 tabular-nums">{formatCurrency(s.valor_rs)}</p>
                                            <p className="text-[9px] text-text-muted font-medium">{Math.round(s.minutos)}m</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pioras/Melhorias - 4 Columns split */}
                <div className="md:col-span-4 grid grid-rows-2 gap-6 h-[400px]">
                    <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden">
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
                                    {data.evolucao_semanal?.melhoraram?.slice(0, 4).map((eq, i) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight truncate max-w-[200px]">{eq.equipe}</td>
                                            <td className="p-2 text-right pr-4 font-semibold text-emerald-500 tabular-nums">-{eq.variacao_pct}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden">
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
                                    {data.evolucao_semanal?.pioraram?.slice(0, 4).map((eq, i) => (
                                        <tr key={i} className="hover:bg-surface/50 transition-colors">
                                            <td className="p-2 pl-4 font-medium text-text-heading uppercase tracking-tight truncate max-w-[200px]">{eq.equipe}</td>
                                            <td className="p-2 text-right pr-4 font-semibold text-rose-500 tabular-nums">+{eq.variacao_pct}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Regional Performance Section - EXATO PADRÃO APR DIGITAL */}
            <div>
                <div className="flex flex-col gap-1 mb-6">
                    <h2 className="text-xs font-semibold text-text-heading uppercase tracking-widest">Desempenho por Regional</h2>
                    <p className="text-[10px] text-text-muted font-medium uppercase tracking-tight">Análise detalhada por regional, evolução temporal e performance individual das equipes.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {data.bases_breakdown?.map((reg, idx) => (
                        <div key={idx} className="bg-surface border border-border rounded-sm p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:border-primary/30 transition-all">
                            {/* Card Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-[13px] font-medium text-text-heading uppercase">{reg.name}</h3>
                                    <p className="text-[10px] text-text-muted font-medium uppercase">
                                        <span className="text-emerald-600 font-medium">{reg.last_result}m (MÊS)</span> • {reg.total_equipes} equipes
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-lg font-semibold tabular-nums leading-none ${reg.last_result <= data.meta ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {reg.last_result}m
                                    </span>
                                    <span className="text-[9px] text-text-muted font-medium uppercase tracking-tighter">(último)</span>
                                </div>
                            </div>

                            {/* Mini Chart */}
                            <div className="flex flex-col gap-0">
                                <div className="h-[120px] w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={reg.trend_data?.map((v, i) => ({ name: reg.trend_labels?.[i] || '', value: v })) || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id={`grad-reg-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ff7849" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#ff7849" stopOpacity={0.01} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="#f1f5f9" vertical={true} horizontal={true} strokeDasharray="0" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={{ stroke: '#f1f5f9' }}
                                                tickLine={false}
                                                tick={{ fontSize: 8, fontWeight: 500, fill: '#94a3b8' }}
                                                interval="preserveStartEnd"
                                                minTickGap={10}
                                            />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                axisLine={{ stroke: '#f1f5f9' }}
                                                tickLine={false}
                                                tick={{ fontSize: 8, fontWeight: 500, fill: '#94a3b8' }}
                                            />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-background border border-border p-2 rounded-sm shadow-xl">
                                                                <p className="text-[9px] font-semibold text-text-muted uppercase mb-1">{payload[0].payload.name}</p>
                                                                <p className="text-[11px] font-semibold text-primary">{payload[0].value}m</p>
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
                                                fillOpacity={1}
                                                fill={`url(#grad-reg-${idx})`}
                                                dot={{ r: 2, fill: '#fff', strokeWidth: 1.5, stroke: '#ff7849' }}
                                                activeDot={{ r: 3, strokeWidth: 0, fill: '#ff7849' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Teams Performance List */}
                            <div className="flex flex-col gap-2 bg-slate-50/30 -mx-5 -mb-5 p-4 border-t border-border/50 h-[300px] overflow-y-auto custom-scrollbar">
                                {reg.teams?.map((team, tIdx) => {
                                    const valDia = team.valores.dia;
                                    const isWin = valDia <= data.meta;
                                    return (
                                        <div key={tIdx} className="flex flex-col gap-0.5">
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className="text-[10px] font-medium text-text-heading/80 uppercase tracking-tight truncate pr-2">{team.equipe}</span>
                                                <span className={`text-[12px] font-semibold tabular-nums ${isWin ? 'text-emerald-700' : 'text-rose-500'}`}>{valDia}m</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-200/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${isWin ? 'bg-emerald-600' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min((valDia / data.meta) * 100, 100)}%` }}
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

            {/* Footer Status */}

        </div>
    )
}

