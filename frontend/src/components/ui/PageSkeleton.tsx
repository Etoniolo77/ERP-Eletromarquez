import React from "react"

function SkBlock({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <div className={`bg-border/30 rounded-sm animate-pulse ${className}`} style={style} />
}

export function KpiGridSkeleton({ cols = 4 }: { cols?: number }) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
            {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-sm p-4 flex flex-col gap-3">
                    <SkBlock className="h-3 w-24" />
                    <SkBlock className="h-7 w-20" />
                    <SkBlock className="h-2 w-16" />
                </div>
            ))}
        </div>
    )
}

export function ChartSkeleton({ height = 400 }: { height?: number }) {
    return (
        <div className="bg-surface border border-border rounded-sm p-4 flex flex-col gap-4" style={{ height }}>
            <div className="flex justify-between items-center">
                <SkBlock className="h-3 w-40" />
                <SkBlock className="h-7 w-32" />
            </div>
            <div className="flex-1 flex items-end gap-2 pt-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <SkBlock
                        key={i}
                        className="flex-1"
                        style={{ height: `${30 + Math.sin(i) * 30 + 40}%` }}
                    />
                ))}
            </div>
        </div>
    )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-border flex gap-2">
                <SkBlock className="h-3 w-32" />
            </div>
            <div className="divide-y divide-border">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-3 px-4">
                        {Array.from({ length: cols }).map((_, j) => (
                            <SkBlock key={j} className={`h-3 ${j === 0 ? 'flex-1' : 'w-16'}`} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

export function PageHeaderSkeleton() {
    return (
        <div className="bg-surface border border-border rounded-sm overflow-hidden">
            <div className="flex items-center gap-6 p-4">
                <SkBlock className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-3">
                    <SkBlock className="h-2 w-48" />
                    <SkBlock className="h-3 w-72" />
                    <SkBlock className="h-3 w-56" />
                </div>
            </div>
            <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4">
                <SkBlock className="h-2 w-32" />
                <SkBlock className="h-2 w-28" />
            </div>
        </div>
    )
}

export function DashboardSkeleton({ kpis = 4, charts = 1, tables = 2 }: { kpis?: number; charts?: number; tables?: number }) {
    return (
        <div className="p-4 space-y-4">
            <PageHeaderSkeleton />
            <KpiGridSkeleton cols={kpis} />
            {Array.from({ length: charts }).map((_, i) => (
                <ChartSkeleton key={i} />
            ))}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: tables }).map((_, i) => (
                    <TableSkeleton key={i} />
                ))}
            </div>
        </div>
    )
}
