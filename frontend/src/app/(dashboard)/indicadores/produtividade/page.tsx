"use client"

import React, { useState, useEffect, useRef } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { CsdBarChart } from "@/components/dashboard/CsdBarChart"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { PageError } from "@/components/ui/PageError"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { useFilter } from "@/components/providers/FilterProvider"
import { EmptyState } from "@/components/ui/EmptyState"
import { useSortableTable } from "@/hooks/useSortableTable"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { CSVExportButton } from "@/components/ui/CSVExportButton"
import { TeamDrawer } from "@/components/dashboard/TeamDrawer"

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
    const [drawerTeam, setDrawerTeam] = useState<{ equipe: string; csd: string; produtividade: number; ociosidade: number; saida_base: number; retorno_base: number; notas: number; rejeitadas: number; interrompidas: number } | null>(null)
    const [compareMode, setCompareMode] = useState(false)
    const [compareData, setCompareData] = useState<{ name: string; prod: number }[]>([])
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)
    const abortCompareRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("produtividade_ccm")

            let url = `/produtividade/dashboard?periodo=${period}&view=${view}&sector=DEPC-CCM&metric=${metric}`
            if (selectedItem) {
                const param = view === 'csd' ? 'csd' : 'equipe'
                url += `&${param}=${encodeURIComponent(selectedItem)}`
            }

            const response = await api.get(url, { signal: abortRef.current.signal })
            setDashData(response.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados operacionais CCM.')
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
    }, [period, view, selectedItem, metric])

    const handleBarClick = (name: string) => {
        setSelectedItem(prev => prev === name ? null : name)
    }

    const COMPARE_PERIOD_MAP: Record<string, string> = {
        day: "week", week: "month", month: "year", year: "year", latest: "month"
    }

    useEffect(() => {
        if (!compareMode) { setCompareData([]); return }
        if (abortCompareRef.current) abortCompareRef.current.abort()
        abortCompareRef.current = new AbortController()
        const comparePeriod = COMPARE_PERIOD_MAP[period] ?? "month"
        const url = `/produtividade/dashboard?periodo=${comparePeriod}&view=${view}&sector=DEPC-CCM&metric=${metric}`
        api.get(url, { signal: abortCompareRef.current.signal })
            .then(res => {
                const d = res.data
                if (d?.chart?.labels) {
                    const sorted = d.chart.labels
                        .map((lbl: string, i: number) => ({ name: lbl, prod: d.chart.data[i] }))
                        .sort((a: { prod: number }, b: { prod: number }) => b.prod - a.prod)
                    setCompareData(sorted)
                }
            })
            .catch(() => {})
    }, [compareMode, period, view, metric])

    // Hooks must be called unconditionally — before early returns
    const { sorted: sortedMelhores, sortKey: skM, sortDir: sdM, handleSort: hsM } = useSortableTable(dashData?.top_melhores ?? [])
    const { sorted: sortedPiores, sortKey: skP, sortDir: sdP, handleSort: hsP } = useSortableTable(dashData?.top_piores ?? [])

    if (!mounted || (loading && !dashData)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />
    if (error) return <PageError error={`Erro no Motor de Gestão: ${error}`} onRetry={() => loadData()} />
    if (!dashData) return null

    const chartDataRaw = dashData.chart.labels.map((label, i) => ({
        name: label,
        prod: dashData.chart.data[i]
    }))
    const chartData = [...chartDataRaw].sort((a, b) => b.prod - a.prod)

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            <TeamDrawer team={drawerTeam} onClose={() => setDrawerTeam(null)} period={period} sector="DEPC-CCM" />
            {/* Header Area */}
            <PageHeader
                icon="timer"
                title="Gestão de Tempos CCM e Insights"
                insights={dashData.insights}
                sourceFile={dashData.source_file}
                lastUpdate={dashData.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
            />

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
                        <button
                            onClick={() => setCompareMode(prev => !prev)}
                            title="Comparar com período anterior"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-bold uppercase transition-all ${compareMode ? 'bg-primary text-white' : 'border border-border text-text-muted hover:text-primary hover:border-primary/40'}`}
                        >
                            <span className="material-symbols-outlined text-[13px]">compare_arrows</span>
                            Comparar
                        </button>
                    </div>
                </div>

                <div className="flex-1 w-full">
                    <CsdBarChart
                        data={chartData}
                        meta={metric === 'ocupacao' ? 95 : (metric === 'ociosidade' ? 15 : 30)}
                        onBarClick={handleBarClick}
                        selectedBar={selectedItem}
                        unit={metric === 'ocupacao' ? '%' : 'min'}
                        compareData={compareMode && compareData.length > 0 ? compareData : undefined}
                        compareLabel={COMPARE_PERIOD_MAP[period] ?? "Anterior"}
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

                                    <div className="flex flex-col gap-2 bg-slate-50/30 -mx-5 -mb-5 p-4 border-t border-border/50 max-h-[560px] overflow-y-auto custom-scrollbar">
                                        {csd.equipes?.map((eq: any, j: number) => {
                                            const val = metric === 'ociosidade' ? (eq.ociosidade || 0) : (metric === 'saida' ? (eq.saida || 0) : eq.prod)
                                            const pct = metric === 'ocupacao' ? Math.min((val / (meta_ref * 1.5)) * 100, 100) : Math.min((val / meta_ref) * 100, 100)
                                            const isEqGood = metric === 'ocupacao' ? val >= meta_ref : val <= meta_ref
                                            const barFill = isEqGood ? 'bg-blue-800' : 'bg-rose-500'
                                            const txtColor = isEqGood ? 'text-blue-700' : 'text-rose-500'

                                            return (
                                                <div key={j} className="flex flex-col gap-0.5">
                                                    <div className="flex justify-between items-center px-0.5">
                                                        <span className="text-[11px] font-semibold text-text-heading/80 uppercase tracking-tight truncate pr-2">{eq.equipe}</span>
                                                        <span className={`text-[13px] font-semibold tabular-nums ${txtColor}`}>{val}{unit}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-1000 ${barFill}`} style={{ width: `${pct}%` }} />
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
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-tighter">Destaques</span>
                            <CSVExportButton data={sortedMelhores as Record<string, unknown>[]} filename="top_ocupacao" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <SortableHeader label="Equipe" sortKey="equipe" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 pl-4" />
                                    <SortableHeader label="Saída" sortKey="saida_base" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Ocio" sortKey="ociosidade" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Ocup" sortKey="produtividade" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-right pr-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {sortedMelhores && sortedMelhores.length > 0 ? (
                                    sortedMelhores.map((e: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => setDrawerTeam(e)}>
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-0">
                                            <EmptyState icon="groups" title="Sem equipes" description="Nenhuma equipe registrada neste período." />
                                        </td>
                                    </tr>
                                )}
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
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Acompanhamento</span>
                            <CSVExportButton data={sortedPiores as Record<string, unknown>[]} filename="oportunidades_ocupacao" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[11px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <SortableHeader label="Equipe" sortKey="equipe" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 pl-4" />
                                    <SortableHeader label="Saída" sortKey="saida_base" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Ocio" sortKey="ociosidade" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Ocup" sortKey="produtividade" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-right pr-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {sortedPiores && sortedPiores.length > 0 ? (
                                    sortedPiores.map((e: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => setDrawerTeam(e)}>
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-0">
                                            <EmptyState icon="groups" title="Sem equipes" description="Nenhuma equipe registrada neste período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    )
}
