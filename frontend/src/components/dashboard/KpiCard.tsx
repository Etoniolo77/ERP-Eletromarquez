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

const accentColors: Record<NonNullable<KpiCardProps['colorValue']>, string> = {
    primary: 'border-l-blue-500',
    success: 'border-l-emerald-500',
    danger: 'border-l-rose-500',
    warning: 'border-l-amber-500',
    slate: 'border-l-slate-400',
}

const badgeBg: Record<string, string> = {
    good: 'bg-emerald-50 text-emerald-600',
    bad: 'bg-rose-50 text-rose-600',
    neutral: 'bg-slate-100 text-slate-500',
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
    const accent = accentColors[colorValue]
    const isNegative = typeof variation === 'number' ? variation < 0 : variation?.toString().startsWith('-')
    const isGoodTrend = trendMode === 'down-is-good' ? isNegative : !isNegative
    const varClass = variation !== undefined
        ? (typeof variation === 'number' && variation === 0 ? badgeBg.neutral : isGoodTrend ? badgeBg.good : badgeBg.bad)
        : badgeBg.neutral

    const varLabel = variation !== undefined
        ? (typeof variation === 'number'
            ? (variation > 0 ? `+${variation.toFixed(1)}%` : `${variation.toFixed(1)}%`)
            : variation)
        : '—'

    return (
        <div className={`bg-white border border-slate-200 border-l-4 ${accent} rounded-sm px-4 py-3.5 min-h-[100px] flex flex-col justify-between transition-all hover:shadow-sm`}>
            {/* Header */}
            <div className="flex items-center gap-1.5 text-slate-400">
                {icon && (
                    <span className="material-symbols-outlined text-[13px] shrink-0 font-light">
                        {icon}
                    </span>
                )}
                <p className="text-[10px] uppercase font-semibold tracking-widest truncate">
                    {title}
                </p>
            </div>

            {/* Value + Badge */}
            <div className="flex items-end justify-between gap-2 mt-2">
                <p className="text-xl font-bold text-slate-900 leading-none tracking-tight truncate">
                    {value}
                </p>
                {showVariation && (
                    <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded ${varClass} tabular-nums whitespace-nowrap`}>
                        {varLabel}
                    </span>
                )}
            </div>

            {/* Target */}
            {target !== undefined && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                    Meta: <span className="font-medium text-slate-600">{target}</span>
                </p>
            )}
        </div>
    )
}
