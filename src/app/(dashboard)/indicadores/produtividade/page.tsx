"use client"

import React, { useState, useEffect } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { CsdBarChart } from "@/components/dashboard/CsdBarChart"
import { RefreshButton } from "@/components/ui/RefreshButton"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { useFilter } from "@/components/providers/FilterProvider"

interface DashboardData {
    meta_prod: number
    periodo_ref: string
    source_file: string
    last_update: string
    stats: {
        media_prod: number
        trend_prod: number
        media_ociosidade: number
        trend_ociosidade: number
        media_saida_base: number
        trend_saida: number
        media_retorno_base: number
        trend_retorno: number
        total_ociosidade_hrs: number
        total_desvios_hrs: number
        total_hora_extra_hrs: number
        total_notas: number
        total_rejeicoes: number
        total_equipes: number
        atingimento_meta: number
    }
    chart: {
        labels: string[]
        data: number[]
    }
    top_desvios: { motivo: string, qtd: number }[]
    top_piores: { equipe: string, csd: string, produtividade: number, ociosidade: number, saida_base: number, retorno_base: number, notas: number, rejeitadas: number, interrompidas: number }[]
    top_melhores: { equipe: string, csd: string, produtividade: number, notas: number, saida_base: number, retorno_base: number, rejeitadas: number, interrompidas: number, ociosidade: number }[]
    breakdown_csd: {
        name: string
        num_equipes: number
        acima_meta: number
        produtividade: number
        ociosidade: number
        equipes: { equipe: string, prod: number }[]
    }[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

export default function CcmProdutividadePage() {
    const { period } = useFilter()
    const [dashData, setDashData] = useState<DashboardData | null>(null)
    const [view, setView] = useState<string>("csd")
    const [metric, setMetric] = useState<string>("ocupacao")
    const [selectedItem, setSelectedItem] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    const loadData = async (forceSync = false) => {
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("produtividade_ccm")

            let url = `/produtividade/dashboard?periodo=${period}&view=${view}&sector=DEPC-CCM&metric=${metric}`
            if (selectedItem) {
                const param = view === 'csd' ? 'csd' : 'equipe'
                url += `&${param}=${encodeURIComponent(selectedItem)}`
            }

            const response = await api.get(url)
            setDashData(response.data)
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados operacionais CCM.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [period, view, selectedItem, metric])

    const handleBarClick = (name: string) => {
        setSelectedItem(prev => prev === name ? null : name)
    }

    if (!mounted || (loading && !dashData)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-500 animate-pulse uppercase tracking-widest">Auditando Tempos CCM...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">Erro no Motor de Gestão: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm transition-all shadow-lg shadow-primary/10">Recarregar Painel</button>
        </div>
    )
    if (!dashData) return null

    const chartData = dashData.chart.labels.map((label, i) => ({
        name: label,
        prod: dashData.chart.data[i]
    }))

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                <div className="flex-1 bg-surface border border-border p-4 min-h-[105px] rounded-sm flex items-stretch gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                        <span className="material-symbols-outlined text-primary text-[28px]">timer</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 className="text-[9px] font-semibold uppercase text-text-muted tracking-widest">Gestão de Tempos CCM e Insights</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {dashData.insights?.slice(0, 2).map((ins: any, i: number) => (
                                <p key={i} className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                    {ins.text}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end justify-center gap-2 min-w-[240px]">
                    <RefreshButton onClick={() => loadData(true)} loading={loading} />
                    <div className="text-right">
                        <p className="text-[9px] text-text-muted font-semibold uppercase tracking-tight leading-relaxed">
                            Fonte: <span className="text-text-heading/70 font-medium">{dashData.source_file}</span>
                        </p>
                        <p className="text-[9px] text-text-muted font-medium uppercase tracking-tight leading-relaxed">
                            Último Update: <span className="text-text-heading/70 font-medium">{dashData.last_update}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Ocupação (Média)"
                    value={`${dashData.stats.media_prod}%`}
                    variation={dashData.stats.trend_prod}
                    target="Meta: 95%"
                    icon="trending_up"
                />
                <KpiCard
                    title="Ociosidade (Média)"
                    value={`${Math.round(dashData.stats.media_ociosidade || 0)} min`}
                    variation={dashData.stats.trend_ociosidade || 0}
                    target={`Total: ${Math.round(dashData.stats.total_ociosidade_hrs * 60)} min`}
                    icon="schedule"
                    trendMode="down-is-good"
                />
                <KpiCard
                    title="Saída de Base (Média)"
                    value={`${Math.round(dashData.stats.media_saida_base || 0)} min`}
                    variation={dashData.stats.trend_saida || 0}
                    target="Meta: 30 min"
                    icon="login"
                    trendMode="down-is-good"
                />
                <KpiCard
                    title="Retorno à Base (Média)"
                    value={`${Math.round(dashData.stats.media_retorno_base || 0)} min`}
                    variation={dashData.stats.trend_retorno || 0}
                    target="Monitoramento"
                    icon="logout"
                    trendMode="down-is-good"
                />
            </div>

            {/* Secondary Operational Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-border p-4 rounded-sm flex items-center gap-4 shadow-sm hover:border-primary/30 transition-all">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">more_time</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Hora Extra (Acumulada)</p>
                        <p className="text-lg font-bold text-text-heading tabular-nums">{dashData.stats.total_hora_extra_hrs.toFixed(1)} <span className="text-[10px] font-medium text-text-muted">hrs</span></p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-4 rounded-sm flex items-center gap-4 shadow-sm hover:border-primary/30 transition-all">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-500 text-[20px]">task_alt</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Notas Executadas (Total)</p>
                        <p className="text-lg font-bold text-text-heading tabular-nums">{dashData.stats.total_notas} <span className="text-[10px] font-medium text-text-muted">unid</span></p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-4 rounded-sm flex items-center gap-4 shadow-sm hover:border-primary/30 transition-all">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-rose-500 text-[20px]">running_with_errors</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Notas Interrompidas (Total)</p>
                        <p className="text-lg font-bold text-text-heading tabular-nums">
                            {dashData.top_piores?.reduce((acc, curr) => acc + (curr.interrompidas || 0), 0)}
                            <span className="text-[10px] font-medium text-text-muted ml-1">unid</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Primary Chart Board */}
            <div className="bg-surface border border-border px-4 py-2 rounded-sm flex flex-col h-[480px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">query_stats</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">
                                {metric === 'ocupacao' ? 'Ocupação' : metric === 'ociosidade' ? 'Ociosidade' : 'Saída de Base'} por {view === 'csd' ? 'Regional' : 'Equipe'}
                            </h3>
                            {selectedItem && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-sm border border-primary/20 animate-pulse">
                                    Filtrado: {selectedItem}
                                </span>
                            )}
                        </div>
                        {selectedItem && (
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="text-[10px] text-primary hover:underline font-semibold uppercase text-left w-fit"
                            >
                                Limpar Filtro de Seleção ✕
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        {/* Seletor de Métrica */}
                        <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10 mr-4">
                            {[
                                { id: 'ocupacao', label: 'Ocupação' },
                                { id: 'ociosidade', label: 'Ociosidade' },
                                { id: 'saida', label: 'Saída' }
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setMetric(m.id)}
                                    className={`text-[10px] uppercase font-bold px-3 py-1 rounded-sm transition-all ${metric === m.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:text-emerald-500/70'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10">
                            <button
                                onClick={() => { setView('csd'); setSelectedItem(null); }}
                                className={`text-[11px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${view === 'csd' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                Regional
                            </button>
                            <button
                                onClick={() => { setView('equipe'); setSelectedItem(null); }}
                                className={`text-[11px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${view === 'equipe' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                Equipes
                            </button>
                        </div>
                        <span className={`px-2 py-1 ${metric === 'ocupacao' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'} text-[11px] font-semibold uppercase rounded-sm border-none`}>
                            Meta: {metric === 'ocupacao' ? '95%' : (metric === 'ociosidade' ? '15min' : '30min')}
                        </span>
                    </div>
                </div>

                <div className="flex-1 w-full">
                    <CsdBarChart
                        data={chartData}
                        meta={metric === 'ocupacao' ? 95 : (metric === 'ociosidade' ? 15 : 30)}
                        onBarClick={handleBarClick}
                        selectedBar={selectedItem}
                        unit={metric === 'ocupacao' ? '%' : 'min'}
                    />
                </div>
            </div>

            {/* Regional Breakdown Grid */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest flex-shrink-0">
                        {metric === 'ocupacao' ? 'Ocupação' : metric === 'ociosidade' ? 'Ociosidade' : 'Saída de Base'} por Regional CCM
                    </h2>
                    <div className="h-px flex-1 bg-border/20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashData.breakdown_csd?.map((csd: any, i: number) => {
                        const unit = metric === 'ocupacao' ? '%' : 'min'
                        const meta_ref = metric === 'ocupacao' ? 95 : 30
                        const isGood = metric === 'ocupacao' ? csd.produtividade >= meta_ref : (metric === 'ociosidade' ? csd.ociosidade <= meta_ref : csd.saida <= meta_ref)

                        return (
                            <div key={i} className="bg-surface border border-border rounded-sm overflow-hidden flex flex-col group transition-all hover:border-primary/50 shadow-sm">
                                <div className={`h-1.5 w-full ${isGood ? 'bg-emerald-500' : 'bg-rose-500'} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h4 className="text-[13px] font-semibold uppercase text-text-heading tracking-widest">{csd.name}</h4>
                                            <p className="text-[11px] text-text-muted font-medium uppercase mt-1">
                                                <span className={`${csd.acima_meta > 0 ? 'text-emerald-500 font-semibold' : 'text-text-muted'}`}>{csd.acima_meta}</span> / {csd.num_equipes} Aderentes
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xl font-semibold ${isGood ? 'text-emerald-500' : 'text-rose-500'} leading-none`}>
                                                {metric === 'ociosidade' ? csd.ociosidade : (metric === 'saida' ? csd.saida : csd.produtividade)}{unit}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto max-h-[240px] custom-scrollbar space-y-3 pr-2">
                                        {csd.equipes?.map((eq: any, j: number) => {
                                            const val = metric === 'ociosidade' ? (eq.ociosidade || 0) : (metric === 'saida' ? (eq.saida || 0) : eq.prod)
                                            const pct = metric === 'ocupacao' ? Math.min((val / (meta_ref * 1.5)) * 100, 100) : 50
                                            const isEqGood = metric === 'ocupacao' ? val >= meta_ref : val <= meta_ref
                                            const barColor = isEqGood ? 'bg-emerald-500' : 'bg-rose-500'
                                            const txtColor = isEqGood ? 'text-emerald-500' : 'text-rose-500'

                                            return (
                                                <div key={j} className="group/row">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[11px] font-medium text-text-muted uppercase truncate w-64">{eq.equipe}</span>
                                                        <span className={`text-[11px] font-semibold ${txtColor}`}>{val}{unit}</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-surface/50 rounded-full overflow-hidden">
                                                        <div className={`h-full ${barColor} group-hover/row:opacity-100 opacity-60 transition-all duration-700`} style={{ width: `${metric === 'ocupacao' ? pct : 100}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Rankings Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Melhores */}
                <div className="bg-surface border border-border rounded-sm flex flex-col">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-[18px]">workspace_premium</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Ocupação</h3>
                        </div>
                        <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-tighter">Destaques</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-3 pl-4">Equipe</th>
                                    <th className="p-3 text-center">Saída</th>
                                    <th className="p-3 text-center">Ocio</th>
                                    <th className="p-3 text-right pr-4">Ocup</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {dashData.top_melhores?.map((e: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-3 pl-4">
                                            <p className="font-semibold text-text-heading uppercase tracking-tight">{e.equipe}</p>
                                            <p className="text-[10px] text-text-muted font-medium uppercase">{e.csd}</p>
                                        </td>
                                        <td className="p-3 text-center font-semibold tabular-nums text-text-muted/60">{e.saida_base}m</td>
                                        <td className="p-3 text-center font-semibold tabular-nums text-text-muted/60">{e.ociosidade}m</td>
                                        <td className="p-3 text-right pr-4">
                                            <span className="text-xs font-semibold text-emerald-500 tabular-nums">{e.produtividade}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Piores */}
                <div className="bg-surface border border-border rounded-sm flex flex-col">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">trending_down</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Oportunidades</h3>
                        </div>
                        <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Acompanhamento</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[11px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-3 pl-4">Equipe</th>
                                    <th className="p-3 text-center">Saída</th>
                                    <th className="p-3 text-center">Ocio</th>
                                    <th className="p-3 text-right pr-4">Ocup</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {dashData.top_piores?.map((e: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-3 pl-4">
                                            <p className="font-semibold text-text-heading uppercase tracking-tight">{e.equipe}</p>
                                            <p className="text-[9px] text-text-muted font-medium uppercase">{e.csd}</p>
                                        </td>
                                        <td className="p-3 text-center font-medium tabular-nums text-text-muted/60">{e.saida_base}m</td>
                                        <td className="p-3 text-center font-medium tabular-nums text-rose-500">{e.ociosidade}m</td>
                                        <td className="p-3 text-right pr-4">
                                            <p className="text-xs font-semibold text-rose-500 tabular-nums">{e.produtividade}%</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    )
}
