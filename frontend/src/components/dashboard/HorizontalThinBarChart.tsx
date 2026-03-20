"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"

interface HorizontalThinBarChartProps {
    data: { name: string; value: number }[]
    valueFormatter?: (value: number) => string
    color?: string
    gradientId?: string
}

export function HorizontalThinBarChart({
    data,
    valueFormatter = (val) => val.toString(),
    color = "#3b82f6",
    gradientId = "barGradient"
}: HorizontalThinBarChartProps) {
    if (!data || data.length === 0) {
        return <div className="animate-pulse w-full h-[220px] bg-slate-100 /20 rounded-xl" />
    }

    // Calcular altura dinâmica para evitar espaçamento excessivo
    // Se tiver poucos itens, não precisa de 300px
    const dynamicHeight = Math.max(160, Math.min(data.length * 45, 300));

    // Cores premium baseadas na cor principal
    const secondaryColor = color === "#3b82f6" ? "#60a5fa" : (color === "#10b981" ? "#34d399" : color);

    return (
        <ResponsiveContainer width="100%" height={dynamicHeight}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                barGap={0}
            >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: '600', fillOpacity: 0.8 }}
                    width={130}
                    interval={0}
                />
                <Tooltip
                    cursor={{ fill: 'var(--border)', opacity: 0.1 }}
                    contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--foreground)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        padding: '8px 12px'
                    }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                    formatter={(value: any) => [valueFormatter(value), 'Valor']}
                />
                <Bar
                    dataKey="value"
                    fill={color}
                    radius={[0, 10, 10, 0]}
                    barSize={12}
                    animationDuration={1500}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}
