"use client"

import React, { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface EvolucaoLineChartProps {
    data: { name: string; value: number }[]
}

export function EvolucaoLineChart({ data }: EvolucaoLineChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-[300px] bg-slate-100 /20 rounded-xl" />
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 11, fillOpacity: 0.7 }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 11, fillOpacity: 0.7 }}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                    cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--foreground)'
                    }}
                    formatter={(val: any) => [`${val}%`, 'Conformidade']}
                />

                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={4}
                    dot={{ fill: "#2563eb", strokeWidth: 2, r: 4, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}
