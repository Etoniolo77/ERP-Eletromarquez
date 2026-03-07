"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"

interface HistoricoRow {
    data: string
    base: string
    local: string
    tipo: string
    nota: number
    inspetor: string
}

export default function Historico5SPage() {
    const [history, setHistory] = useState<HistoricoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            try {
                const response = await api.get('/5s/historico')
                setHistory(response.data.items || [])
            } catch (err: any) {
                setError(err.message || "Erro ao carregar histórico.")
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const filtered = history.filter(h =>
        h.base.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.inspetor.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading && history.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-text-muted animate-pulse uppercase tracking-widest">Compilando Histórico de Auditorias...</p>
        </div>
    )

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">Falha no registro histórico: {error}</p>
        </div>
    )

    return (
        <div className="space-y-4 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                <div className="flex-1 bg-surface border border-border p-4 min-h-[105px] rounded-sm flex items-stretch gap-6 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                        <span className="material-symbols-outlined text-primary text-[28px]">history</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 className="text-[10px] font-semibold uppercase text-text-muted tracking-[0.2em]">Histórico 5S — Registro de Inspeções</h3>
                        </div>
                        <p className="text-[12px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                            Log Global de Auditorias SESMT • Auditoria Contínua
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end justify-center gap-2 min-w-[240px]">
                    <div className="flex items-center gap-3">
                        <div className="bg-surface border border-border px-3 py-1.5 rounded-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-text-muted">search</span>
                            <input
                                type="text"
                                placeholder="BUSCAR LOCAL, REGIONAL OU INSPETOR..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] font-semibold uppercase tracking-tighter text-text-heading cursor-pointer w-[250px] placeholder:text-text-muted/50"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden min-h-[500px]">
                <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Mapa de Inspeções Realizadas</h3>
                    <span className="px-2 py-1 bg-primary text-white text-[9px] font-semibold uppercase rounded-sm">{history.length} Registros</span>
                </div>
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-surface/95 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                            <tr>
                                <th className="p-2 pl-4">Data / Hora</th>
                                <th className="p-2">Regional</th>
                                <th className="p-2">Local Auditado</th>
                                <th className="p-2 text-center">Tipo</th>
                                <th className="p-2 text-center">Nota Final (%)</th>
                                <th className="p-2 pr-4">Responsável Técnico</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[12px]">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <p className="text-[10px] font-semibold text-text-muted/50 uppercase tracking-widest">Nenhuma auditoria encontrada para o critério</p>
                                    </td>
                                </tr>
                            ) : filtered.map((row, idx) => (
                                <tr key={idx} className="hover:bg-surface/50 transition-colors group">
                                    <td className="p-2 pl-4 font-semibold text-text-heading tabular-nums group-hover:text-primary transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[14px] text-text-muted/50">calendar_month</span>
                                            {row.data}
                                        </div>
                                    </td>
                                    <td className="p-2 text-text-muted font-semibold uppercase">{row.base}</td>
                                    <td className="p-2 text-text-heading uppercase truncate max-w-[280px]" title={row.local}>{row.local}</td>
                                    <td className="p-2 text-center">
                                        <span className="bg-surface text-text-muted px-2 py-0.5 rounded-sm text-[9px] font-semibold uppercase border border-border">{row.tipo}</span>
                                    </td>
                                    <td className="p-2 text-center">
                                        <span className={`inline-flex items-center justify-center px-4 py-1 rounded-sm text-[11px] font-semibold tabular-nums min-w-[70px] ${row.nota >= 90 ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/10' : row.nota >= 75 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                                            {row.nota}%
                                        </span>
                                    </td>
                                    <td className="p-2 pr-4 text-text-muted uppercase font-semibold italic">{row.inspetor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}

        </div>
    )
}


