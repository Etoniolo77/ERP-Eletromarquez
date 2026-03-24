"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { TrendLineChart } from "@/components/dashboard/TrendLineChart"
import { ParetoChart } from "@/components/dashboard/ParetoChart"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { PageError } from "@/components/ui/PageError"
import { EmptyState } from "@/components/ui/EmptyState"
import { useFilter } from "@/components/providers/FilterProvider"

interface RejeicoesDashboard {
    period_label: string
    source_file: string
    last_update: string
    stats: {
        total: number
        media_dia: number
        media_prev: number
        aderencia_pct: number
        status_resumo: { auditadas: number; pendentes: number }
        kpi1: any; kpi2: any; kpi3: any; kpi4: any;
    }
    top_equipes: { Equipe: string; Qtd: number }[]
    top_eletricistas: { Equipe: string; Qtd: number }[]
    pareto: { Motivo: string; Qtd: number; Pct: number }[]
    backoffice_data: { Backoffice: string; Procedente: number; Improcedente: number; "Em Análise": number }[]
    global_status: Record<string, number>
    history: { MesAno: string; Qtd: number }[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
    recent_records?: { data: string; status: string; equipe: string; nota: string; motivo: string; observacao: string; regional: string }[]
}

const PERIOD_OPTIONS = [
    { value: "7d", label: "7 Dias" },
    { value: "month", label: "Mês Atual" },
    { value: "last_month", label: "Mês Anterior" },
    { value: "year", label: "Ano" },
]

export default function RejeicoesPage() {
    const { period } = useFilter()
    const [data, setData] = useState<RejeicoesDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [searchTerm, setSearchTerm] = useState<string>("")
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("rejeicoes")
            const response = await api.get(`/rejeicoes/dashboard?periodo=${period}`, { signal: abortRef.current.signal })
            setData(response.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados.')
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
    }, [period])

    // Todos os hooks ANTES dos early returns
    const allRecords = useMemo(() => data?.recent_records ?? [], [data])
    const statusOptions = useMemo(() => Array.from(new Set(allRecords.map(r => r.status))).filter(Boolean).sort(), [allRecords])
    const filteredRecords = useMemo(() => {
        return allRecords.filter(r => {
            const matchStatus = statusFilter === "ALL" || r.status === statusFilter
            const s = searchTerm.toLowerCase()
            const matchSearch = !s || r.equipe.toLowerCase().includes(s) || r.motivo.toLowerCase().includes(s) || r.regional?.toLowerCase().includes(s)
            return matchStatus && matchSearch
        })
    }, [allRecords, statusFilter, searchTerm])

    if (!mounted || (loading && !data)) return <DashboardSkeleton kpis={3} charts={1} tables={2} />
    if (error) return <PageError error={`Falha no rastreio de qualidade: ${error}`} onRetry={() => loadData()} />
    if (!data) return null

    const stats = data?.stats;
    const historyData = (data?.history ?? []).map(h => ({ name: h.MesAno, value: h.Qtd }));
    const paretoData = (data?.pareto ?? []).map(p => ({ name: p.Motivo, value: p.Qtd, pct: p.Pct }));

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon="analytics"
                title="Inteligência de Qualidade e Insights"
                insights={data?.insights ?? []}
                fallbackText={`Análise de rejeições consolidada para o período de ${data?.period_label ?? "..."}.`}
                sourceFile={data?.source_file ?? "API"}
                lastUpdate={data?.last_update ?? new Date().toISOString()}
                onRefresh={() => loadData(true)}
                loading={loading}
                showPeriodSelector={true}
            />

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Volume Total"
                    value={(stats?.total ?? 0).toString()}
                    target="Notas Reprovadas"
                    icon="receipt_long"
                />
                <KpiCard
                    title="Média Diária"
                    value={(stats?.media_dia ?? 0).toFixed(1)}
                    variation={`${(( (stats?.media_dia ?? 0) - (stats?.media_prev ?? 0) ) / (stats?.media_prev || 1) * 100).toFixed(1)}%`}
                    target="vs Anterior"
                    icon="monitoring"
                />
                <KpiCard
                    title="Aderência Auditoria"
                    value={`${(stats?.aderencia_pct ?? 0).toFixed(1)}%`}
                    target={`${stats?.status_resumo?.auditadas ?? 0} Audit`}
                    icon="fact_check"
                    colorValue={(stats?.aderencia_pct ?? 0) >= 90 ? 'success' : 'warning'}
                />
                <KpiCard
                    title="Pendências"
                    value={(stats?.status_resumo?.pendentes ?? 0).toString()}
                    target="Em Análise"
                    icon="history"
                    colorValue={(stats?.status_resumo?.pendentes ?? 0) > 5 ? 'danger' : 'warning'}
                />
            </div>

