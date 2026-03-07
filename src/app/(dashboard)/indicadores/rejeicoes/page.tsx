"use client"

import React, { useState, useEffect } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { TrendLineChart } from "@/components/dashboard/TrendLineChart"
import { ParetoChart } from "@/components/dashboard/ParetoChart"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { RefreshButton } from "@/components/ui/RefreshButton"
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
    recent_records?: { data: string; status: string; equipe: string; nota: string; motivo: string; observacao: string }[]
}

export default function RejeicoesPage() {
    const { period } = useFilter()
    const [data, setData] = useState<RejeicoesDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    const loadData = async (forceSync = false) => {
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("rejeicoes")
            const response = await api.get(`/rejeicoes/dashboard?periodo=${period}`)
            setData(response.data)
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [period])

    if (!mounted || (loading && !data)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-semibold text-text-muted animate-pulse uppercase tracking-wider">Auditando Qualidade Operacional...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-wider text-center">Falha no rastreio de qualidade: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/20 transition-all hover:scale-105">Recarregar</button>
        </div>
    )
    if (!data) return null

    const stats = data.stats;
    const historyData = data.history.map(h => ({ name: h.MesAno, value: h.Qtd }));
    const paretoData = data.pareto.map(p => ({ name: p.Motivo, value: p.Qtd, pct: p.Pct }));

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area - Best in Class Design */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                <div className="flex-1 bg-surface border border-border p-4 min-h-[105px] rounded-sm flex items-stretch gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                        <span className="material-symbols-outlined text-primary text-[28px]">analytics</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 className="text-[9px] font-semibold uppercase text-text-muted tracking-widest">Inteligência de Qualidade e Insights</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {data.insights?.slice(0, 2).map((ins: any, i: number) => (
                                <p key={i} className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                    {ins.text.replace(/(\d+(\.\d+)?)(%)/g, (_match: string, p1: string) => `${parseFloat(p1).toFixed(1)}%`)}
                                </p>
                            )) || (
                                    <p className="text-[12px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                        Análise de rejeições consolidada para o período de {data.period_label}.
                                    </p>
                                )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end justify-center gap-2 min-w-[240px]">
                    <div className="flex items-center gap-3">
                        <RefreshButton onClick={() => loadData(true)} loading={loading} />
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-text-muted font-medium uppercase tracking-tight leading-relaxed">
                            Arquivo: <span className="text-text-heading/70 font-medium">{data.source_file}</span>
                        </p>
                        <p className="text-[9px] text-text-muted font-medium uppercase tracking-tight leading-relaxed">
                            Último Update: <span className="text-text-heading/70 font-medium">{data.last_update}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Volume Total"
                    value={stats.total.toString()}
                    target="Notas Reprovadas"
                    icon="receipt_long"
                />
                <KpiCard
                    title="Média Diária"
                    value={stats.media_dia.toFixed(1)}
                    variation={`${((stats.media_dia - stats.media_prev) / (stats.media_prev || 1) * 100).toFixed(1)}%`}
                    target="vs Anterior"
                    icon="monitoring"
                />
                <KpiCard
                    title="Aderência Auditoria"
                    value={`${stats.aderencia_pct.toFixed(1)}%`}
                    target={`${stats.status_resumo.auditadas} Audit`}
                    icon="fact_check"
                    colorValue={stats.aderencia_pct >= 90 ? 'success' : 'warning'}
                />
                <KpiCard
                    title="Pendências"
                    value={stats.status_resumo.pendentes.toString()}
                    target="Em Análise"
                    icon="history"
                    colorValue={stats.status_resumo.pendentes > 5 ? 'danger' : 'warning'}
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
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top 5 Equipes Ofensoras</h3>
                        </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                        {data.top_equipes.length > 0 ? data.top_equipes.slice(0, 5).map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface/50 border border-transparent hover:border-rose-500/20 transition-all group rounded-sm min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-rose-500/30 w-5">#{idx + 1}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-[13px] text-text-heading uppercase truncate">{t.Equipe}</span>
                                        <span className="text-[9px] text-text-muted font-medium uppercase">Equipe de Turma</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-semibold text-rose-500 tabular-nums">{t.Qtd}</span>
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
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top 5 Operadores Ofensores</h3>
                        </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                        {data.top_eletricistas.length > 0 ? data.top_eletricistas.slice(0, 5).map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-surface/50 border border-transparent hover:border-amber-500/20 transition-all group rounded-sm min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-amber-500/30 w-5">#{idx + 1}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-[13px] text-text-heading uppercase truncate">{t.Equipe}</span>
                                        <span className="text-[9px] text-text-muted font-medium uppercase">Eletricista Responsável</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-semibold text-amber-500 tabular-nums">{t.Qtd}</span>
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
                                {data.backoffice_data.length > 0 ? data.backoffice_data
                                    .filter(b => isNaN(Number(b.Backoffice))) // Remove IDs numéricos (1.0, 2.0, etc)
                                    .map((b, idx) => (
                                        <tr key={idx} className="hover:bg-surface/50 transition-colors group">
                                            <td className="p-3 pl-4 min-w-[200px]">
                                                <p className="font-medium text-[13px] text-text-heading uppercase group-hover:text-primary transition-colors">{b.Backoffice}</p>
                                            </td>
                                            <td className="p-3 text-center text-emerald-500 font-medium tabular-nums text-[13px]">{b.Procedente}</td>
                                            <td className="p-3 text-center text-rose-500 font-medium tabular-nums text-[13px]">{b.Improcedente}</td>
                                            <td className="p-3 text-center text-amber-500 font-semibold tabular-nums text-[13px] bg-amber-500/5">{b["Em Análise"]}</td>
                                        </tr>
                                    )) : <tr><td colSpan={4} className="py-20 text-center text-text-muted/30 uppercase text-[10px]">Sem dados</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Rejections Table */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-border bg-primary/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">list_alt</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Novas Rejeições Concluídas</h3>
                    </div>
                </div>
                <div className="overflow-x-auto h-[450px] overflow-y-auto custom-scrollbar relative">
                    <table className="w-full text-left">
                        <thead className="bg-surface text-[9px] font-semibold uppercase text-text-muted border-b border-border sticky top-0 z-10">
                            <tr>
                                <th className="p-3 pl-4">Data</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Equipe</th>
                                <th className="p-3">Nota</th>
                                <th className="p-3">Motivo</th>
                                <th className="p-3">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[11px]">
                            {data.recent_records && data.recent_records.length > 0 ? data.recent_records.map((r, idx) => (
                                <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                    <td className="p-3 pl-4 font-medium tabular-nums text-text-muted">{r.data}</td>
                                    <td className="p-3">
                                        <span className={`font-medium uppercase text-[10px] ${r.status === 'Procedente' ? 'text-emerald-500' : r.status === 'Improcedente' ? 'text-rose-500' : 'text-amber-500'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium text-text-heading">{r.equipe}</td>
                                    <td className="p-3 tabular-nums text-text-muted font-medium">{r.nota}</td>
                                    <td className="p-3 text-text-heading font-medium leading-tight max-w-[300px]">{r.motivo}</td>
                                    <td className="p-3 text-text-muted italic max-w-[400px]">{r.observacao}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-text-muted/30 uppercase tracking-widest text-[10px]">Nenhum registro encontrado no período</td>
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
