"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { RefreshButton } from "@/components/ui/RefreshButton"

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

export default function Planos5SPage() {
    const [planos, setPlanos] = useState<PlanoAcaoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    // Filtros
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [sensoFilter, setSensoFilter] = useState("ALL")
    const [baseFilter, setBaseFilter] = useState("ALL")
    const [responsavelFilter, setResponsavelFilter] = useState("ALL")

    const loadData = async (forceSync = false) => {
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("5s")
            const response = await api.get('/5s/planos')
            setPlanos(response.data.action_plans || [])
        } catch (err: any) {
            setError(err.message || "Erro ao carregar planos de ação.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    if (!mounted || (loading && planos.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-semibold text-text-muted animate-pulse uppercase tracking-widest">Mapeando Não Conformidades...</p>
            </div>
        )
    }

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">Erro no rastreio de melhorias: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/20 transition-all hover:scale-105">Recarregar Painel</button>
        </div>
    )

    const filteredPlanos = planos.filter(p => {
        const s = searchTerm.toLowerCase();
        const searchMatch = !s ||
            p.base.toLowerCase().includes(s) ||
            p.local.toLowerCase().includes(s) ||
            p.responsavel.toLowerCase().includes(s) ||
            p.acao_sugerida.toLowerCase().includes(s) ||
            p.pergunta.toLowerCase().includes(s);
        const statusMatch = statusFilter === "ALL" || p.status === statusFilter;
        const sensoMatch = sensoFilter === "ALL" || p.codigo.startsWith(sensoFilter);
        const baseMatch = baseFilter === "ALL" || p.base === baseFilter || p.local === baseFilter || `${p.base} / ${p.local}` === baseFilter;
        const responsavelMatch = responsavelFilter === "ALL" || p.responsavel === responsavelFilter;
        return searchMatch && statusMatch && sensoMatch && baseMatch && responsavelMatch;
    });

    const exportXLSX = async () => {
        try {
            const params = new URLSearchParams()
            if (sensoFilter !== 'ALL') params.append('senso', sensoFilter)
            if (statusFilter !== 'ALL') params.append('status', statusFilter)
            if (baseFilter !== 'ALL') params.append('base', baseFilter)
            if (responsavelFilter !== 'ALL') params.append('responsavel', responsavelFilter)

            const response = await api.get(`/5s/planos/export?${params.toString()}`, {
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
            alert('Erro ao gerar arquivo Excel. Tente novamente.')
        }
    }

    const criticosCount = planos.filter(a => a.status === 'CRÍTICO').length;
    const locsSet = new Set(planos.map(a => `${a.base}-${a.local}`));

    // Ofensores e Alertas
    const baseLocalFreq = planos.filter(p => p.status === 'CRÍTICO').reduce((acc, curr) => {
        const key = `${curr.base} / ${curr.local}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topOffender = Object.entries(baseLocalFreq).sort((a, b) => b[1] - a[1])[0] || ["Nenhum", 0];
    const oldestAction = [...planos].sort((a, b) => b.dias_aberto - a.dias_aberto)[0];

    return (
        <div className="space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                <div className="flex-1 bg-surface border border-border p-4 min-h-[105px] rounded-sm flex items-stretch gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                        <span className="material-symbols-outlined text-primary text-[28px]">assignment</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 className="text-[10px] font-semibold uppercase text-text-muted tracking-[0.2em]">Compliance 5S — Plano de Ação</h3>
                        </div>
                        <p className="text-[12px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                            Gestão de Não Conformidades • Auditoria SESMT Digital
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end justify-center gap-2 min-w-[240px]">
                    <div className="flex flex-col items-end gap-2">
                        <RefreshButton onClick={() => loadData(true)} loading={loading} />
                        <button onClick={exportXLSX} className="bg-surface border border-border px-3 py-1.5 rounded-sm flex items-center gap-2 hover:border-primary transition-colors w-fit">
                            <span className="material-symbols-outlined text-sm text-primary">download</span>
                            <span className="text-[10px] font-semibold uppercase text-text-heading">Exportar XLSX</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Total em Aberto"
                    value={planos.length.toString()}
                    target="Pendentes"
                    icon="assignment"
                    colorValue="primary"
                    showVariation={false}
                />
                <KpiCard
                    title="Ações Críticas"
                    value={criticosCount.toString()}
                    target="Vencidos"
                    icon="emergency"
                    colorValue="danger"
                    showVariation={false}
                />
                <KpiCard
                    title="Locais Impactados"
                    value={locsSet.size.toString()}
                    target="Localidades"
                    icon="location_on"
                    colorValue="slate"
                    showVariation={false}
                />
                <div className="bg-surface border border-border px-4 py-3 min-h-[95px] flex flex-col justify-between rounded-sm transition-all hover:border-primary/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:bg-rose-500/10"></div>
                    <div className="flex items-center gap-1.5 h-4 mb-2">
                        <span className="material-symbols-outlined text-[14px] text-rose-500 animate-pulse">new_releases</span>
                        <p className="text-[12px] text-text-muted uppercase font-semibold tracking-tight">Alertas e Ofensores</p>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[9px] font-semibold uppercase text-text-muted/70">Top Crítico:</span>
                            <span className="text-[10px] font-semibold uppercase text-rose-500 truncate text-right flex-1">{topOffender[0]}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[9px] font-semibold uppercase text-text-muted/70">Maior Idade:</span>
                            <span className="text-[10px] font-semibold uppercase text-amber-500 truncate text-right flex-1">{oldestAction?.responsavel || '--'} ({oldestAction?.dias_aberto || 0}D)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-surface border border-border p-3 rounded-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">search</span>
                    <input
                        type="text"
                        placeholder="BUSCAR POR LOCAL, RESPONSÁVEL OU DESCRIÇÃO..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-1.5 text-[10px] font-semibold uppercase border-none focus:ring-0 bg-transparent placeholder:text-text-muted/50 "
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                    <div className="bg-surface/50 px-2 py-1 rounded-sm border border-border shrink-0">
                        <select
                            value={baseFilter}
                            onChange={(e) => setBaseFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[9px] font-semibold uppercase tracking-tighter text-text-muted cursor-pointer"
                        >
                            <option value="ALL">BASE/LOCAL</option>
                            {Array.from(new Set(planos.map(p => `${p.base} / ${p.local}`))).sort().map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-surface/50 px-2 py-1 rounded-sm border border-border shrink-0">
                        <select
                            value={responsavelFilter}
                            onChange={(e) => setResponsavelFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[9px] font-semibold uppercase tracking-tighter text-text-muted cursor-pointer"
                        >
                            <option value="ALL">RESPONSÁVEL</option>
                            {Array.from(new Set(planos.map(p => p.responsavel))).sort().map(resp => (
                                <option key={resp} value={resp}>{resp}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-surface/50 px-2 py-1 rounded-sm border border-border shrink-0">
                        <select
                            value={sensoFilter}
                            onChange={(e) => setSensoFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[9px] font-semibold uppercase tracking-tighter text-text-muted cursor-pointer"
                        >
                            <option value="ALL">TODOS OS SENSOS</option>
                            <option value="S01">1S - UTILIZAÇÃO</option>
                            <option value="S02">2S - ORGANIZAÇÃO</option>
                            <option value="S03">3S - LIMPEZA</option>
                            <option value="S04">4S - PADRONIZAÇÃO</option>
                            <option value="S05">5S - DISCIPLINA</option>
                        </select>
                    </div>

                    <div className="bg-surface/50 px-2 py-1 rounded-sm border border-border shrink-0">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[9px] font-semibold uppercase tracking-tighter text-text-muted cursor-pointer"
                        >
                            <option value="ALL">STATUS GLOBAL</option>
                            <option value="CRÍTICO">CRÍTICOS</option>
                            <option value="PENDENTE">PENDENTES</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-surface/50 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                            <tr>
                                <th className="p-2 pl-4">Base / local</th>
                                <th className="p-2">Responsável</th>
                                <th className="p-2">Indício de Falha (GAP)</th>
                                <th className="p-2">Ação Sugerida</th>
                                <th className="p-2 text-center">Idade</th>
                                <th className="p-2 text-right pr-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[12px]">
                            {filteredPlanos.length > 0 ? filteredPlanos.map((plano, idx) => (
                                <tr key={`${plano.id}-${idx}`} className="hover:bg-surface/50 transition-colors group">
                                    <td className="p-2 pl-4">
                                        <p className="text-[10px] text-text-muted font-semibold uppercase mb-0.5">{plano.base}</p>
                                        <p className="text-text-heading uppercase font-semibold">{plano.local}</p>
                                    </td>
                                    <td className="p-2 text-text-muted uppercase font-medium leading-tight">{plano.responsavel}</td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-1.5 py-0.5 bg-primary/5 text-primary text-[10px] font-semibold rounded-sm border border-primary/10">{plano.codigo}</span>
                                            <span className="text-[10px] text-text-muted/50 font-semibold uppercase">Cultura 5S</span>
                                        </div>
                                        <p className="text-[12px] text-text-muted font-medium italic max-w-[300px] line-clamp-2 leading-tight">"{plano.pergunta}"</p>
                                    </td>
                                    <td className="p-2">
                                        <div className="p-2 border border-border border-dashed rounded-sm bg-surface/30">
                                            <p className="text-[12px] text-text-heading font-semibold uppercase leading-tight">{plano.acao_sugerida}</p>
                                        </div>
                                    </td>
                                    <td className="p-2 text-center">
                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-semibold ${plano.dias_aberto >= 30 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                                            {plano.dias_aberto} Dias
                                        </div>
                                    </td>
                                    <td className="p-2 text-right pr-4">
                                        <span className={`px-2 py-1 rounded-sm text-[9px] font-semibold uppercase tracking-widest ${plano.status === 'CRÍTICO' ? 'bg-rose-500 text-white' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                            {plano.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <span className="material-symbols-outlined text-4xl text-text-muted/20 block mb-2">task_alt</span>
                                        <p className="text-[10px] font-semibold text-text-muted/50 uppercase tracking-widest">Nenhuma não conformidade mapeada no ciclo</p>
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


