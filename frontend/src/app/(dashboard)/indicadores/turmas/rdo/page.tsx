"use client"

import { useState, useEffect, useRef } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { TrendLineChart } from "@/components/dashboard/TrendLineChart"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { PageLoader } from "@/components/ui/PageLoader"
import { PageError } from "@/components/ui/PageError"
import { useFilter } from "@/components/providers/FilterProvider"

interface RDODashboardData {
    period_label: string
    source_file: string
    last_update: string
    stats: {
        kpi1: { label: string, value: string, legend: string, trend?: number, trend_label?: string, border?: string }
        kpi2: { label: string, value: string, legend: string, trend?: number, trend_label?: string, border?: string }
        kpi3: { label: string, value: string, legend: string, trend?: number, trend_label?: string, border?: string }
        kpi4: { label: string, value: string, legend: string, trend?: number, trend_label?: string, border?: string }
    }
    matriz: Array<any>
    indicadores_labels: string[]
    matriz_presenca: Array<any>
    regionais_presenca_labels: string[]
    history: Array<any>
    top_melhores: { Equipe: string, Nota: number }[]
    top_piores: { Equipe: string, Nota: number }[]
    top_piores_indicadores: { Indicador: string, Nota: number }[]
    presenca_history: { Funcao: string, PresencaPct: number }[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

export default function TurmasRDOPage() {
    const { period } = useFilter()
    const [dashData, setDashData] = useState<RDODashboardData | null>(null)
    const [regional, setRegional] = useState<string>("all")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceRefresh = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceRefresh) await triggerSync("turmas_rdo")
            const response = await api.get(`/turmas_rdo/dashboard?periodo=${period}&regional=${regional}`, { signal: abortRef.current.signal })
            setDashData(response.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados do RDO.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData(true)
        isInitialMount.current = false
    }, [])

    useEffect(() => {
        if (isInitialMount.current) return
        loadData(false)
    }, [period, regional])

    if (loading && !dashData) return <PageLoader message="Compilando Painel de Turmas..." />
    if (error) return <PageError error={`Falha no rastreio operacional: ${error}`} onRetry={() => loadData()} />
    if (!dashData) return null

