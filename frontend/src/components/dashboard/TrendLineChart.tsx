"use client"

import React, { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface TrendLineChartProps {
    data: any[]
    tooltipLabel?: string
    color?: string
    lines?: { key: string; color: string; label?: string }[]
    isCurrency?: boolean
    yDomain?: [number, number]
}

export function TrendLineChart({
    data,
    tooltipLabel = "Volume",
    color = "#ef4444",
    lines,
    isCurrency = true,
    yDomain
}: TrendLineChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-[260px] bg-slate-100 /20 rounded-xl" />
    }

    const activeLines = lines && lines.length > 0
        ? lines
        : [{ key: 'value', color: color, label: tooltipLabel }];

    return (
        <div className="w-full h-full relative min-h-0">
            <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    <LineChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 900, fillOpacity: 0.7 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 900, fillOpacity: 0.7 }}
                            tickFormatter={(v) => isCurrency ? `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}` : v}
                            domain={yDomain || ['auto', 'auto']}
                            allowDataOverflow={true}
                        />
                        <Tooltip
                            cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                color: 'var(--foreground)',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                padding: '12px',
                            }}
                            itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                            labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            formatter={(value: any) => [
                                isCurrency
                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
                                    : value,
                                ""
                            ]}
                        />

                        {lines && lines.length > 1 && (
                            <Legend
                                verticalAlign="top"
                                align="right"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '20px' }}
                            />
                        )}

                        {activeLines.map((line, idx) => (
                            <Line
                                key={line.key}
                                name={line.label || line.key}
                                type="monotone"
                                dataKey={line.key}
                                stroke={line.color || "#ef4444"}
                                strokeWidth={4}
                                dot={{ fill: line.color || "#ef4444", strokeWidth: 2, r: 3, stroke: "#fff" }}
                                activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--primary)' }}
                                animationDuration={1500}
                                connectNulls={true}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
