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
    variant?: 'default' | 'transparent'
    subtitle?: string
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
    trendMode = 'up-is-good',
    variant = 'default',
    subtitle
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
        <div className="bg-surface border border-border rounded-sm p-4 shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:border-primary/20 group">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                        {title}
                    </p>
                    {subtitle && <p className="text-[9px] text-slate-400 font-medium uppercase">{subtitle}</p>}
                    {showVariation && variation !== undefined && (
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${varClass} tabular-nums`}>
                            {varLabel}
                        </span>
                    )}
                </div>
                
                <h3 className="text-2xl font-bold text-slate-900 leading-none tracking-tight truncate">
                    {value}
                </h3>
                
                {target !== undefined && (
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        META: <span className="text-slate-600">{target}</span>
                    </p>
                )}
            </div>

            {icon && (
                <div className={`ml-4 shrink-0 w-12 h-12 rounded-sm flex items-center justify-center transition-transform group-hover:scale-110 ${
                    colorValue === 'danger' ? 'bg-rose-50 text-rose-500' :
                    colorValue === 'success' ? 'bg-emerald-50 text-emerald-500' :
                    colorValue === 'warning' ? 'bg-amber-50 text-amber-500' :
                    'bg-primary/10 text-primary'
                }`}>
                    <span className="material-symbols-outlined text-[24px]">
                        {icon}
                    </span>
                </div>
            )}
        </div>
    )
}