            {/* Main Trend Chart */}
            <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px]">
                <div className="flex items-center gap-2 mb-8">
                    <span className="material-symbols-outlined text-rose-500 text-[18px]">show_chart</span>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Incidência Temporal de Rejeições</h3>
                </div>
                <div className="flex-1 w-full">
                    <TrendLineChart
                        data={historyData}
                        tooltipLabel="Rejeições"
                        color="#f43f5e"
                        isCurrency={false}
                    />
                </div>
            </div>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Ranking Equipes */}
                <div className="bg-surface border border-border rounded-sm flex flex-col">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-rose-500/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500">group</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Equipes Ofensoras</h3>
                        </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                        {(data?.top_equipes ?? []).length > 0 ? (data?.top_equipes ?? []).slice(0, 10).map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface/50 border border-transparent hover:border-rose-500/20 transition-all group rounded-sm min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-rose-500/30 w-5">#{idx + 1}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-[13px] text-text-heading uppercase truncate">{t?.Equipe ?? "N/D"}</span>
                                        <span className="text-[9px] text-text-muted font-medium uppercase">Equipe de Turma</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-semibold text-rose-500 tabular-nums">{t?.Qtd ?? 0}</span>
                                    <span className="text-[9px] font-semibold text-text-muted ml-1 uppercase">Reprovações</span>
                                </div>
                            </div>
                        )) : <div className="py-12 text-center text-text-muted/30 uppercase tracking-widest text-[10px]">Sem registros</div>}
                    </div>
                </div>

                {/* Ranking Operadores */}
                <div className="bg-surface border border-border rounded-sm flex flex-col">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-amber-500/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">person</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Operadores Ofensores</h3>
                        </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                        {(data?.top_eletricistas ?? []).length > 0 ? (data?.top_eletricistas ?? []).slice(0, 10).map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface/50 border border-transparent hover:border-amber-500/20 transition-all group rounded-sm min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-amber-500/30 w-5">#{idx + 1}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-[13px] text-text-heading uppercase truncate">{t?.Equipe ?? "N/D"}</span>
                                        <span className="text-[9px] text-text-muted font-medium uppercase">Eletricista Responsável</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-semibold text-amber-500 tabular-nums">{t?.Qtd ?? 0}</span>
                                    <span className="text-[9px] font-semibold text-text-muted ml-1 uppercase">Reprovações</span>
                                </div>
                            </div>
                        )) : <div className="py-12 text-center text-text-muted/30 uppercase tracking-widest text-[10px]">Sem registros</div>}
                    </div>
                </div>
            </div>

            {/* Pareto & Auditoria */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Pareto Chart */}
                <div className="lg:col-span-8 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px]">
                    <div className="flex items-center gap-2 mb-8">
                        <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Pareto: Motivos Predominantes</h3>
                    </div>
                    <div className="flex-1 w-full relative">
                        <ParetoChart data={paretoData} />
                    </div>
                </div>

                {/* Backoffice */}
                <div className="lg:col-span-4 bg-surface border border-border rounded-sm flex flex-col overflow-hidden h-[400px]">
                    <div className="p-4 border-b border-border bg-emerald-500/5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Equipe de Auditoria</h3>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-3 pl-4 min-w-[200px]">Auditor</th>
                                    <th className="p-3 text-center">PROC.</th>
                                    <th className="p-3 text-center">IMP.</th>
                                    <th className="p-3 text-center text-amber-500">PEND.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {(data?.backoffice_data ?? []).length > 0 ? (
                                    (data?.backoffice_data ?? [])
                                        .filter(b => isNaN(Number(b?.Backoffice))) 
                                        .map((b, idx) => (
                                            <tr key={idx} className="hover:bg-surface/50 transition-colors group">
                                                <td className="p-3 pl-4 min-w-[200px]">
                                                    <p className="font-medium text-[13px] text-text-heading uppercase group-hover:text-primary transition-colors">{b?.Backoffice ?? "N/D"}</p>
                                                </td>
                                                <td className="p-3 text-center text-emerald-500 font-medium tabular-nums text-[13px]">{b?.Procedente ?? 0}</td>
                                                <td className="p-3 text-center text-rose-500 font-medium tabular-nums text-[13px]">{b?.Improcedente ?? 0}</td>
                                                <td className="p-3 text-center text-amber-500 font-semibold tabular-nums text-[13px] bg-amber-500/5">{b?.["Em Análise"] ?? 0}</td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-0">
                                            <EmptyState icon="leaderboard" title="Sem classificação disponível" description="Nenhum dado de auditoria disponível para este período." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Rejections Table */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-border bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">list_alt</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Lista de Rejeições</h3>
                        <span className="ml-2 px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded-sm">{filteredRecords.length}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Search */}
                        <div className="flex items-center gap-1.5 bg-background border border-border px-2 py-1.5 rounded-sm min-w-[180px]">
                            <span className="material-symbols-outlined text-[14px] text-text-muted">search</span>
                            <input
                                type="text"
                                placeholder="Equipe, motivo, regional..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] font-semibold uppercase tracking-wider text-text-heading placeholder:text-text-muted/50 w-full"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="text-text-muted hover:text-rose-500 transition-colors">
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                            )}
                        </div>
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="bg-background border border-border px-2 py-1.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider outline-none text-text-heading cursor-pointer"
                        >
                            <option value="ALL">Todos Status</option>
                            {statusOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto h-[500px] overflow-y-auto custom-scrollbar relative">
                    <table className="w-full text-left">
                        <thead className="bg-surface text-[9px] font-semibold uppercase text-text-muted border-b border-border sticky top-0 z-10">
                            <tr>
                                <th className="p-3 pl-4 whitespace-nowrap">Data</th>
                                <th className="p-3 whitespace-nowrap">Regional</th>
                                <th className="p-3 whitespace-nowrap">Status</th>
                                <th className="p-3 whitespace-nowrap">Equipe</th>
                                <th className="p-3 whitespace-nowrap">Nota</th>
                                <th className="p-3">Motivo</th>
                                <th className="p-3">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[11px]">
                            {(filteredRecords ?? []).length > 0 ? (
                                (filteredRecords ?? []).map((r, idx) => (
                                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-3 pl-4 font-medium tabular-nums text-text-muted whitespace-nowrap">{r?.data ?? "N/D"}</td>
                                        <td className="p-3 text-[10px] font-semibold text-text-muted uppercase whitespace-nowrap">{r?.regional ?? "N/D"}</td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-sm font-semibold uppercase text-[9px] ${r?.status === 'Procedente' ? 'bg-emerald-500/10 text-emerald-600' : r?.status === 'Improcedente' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'}`}>
                                                {r?.status ?? "Pendente"}
                                            </span>
                                        </td>
                                        <td className="p-3 font-semibold text-text-heading uppercase whitespace-nowrap">{r?.equipe ?? "N/D"}</td>
                                        <td className="p-3 tabular-nums text-text-muted font-medium whitespace-nowrap">{r?.nota ?? "N/D"}</td>
                                        <td className="p-3 text-text-heading font-medium leading-tight max-w-[280px]">{r?.motivo ?? "N/D"}</td>
                                        <td className="p-3 text-text-muted italic max-w-[320px]">{r?.observacao ?? ""}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-0">
                                        <EmptyState icon="warning" title="Nenhum ofensor identificado" description="Nenhum registro encontrado para os filtros selecionados." />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}

        </div>
    )
}
