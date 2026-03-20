"use client"

import React, { useState, useEffect, useRef } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { CsdBarChart } from "@/components/dashboard/CsdBarChart"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { PageHeader } from "@/components/dashboard/PageHeader"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"

interface DashboardData {
    meta_prod: number
    periodo_ref: string
    source_file: string
    last_update: string
    stats: {
        media_prod: number
        trend_prod: number
        media_ociosidade?: number
        trend_ociosidade?: number
        total_ociosidade_hrs: number
        total_desvios_hrs: number
        total_notas: number
        total_rejeicoes: number
        total_equipes: number
        atingimento_meta: number
        num_dias?: number
    }
    chart: {
        labels: string[]
        data: number[]
    }
    top_desvios: { motivo: string, qtd: number }[]
    top_piores: { equipe: string, csd: string, produtividade: number, ociosidade: number, notas: number, rejeitadas: number, interrompidas: number }[]
    top_melhores: { equipe: string, csd: string, produtividade: number, notas: number, ociosidade: number, rejeitadas: number, interrompidas: number }[]
    breakdown_csd: {
        name: string
        num_equipes: number
        acima_meta: number
        produtividade: number
        ociosidade: number
        desvios?: number
        equipes: { equipe: string, prod: number }[]
    }[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

import { useFilter } from "@/components/providers/FilterProvider"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"
import { useSortableTable } from "@/hooks/useSortableTable"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { CSVExportButton } from "@/components/ui/CSVExportButton"
import { TeamDrawer } from "@/components/dashboard/TeamDrawer"

export default function TurmasPage() {
    const { period } = useFilter()
    const [dashData, setDashData] = useState<DashboardData | null>(null)
    const [view, setView] = useState<string>("csd")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [drawerTeam, setDrawerTeam] = useState<{ equipe: string; csd: string; produtividade: number; ociosidade: number; notas: number; rejeitadas: number; interrompidas: number } | null>(null)
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("produtividade")
            const response = await api.get(`/produtividade/dashboard?periodo=${period}&view=${view}`, { signal: abortRef.current.signal })
            setDashData(response.data)
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
    }, [period, view])

    // Hooks must be called unconditionally — before early returns
    const { sorted: sortedMelhores, sortKey: skM, sortDir: sdM, handleSort: hsM } = useSortableTable(dashData?.top_melhores ?? [])
    const { sorted: sortedPiores, sortKey: skP, sortDir: sdP, handleSort: hsP } = useSortableTable(dashData?.top_piores ?? [])