    // Formatar dados para o gráfico de linhas
    const historyChartData = dashData.history?.map(h => ({
        name: h.Periodo,
        ...h
    })) || []

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon="assignment"
                title="Inteligência de RDO e Insights"
                insights={dashData.insights}
                fallbackText={`Monitoramento de conformidade de RDO Turmas consolidado para ${dashData.period_label}.`}
                sourceFile={dashData.source_file}
                lastUpdate={dashData.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
            />

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title={dashData.stats.kpi1.label} value={dashData.stats.kpi1.value} target={dashData.stats.kpi1.legend} variation={dashData.stats.kpi1.trend} icon="military_tech" />
                <KpiCard title={dashData.stats.kpi2.label} value={dashData.stats.kpi2.value} target={dashData.stats.kpi2.legend} variation={dashData.stats.kpi2.trend} icon="task_alt" />
                <KpiCard title={dashData.stats.kpi3.label} value={dashData.stats.kpi3.value} target={dashData.stats.kpi3.legend} variation={dashData.stats.kpi3.trend} icon="groups" />
                <div className="bg-rose-500/5 border border-rose-500/10 p-3 min-h-[95px] rounded-sm flex flex-col justify-center gap-1 hover:border-rose-500/30 transition-all shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-sm bg-rose-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-rose-500 text-[18px]">warning</span>
                        </div>
                        <h3 className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400 tracking-widest">Alertas Operacionais</h3>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {dashData.insights?.slice(0, 2).map((ins, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                                <p className="text-[10px] font-semibold text-text-heading/80 uppercase leading-snug line-clamp-1">
                                    {ins.text}
                                </p>
                            </div>
                        )) || (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                    <p className="text-[10px] font-semibold text-text-heading/60 uppercase">Nenhum alerta crítico identificado</p>
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* Matriz de Indicadores */}
            <div className="bg-surface border border-border rounded-sm flex flex-col">
                <div className="p-4 border-b border-border bg-surface/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Matriz de Desempenho Operacional</h3>
                    </div>
                    <select
                        value={regional}
                        onChange={(e) => setRegional(e.target.value)}
                        className="bg-surface border border-border outline-none text-[10px] font-semibold uppercase tracking-tighter text-text-heading cursor-pointer px-3 py-1 rounded-sm shadow-sm hover:border-primary/50 transition-colors"
                    >
                        <option value="all">Todas Regionais</option>
                        <option value="Itarana">ITARANA</option>
                        <option value="Nova Venécia">NOVA VENÉCIA</option>
                        <option value="Venda Nova do Imigrante">VENDA NOVA</option>
                    </select>
                </div>

                <div className="overflow-x-scroll overflow-y-auto custom-scrollbar relative max-h-[600px] w-full">
                    <table className="text-left min-w-max">
                        <thead className="sticky top-0 z-50 bg-surface/95 border-b border-border">
                            <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">
                                <th className="py-1 px-3 pl-6 text-left min-w-[420px] whitespace-nowrap border-r border-border">Indicador Operacional</th>
                                <th className="py-1 px-3 bg-primary/10 text-primary border-r border-border min-w-[100px]">Média Geral</th>
                                {dashData.indicadores_labels?.map((eq, i) => (
                                    <th key={i} className="py-1 px-3 border-r border-border last:border-r-0 min-w-[80px]">
                                        {eq}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {dashData.matriz?.map((row, r_idx) => {
                                const isFooter = row.is_footer;
                                return (
                                    <tr key={r_idx} className={`${isFooter ? 'bg-primary/5' : 'hover:bg-surface/50 transition-colors'}`}>
                                        <td className={`py-1 px-3 pl-6 border-r border-border sticky left-0 bg-inherit z-10 uppercase min-w-[420px] whitespace-nowrap text-[12px] ${isFooter ? 'text-primary font-semibold' : 'text-text-heading font-semibold'}`}>
                                            {row.indicador}
                                        </td>
                                        <td className={`py-1 px-3 text-center border-r border-border tabular-nums text-[14px] font-medium ${row.media_ind < 95 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                            {row.media_ind}%
                                        </td>
                                        {dashData.indicadores_labels?.map((eq, c_idx) => {
                                            const val = row[eq]
                                            const isBad = val < 95;
                                            return (
                                                <td key={c_idx} className={`py-1 px-3 text-center border-r border-border last:border-r-0 tabular-nums text-[15px] font-semibold ${isBad ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-slate-600'}`}>
                                                    {val !== undefined ? `${val}%` : '-'}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rankings Grid */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Top Performance */}
                <div className="bg-surface border border-border rounded-sm flex flex-col h-[400px] overflow-hidden border-t-4 border-t-emerald-500 shadow-sm">
                    <div className="p-4 border-b border-border bg-emerald-500/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500">award_star</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Top Performance</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-1 gap-1">
                        {dashData.top_melhores?.map((e, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-surface/50 border border-transparent hover:border-emerald-500/20 transition-all group rounded-sm flex-1 min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-emerald-500/30 w-5">#{idx + 1}</span>
                                    <span className="font-semibold text-[13px] text-text-heading uppercase truncate">{e.Equipe}</span>
                                </div>
                                <span className="font-semibold text-[14px] text-emerald-500 tabular-nums">{e.Nota}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Attention Needed */}
                <div className="bg-surface border border-border rounded-sm flex flex-col h-[400px] overflow-hidden border-t-4 border-t-rose-500 shadow-sm">
                    <div className="p-4 border-b border-border bg-rose-500/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-rose-500">trending_down</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Risco Crítico</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-1 gap-1">
                        {dashData.top_piores?.map((e, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-surface/50 border border-transparent hover:border-rose-500/20 transition-all group rounded-sm flex-1 min-h-[55px]">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-semibold text-rose-500/30 w-5">#{idx + 1}</span>
                                    <span className="font-semibold text-[13px] text-text-heading uppercase truncate">{e.Equipe}</span>
                                </div>
                                <span className="font-semibold text-[14px] text-rose-500 tabular-nums">{e.Nota}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Offending Indicators */}
                <div className="bg-surface border border-border rounded-sm flex flex-col h-[400px] overflow-hidden border-t-4 border-t-amber-500 shadow-sm">
                    <div className="p-4 border-b border-border bg-amber-500/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">warning</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Ofensores por Indicador</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-1 gap-1">
                        {dashData.top_piores_indicadores?.map((e, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-surface/50 border border-transparent hover:border-amber-500/20 transition-all group rounded-sm flex-1 min-h-[55px]">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="text-[11px] font-semibold text-amber-500/30 w-5">#{idx + 1}</span>
                                    <span className="font-semibold text-[13px] text-text-heading uppercase leading-tight line-clamp-1 truncate">{e.Indicador}</span>
                                </div>
                                <span className="font-semibold text-[14px] text-amber-500 tabular-nums ml-2">{e.Nota}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Presença e Gráfico Final */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-surface border border-border rounded-sm flex flex-col h-[400px] overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-surface/50 flex items-center justify-between">
                        <h2 className="text-[11px] font-semibold text-text-heading flex items-center gap-2 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-primary text-[18px]">groups</span> Matriz de Presença (Função x Regional)
                        </h2>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-surface/95 border-b border-border">
                                <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">
                                    <th className="py-2 px-3 text-left sticky left-0 bg-inherit z-10 border-r border-border min-w-[200px]">Função</th>
                                    <th className="py-2 px-3 bg-primary/10 text-primary border-r border-border min-w-[110px] w-[110px]">Média</th>
                                    {dashData.regionais_presenca_labels?.map(reg => {
                                        const shortName = reg
                                            .replace('Venda Nova do Imigrante', 'VENDA NOVA')
                                            .replace('Nova Venécia', 'N. VENÉCIA')
                                            .replace('Aracruz', 'ARACRUZ')
                                            .replace('Barra de São Francisco', 'B. S. FRAN.')
                                            .toUpperCase();
                                        return (
                                            <th key={reg} className="py-2 px-3 border-r border-border last:border-r-0 min-w-[110px] w-[110px]">
                                                {shortName}
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {dashData.matriz_presenca?.map((row, idxP) => (
                                    <tr key={idxP} className="hover:bg-surface/50 transition-colors">
                                        <td className="py-2 px-3 text-text-heading uppercase font-semibold sticky left-0 bg-inherit border-r border-border truncate min-w-[200px] text-[12px]">
                                            {row.funcao}
                                        </td>
                                        <td className={`py-2 px-3 text-center border-r border-border bg-primary/[0.05] tabular-nums text-[14px] font-medium min-w-[110px] w-[110px] ${row.media_func < 95 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {row.media_func}%
                                        </td>
                                        {dashData.regionais_presenca_labels?.map(reg => (
                                            <td key={reg} className={`py-2 px-3 text-center border-r border-border last:border-r-0 tabular-nums text-[15px] font-semibold min-w-[110px] w-[110px] ${row[reg] < 95 ? 'text-rose-500' : 'text-slate-500'}`}>
                                                {row[reg]}%
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm">
                    <div className="flex items-center gap-2 mb-8 shrink-0">
                        <span className="material-symbols-outlined text-primary text-[18px]">show_chart</span>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Evolução Histórica por Regional</h3>
                    </div>
                    <div className="flex-grow w-full">
                        <TrendLineChart
                            data={historyChartData}
                            lines={[
                                { key: 'Itarana', color: '#0f172a', label: 'ITARANA' },
                                { key: 'Nova Venécia', color: '#10b981', label: 'NOVA VENÉCIA' },
                                { key: 'Venda Nova do Imigrante', color: '#f59e0b', label: 'VENDA NOVA' }
                            ]}
                            isCurrency={false}
                            yDomain={[50, 100]}
                            tooltipLabel="Nota (%)"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
