"use client"

import React from "react"

interface KpiCardProps {
    title: string
    value: React.ReactNode
    target?: string | number
    variation?: number | string
    icon?: string
    colorValue?: 'primary' | 'success' | 'danger' | 'warning' | 'slate'
    showVariation?: boolean
    trendMode?: 'up-is-good' | 'down-is-good'
}

export function KpiCard({
    title,
    value,
    target,
    variation,
    icon,
    colorValue = 'primary',
    showVariation = true,
    trendMode = 'up-is-good'
}: KpiCardProps) {
    const isNegative = typeof variation === 'number' ? variation < 0 : variation?.toString().startsWith('-')

    // If trendMode is 'down-is-good', negative variation is GOOD (green)
    const isGoodTrend = trendMode === 'down-is-good' ? isNegative : !isNegative
    const varColorClass = isGoodTrend ? 'text-emerald-500' : 'text-rose-500'

    return (
        <div className="bg-surface border border-border px-3 py-3 min-h-[95px] flex items-stretch gap-2 rounded-sm transition-all hover:border-primary/50 overflow-hidden">
            <div className="flex-[3] flex flex-col justify-between min-w-0">
                <div className="flex items-center gap-1.5 h-4 text-slate-400">
                    {icon && <span className="material-symbols-outlined text-[14px] shrink-0 font-light">{icon}</span>}
                    <p className="text-[9px] uppercase font-medium tracking-wide truncate">{title}</p>
                </div>
                <div className="flex items-baseline mt-auto h-6">
                    <p className="text-lg font-semibold text-text-heading leading-none tracking-tight truncate">{value}</p>
                </div>
            </div>

            {showVariation && (
                <>
                    <div className="w-[1px] bg-border/40 shrink-0 my-2" />
                    <div className="flex-[2] flex flex-col justify-between items-end min-w-[60px] shrink-0">
                        <p className="text-[8px] text-slate-400 uppercase font-medium tracking-wide h-4">VAR%</p>
                        <p className={`text-[11px] font-semibold h-6 flex items-end justify-end tabular-nums whitespace-nowrap ${varColorClass}`}>
                            {variation !== undefined ? (typeof variation === 'number' ? (variation > 0 ? `+${variation.toFixed(1)}%` : `${variation.toFixed(1)}%`) : variation) : '0.0%'}
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
