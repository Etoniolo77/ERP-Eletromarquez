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
        num_dias: number
    }
    chart: {
        labels: string[]
        data: number[]
    }
    charts: {
        [key: string]: {
            labels: string[]
            data: number[]
            prev1?: number[]
            prev2?: number[]
            labels_prev?: string[]
        }
    }
    top_desvios: { motivo: string, qtd: number }[]
    top_piores: { equipe: string, csd: string, produtividade: number, ociosidade: number, saida_base: number, retorno_base: number, notas: number, rejeitadas: number, interrompidas: number }[]
    top_melhores: { equipe: string, csd: string, produtividade: number, notas: number, saida_base: number, retorno_base: number, rejeitadas: number, interrompidas: number, ociosidade: number }[]
    breakdown_csd: {
        name: string
        num_equipes: number
        produtividade: number
        ociosidade: number
        desvios: number
        saida: number
        equipes: { equipe: string, prod: number, ociosidade?: number, saida?: number, desvios?: number }[]
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
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("produtividade_ccm")

            // A métrica passada aqui agora afeta apenas o ranking e breakdown
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


    // Hooks must be called unconditionally — before early returns
    const { sorted: sortedMelhores, sortKey: skM, sortDir: sdM, handleSort: hsM } = useSortableTable(dashData?.top_melhores ?? [])
    const { sorted: sortedPiores, sortKey: skP, sortDir: sdP, handleSort: hsP } = useSortableTable(dashData?.top_piores ?? [])

    if (!mounted || (loading && !dashData)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />
    if (error) return <PageError error={`Erro no Motor de Gestão: ${error}`} onRetry={() => loadData()} />
    if (!dashData) return null

    return (
        <div className="p-4 pt-1 pb-2 space-y-2 animate-in fade-in duration-700">
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
                showPeriodSelector={true}
            />

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Aderência Geral"
                    value={`${dashData.stats.atingimento_meta}%`}
                    variation={dashData.stats.trend_prod}
                    target="Equipes na Meta"
                    icon="verified"
                />
                <KpiCard
                    title="Ociosidade (Média)"
                    value={`${Math.round(dashData.stats.media_ociosidade || 0)} min`}
                    variation={dashData.stats.trend_ociosidade || 0}
                    target={`Acumulado: ${Math.round(dashData.stats.total_ociosidade_hrs)}h`}
                    icon="schedule"
                    trendMode="down-is-good"
                />
                <KpiCard
                    title="Desvios (Média)"
                    value={`${Math.round(dashData.stats.total_desvios_hrs * 60 / (dashData.stats.total_equipes || 1) / (dashData.stats.num_dias || 1))} min`}
                    target={`Total: ${Math.round(dashData.stats.total_desvios_hrs)}h`}
                    icon="warning"
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
                     {/* Sequence of 3 Operational Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { id: 'ocupacao', label: 'Ocupação Operacional', meta: 95, unit: '%', icon: 'trending_up', color: 'text-emerald-500' },
                    { id: 'ociosidade', label: 'Tempo de Ociosidade', meta: 15, unit: 'min', icon: 'schedule', color: 'text-amber-500' },
                    { id: 'desvios', label: 'Desvios de Percurso', meta: 10, unit: 'min', icon: 'warning', color: 'text-rose-500' }
                ].map((m) => {
                    const labels = dashData.charts[m.id].labels
                    const current = dashData.charts[m.id].data
                    const chartData = labels.map((label, i) => ({
                        name: label,
                        prod: current[i]
                    })).sort((a, b) => m.id === 'ocupacao' ? b.prod - a.prod : a.prod - b.prod)

                    return (
                        <div key={m.id} className="bg-surface border border-border px-4 py-3 rounded-sm flex flex-col h-[320px] shadow-sm hover:border-primary/30 transition-all">
                            <div className="flex flex-col gap-0.5 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-[16px] ${m.color}`}>
                                        {m.icon}
                                    </span>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-heading">
                                        {m.label}
                                    </h3>
                                </div>
                                <p className="text-[9px] text-text-muted font-medium uppercase">Meta: {m.meta}{m.unit}</p>
                            </div>
                            <div className="flex-1 w-full min-h-0">
                                <CsdBarChart
                                    data={chartData}
                                    meta={m.meta}
                                    unit={m.unit}
                                    variant="status"
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Main Interactive Chart Sections (Selection affects table breakdown) */}
            <div className="bg-surface border border-border p-4 rounded-sm flex flex-col shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-text-heading">
                                Análise Detalhada: {metric === 'ocupacao' ? 'Produtividade' : metric === 'ociosidade' ? 'Ociosidade' : 'Desvios'}
                            </h3>
                            <p className="text-[10px] text-text-muted font-medium uppercase mt-0.5">Clique nas barras para filtrar por Regional</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-0.5 rounded-sm flex gap-0.5">
                            {[
                                { id: 'ocupacao', label: 'PROD' },
                                { id: 'ociosidade', label: 'OCIO' },
                                { id: 'desvios', label: 'DESV' },
                                { id: 'saida', label: 'SAÍDA' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setMetric(btn.id)}
                                    className={`text-[9px] font-bold uppercase px-3 py-1 rounded-sm transition-all ${metric === btn.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-slate-200'}`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                        <div className="h-4 w-px bg-border mx-1" />
                        <div className="bg-slate-100 p-0.5 rounded-sm flex gap-0.5">
                            <button
                                onClick={() => { setView('csd'); setSelectedItem(null); }}
                                className={`text-[9px] uppercase font-bold px-3 py-1 rounded-sm transition-all ${view === 'csd' ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-200'}`}
                            >
                                Regional
                            </button>
                            <button
                                onClick={() => { setView('equipe'); setSelectedItem(null); }}
                                className={`text-[9px] uppercase font-bold px-3 py-1 rounded-sm transition-all ${view === 'equipe' ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-200'}`}
                            >
                                Equipes
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    <CsdBarChart
                        data={dashData.charts[metric].labels.map((l, i) => ({
                            name: l,
                            prod: dashData.charts[metric].data[i]
                        })).sort((a, b) => metric === 'ocupacao' ? b.prod - a.prod : a.prod - b.prod)}
                        meta={metric === 'ocupacao' ? 95 : metric === 'ociosidade' ? 15 : 10}
                        onBarClick={handleBarClick}
                        selectedBar={selectedItem}
                        unit={metric === 'ocupacao' ? '%' : 'min'}
                        compareData={compareMode && dashData.charts[metric].prev1 ? dashData.charts[metric].labels.map((l, i) => ({ name: l, prod: dashData.charts[metric].prev1![i] })) : undefined}
                        compareLabel={dashData.charts[metric].labels_prev?.[0] ?? "Anterior"}
                    />
                </div>
            </div>
        

            {/* Regional Breakdown Grid */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest flex-shrink-0">
                        {metric === 'ocupacao' ? 'Produtividade' : metric === 'ociosidade' ? 'Ociosidade' : metric === 'desvios' ? 'Desvios' : 'Saída de Base'} por Regional CCM
                    </h2>
                    <div className="h-px flex-1 bg-border/20" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashData.breakdown_csd?.map((csd: any, i: number) => {
                        const unit = metric === 'ocupacao' ? '%' : 'min'
                        const meta_ref = metric === 'ocupacao' ? 95 : metric === 'desvios' ? 10 : 30
                        const isGood = metric === 'ocupacao' ? csd.produtividade >= meta_ref : (metric === 'ociosidade' ? csd.ociosidade <= meta_ref : metric === 'desvios' ? (csd.desvios || 0) <= meta_ref : csd.saida <= meta_ref)

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
                                                {metric === 'ociosidade' ? csd.ociosidade : (metric === 'saida' ? csd.saida : metric === 'desvios' ? csd.desvios : csd.produtividade)}{unit}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 bg-slate-50/30 -mx-5 -mb-5 p-4 border-t border-border/50 max-h-[560px] overflow-y-auto custom-scrollbar">
                                        {csd.equipes?.map((eq: any, j: number) => {
                                            const val = metric === 'ociosidade' ? (eq.ociosidade || 0) : (metric === 'saida' ? (eq.saida || 0) : metric === 'desvios' ? (eq.desvios || 0) : eq.prod)
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