    if (!mounted || (loading && !dashData)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />

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
        <div className="p-4 pt-1 pb-2 space-y-2 animate-in fade-in duration-700">
            <TeamDrawer team={drawerTeam} onClose={() => setDrawerTeam(null)} period={period} />
            {/* Header Area */}
            <PageHeader
                icon="analytics"
                title="Gestão de Tempos CCM e Insights"
                insights={dashData.insights}
                fallbackText={`Monitoramento Tático e Produtividade consolidado.`}
                sourceFile={dashData.source_file}
                lastUpdate={dashData.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
                showPeriodSelector={true}
            />

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Produtividade"
                    value={`${dashData.stats.media_prod}%`}
                    variation={dashData.stats.trend_prod}
                    target={`${dashData.meta_prod}%`}
                    icon="trending_up"
                />
                <KpiCard
                    title="Ociosidade"
                    value={`${Math.round(dashData.stats.total_ociosidade_hrs)}h`}
                    variation="-2.4%"
                    target="< 40h"
                    icon="schedule"
                    trendMode="down-is-good"
                />
                <KpiCard
                    title="Desvios"
                    value={`${Math.round(dashData.stats.total_desvios_hrs)}h`}
                    variation="+0.8%"
                    target="< 15h"
                    icon="error"
                    trendMode="down-is-good"
                />

                {/* Alert Card (Transformed from Top Insight) */}
                <div className="bg-rose-500/5 border border-rose-500/20 p-4 min-h-[95px] rounded-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-rose-500 text-[18px]">warning</span>
                        <h4 className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400 tracking-wider">Alerta de Críticos</h4>
                    </div>
                    <p className="text-[11px] font-semibold text-text-muted leading-snug">
                        {dashData.stats.atingimento_meta < 100 ?
                            `Atenção: Aderência à meta regional está em ${dashData.stats.atingimento_meta.toFixed(1)}%. Verifique o Ranking Regional.` :
                            "Nenhum alerta crítico de produtividade detectado para o período atual."
                        }
                    </p>
                </div>
            </div>

            {/* Sequence of 3 Operational Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { id: 'ocupacao', label: 'Produtividade', meta: dashData.meta_prod, unit: '%', icon: 'trending_up', color: 'text-emerald-500' },
                    { id: 'ociosidade', label: 'Média Ociosidade', meta: 15, unit: 'min', icon: 'schedule', color: 'text-amber-500' },
                    { id: 'desvios', label: 'Média Desvios', meta: 10, unit: 'min', icon: 'error', color: 'text-rose-500' }
                ].map((m) => {
                    // Adaptando dados de dashData para o formato de gráfico (convertendo h acumulada para min médio)
                    const nDias = dashData.stats.num_dias || 1
                    const chartData = m.id === 'ocupacao' ? 
                        dashData.chart.labels.map((l, i) => ({ name: l, prod: dashData.chart.data[i] })) :
                        dashData.breakdown_csd.map(c => ({ 
                            name: c.name, 
                            prod: m.id === 'ociosidade' ? (c.ociosidade || 0) : (c.desvios || 0)
                        })) 

                    return (
                        <div key={m.id} className="bg-surface border border-border px-4 py-3 rounded-sm flex flex-col h-[320px] shadow-sm hover:border-primary/30 transition-all">
                            <div className="flex flex-col gap-0.5 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-[16px] ${m.color}`}>
                                        {m.icon}
                                    </span>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-heading">
                                        {m.label} por Regional
                                    </h3>
                                </div>
                                <p className="text-[9px] text-text-muted font-medium uppercase">Meta: {m.meta}{m.unit}</p>
                            </div>
                            <div className="flex-1 w-full min-h-0">
                                <CsdBarChart
                                    data={chartData.sort((a, b) => b.prod - a.prod)}
                                    meta={m.meta}
                                    unit={m.unit}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Main Primary Chart Board */}
            <div className="bg-surface border border-border px-4 py-2 rounded-sm flex flex-col h-[480px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">query_stats</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Produtividade</h3>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10">
                            <button
                                onClick={() => setView('csd')}
                                className={`text-[11px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${view === 'csd' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                CSD
                            </button>
                            <button
                                onClick={() => setView('equipe')}
                                className={`text-[11px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${view === 'equipe' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}
                            >
                                Equipes
                            </button>
                        </div>
                        <span className="px-2 py-1 bg-rose-500 text-white text-[11px] font-semibold uppercase rounded-sm border-none shadow-lg shadow-rose-500/10">Goal: {dashData.meta_prod}%</span>
                    </div>
                </div>

                <div className="flex-1 w-full">
                    <CsdBarChart data={chartData} meta={dashData.meta_prod} unit="%" />
                </div>
            </div>

            {/* Rankings Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Melhores */}
                <div className="bg-surface border border-border rounded-sm flex flex-col">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-[18px]">workspace_premium</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Produtividade</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-tighter">Ranking Positivo</span>
                            <CSVExportButton data={sortedMelhores as Record<string, unknown>[]} filename="top_produtividade" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <SortableHeader label="Equipe" sortKey="equipe" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 pl-4 min-w-[300px]" />
                                    <SortableHeader label="Exec" sortKey="notas" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Rej" sortKey="rejeitadas" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Inter" sortKey="interrompidas" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Ocio" sortKey="ociosidade" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-center" />
                                    <SortableHeader label="Prod" sortKey="produtividade" activeSortKey={skM} sortDir={sdM} onSort={hsM} className="p-3 text-right pr-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {sortedMelhores && sortedMelhores.length > 0 ? (
                                    sortedMelhores.map((e, idx: number) => (
                                        <tr key={idx} className="hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => setDrawerTeam(e as any)}>
                                            <td className="p-3 pl-4 min-w-[300px]">
                                                <p className="font-semibold text-text-heading uppercase tracking-tight">{e.equipe}</p>
                                                <p className="text-[10px] text-text-muted font-medium uppercase">{e.csd}</p>
                                            </td>
                                            <td className="p-3 text-center font-semibold tabular-nums">{e.notas}</td>
                                            <td className="p-3 text-center font-semibold tabular-nums text-rose-500">{e.rejeitadas}</td>
                                            <td className="p-3 text-center font-semibold tabular-nums text-amber-500">{e.interrompidas}</td>
                                            <td className="p-3 text-center font-semibold tabular-nums text-text-muted/60">{e.ociosidade}m</td>
                                            <td className="p-3 text-right pr-4">
                                                <span className="text-xs font-semibold text-emerald-500 tabular-nums">{e.produtividade}%</span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-0">
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
                            <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Crítico</span>
                            <CSVExportButton data={sortedPiores as Record<string, unknown>[]} filename="oportunidades_produtividade" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[11px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <SortableHeader label="Equipe" sortKey="equipe" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 pl-4 min-w-[300px]" />
                                    <SortableHeader label="Exec" sortKey="notas" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Rej" sortKey="rejeitadas" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Inter" sortKey="interrompidas" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Ocio" sortKey="ociosidade" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-center" />
                                    <SortableHeader label="Prod" sortKey="produtividade" activeSortKey={skP} sortDir={sdP} onSort={hsP} className="p-3 text-right pr-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {sortedPiores && sortedPiores.length > 0 ? (
                                    sortedPiores.map((e, idx: number) => (
                                        <tr key={idx} className="hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => setDrawerTeam(e as any)}>
                                            <td className="p-3 pl-4 min-w-[300px]">
                                                <p className="font-semibold text-text-heading uppercase tracking-tight">{e.equipe}</p>
                                                <p className="text-[9px] text-text-muted font-medium uppercase">{e.csd}</p>
                                            </td>
                                            <td className="p-3 text-center font-medium tabular-nums">{e.notas}</td>
                                            <td className="p-3 text-center font-medium tabular-nums text-rose-500">{e.rejeitadas}</td>
                                            <td className="p-3 text-center font-medium tabular-nums text-amber-500">{e.interrompidas}</td>
                                            <td className="p-3 text-center font-medium tabular-nums text-rose-500">{e.ociosidade}m</td>
                                            <td className="p-3 text-right pr-4">
                                                <p className="text-xs font-semibold text-rose-500 tabular-nums">{e.produtividade}%</p>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-0">
                                            <EmptyState icon="groups" title="Sem equipes" description="Nenhuma equipe registrada neste período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Regional Breakdown Grid */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest flex-shrink-0">Auditando Equipes por CSD</h2>
                    <div className="h-px flex-1 bg-border/20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashData.breakdown_csd?.map((csd, i: number) => {
                        const isAbove = csd.produtividade >= dashData.meta_prod
                        return (
                            <div key={i} className="bg-surface border border-border rounded-sm overflow-hidden flex flex-col group transition-all hover:border-primary/50 shadow-sm">
                                <div className={`h-1.5 w-full ${isAbove ? 'bg-emerald-500' : 'bg-rose-500'} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h4 className="text-[13px] font-semibold uppercase text-text-heading tracking-widest">{csd.name}</h4>
                                            <p className="text-[11px] text-text-muted font-medium uppercase mt-1">
                                                <span className={`${csd.acima_meta > 0 ? 'text-emerald-500 font-semibold' : 'text-text-muted'}`}>{csd.acima_meta}</span> / {csd.num_equipes} Aderentes
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xl font-semibold ${isAbove ? 'text-emerald-500' : 'text-rose-500'} leading-none`}>{csd.produtividade}%</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto max-h-[240px] custom-scrollbar space-y-3 pr-2">
                                        {csd.equipes?.map((eq, j: number) => {
                                            const pct = Math.min((eq.prod / (dashData.meta_prod * 1.5)) * 100, 100)
                                            const isEqAbove = eq.prod >= dashData.meta_prod
                                            const barColor = isEqAbove ? 'bg-emerald-500' : 'bg-rose-500'
                                            const txtColor = isEqAbove ? 'text-emerald-500' : 'text-rose-500'

                                            return (
                                                <div key={j} className="group/row">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[11px] font-medium text-text-muted uppercase truncate w-64">{eq.equipe}</span>
                                                        <span className={`text-[11px] font-semibold ${txtColor}`}>{eq.prod}%</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-surface/50 rounded-full overflow-hidden">
                                                        <div className={`h-full ${barColor} group-hover/row:opacity-100 opacity-60 transition-all duration-700`} style={{ width: `${pct}%` }} />
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

            {/* Footer Removed by User Request */}
        </div>
    )
}

