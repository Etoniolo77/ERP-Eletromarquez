"use client"

import React, { useState, useEffect, useRef } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { RefreshButton } from "@/components/ui/RefreshButton"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine } from "recharts"
import { useFilter } from "@/components/providers/FilterProvider"

interface RegionalData {
    name: string
    last_result: number
    efetividade_str: string
    total_equipes: number
    equipes_meta: number
    equipes_fora: number
    sparkline: { name: string, value: number }[]
    top_offenders: { equipe: string, efetividade: number }[]
}

interface AprDashboardData {
    sector: string
    period_label: string
    source_file: string
    last_update: string
    meta: number
    stats: {
        aderencia_global: number
        aderencia_var: number
        equipes_fora_meta: number
        equipes_fora_var: number
        total_equipes: number
        total_equipes_var: number
    }
    history: { labels: string[], values: number[] }
    top_melhores: { equipe: string, regional: string, efetividade: number }[]
    top_piores: { equipe: string, regional: string, efetividade: number }[]
    bases_breakdown: RegionalData[]
    insights: { type: string, text: string }[]
}

export default function AprDigitalPage() {
    const { period } = useFilter()
    const [data, setData] = useState<AprDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sector, setSector] = useState("CCM")
    const [mounted, setMounted] = useState(false)
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("apr")
            const resp = await api.get(`/apr/dashboard?sector=${sector}&periodo=${period}`, { signal: abortRef.current.signal })
            setData(resp.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados de APR.')
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
    }, [sector, period])

    if (!mounted || (loading && !data)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-semibold text-text-muted animate-pulse uppercase tracking-widest">Sincronizando Auditorias APR Digital...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">Falha crítica no sistema APR: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/10 transition-all hover:scale-105">Tentar Recarregar</button>
        </div>
    )
    if (!data) return null

    const stats = data.stats ?? {
        aderencia_global: 0, aderencia_var: 0,
        equipes_fora_meta: 0, equipes_fora_var: 0,
        total_equipes: 0, total_equipes_var: 0
    }
    const top_melhores = data.top_melhores ?? []
    const top_piores = data.top_piores ?? []
    const bases_breakdown = data.bases_breakdown ?? []
    const insights = data.insights ?? []

    const lineChartData = (data.history?.labels ?? []).map((label: string, idx: number) => ({
        name: label,
        value: data.history.values?.[idx] ?? 0
    }))

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon="shield_with_heart"
                title="Safety Intelligence — APR Digital"
                fallbackText={`Monitoramento de Conformidade e Aderência por Regional • ${sector === 'CCM' ? 'Centro de Controle e Medição' : 'Equipes de Campo / Turmas'}`}
                sourceFile={data.source_file}
                lastUpdate={data.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
            />

            {/* Tabs Navigation */}
            <div className="flex items-center gap-8 border-b border-border px-2 pt-2">
                {[
                    { id: 'CCM', label: 'CCM', icon: 'settings_input_component' },
                    { id: 'TURMAS', label: 'TURMAS', icon: 'groups' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSector(tab.id)}
                        className={`flex items-center gap-2 pb-3 text-[11px] font-semibold uppercase tracking-widest transition-all relative ${sector === tab.id ? 'text-primary' : 'text-text-muted hover:text-text-heading'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                        {tab.label}
                        {sector === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary animate-in fade-in duration-300" />}
                    </button>
                ))}
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                <KpiCard
                    title="Aderência Global"
                    value={`${stats.aderencia_global.toFixed(1)}%`}
                    variation={stats.aderencia_var}
                    target={`${data.meta}% Meta`}
                    icon="shield"
                    colorValue={stats.aderencia_global >= data.meta ? "success" : "danger"}
                />
                <KpiCard
                    title="Equipes Analisadas"
                    value={`${stats.total_equipes}`}
                    variation={stats.total_equipes_var}
                    target="No Período"
                    icon="groups"
                    colorValue="primary"
                />
                <KpiCard
                    title="Abaixo da Meta"
                    value={`${stats.equipes_fora_meta}`}
                    variation={stats.equipes_fora_var}
                    target="GAP Operacional"
                    icon="warning"
                    colorValue="danger"
                />

                <div className="bg-rose-500/5 border border-rose-500/10 p-3 min-h-[95px] flex flex-col rounded-sm overflow-hidden group hover:border-rose-500/30 transition-all shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[18px] text-rose-500 underline-offset-4">warning</span>
                        <h4 className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Alertas SESMT</h4>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar pr-1">
                        {insights.map((insight: any, i: number) => (
                            <div key={i} className="flex gap-2 items-center mb-1.5 group/ins">
                                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${insight.type === 'destaque' ? 'bg-emerald-500' : insight.type === 'preocupacao' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                <p className="text-[10px] font-medium text-text-muted leading-tight uppercase group-hover/ins:text-primary transition-colors">
                                    {insight.text.replace(/(\d+(\.\d+)?)(%)/g, (_match: string, p1: string) => `${parseFloat(p1).toFixed(1)}%`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Evolution Chart */}
                <div className="lg:col-span-6 bg-surface border border-border p-4 rounded-sm h-[480px] flex flex-col">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Evolução de Aderência na APR Digital</h3>
                            <p className="text-[10px] text-text-muted font-medium uppercase tracking-tight">Média aritmética simples da aderência por data.</p>
                        </div>
                        <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-500 text-[9px] font-semibold uppercase rounded-sm border border-rose-500/20 shrink-0">Target: {data.meta}%</span>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600, fillOpacity: 0.7 }}
                                    dy={10}
                                    minTickGap={30}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600, fillOpacity: 0.7 }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                                    contentStyle={{ borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', padding: '8px' }}
                                    labelStyle={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', color: 'var(--text-heading)' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: '600', color: 'var(--primary)' }}
                                    formatter={(v: any) => [`${v}%`, 'Conformidade']}
                                />
                                <ReferenceLine
                                    y={data.meta}
                                    stroke="#f43f5e"
                                    strokeDasharray="4 4"
                                    strokeWidth={1}
                                    label={{
                                        position: 'right',
                                        value: 'META',
                                        fill: '#f43f5e',
                                        fontSize: 8,
                                        fontWeight: 600
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="var(--primary)"
                                    strokeWidth={4}
                                    dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--primary)' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Performance */}
                <div className="lg:col-span-3 bg-surface border border-border rounded-sm flex flex-col h-[480px] overflow-hidden">
                    <div className="p-3 border-b border-border bg-emerald-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-[18px]">military_tech</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Performance</h3>
                        </div>
                    </div>
                    <div className="px-2 overflow-y-auto custom-scrollbar flex-1">
                        {top_melhores.map((eq, i) => (
                            <div key={i} className="py-1 px-3 bg-surface/50 border-b border-border/5 hover:border-emerald-500/20 transition-all group">
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-semibold text-text-heading group-hover:text-emerald-500 uppercase truncate pr-1 flex-1">{eq.equipe}</span>
                                    <span className="text-[13px] font-semibold text-emerald-500 tabular-nums shrink-0">{eq.efetividade.toFixed(1)}%</span>
                                </div>
                                <span className="text-[9px] text-text-muted font-medium uppercase tracking-widest leading-none block">{eq.regional}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Attention Needed */}
                <div className="lg:col-span-3 bg-rose-500/5 border border-rose-500/10 rounded-sm flex flex-col h-[480px] overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-rose-500/10 bg-rose-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">warning</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Atenção Crítica</h3>
                        </div>
                    </div>
                    <div className="px-2 overflow-y-auto custom-scrollbar flex-1">
                        {top_piores.map((eq, i) => (
                            <div key={i} className="py-1 px-3 bg-surface/50 border-b border-border/5 hover:border-rose-500/20 transition-all group">
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-semibold text-text-heading group-hover:text-rose-500 uppercase truncate pr-1 flex-1">{eq.equipe}</span>
                                    <span className="text-[13px] font-semibold text-rose-500 tabular-nums shrink-0">{eq.efetividade.toFixed(1)}%</span>
                                </div>
                                <span className="text-[9px] text-text-muted font-medium uppercase tracking-widest leading-none block">{eq.regional}</span>
                            </div>
                        ))}
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
                    {bases_breakdown.map((reg, idx) => (
                        <div key={idx} className="bg-surface border border-border rounded-sm p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:border-primary/30 transition-all">
                            {/* Card Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-[14px] font-semibold text-text-heading uppercase">{reg.name}</h3>
                                    <p className="text-[11px] text-text-muted font-medium uppercase">
                                        <span className="text-blue-600 font-semibold">{reg.last_result.toFixed(1)}% ({data.period_label.toUpperCase()})</span> • {reg.total_equipes} equipes
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-xl font-semibold tabular-nums leading-none ${reg.last_result >= data.meta ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {reg.last_result.toFixed(1)}%
                                    </span>
                                    <span className="text-[9px] text-text-muted font-medium uppercase tracking-tighter">(último)</span>
                                </div>
                            </div>

                            {/* Mini Chart */}
                            <div className="flex flex-col gap-0">

                                <div className="h-[150px] w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={reg.sparkline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                                                tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                                                interval="preserveStartEnd"
                                                minTickGap={10}
                                            />
                                            <YAxis
                                                domain={[80, 100]}
                                                axisLine={{ stroke: '#f1f5f9' }}
                                                tickLine={false}
                                                tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                                                ticks={[80, 85, 90, 95, 100]}
                                            />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-background border border-border p-2 rounded-sm shadow-xl">
                                                                <p className="text-[9px] font-semibold text-text-muted uppercase mb-1">{payload[0].payload.name}</p>
                                                                <p className="text-[12px] font-semibold text-primary">{payload[0].value}%</p>
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
                                                dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#ff7849' }}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: '#ff7849' }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Teams Performance List */}
                            <div className="flex flex-col gap-2 bg-slate-50/30 -mx-5 -mb-5 p-4 border-t border-border/50 h-[350px] overflow-y-auto custom-scrollbar">
                                {reg.top_offenders.map((team, tIdx) => {
                                    const isWin = team.efetividade >= data.meta;
                                    return (
                                        <div key={tIdx} className="flex flex-col gap-0.5">
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className="text-[11px] font-semibold text-text-heading/80 uppercase tracking-tight truncate pr-2">{team.equipe}</span>
                                                <span className={`text-[13px] font-semibold tabular-nums ${isWin ? 'text-blue-700' : 'text-rose-500'}`}>{team.efetividade.toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${isWin ? 'bg-blue-800' : 'bg-rose-500'}`}
                                                    style={{ width: `${team.efetividade}%` }}
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

            {/* Footer */}

        </div>
    )
}


