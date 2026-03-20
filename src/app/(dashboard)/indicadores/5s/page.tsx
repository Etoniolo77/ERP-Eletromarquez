"use client"

import React, { useState, useEffect, useMemo, useRef, Fragment } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { EvolucaoLineChart } from "@/components/dashboard/EvolucaoLineChart"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { useFilter } from "@/components/providers/FilterProvider"

import { PageHeader } from "@/components/dashboard/PageHeader"

// --- Interfaces ---
interface Dashboard5S {
    meta_5s: number
    periodo_ref: string
    source_file: string
    last_update: string
    stats: {
        media_conformidade: number
        trend_conformidade: number
        total_auditorias: number
        s1: number; s1_trend: number;
        s2: number; s2_trend: number;
        s3: number; s3_trend: number;
        s4: number; s4_trend: number;
        s5: number; s5_trend: number;
        bases_auditadas: number
    }
    evolucao: {
        labels: string[]
        data: number[]
    }
    all_bases: string[]
    hierarchy: {
        name: string; auditorias: number;
        s1: number; s2: number; s3: number; s4: number; s5: number;
        conformidade: number;
        ultima_data: string;
        ultimo_inspetor: string;
        locais: {
            name: string; s1: number; s2: number; s3: number; s4: number; s5: number; conformidade: number;
            ultima_data: string; ultimo_inspetor: string;
        }[]
    }[]
}

interface HistoricoRow {
    data: string
    base: string
    local: string
    tipo: string
    nota: number
    inspetor: string
}

interface PlanoAcaoRow {
    id: string
    base: string
    local: string
    pergunta: string
    codigo: string
    status: string
    data_identificacao: string
    dias_aberto: number
    responsavel: string
    acao_sugerida: string
}

