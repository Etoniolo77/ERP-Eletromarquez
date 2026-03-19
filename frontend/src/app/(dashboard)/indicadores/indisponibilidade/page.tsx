"use client"

import React, { useState, useEffect, useRef } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { formatCurrency as formatCurrencyFull } from "@/lib/utils"

interface IndisponibilidadeDashboard {
    period: string
    source_file: string
    last_update: string
    stats: {
        total_valor: number
        pendente_valor: number
        total_itens: number
        pendente_itens: number
        aderencia: number
    }
    pareto: { Tipo: string; Valor: number }[]
    regionais_list: string[]
    tipos_list: string[]
    matrix: any[]
    available_months: string[]
    regionais: {
        Regional: string
        TotalValor: number
        PendenteValor: number
        TratadoValor: number
        TratadoPct: number
    }[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

const formatMonth = (val: string) => {
    if (!val || val.length !== 6) return val;
    return `${val.substring(4)}/${val.substring(0, 4)}`;
}

const formatTime = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return "";
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export default function IndisponibilidadePage() {
    const [selectedMonth, setSelectedMonth] = useState<string>("month")
    const [data, setData] = useState<IndisponibilidadeDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const [mounted, setMounted] = useState(false)
    const isInitialMount = useRef(true)
    const abortRef = useRef<AbortController | null>(null)

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }

    const getSortedMatrix = () => {
        if (!data || !data.matrix) return [];
        let sorted = [...data.matrix];
        if (sortConfig) {
            sorted.sort((a, b) => {
                let valA = 0;
                let valB = 0;

                if (sortConfig.key === 'Tipo') {
                    return sortConfig.direction === 'asc'
                        ? a.Tipo.localeCompare(b.Tipo)
                        : b.Tipo.localeCompare(a.Tipo);
                } else if (sortConfig.key === 'Total') {
                    valA = a._total_impacto || 0;
                    valB = b._total_impacto || 0;
                } else {
                    valA = (a[sortConfig.key]?.tratado || 0) + (a[sortConfig.key]?.pendente || 0);
                    valB = (b[sortConfig.key]?.tratado || 0) + (b[sortConfig.key]?.pendente || 0);
                }

                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });
        }
        return sorted;
    }

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("indisponibilidade")
            const response = await api.get(`/indisponibilidade/dashboard?periodo=${selectedMonth}`, { signal: abortRef.current.signal })
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
    }, [selectedMonth])

    if (!mounted || (loading && !data)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-semibold text-text-muted animate-pulse uppercase tracking-wider">Calculando Indisponibilidade...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-wider text-center">Erro Crítico: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">Recarregar Dashboard</button>
        </div>
    )
    if (!data) return null

    const stats = data.stats;

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header Area - Best in Class Design */}
            <PageHeader
                icon="analytics"
                title="Inteligência Operacional e Insights"
                insights={data.insights}
                fallbackText={`Monitoramento de indisponibilidade consolidado para o arquivo ${data.source_file}.`}
                sourceFile={data.source_file}
                lastUpdate={data.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
            >
                {/* Month Selector */}
                {data.available_months && data.available_months.length > 0 && (
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-surface border border-border text-text-heading text-[11px] font-semibold uppercase tracking-tight rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary/60 cursor-pointer h-[32px] shadow-sm"
                    >
                        {data.available_months.map((m) => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                )}
            </PageHeader>

            {/* KPI Cards */}
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Impacto Total"
                    value={formatCurrency(stats.total_valor)}
                    target={stats.total_itens}
                    variation="+4.2%"
                    icon="payments"
                />
                <KpiCard
                    title="Tratado"
                    value={formatCurrency(stats.total_valor - stats.pendente_valor)}
                    target={stats.total_itens - stats.pendente_itens}
                    variation={`${((stats.total_valor - stats.pendente_valor) / stats.total_valor * 100).toFixed(1)}%`}
                    icon="task_alt"
                />
                <KpiCard
                    title="Pendente"
                    value={formatCurrency(stats.pendente_valor)}
                    target={stats.pendente_itens}
                    variation="-1.5%"
                    icon="pending_actions"
                />
                <KpiCard
                    title="Aderência"
                    value={`${stats.aderencia}%`}
                    target="95.0%"
                    variation="+0.5%"
                    icon="bolt"
                />
            </div>

            {/* Main Graphs Area */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                {/* Pareto Chart - 7 Columns */}
                <div className="md:col-span-12 lg:col-span-7 bg-surface border border-border p-4 rounded-sm flex flex-col h-[480px]">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Pareto de Ofensores Operativos</h3>
                            <p className="text-[9px] text-text-muted uppercase font-medium mt-0.5">Distribuição por motivo e impacto financeiro</p>
                        </div>
                        <span className="material-symbols-outlined text-text-muted/30">bar_chart</span>
                    </div>

                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.pareto.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(148, 163, 184, 0.05)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="Tipo"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={200}
                                    tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 500 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '9px', fontWeight: '600', textTransform: 'uppercase' }}
                                    formatter={(v: any) => [formatCurrencyFull(v), "IMPACTO"]}
                                />
                                <Bar dataKey="Valor" radius={[0, 2, 2, 0]} barSize={20}>
                                    {data.pareto.slice(0, 8).map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#f43f5e' : '#1152d4'} fillOpacity={1 - index * 0.1} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Regional Stats - 5 Columns */}
                <div className="md:col-span-12 lg:col-span-5 bg-surface border border-border rounded-sm flex flex-col h-[480px]">
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px]">assessment</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Performance Regional</h3>
                        </div>
                        <span className="text-[9px] font-semibold text-text-muted uppercase tracking-tighter">MB52 Filter</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 text-[10px] font-semibold uppercase text-text-muted">
                                <tr>
                                    <th className="p-3 pl-4">Regional</th>
                                    <th className="p-3 text-right pr-4">Tratado / Pendente</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-[12px]">
                                {data.regionais.map((r) => (
                                    <tr key={r.Regional} className="hover:bg-surface/50 transition-colors">
                                        <td className="p-3 pl-4">
                                            <p className="font-semibold text-text-heading uppercase tracking-tight">{r.Regional}</p>
                                            <p className="text-[10px] text-emerald-500 font-medium uppercase mt-0.5">{r.TratadoPct.toFixed(1)}% Aderência</p>
                                        </td>
                                        <td className="p-3 text-right pr-4">
                                            <p className="font-semibold text-text-heading/80 tabular-nums">{formatCurrency(r.TratadoValor)}</p>
                                            <p className="text-[10px] text-rose-500 font-medium uppercase">Pend: {formatCurrency(r.PendenteValor)}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Detailed Matrix Table - 12 Columns */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-surface/50">
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Matriz Detalhada por CSD</h3>
                        <p className="text-[10px] text-text-muted uppercase font-medium mt-0.5">Cruzamento dinâmico de desvios por regional integrada</p>
                    </div>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5 text-[9px] uppercase font-semibold text-text-muted">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Tratado
                        </span>
                        <span className="flex items-center gap-1.5 text-[9px] uppercase font-semibold text-text-muted">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Em Aberto
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-surface border-b-2 border-border shadow-sm">
                                <th
                                    className="p-2 pl-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider sticky left-0 z-30 bg-surface border-r border-border cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('Tipo')}
                                >
                                    Motivo {sortConfig?.key === 'Tipo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                {data.regionais_list?.map(reg => (
                                    <th
                                        key={reg}
                                        className="p-2 text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort(reg)}
                                    >
                                        {reg} {sortConfig?.key === reg ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                ))}
                                <th
                                    className="p-2 text-right text-[10px] font-semibold text-primary uppercase tracking-wider bg-primary/5 cursor-pointer"
                                    onClick={() => handleSort('Total')}
                                >
                                    Total {sortConfig?.key === 'Total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[12px]">
                            {getSortedMatrix().map((row, idx) => (
                                <tr key={idx} className="hover:bg-surface/30 transition-colors group">
                                    <td className="p-2 pl-4 font-semibold text-text-heading sticky left-0 z-10 bg-surface group-hover:bg-surface border-r border-border max-w-[200px] truncate">
                                        {row.Tipo}
                                    </td>
                                    {data.regionais_list?.map(reg => {
                                        const totalCell = (row[reg]?.pendente || 0) + (row[reg]?.tratado || 0);
                                        const hasPending = row[reg]?.pendente > 0;
                                        return (
                                            <td key={reg} className="p-2 text-right">
                                                {totalCell > 0 ? (
                                                    <p className={`font-semibold tracking-tight tabular-nums ${hasPending ? 'text-rose-500' : 'text-emerald-500 opacity-60'}`}>{formatCurrency(totalCell)}</p>
                                                ) : <span className="opacity-10">—</span>}
                                            </td>
                                        )
                                    })}
                                    <td className="p-2 text-right bg-primary/5 font-semibold text-text-heading border-l border-border tabular-nums">
                                        {formatCurrency(row._total_impacto)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer System Info */}

        </div>
    )
}


