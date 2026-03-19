"use client"

import React, { useEffect, useState } from "react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts"

interface ParetoChartProps {
    data: { name: string; value: number; pct: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const bar = payload.find((p: any) => p.dataKey === 'value')
    const line = payload.find((p: any) => p.dataKey === 'cumPct')
    return (
        <div className="bg-surface border border-border rounded-sm p-3 shadow-xl text-[11px] max-w-[260px]">
            <p className="font-semibold text-text-heading uppercase tracking-tight mb-2 leading-tight">{label}</p>
            {bar && <p className="text-rose-500 font-bold">{bar.value} ocorrência{bar.value !== 1 ? 's' : ''}</p>}
            {line && <p className="text-primary font-semibold">Acumulado: {line.value?.toFixed(1)}%</p>}
        </div>
    )
}

export function ParetoChart({ data }: ParetoChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-[300px] bg-slate-100 /20 rounded-xl" />
    }

    // Calcular % cumulativa corretamente
    const total = data.reduce((sum, d) => sum + d.value, 0)
    let cumulative = 0
    const enriched = data.map((d) => {
        cumulative += d.value
        return { ...d, cumPct: total > 0 ? Math.round((cumulative / total) * 1000) / 10 : 0 }
    })

    const maxVal = Math.max(...data.map(d => d.value))

    return (
        <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
                data={enriched}
                layout="vertical"
                margin={{ top: 5, right: 55, left: 0, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 10, fillOpacity: 0.5 }}
                    domain={[0, maxVal > 0 ? Math.ceil(maxVal * 1.1) : 10]}
                    allowDecimals={false}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    type="number"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--primary)', fontSize: 10, fillOpacity: 0.8 }}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={200}
                    tick={{ fill: 'currentColor', fontSize: 10, fillOpacity: 0.8 }}
                    tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 28) + '…' : v}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.2 }} />
                <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                />
                <Bar dataKey="value" name="Ocorrências" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {enriched.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill="#ef4444"
                            fillOpacity={1 - (index * 0.12)}
                        />
                    ))}
                </Bar>
                <Line
                    yAxisId="right"
                    dataKey="cumPct"
                    name="% Acumulado"
                    type="monotone"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--primary)', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                />
            </ComposedChart>
        </ResponsiveContainer>
    )
}
