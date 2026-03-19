"use client"

import React, { useState, useEffect } from "react"
import {
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts"
import { createClient } from "@/lib/supabase/client"

interface EvolucaoRow {
    data: string
    produtividade: number
    eficacia: number
}

export function OverviewChart() {
    const [chartData, setChartData] = useState<EvolucaoRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadChartData() {
            try {
                const supabase = createClient()
                // Busca os dados da view que criamos
                const { data, error } = await supabase
                    .from("view_evolucao_diaria")
                    .select("*")
                    .order("data", { ascending: true })
                    .limit(30)

                if (error) throw error

                if (data) {
                    const formattedData = data.map((row: any) => ({
                        data: new Date(row.data).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                        }),
                        produtividade: row.produtividade,
                        eficacia: row.eficacia,
                    }))
                    setChartData(formattedData)
                }
            } catch (err) {
                console.error("Erro ao carregar dados do gráfico no ERP", err)
            } finally {
                setLoading(false)
            }
        }
        loadChartData()
    }, [])

    if (loading)
        return (
            <div className="animate-pulse w-full h-[350px] bg-slate-100/20 rounded-xl" />
        )
    if (chartData.length === 0)
        return (
            <div className="flex items-center justify-center h-[350px] border border-dashed border-gray-200 rounded-xl text-gray-400 font-medium">
                Nenhuma evolução encontrada no período atual.
            </div>
        )

    return (
        <ResponsiveContainer width="100%" height={350}>
            <LineChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
            >
                <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                    opacity={0.4}
                />
                <XAxis
                    dataKey="data"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11, fontWeight: 700 }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11, fontWeight: 700 }}
                    domain={["auto", "auto"]}
                    dx={-10}
                />
                <Tooltip
                    contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        backgroundColor: "#FFFFFF",
                        padding: "16px",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
                    }}
                    labelStyle={{
                        fontSize: "11px",
                        fontWeight: "800",
                        marginBottom: "8px",
                        color: "#1E293B",
                        textTransform: "uppercase",
                    }}
                    itemStyle={{ fontSize: "13px", fontWeight: "600", padding: "2px 0" }}
                />

                <Line
                    type="monotone"
                    dataKey="produtividade"
                    name="Produtividade (%)"
                    stroke="#3B82F6"
                    strokeWidth={4}
                    dot={{ r: 4, fill: "#3B82F6", strokeWidth: 2, stroke: "#FFFFFF" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                />

                <Line
                    type="stepAfter"
                    dataKey="eficacia"
                    name="Eficácia (%)"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="6 6"
                    opacity={0.5}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}
