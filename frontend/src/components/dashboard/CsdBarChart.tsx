"use client"

import React, { useEffect, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell, Legend } from "recharts"

interface CsdBarChartProps {
    data: { name: string; prod: number }[]
    meta: number
    onBarClick?: (name: string) => void
    selectedBar?: string | null
    unit?: string
    variant?: 'status' | 'info'
    compareData?: { name: string; prod: number }[]
    compareLabel?: string
}

export function CsdBarChart({ data, meta, onBarClick, selectedBar, unit = "%", variant = 'status', compareData, compareLabel = "Anterior" }: CsdBarChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-full bg-surface rounded-xl" />
    }

    const isTime = unit === "min"
    const hasCompare = !!compareData && compareData.length > 0

    // Merge data with compareData by name when comparison mode is on
    const mergedData = hasCompare
        ? data.map(d => {
            const match = compareData!.find(c => c.name === d.name)
            return { name: d.name, prod: d.prod, prodPrev: match?.prod ?? 0 }
          })
        : data

    const minWidth = mergedData.length > 10 ? mergedData.length * (hasCompare ? 60 : 40) : '100%'

    return (
        <div className="w-full h-full overflow-x-auto custom-scroll relative min-h-0">
            <div style={{ minWidth: minWidth, height: '100%', position: 'relative' }}>
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <BarChart
                            data={mergedData}
                            margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 'bold', fillOpacity: 0.6 }}
                                interval={0}
                                angle={data.length > 8 ? -45 : 0}
                                textAnchor={data.length > 8 ? 'end' : 'middle'}
                                height={60}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 'bold', fillOpacity: 0.6 }}
                                domain={isTime ? [0, 'auto'] : [0, 120]}
                                unit={unit}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(17, 82, 212, 0.05)', opacity: 0.1 }}
                                contentStyle={{
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--surface)',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    padding: '8px 12px'
                                }}
                                itemStyle={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: 'var(--text-heading)'
                                }}
                                labelStyle={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                    textTransform: 'uppercase',
                                    fontWeight: '600'
                                }}
                                formatter={(value: number | undefined, name: string | undefined) => [
                                    `${value ?? 0}${unit}`,
                                    (name ?? '') === 'prod' ? 'Atual' : compareLabel
                                ]}
                            />
                            {hasCompare && (
                                <Legend
                                    wrapperStyle={{ fontSize: '10px', fontWeight: '600', paddingTop: '4px' }}
                                    formatter={(value) => value === 'prod' ? 'Atual' : compareLabel}
                                />
                            )}

                            {variant === 'status' && meta > 0 && (
                                <ReferenceLine
                                    y={meta}
                                    stroke={isTime ? "var(--color-danger)" : "var(--color-success)"}
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    label={{
                                        position: 'right',
                                        value: `META ${meta}${unit}`,
                                        fill: isTime ? 'var(--color-danger)' : 'var(--color-success)',
                                        fontSize: 10,
                                        fontWeight: '900'
                                    }}
                                />
                            )}

                            <Bar
                                dataKey="prod"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={hasCompare ? 28 : 40}
                                animationDuration={1000}
                                onClick={(entry) => {
                                    if (entry && entry.name && onBarClick) {
                                        onBarClick(entry.name);
                                    }
                                }}
                                className="cursor-pointer"
                            >
                                {mergedData.map((entry, index) => {
                                    const isSelected = selectedBar === entry.name;
                                    const hasSelection = !!selectedBar;
                                    const isGood = isTime ? entry.prod <= meta : entry.prod >= meta;
                                    const barColor = variant === 'info' ? 'var(--primary)' : (isGood ? 'var(--color-success)' : 'var(--color-danger)');

                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={barColor}
                                            fillOpacity={hasSelection ? (isSelected ? 1 : 0.3) : 0.9}
                                            stroke={isSelected ? 'var(--text-heading)' : 'none'}
                                            strokeWidth={2}
                                            className="transition-all duration-300"
                                        />
                                    );
                                })}
                            </Bar>
                            {hasCompare && (
                                <Bar
                                    dataKey="prodPrev"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                    animationDuration={1000}
                                    fill="var(--border)"
                                    fillOpacity={0.6}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