// --- Main Component ---
export default function Page5SControle() {
    const [activeTab, setActiveTab] = useState<string>('dashboard')
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Data States
    const [dashData, setDashData] = useState<Dashboard5S | null>(null)
    const [historico, setHistorico] = useState<HistoricoRow[]>([])
    const [planos, setPlanos] = useState<PlanoAcaoRow[]>([])

    // Filter States
    const { period: periodo } = useFilter()
    const [selectedBases, setSelectedBases] = useState<string[]>([])
    const [openBase, setOpenBase] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [sensoFilter, setSensoFilter] = useState("ALL")
    const [responsavelFilter, setResponsavelFilter] = useState("ALL")

    const [sortConfig, setSortConfig] = useState<{ key: keyof HistoricoRow | null, direction: 'asc' | 'desc' }>({
        key: 'data',
        direction: 'desc'
    })
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const SortIcon = ({ column }: { column: keyof HistoricoRow }) => {
        if (sortConfig.key !== column) return <span className="material-symbols-outlined text-[14px] opacity-20 group-hover:opacity-50">swap_vert</span>
        return sortConfig.direction === 'asc'
            ? <span className="material-symbols-outlined text-[14px] text-primary">arrow_upward</span>
            : <span className="material-symbols-outlined text-[14px] text-primary">arrow_downward</span>
    }

    const handleSort = (key: keyof HistoricoRow) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const loadDashboard = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("5s")
            const baseStr = selectedBases.length > 0 ? selectedBases.join(",") : "ALL"
            const res = await api.get(`/5s/dashboard?periodo=${periodo}&base=${baseStr}`, { signal: abortRef.current.signal })
            setDashData(res.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dashboard.')
        } finally {
            setLoading(false)
        }
    }

    const loadHistorico = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("5s")
            const baseStr = selectedBases.length > 0 ? selectedBases.join(",") : "ALL"
            const res = await api.get(`/5s/historico?base=${baseStr}`, { signal: abortRef.current.signal })
            setHistorico(res.data.items || [])
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar histórico.')
        } finally {
            setLoading(false)
        }
    }

    const loadPlanos = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("5s")
            const baseStr = selectedBases.length > 0 ? selectedBases.join(",") : "ALL"
            const res = await api.get(`/5s/planos?base=${baseStr}`, { signal: abortRef.current.signal })
            setPlanos(res.data.action_plans || [])
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar planos de ação.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        isInitialMount.current = false
    }, [])

    useEffect(() => {
        if (!mounted) return
        if (isInitialMount.current) return
        if (activeTab === 'dashboard') loadDashboard(false)
        if (activeTab === 'historico') loadHistorico(false)
        if (activeTab === 'planos') loadPlanos(false)
    }, [activeTab, periodo, selectedBases])

    useEffect(() => {
        if (!mounted) return
        if (activeTab === 'dashboard') loadDashboard(true)
        if (activeTab === 'historico') loadHistorico(true)
        if (activeTab === 'planos') loadPlanos(true)
    }, [mounted])


    // -- Derived Data for Dashboard --
    let evoChartData: any[] = []
    if (dashData?.evolucao) {
        evoChartData = (dashData.evolucao.labels || []).map((label, i) => ({
            name: label,
            value: dashData.evolucao.data?.[i] || 0
        }))
    }

    const sensos = dashData ? [
        { sigla: "Utilização", name: "Seiri", value: dashData.stats?.s1 ?? 0, trend: dashData.stats?.s1_trend ?? 0, icon: "package_2" },
        { sigla: "Organização", name: "Seiton", value: dashData.stats?.s2 ?? 0, trend: dashData.stats?.s2_trend ?? 0, icon: "grid_view" },
        { sigla: "Limpeza", name: "Seiso", value: dashData.stats?.s3 ?? 0, trend: dashData.stats?.s3_trend ?? 0, icon: "opacity" },
        { sigla: "Padronização", name: "Seiketsu", value: dashData.stats?.s4 ?? 0, trend: dashData.stats?.s4_trend ?? 0, icon: "fact_check" },
        { sigla: "Disciplina", name: "Shitsuke", value: dashData.stats?.s5 ?? 0, trend: dashData.stats?.s5_trend ?? 0, icon: "shield" }
    ] : []

    // -- Derived Data for Historico --
    const sortedHistory = useMemo(() => {
        const filtered = historico.filter(h =>
            !searchTerm ||
            h.base.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.inspetor.toLowerCase().includes(searchTerm.toLowerCase())
        )

        if (!sortConfig.key) return filtered

        return [...filtered].sort((a, b) => {
            const aValue = a[sortConfig.key!]
            const bValue = b[sortConfig.key!]

            if (sortConfig.key === 'data') {
                const parseDate = (d: string) => {
                    const [day, month, year] = d.split('/').map(Number)
                    return new Date(year, month - 1, day).getTime()
                }
                return sortConfig.direction === 'asc' ? parseDate(a.data) - parseDate(b.data) : parseDate(b.data) - parseDate(a.data)
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
            }

            return sortConfig.direction === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue))
        })
    }, [historico, searchTerm, sortConfig])

    const filteredHistory = sortedHistory

    const histStats = useMemo(() => {
        if (!historico.length) return { topInsp: null, botInsp: null, worstLoc: null, alertCount: 0 }
        const inspMap: Record<string, { sum: number, qtd: number }> = {}
        const locMap: Record<string, { sum: number, qtd: number }> = {}
        let alertCount = 0

        historico.forEach(h => {
            if (!inspMap[h.inspetor]) inspMap[h.inspetor] = { sum: 0, qtd: 0 }
            inspMap[h.inspetor].sum += h.nota
            inspMap[h.inspetor].qtd += 1

            const baseName = h.base && h.base !== 'N/A' ? h.base : ''
            const locName = h.local && h.local !== 'N/A' ? h.local : ''
            const lKey = baseName && locName ? `${baseName} / ${locName}` : (baseName || locName || 'Local Indefinido')

            if (!locMap[lKey]) locMap[lKey] = { sum: 0, qtd: 0 }
            locMap[lKey].sum += h.nota
            locMap[lKey].qtd += 1

            if (h.nota < 80) alertCount++
        })

        const sortedInsps = Object.entries(inspMap)
            .map(([n, s]) => ({ name: n, avg: Math.round(s.sum / s.qtd) }))
            .filter(item => item.avg > 0)
            .sort((a, b) => b.avg - a.avg)

        const sortedLocs = Object.entries(locMap)
            .map(([n, s]) => ({ name: n, avg: Math.round(s.sum / s.qtd) }))
            .filter(item => item.avg > 0)
            .sort((a, b) => a.avg - b.avg)

        return {
            topInsp: sortedInsps[0],
            botInsp: sortedInsps[sortedInsps.length - 1],
            worstLoc: sortedLocs[0],
            alertCount
        }
    }, [historico])

    const filteredPlanos = useMemo(() => {
        return planos.filter(p => {
            const s = searchTerm.toLowerCase()
            const matchSearch = !s ||
                p.base.toLowerCase().includes(s) ||
                p.local.toLowerCase().includes(s) ||
                p.responsavel.toLowerCase().includes(s) ||
                p.acao_sugerida.toLowerCase().includes(s) ||
                p.pergunta.toLowerCase().includes(s)

            const matchStatus = statusFilter === "ALL" || p.status === statusFilter
            const matchSenso = sensoFilter === "ALL" || p.codigo.startsWith(sensoFilter)

            const strBase = String(p.base || "").toUpperCase()
            const strLocal = String(p.local || "").toUpperCase()
            // Multi-select global filter for Base
            const matchBase = selectedBases.length === 0 ||
                selectedBases.map(b => b.toUpperCase()).includes(strBase) ||
                selectedBases.map(b => b.toUpperCase()).includes(strLocal)

            const matchResp = responsavelFilter === "ALL" || p.responsavel === responsavelFilter
            return matchSearch && matchStatus && matchSenso && matchBase && matchResp
        })
    }, [planos, searchTerm, statusFilter, sensoFilter, selectedBases, responsavelFilter])

    const criticosCount = planos.filter(a => a.status === 'CRÍTICO').length
    const locsSet = new Set(planos.map(a => `${a.base}-${a.local}`))
    const baseLocalFreq = planos.filter(p => p.status === 'CRÍTICO').reduce((acc, curr) => {
        const key = `${curr.base} / ${curr.local}`
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {} as Record<string, number>)
    const topOffender = Object.entries(baseLocalFreq).sort((a, b) => b[1] - a[1])[0] || ["Nenhum", 0]
    const oldestAction = [...planos].sort((a, b) => b.dias_aberto - a.dias_aberto)[0]

    const exportXLSX = async () => {
        try {
            const params = new URLSearchParams()
            if (sensoFilter !== 'ALL') params.append('senso', sensoFilter)
            if (statusFilter !== 'ALL') params.append('status', statusFilter)
            if (selectedBases.length > 0) params.append('base', selectedBases.join(','))
            if (responsavelFilter !== 'ALL') params.append('resp', responsavelFilter)
            if (searchTerm) params.append('search', searchTerm)

            const response = await api.get(`/5s/planos/export`, {
                params,
                responseType: 'blob'
            })

            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `Plano_de_Acao_5S_${new Date().toISOString().split('T')[0]}.xlsx`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (err) {
            console.error('Erro ao exportar XLSX:', err)
            // Fallback para CSV se o endpoint falhar
            const headers = ['Base', 'Local', 'Responsavel', 'Codigo', 'Pergunta', 'Acao Sugerida', 'Dias em Aberto', 'Status'].join(';')
            const rows = filteredPlanos.map(a => `${a.base};${a.local};${a.responsavel};${a.codigo};${a.pergunta};${a.acao_sugerida};${a.dias_aberto};${a.status}`)
            const csv = ["\ufeff" + headers, ...rows].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.setAttribute("download", `Plano_de_Acao_5S.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    if (!mounted) return null

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <PageHeader
                icon={activeTab === 'dashboard' ? 'auto_awesome' : activeTab === 'historico' ? 'history' : 'assignment'}
                title={`Programa 5S — ${activeTab === 'dashboard' ? 'Evolução Cultural' : activeTab === 'historico' ? 'Registro de Inspeções' : 'Plano de Ação'}`}
                fallbackText={activeTab === 'dashboard'
                    ? `Média geral de conformidade em ${dashData?.stats?.media_conformidade ?? 0}% com ${dashData?.stats?.total_auditorias ?? 0} ciclos auditados.`
                    : activeTab === 'historico' ? `Log Global de Auditorias SESMT • Auditoria Contínua` : `Gestão de Não Conformidades • Auditoria SESMT Digital`}
                sourceFile={dashData?.source_file}
                lastUpdate={dashData?.last_update}
                onRefresh={() => activeTab === 'dashboard' ? loadDashboard(true) : activeTab === 'historico' ? loadHistorico(true) : loadPlanos(true)}
                loading={loading}
                showPeriodSelector={true}
                tabs={[
                    { id: 'dashboard', label: '5S Dashboard', icon: 'auto_awesome' },
                    { id: 'historico', label: 'Histórico 5S', icon: 'history' },
                    { id: 'planos', label: 'Plano de Ação', icon: 'assignment' }
                ]}
                activeTab={activeTab}
                onTabChange={(id) => {
                    setActiveTab(id)
                    setSearchTerm("")
                }}
            >
                {/* Filtro de Base (Multi-seleção simplificada) */}
                <div className="relative group self-center h-[34px]">
                    <div className="flex items-center gap-2 bg-background border border-border/80 px-3 py-1.5 rounded-sm shadow-sm cursor-pointer min-w-[140px] h-full hover:border-primary/50 transition-colors">
                        <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-heading truncate max-w-[100px]">
                            {selectedBases.length === 0 ? "Todas Bases" : selectedBases.length === 1 ? selectedBases[0] : `${selectedBases.length} Bases`}
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-text-muted ml-auto">expand_more</span>
                    </div>

                    {/* Dropdown de Bases */}
                    <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border shadow-xl rounded-sm py-2 z-[99] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 origin-top">
                        <div className="px-3 py-1 border-b border-border mb-1">
                            <button
                                onClick={() => setSelectedBases([])}
                                className="text-[9px] font-bold text-primary uppercase hover:underline"
                            >
                                Limpar Seleção
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {(dashData?.all_bases || []).map(b => (
                                <label key={b} className="flex items-center gap-2 px-3 py-2 hover:bg-primary/5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedBases.includes(b)}
                                        onChange={() => {
                                            setSelectedBases(prev =>
                                                prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
                                            )
                                        }}
                                        className="rounded-sm border-gray-300 text-primary focus:ring-primary h-3 w-3"
                                    />
                                    <span className="text-[10px] font-semibold text-text-heading uppercase">{b}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </PageHeader>

            {/* Dashboard Content */}

            {/* Render Content Based on Active Tab */}
            <main className="min-h-[600px] animate-in fade-in duration-500">
                {loading && (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-[10px] font-semibold text-text-muted animate-pulse uppercase tracking-widest">Sincronizando Dados...</p>
                    </div>
                )}

                {error && !loading && (
                    <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm flex flex-col items-center justify-center gap-4">
                        <span className="material-symbols-outlined text-4xl">warning</span>
                        <p className="font-bold text-xs uppercase tracking-widest text-center">Erro operacional: {error}</p>
                        <button onClick={() => activeTab === 'dashboard' ? loadDashboard() : activeTab === 'historico' ? loadHistorico() : loadPlanos()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm">Tentar Novamente</button>
                    </div>
                )}

                {!loading && !error && activeTab === 'dashboard' && dashData && (
                    <div className="space-y-4">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <KpiCard
                                title="Média Geral"
                                value={`${dashData.stats?.media_conformidade ?? 0}%`}
                                variation={dashData.stats?.trend_conformidade ?? 0}
                                icon="auto_awesome"
                                colorValue={(dashData.stats?.media_conformidade ?? 0) >= dashData.meta_5s ? 'success' : 'danger'}
                            />
                            {sensos.map((s, idx) => (
                                <KpiCard
                                    key={idx}
                                    title={s.name}
                                    value={`${s.value}%`}
                                    variation={s.trend}
                                    icon={s.icon}
                                />
                            ))}
                        </div>

                        {/* Chart + Summary */}
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 lg:col-span-8 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px]">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Média de Conformidade</h3>
                                        <p className="text-[10px] text-text-muted font-medium uppercase mt-1">Média aritmética simples de todos os registros de auditoria no período.</p>
                                    </div>
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-semibold uppercase rounded-sm border border-primary/20 shrink-0">Meta: {dashData.meta_5s}%</span>
                                </div>
                                <div className="flex-1 w-full">
                                    <EvolucaoLineChart data={evoChartData} />
                                </div>
                            </div>

                            <div className="col-span-12 lg:col-span-4 bg-rose-500/5 border border-rose-500/10 rounded-sm flex flex-col h-[400px] overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-rose-500/10 bg-rose-500/5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-rose-500 text-[18px]">warning</span>
                                    <h3 className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">Locais Abaixo da Meta</h3>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <tbody className="divide-y divide-border">
                                            {dashData.hierarchy?.flatMap(h => h.locais)
                                                .filter(l => l.conformidade < dashData.meta_5s)
                                                .sort((a, b) => a.conformidade - b.conformidade)
                                                .slice(0, 10).map((l, i) => (
                                                    <tr key={i} className="hover:bg-surface/50 transition-colors">
                                                        <td className="p-2 pl-4">
                                                            <p className="text-[12px] font-semibold text-text-heading uppercase truncate w-32">{l.name}</p>
                                                        </td>
                                                        <td className="p-2 text-right pr-4">
                                                            <p className="text-[12px] font-semibold text-rose-500 tabular-nums">{l.conformidade}%</p>
                                                            <p className="text-[10px] text-text-muted font-medium uppercase">GAP: {(dashData.meta_5s - l.conformidade).toFixed(1)}%</p>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-surface border border-border rounded-sm overflow-hidden">
                            <div className="p-4 border-b border-border bg-surface/50">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Últimas Inspeções realizadas no mês atual</h3>
                                <p className="text-[10px] text-text-muted font-medium uppercase mt-1">Consolidado da última inspeção realizada em cada local por base.</p>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-surface/20 border-b border-border">
                                            <th className="p-3 pl-4 text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[25%]">Base / Local</th>
                                            <th className="p-3 text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[23%]">Inspetor</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[110px]">Data</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[75px]">S1</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[75px]">S2</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[75px]">S3</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[75px]">S4</th>
                                            <th className="p-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-widest w-[75px]">S5</th>
                                            <th className="p-3 text-right pr-6 text-[11px] font-semibold text-primary uppercase tracking-widest bg-primary/5 border-l border-primary/10 w-[100px]">Média</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {dashData.hierarchy?.map((base, bIdx) => {
                                            const isExpanded = openBase === base.name
                                            return (
                                                <Fragment key={bIdx}>
                                                    <tr onClick={() => setOpenBase(isExpanded ? null : base.name)} className="hover:bg-surface/50 cursor-pointer transition-colors group">
                                                        <td className="p-3 pl-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpanded ? 'rotate-180 text-primary' : 'text-slate-300'}`}>expand_more</span>
                                                                <div>
                                                                    <p className="text-[12px] font-semibold text-text-heading uppercase tracking-tight group-hover:text-primary">{base.name}</p>
                                                                    <p className="text-[10px] text-text-muted font-medium uppercase">{base.auditorias || 0} Inspeções</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-[12px] font-semibold text-text-muted uppercase truncate">{base.ultimo_inspetor}</td>
                                                        <td className="p-3 text-center text-[12px] font-semibold text-text-muted tabular-nums">{base.ultima_data}</td>
                                                        <td className={`p-3 text-center text-[15px] font-semibold ${base.s1 < dashData.meta_5s ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{base.s1}%</td>
                                                        <td className={`p-3 text-center text-[15px] font-semibold ${base.s2 < dashData.meta_5s ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{base.s2}%</td>
                                                        <td className={`p-3 text-center text-[15px] font-semibold ${base.s3 < dashData.meta_5s ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{base.s3}%</td>
                                                        <td className={`p-3 text-center text-[15px] font-semibold ${base.s4 < dashData.meta_5s ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{base.s4}%</td>
                                                        <td className={`p-3 text-center text-[15px] font-semibold ${base.s5 < dashData.meta_5s ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{base.s5}%</td>
                                                        <td className="p-3 text-right pr-6 bg-primary/5 border-l border-primary/10 shadow-[inset_2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                                                            <span className={`text-sm font-semibold ${base.conformidade >= dashData.meta_5s ? 'text-emerald-500' : 'text-rose-500'}`}>{base.conformidade}%</span>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && base.locais?.map((local, lIdx) => (
                                                        <tr key={lIdx} className="bg-surface/30">
                                                            <td className="p-3 pl-14 text-[11px] font-medium text-text-muted uppercase">{local.name}</td>
                                                            <td className="p-3 text-[11px] font-medium text-text-muted uppercase truncate">{local.ultimo_inspetor}</td>
                                                            <td className="p-3 text-center text-[11px] font-semibold text-text-muted tabular-nums">{local.ultima_data}</td>
                                                            <td className="p-3 text-center text-[13px] font-semibold text-text-muted">{local.s1}%</td>
                                                            <td className="p-3 text-center text-[13px] font-semibold text-text-muted">{local.s2}%</td>
                                                            <td className="p-3 text-center text-[13px] font-semibold text-text-muted">{local.s3}%</td>
                                                            <td className="p-3 text-center text-[13px] font-semibold text-text-muted">{local.s4}%</td>
                                                            <td className="p-3 text-center text-[13px] font-semibold text-text-muted">{local.s5}%</td>
                                                            <td className="p-3 text-right pr-6 bg-primary/5 text-[13px] font-semibold border-l border-primary/5 italic">{local.conformidade}%</td>
                                                        </tr>
                                                    ))}
                                                </Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && activeTab === 'historico' && (
                    <div className="space-y-4">
                        {/* KPI Cards for Historico */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard
                                title="Maior média"
                                value={`${histStats.topInsp?.avg ?? 0}%`}
                                target={histStats.topInsp?.name ?? 'N/A'}
                                icon="verified"
                                colorValue="success"
                                showVariation={false}
                            />
                            <KpiCard
                                title="Menor Média"
                                value={`${histStats.botInsp?.avg ?? 0}%`}
                                target={histStats.botInsp?.name ?? 'N/A'}
                                icon="trending_down"
                                colorValue="warning"
                                showVariation={false}
                            />
                            <KpiCard
                                title="Pior Local"
                                value={`${histStats.worstLoc?.avg ?? 0}%`}
                                target={histStats.worstLoc?.name ?? 'N/A'}
                                icon="location_off"
                                colorValue="danger"
                                showVariation={false}
                            />
                            <div className="bg-rose-500/5 border border-rose-500/10 px-4 py-3 min-h-[95px] flex flex-col justify-between rounded-sm relative overflow-hidden group shadow-sm transition-all hover:border-rose-500/30">
                                <div className="flex items-center gap-1.5 h-4 mb-2">
                                    <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                                    <p className="text-[12px] text-rose-600 dark:text-rose-400 uppercase font-semibold tracking-tight">Alertas SESMT</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold uppercase text-rose-500">{histStats.alertCount} Notas abaixo de 80%</p>
                                    <p className="text-[9px] font-semibold uppercase text-text-muted line-clamp-1">Locais necessitam revisão</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface border border-border p-3 rounded-sm flex items-center gap-3 shadow-sm">
                            <span className="material-symbols-outlined text-primary">search_check</span>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="FILTRAR HISTÓRICO POR BASE, LOCAL OU INSPETOR..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-[11px] font-semibold uppercase tracking-wider text-text-heading placeholder:text-text-muted/50"
                                />
                            </div>
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="text-text-muted hover:text-rose-500 transition-colors">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            )}
                        </div>

                        <div className="bg-surface border border-border rounded-sm overflow-hidden min-h-[500px]">
                            <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Mapa de Inspeções</h3>
                                <span className="px-2 py-1 bg-primary text-white text-[9px] font-semibold uppercase rounded-sm">{filteredHistory.length} Registros</span>
                            </div>
                            <div className="overflow-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-surface border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                                        <tr>
                                            <th className="p-3 pl-4 cursor-pointer group" onClick={() => handleSort('data')}>
                                                <div className="flex items-center gap-2">Data <SortIcon column="data" /></div>
                                            </th>
                                            <th className="p-3 cursor-pointer group" onClick={() => handleSort('base')}>
                                                <div className="flex items-center gap-2">Regional <SortIcon column="base" /></div>
                                            </th>
                                            <th className="p-3 cursor-pointer group" onClick={() => handleSort('local')}>
                                                <div className="flex items-center gap-2">Local <SortIcon column="local" /></div>
                                            </th>
                                            <th className="p-3 text-center cursor-pointer group" onClick={() => handleSort('tipo')}>
                                                <div className="flex items-center gap-2 justify-center">Tipo <SortIcon column="tipo" /></div>
                                            </th>
                                            <th className="p-3 text-center cursor-pointer group" onClick={() => handleSort('nota')}>
                                                <div className="flex items-center gap-2 justify-center">Nota (%) <SortIcon column="nota" /></div>
                                            </th>
                                            <th className="p-3 cursor-pointer group" onClick={() => handleSort('inspetor')}>
                                                <div className="flex items-center gap-2">Inspetor <SortIcon column="inspetor" /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-[12px]">
                                        {filteredHistory.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-surface/50 transition-colors group">
                                                <td className="p-3 pl-4 font-semibold text-text-heading tabular-nums">{row.data}</td>
                                                <td className="p-3 text-text-muted font-semibold uppercase text-[10px]">{row.base}</td>
                                                <td className="p-3 text-text-heading uppercase font-semibold">{row.local}</td>
                                                <td className="p-3 text-center">
                                                    <span className="bg-surface text-text-muted px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase border border-border">{row.tipo}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-flex items-center justify-center px-4 py-1 rounded-sm text-[11px] font-semibold tabular-nums min-w-[60px] ${row.nota >= 90 ? 'bg-emerald-500 text-white shadow-sm' : row.nota >= 75 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                        {row.nota}%
                                                    </span>
                                                </td>
                                                <td className="p-3 text-text-muted uppercase font-semibold italic">{row.inspetor}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && activeTab === 'planos' && (
                    <div className="space-y-4">
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                            <KpiCard title="Total em Aberto" value={planos.length.toString()} target="Pendentes" icon="assignment" colorValue="primary" showVariation={false} />
                            <KpiCard title="Ações Críticas" value={criticosCount.toString()} target="Vencidos" icon="emergency" colorValue="danger" showVariation={false} />
                            <KpiCard title="Locais Impactados" value={locsSet.size.toString()} target="Localidades" icon="location_on" colorValue="slate" showVariation={false} />
                            <div className="bg-rose-500/5 border border-rose-500/10 px-4 py-3 min-h-[95px] flex flex-col justify-between rounded-sm relative overflow-hidden group shadow-sm transition-all hover:border-rose-500/30">
                                <div className="flex items-center gap-1.5 h-4 mb-2">
                                    <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
                                    <p className="text-[12px] text-rose-600 dark:text-rose-400 uppercase font-semibold tracking-tight">Alertas Críticos</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold uppercase text-rose-500 truncate">Top: {topOffender[0]}</p>
                                    <p className="text-[9px] font-semibold uppercase text-amber-500">Mais Antiga: {oldestAction?.responsavel} ({oldestAction?.dias_aberto}D)</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface border border-border p-3 rounded-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select value={responsavelFilter} onChange={e => setResponsavelFilter(e.target.value)} className="bg-transparent border border-border px-2 py-1.5 rounded-sm text-[10px] font-semibold uppercase outline-none min-w-[140px]">
                                    <option value="ALL">RESPONSÁVEL</option>
                                    {Array.from(new Set(planos.map(p => p.responsavel))).sort().map(resp => (
                                        <option key={resp} value={resp}>{resp}</option>
                                    ))}
                                </select>
                                <select value={sensoFilter} onChange={e => setSensoFilter(e.target.value)} className="bg-transparent border border-border px-2 py-1.5 rounded-sm text-[10px] font-semibold uppercase outline-none min-w-[140px]">
                                    <option value="ALL">TODOS OS SENSOS</option>
                                    <option value="S01">1S - SEIRI</option>
                                    <option value="S02">2S - SEITON</option>
                                    <option value="S03">3S - SEISO</option>
                                    <option value="S04">4S - SEIKETSU</option>
                                    <option value="S05">5S - SHITSUKE</option>
                                </select>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent border border-border px-2 py-1.5 rounded-sm text-[10px] font-semibold uppercase outline-none min-w-[140px]">
                                    <option value="ALL">STATUS GLOBAL</option>
                                    <option value="CRÍTICO">CRÍTICOS</option>
                                    <option value="PENDENTE">PENDENTES</option>
                                </select>
                            </div>
                            <button onClick={exportXLSX} className="bg-surface border border-border px-3 py-1.5 rounded-sm flex items-center gap-2 hover:border-primary transition-colors text-primary whitespace-nowrap">
                                <span className="material-symbols-outlined text-sm">download</span>
                                <span className="text-[10px] font-semibold uppercase">Exportar para Excel (XLSX)</span>
                            </button>
                        </div>

                        <div className="bg-surface border border-border rounded-sm overflow-hidden min-h-[400px]">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-surface/50 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                                        <tr>
                                            <th className="p-3 pl-4">Base / Local</th>
                                            <th className="p-3">Responsável</th>
                                            <th className="p-3">Indício de Falha (GAP)</th>
                                            <th className="p-3">Ação Sugerida</th>
                                            <th className="p-3 text-center">Idade</th>
                                            <th className="p-3 text-right pr-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-[12px]">
                                        {filteredPlanos.map((plano, idx) => (
                                            <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                                <td className="p-3 pl-4">
                                                    <p className="text-[10px] text-text-muted font-semibold uppercase">{plano.base}</p>
                                                    <p className="text-text-heading uppercase font-semibold">{plano.local}</p>
                                                </td>
                                                <td className="p-3 text-text-muted uppercase font-semibold text-[10px]">{plano.responsavel}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-1.5 py-0.5 bg-primary/5 text-primary text-[10px] font-semibold rounded-sm border border-primary/10">{plano.codigo}</span>
                                                    </div>
                                                    <p className="text-[12px] text-text-muted font-semibold italic line-clamp-2">"{plano.pergunta}"</p>
                                                </td>
                                                <td className="p-3">
                                                    <p className="text-[12px] text-text-heading uppercase leading-tight">{plano.acao_sugerida}</p>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-1 rounded-sm text-[9px] font-semibold ${plano.dias_aberto > 30 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                        {plano.dias_aberto}D
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right pr-4">
                                                    <span className={`px-2 py-1 rounded-sm text-[9px] font-semibold uppercase ${plano.status === 'CRÍTICO' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                        {plano.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
