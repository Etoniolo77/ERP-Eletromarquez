"use client"

import { RefreshButton } from "@/components/ui/RefreshButton"
import { PeriodSelector } from "@/components/providers/PeriodSelector"

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
    children?: React.ReactNode
    showPeriodSelector?: boolean
    tabs?: { id: string; label: string; icon: string }[]
    activeTab?: string
    onTabChange?: (id: string) => void
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
    children,
    showPeriodSelector,
    tabs,
    activeTab,
    onTabChange
}: PageHeaderProps) {
    const hasFooter = onRefresh || sourceFile || lastUpdate || monitoramento || children || showPeriodSelector || (tabs && tabs.length > 0)

    return (
        <div className="bg-surface border border-border shadow-sm flex flex-col mb-4 overflow-hidden rounded-sm transition-all hover:border-primary/30">
            <div className="flex items-stretch gap-6 p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
                    <span className="material-symbols-outlined text-primary text-[28px]">{icon}</span>
                </div>
                <div className="flex-1 flex flex-col py-1 gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-[10px] font-semibold uppercase text-text-muted tracking-[0.2em]">{title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {insights && insights.length > 0 ? (
                            insights.slice(0, 2).map((ins, i) => (
                                <p key={i} className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                    {ins.text.replace(/(\d+\.\d{2,})([%a-zA-Z]*)/g, (_, num, unit) => `${parseFloat(num).toFixed(1)}${unit}`)}
                                </p>
                            ))
                        ) : (
                            <p className="text-[11px] font-medium text-text-heading leading-tight border-l-2 border-primary/30 pl-3">
                                {fallbackText}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {hasFooter && (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between border-t border-border px-4 py-2 bg-transparent gap-4 min-h-[48px]">
                    <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar min-w-0 pr-4 flex-1">
                        {tabs && tabs.length > 0 ? tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange?.(tab.id)}
                                className={`flex items-center gap-2 py-2 text-[11px] font-semibold uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-text-muted hover:text-text-heading'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary animate-in fade-in duration-300" />}
                            </button>
                        )) : <div className="flex-1" />}
                    </div>

                    <div className="flex flex-wrap items-center lg:justify-end gap-3 flex-shrink-0">
                        {showPeriodSelector && <PeriodSelector />}
                        {children}
                        {onRefresh && (
                            <div className="border-l border-border/50 pl-3">
                                <RefreshButton onClick={onRefresh} loading={loading ?? false} />
                            </div>
                        )}
                        <div className="flex items-center gap-3 border-l border-border/50 pl-3">
                            {lastUpdate && <DataFreshnessBadge lastUpdate={lastUpdate} />}
                            {(sourceFile || lastUpdate) && (
                                <div className="flex flex-col text-right">
                                    {sourceFile && (
                                        <span className="text-[8px] text-text-muted font-medium uppercase tracking-tighter truncate max-w-[150px]" title={sourceFile}>
                                            ARQ: {sourceFile}
                                        </span>
                                    )}
                                    {lastUpdate && (
                                        <span className="text-[8px] text-text-muted font-medium uppercase tracking-tighter">
                                            UPD: {lastUpdate}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
