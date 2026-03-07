"use client"

import React, { useEffect, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"

interface ParetoChartProps {
    data: { name: string; value: number; pct: number }[]
}

export function ParetoChart({ data }: ParetoChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-[300px] bg-slate-100 /20 rounded-xl" />
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 10, fillOpacity: 0.5 }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={180}
                    tick={{ fill: 'currentColor', fontSize: 11, fillOpacity: 0.8 }}
                />
                <Tooltip
                    cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                    contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--foreground)'
                    }}
                    formatter={(val: any, name: any, props: any) => [
                        `${val} (${props.payload.pct}%)`,
                        'Rejeições'
                    ]}
                />

                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#ef4444" fillOpacity={0.8} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}
