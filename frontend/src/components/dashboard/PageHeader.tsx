"use client"

import { RefreshButton } from "@/components/ui/RefreshButton"

interface Insight {
    type: "success" | "warning" | "danger" | "info"
    text: string
}

interface PageHeaderProps {
    icon: string
    title: string
    insights?: Insight[]
    fallbackText?: string
    sourceFile?: string
    lastUpdate?: string
    monitoramento?: string
    onRefresh?: () => void
    loading?: boolean
}

// Parse "DD/MM/YYYY HH:MM" → Date
function parseUpdateDate(str: string): Date | null {
    const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
    if (!match) return null
    const [, d, m, y, h, min] = match
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min))
}

function DataFreshnessBadge({ lastUpdate }: { lastUpdate: string }) {
    const updated = parseUpdateDate(lastUpdate)
    if (!updated) return null
    const ageHours = (Date.now() - updated.getTime()) / 3_600_000

    if (ageHours < 2) return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 text-[9px] font-semibold uppercase tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Atualizado
        </span>
    )
    if (ageHours < 6) return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 text-[9px] font-semibold uppercase tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {Math.floor(ageHours)}h atrás
        </span>
    )
    return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-600 text-[9px] font-semibold uppercase tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Desatualizado
        </span>
    )
}

export function PageHeader({
    icon,
    title,
    insights,
    fallbackText,
    sourceFile,
    lastUpdate,
    monitoramento,
    onRefresh,
    loading,
}: PageHeaderProps) {
    const hasFooter = onRefresh || sourceFile || lastUpdate || monitoramento

    return (
        <div className="bg-surface border border-border rounded-sm shadow-sm overflow-hidden">
            <div className="flex items-stretch gap-6 p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                    <span className="material-symbols-outlined text-primary text-[28px]">{icon}</span>
                </div>
                <div className="flex-1 flex flex-col justify-between py-1 gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-[9px] font-semibold uppercase text-text-muted tracking-widest">{title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {insights && insights.length > 0 ? (
                            insights.slice(0, 2).map((ins, i) => (
                                <p key={i} className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                    {ins.text}
                                </p>
                            ))
                        ) : (
                            <p className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                {fallbackText}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right column: button + metadata */}
                {hasFooter && (
                    <div className="flex flex-col items-end justify-center gap-2 min-w-[150px] flex-shrink-0">
                        {onRefresh && <RefreshButton onClick={onRefresh} loading={loading ?? false} />}
                        <div className="text-right">
                            {monitoramento && (
                                <p className="text-[9px] text-text-muted font-semibold uppercase tracking-tight leading-relaxed">
                                    Monitoramento: <span className="text-text-heading/70">{monitoramento}</span>
                                </p>
                            )}
                            {sourceFile && (
                                <p className="text-[9px] text-text-muted font-semibold uppercase tracking-tight leading-relaxed">
                                    Arquivo: <span className="text-text-heading/70 font-semibold">{sourceFile}</span>
                                </p>
                            )}
                            {lastUpdate && (
                                <p className="text-[9px] text-text-muted font-semibold uppercase tracking-tight leading-relaxed">
                                    Último Update: <span className="text-text-heading/70 font-semibold">{lastUpdate}</span>
                                </p>
                            )}
                            {lastUpdate && <div className="flex justify-end mt-1"><DataFreshnessBadge lastUpdate={lastUpdate} /></div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
