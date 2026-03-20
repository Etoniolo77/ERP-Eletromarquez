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
    
    // Altura do gráfico deve ser proporcional ao número de itens para não ficar apertado?
    // Não, o usuário pediu LARGURA dinâmica no eixo X.
    // Em um gráfico de barras verticais (Pareto tradicional), o eixo X é horizontal.
    // Se temos muitos itens, a largura deve aumentar e permitir scroll.
    const minWidth = data.length > 6 ? data.length * 80 : '100%'

    return (
        <div className="w-full h-full overflow-x-auto custom-scroll relative">
            <div style={{ minWidth: minWidth, height: '100%' }}>
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                        data={enriched}
                        margin={{ top: 20, right: 40, left: 10, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            tick={(props: any) => {
                                const { x, y, payload } = props;
                                const text = payload.value;
                                const truncated = text.length > 15 ? text.slice(0, 15) + '…' : text;
                                return (
                                    <g transform={`translate(${x},${y})`}>
                                        <text
                                            x={0}
                                            y={0}
                                            dy={16}
                                            textAnchor="end"
                                            fill="currentColor"
                                            className="text-[9px] font-bold uppercase fill-text-muted"
                                            transform="rotate(-35)"
                                        >
                                            {truncated}
                                        </text>
                                    </g>
                                );
                            }}
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'currentColor', fontSize: 10, fillOpacity: 0.5 }}
                            label={{ value: 'Ocorrências', angle: -90, position: 'insideLeft', offset: 0, fontSize: 9, fontWeight: '700', fill: 'var(--text-muted)' }}
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
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.1 }} />
                        <Legend
                            verticalAlign="top"
                            align="right"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        />
                        <Bar yAxisId="left" dataKey="value" name="Ocorrências" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {enriched.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? "#f43f5e" : "#fb7185"}
                                    fillOpacity={0.9}
                                />
                            ))}
                        </Bar>
                        <Line
                            yAxisId="right"
                            dataKey="cumPct"
                            name="% Acumulado"
                            type="monotone"
                            stroke="var(--primary)"
                            strokeWidth={3}
                            dot={{ fill: 'var(--primary)', r: 4, strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

