"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
    title: string
    value: React.ReactNode
    target?: string | number
    variation?: number | string
    icon?: React.ReactNode
    colorValue?: "primary" | "success" | "danger" | "warning" | "slate"
    showVariation?: boolean
    trendMode?: "up-is-good" | "down-is-good"
    description?: string
}

export function KpiCard({
    title,
    value,
    variation,
    icon,
    showVariation = true,
    trendMode = "up-is-good",
    description,
}: KpiCardProps) {
    const isNegative =
        typeof variation === "number"
            ? variation < 0
            : variation?.toString().startsWith("-")

    // If trendMode is 'down-is-good', negative variation is GOOD (green)
    const isGoodTrend = trendMode === "down-is-good" ? isNegative : !isNegative
    const varColorClass = isGoodTrend ? "text-emerald-500" : "text-rose-500"

    return (
        <div className="bg-white border border-gray-200 px-4 py-4 min-h-[100px] flex items-stretch gap-3 rounded-xl transition-all hover:border-blue-500/50 shadow-sm overflow-hidden">
            <div className="flex-[3] flex flex-col justify-between min-w-0">
                <div className="flex items-center gap-2 text-gray-400">
                    {icon && <div className="shrink-0">{icon}</div>}
                    <p className="text-xs uppercase font-semibold tracking-wider truncate">
                        {title}
                    </p>
                </div>
                <div className="flex flex-col mt-auto">
                    <p className="text-2xl font-bold text-gray-900 leading-none tracking-tight truncate">
                        {value}
                    </p>
                    {description && (
                        <p className="text-[10px] text-gray-400 font-medium mt-1 leading-tight">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {showVariation && (
                <>
                    <div className="w-[1px] bg-gray-100 shrink-0 my-1" />
                    <div className="flex-[2] flex flex-col justify-center items-end min-w-[70px] shrink-0">
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1.5">
                            VAR%
                        </p>
                        <p
                            className={cn(
                                "text-sm font-bold tabular-nums whitespace-nowrap",
                                varColorClass
                            )}
                        >
                            {variation !== undefined
                                ? typeof variation === "number"
                                    ? variation > 0
                                        ? `+${variation.toFixed(1)}%`
                                        : `${variation.toFixed(1)}%`
                                    : variation
                                : "0.0%"}
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
