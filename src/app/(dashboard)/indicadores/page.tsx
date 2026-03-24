"use client"

import React, { useState, useEffect, useRef } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { OverviewChart } from "@/components/dashboard/OverviewChart"
import { RefreshButton } from "@/components/ui/RefreshButton"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"

interface RankingRow {
  equipe: string
  setor: string
  produtividade: number
  ociosidade: number
}

interface KpiApiItem {
  title: string
  value: string | number
  icon: string
  target?: string | number
  trend?: string
}

interface KpiMapped {
  title: string
  value: string | number
  icon: string
  target: string
  variation: string
}

export default function DashboardHome() {
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [globalKpis, setGlobalKpis] = useState<KpiMapped[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const loadData = async (forceSync = false) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      setLoading(true)
      if (forceSync) await triggerSync("all")
      const [respRank, respGlobal] = await Promise.all([
        api.get('/produtividade/ranking', { signal: abortRef.current.signal }),
        api.get('/global/dashboard', { signal: abortRef.current.signal })
      ])
      setRanking(respRank.data ?? [])

      // Map icons for Material Symbols
      const iconMap: Record<string, string> = {
        "Activity": "monitoring",
        "CarFront": "local_shipping",
        "CheckSquare": "fact_check",
        "Clock": "schedule"
      }

      const kpis = respGlobal.data?.kpis ?? []
      const mappedKpis = kpis.map((k: KpiApiItem): KpiMapped => ({
        ...k,
        icon: iconMap[k.icon] || "analytics",
        target: (k.target as string) || "85%", // Placeholder meta if missing
        variation: k.trend || "+0.8%" // Placeholder var if missing
      }))

      setGlobalKpis(mappedKpis)
    } catch (e: unknown) {
      const err = e as { name?: string; code?: string }
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
      console.error(e)
      setRanking([])
      setGlobalKpis([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadData(true)
  }, [])

  if (!mounted || (loading && globalKpis.length === 0)) return <DashboardSkeleton kpis={4} charts={1} tables={2} />

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-700">
      {/* Insight Highlight */}
      <div className="bg-primary/5 border border-primary/20 p-3 rounded-sm flex items-center gap-4 shadow-sm">
        <div className="p-2 bg-primary/20 rounded-full">
          <span className="material-symbols-outlined text-primary">lightbulb</span>
        </div>
        <div className="flex-1">
          <h4 className="text-[10px] font-semibold uppercase text-primary tracking-[0.2em]">Inteligência Operacional</h4>
          <p className="text-xs text-text-heading">Painel consolidado de indicadores operacionais. Dados atualizados automaticamente em cada sincronização.</p>
        </div>
      </div>

      {/* KPI Grid - Horizontal Sharp Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {globalKpis.map((kpi, idx) => (
          <KpiCard key={idx} {...kpi} />
        ))}
      </div>

      {/* Main Area: Grid 12 Columns */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Chart Area */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-surface border border-border p-4 rounded-sm shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Produtividade x Eficácia</h3>
                <p className="text-[9px] text-text-muted uppercase font-medium mt-0.5">Visão consolidada do período atual</p>
              </div>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[9px] uppercase font-semibold text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-primary"></span> Prod
                </span>
                <span className="flex items-center gap-1.5 text-[9px] uppercase font-semibold text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span> Eficácia
                </span>
                <RefreshButton onClick={() => loadData(true)} loading={loading} />
              </div>
            </div>
            <div className="h-[400px]">
              <OverviewChart />
            </div>
          </div>
        </div>

        {/* Right: Ranking/Ofensores Area */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-full bg-surface border border-border rounded-sm shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500">warning</span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Ofensores Ociosidade</h3>
            </div>
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-semibold uppercase rounded-sm">Crítico</span>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-surface/50 text-[11px] font-semibold uppercase text-text-muted">
                <tr className="border-b border-border">
                  <th className="p-4 text-[9px] font-semibold text-text-muted uppercase tracking-wider">Equipe / Setor</th>
                  <th className="p-4 text-right text-[9px] font-semibold text-text-muted uppercase tracking-wider">Ocios.</th>
                  <th className="p-4 text-right text-[9px] font-semibold text-text-muted uppercase tracking-wider">Prod.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ranking && ranking.length > 0 ? (
                  ranking.map((r, i) => (
                    <tr key={i} className="hover:bg-surface/50 transition-colors">
                      <td className="p-4">
                        <p className="text-[11px] font-semibold text-text-heading">{r?.equipe ?? "N/D"}</p>
                        <p className="text-[9px] text-text-muted uppercase font-medium">{r?.setor ?? "N/D"}</p>
                      </td>
                      <td className="p-4 text-right text-xs font-semibold text-rose-500 bg-rose-500/5 tabular-nums">
                        {Math.round(r?.ociosidade ?? 0)}m
                      </td>
                      <td className="p-4 text-right text-xs font-medium text-text-muted tabular-nums">
                        {Math.round(r?.produtividade ?? 0)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EmptyState icon="warning" title="Nenhum ofensor identificado" description="Nenhum dado de ociosidade disponível para este período." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-surface border-t border-border text-center">
            <button className="text-[10px] font-semibold uppercase text-primary hover:underline tracking-widest">Ver Todos os Ofensores</button>
          </div>
        </div>
      </div>

      {/* Footer Industrial Info */}

    </div>
  )
}


