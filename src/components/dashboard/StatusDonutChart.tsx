"use client"

import React, { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface StatusDonutChartProps {
    data: { name: string; value: number }[]
    colorMap?: Record<string, string>
}

const DEFAULT_COLORS: Record<string, string> = {
    'Procedente': '#10b981', // success
    'Improcedente': '#ef4444', // danger
    'Em Análise': '#f59e0b', // warning
    'Não Tratado': '#94a3b8'  // slate-400
};

export function StatusDonutChart({ data, colorMap = DEFAULT_COLORS }: StatusDonutChartProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !data || data.length === 0) {
        return <div className="animate-pulse w-full h-[280px] bg-slate-100 /20 rounded-xl" />
    }

    const getColor = (name: string) => {
        return colorMap[name] || '#64748b';
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--foreground)'
                    }}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
            </PieChart>
        </ResponsiveContainer>
    )
}
