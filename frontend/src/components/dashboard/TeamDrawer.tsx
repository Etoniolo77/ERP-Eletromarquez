"use client"

import { useEffect, useRef, useState } from "react"
import api from "@/lib/api"
import { CSVExportButton } from "@/components/ui/CSVExportButton"

interface TeamMetric {
    label: string
    value: string | number
    unit?: string
    icon: string
    color: string
}

interface TeamDetail {
    equipe: string
    csd: string
    produtividade?: number
    ociosidade?: number
    saida_base?: number
    retorno_base?: number
    notas?: number
    rejeitadas?: number
    interrompidas?: number
    [key: string]: unknown
}

interface TeamDrawerProps {
    team: TeamDetail | null
    onClose: () => void
    period: string
    sector?: string
}

interface HistoryPoint {
    data: string
    ocupacao: number
    ociosidade: number
    saida_base: number
}

export function TeamDrawer({ team, onClose, period, sector }: TeamDrawerProps) {
    const [history, setHistory] = useState<HistoryPoint[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!team) return
        setLoadingHistory(true)
        setHistory([])
        const abort = new AbortController()

        const params = new URLSearchParams({
            periodo: period,
            view: "equipe",
            equipe: team.equipe,
        })
        if (sector) params.set("sector", sector)

        api.get(`/produtividade/dashboard?${params}`, { signal: abort.signal })
            .then(res => {
                const d = res.data
                if (d?.chart?.labels?.length) {
                    const points: HistoryPoint[] = d.chart.labels.map((lbl: string, i: number) => ({
                        data: lbl,
                        ocupacao: d.chart.data[i] ?? 0,
                        ociosidade: 0,
                        saida_base: 0,
                    }))
                    setHistory(points)
                }
            })
            .catch(() => {})
            .finally(() => setLoadingHistory(false))

        return () => abort.abort()
    }, [team?.equipe, period, sector])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [onClose])

    if (!team) return null

    const metrics: TeamMetric[] = [
        { label: "Ocupação", value: team.produtividade ?? "—", unit: "%", icon: "trending_up", color: team.produtividade != null && team.produtividade >= 95 ? "text-emerald-500" : "text-rose-500" },
        { label: "Ociosidade", value: team.ociosidade ?? "—", unit: "min", icon: "schedule", color: "text-amber-500" },
        { label: "Saída de Base", value: team.saida_base ?? "—", unit: "min", icon: "login", color: "text-blue-500" },
        { label: "Retorno à Base", value: team.retorno_base ?? "—", unit: "min", icon: "logout", color: "text-purple-500" },
        { label: "Notas Exec.", value: team.notas ?? "—", icon: "task_alt", color: "text-emerald-500" },
        { label: "Rejeitadas", value: team.rejeitadas ?? "—", icon: "cancel", color: "text-rose-500" },
        { label: "Interrompidas", value: team.interrompidas ?? "—", icon: "running_with_errors", color: "text-amber-500" },
    ]

    const maxVal = history.length ? Math.max(...history.map(h => h.ocupacao), 1) : 1

    return (
        <>
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-background border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface/60">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-text-heading">{team.equipe}</h2>
                        <p className="text-[10px] text-text-muted font-medium uppercase mt-0.5">{team.csd}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-sm flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                    {/* Metrics Grid */}
                    <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mb-3">Indicadores do Período</p>
                        <div className="grid grid-cols-2 gap-2">
                            {metrics.map((m, i) => (
                                <div key={i} className="bg-surface border border-border rounded-sm p-3 flex items-center gap-3">
                                    <span className={`material-symbols-outlined text-[18px] ${m.color}`}>{m.icon}</span>
                                    <div>
                                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-tight">{m.label}</p>
                                        <p className={`text-sm font-bold tabular-nums ${m.color}`}>
                                            {m.value}{m.unit && <span className="text-[10px] text-text-muted ml-0.5">{m.unit}</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mini Sparkline */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Evolução de Ocupação</p>
                            {history.length > 0 && (
                                <CSVExportButton
                                    data={history as unknown as Record<string, unknown>[]}
                                    filename={`historico_${team.equipe.replace(/\s+/g, "_")}`}
                                />
                            )}
                        </div>

                        {loadingHistory ? (
                            <div className="h-20 bg-surface border border-border rounded-sm animate-pulse" />
                        ) : history.length === 0 ? (
                            <div className="h-20 bg-surface border border-border rounded-sm flex items-center justify-center">
                                <p className="text-[10px] text-text-muted">Sem histórico disponível</p>
                            </div>
                        ) : (
                            <div className="bg-surface border border-border rounded-sm p-3">
                                <div className="flex items-end gap-1 h-16">
                                    {history.map((h, i) => {
                                        const pct = (h.ocupacao / maxVal) * 100
                                        const isGood = h.ocupacao >= 95
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${h.data}: ${h.ocupacao}%`}>
                                                <div
                                                    className={`w-full rounded-sm transition-all ${isGood ? "bg-emerald-500" : "bg-rose-500"} opacity-70 group-hover:opacity-100`}
                                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[8px] text-text-muted">{history[0]?.data}</span>
                                    <span className="text-[8px] text-text-muted">{history[history.length - 1]?.data}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border bg-surface/40">
                    <button
                        onClick={onClose}
                        className="w-full py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-primary border border-border hover:border-primary/40 rounded-sm transition-all"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </>
    )
}
