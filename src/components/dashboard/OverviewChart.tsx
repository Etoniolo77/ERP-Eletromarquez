"use client"

import React, { useState, useEffect } from "react"
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import api from "@/lib/api"

interface EvolucaoRow {
    data: string
    produtividade: number
    eficacia: number
}

export function OverviewChart() {
    const [chartData, setChartData] = useState<EvolucaoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        async function loadChartData() {
            try {
                const response = await api.get('/produtividade/evolucao')
                setChartData(response.data)
            } catch (err) {
                console.error("Erro ao carregar dados do gráfico", err)
            } finally {
                setLoading(false)
            }
        }
        loadChartData()
    }, [])

    if (!mounted || loading) return <div className="animate-pulse w-full h-[350px] bg-slate-100 /20 rounded-xl" />
    if (chartData.length === 0) return <div className="text-center text-slate-400 py-20 h-[350px]">Nenhuma evolução encontrada nesse período.</div>

    return (
        <ResponsiveContainer width="100%" height={350}>
            <LineChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                    dataKey="data"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
                    domain={['auto', 'auto']}
                    dx={-10}
                />
                <Tooltip
                    contentStyle={{
                        borderRadius: '16px',
                        border: 'none',
                        backgroundColor: 'var(--surface)',
                        padding: '16px',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)'
                    }}
                    labelStyle={{ fontSize: '11px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-heading)', textTransform: 'uppercase' }}
                    itemStyle={{ fontSize: '13px', fontWeight: '600', padding: '2px 0' }}
                />

                {/* Linha de Produtividade */}
                <Line
                    type="monotone"
                    dataKey="produtividade"
                    name="Produtividade (%)"
                    stroke="var(--primary)"
                    strokeWidth={4}
                    dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2, stroke: "var(--surface)" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                />

                {/* Linha de Eficacia (Meta) */}
                <Line
                    type="stepAfter"
                    dataKey="eficacia"
                    name="Eficácia (%)"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 6"
                    opacity={0.5}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}
