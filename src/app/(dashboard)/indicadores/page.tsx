"use client"

import React, { useState, useEffect } from "react"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { OverviewChart } from "@/components/dashboard/OverviewChart"
import { RefreshButton } from "@/components/ui/RefreshButton"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"

interface RankingRow {
  equipe: string
  setor: string
  produtividade: number
  ociosidade: number
}

export default function DashboardHome() {
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [globalKpis, setGlobalKpis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const loadData = async (forceSync = false) => {
    try {
      setLoading(true)
      if (forceSync) await triggerSync("all")
      const [respRank, respGlobal] = await Promise.all([
        api.get('/produtividade/ranking'),
        api.get('/global/dashboard')
      ])
      setRanking(respRank.data)

      // Map icons for Material Symbols
      const iconMap: any = {
        "Activity": "monitoring",
        "CarFront": "local_shipping",
        "CheckSquare": "fact_check",
        "Clock": "schedule"
      }

      const mappedKpis = respGlobal.data.kpis.map((k: any) => ({
        ...k,
        icon: iconMap[k.icon] || "analytics",
        target: k.target || "85%", // Placeholder meta if missing
        variation: k.trend || "+0.8%" // Placeholder var if missing
      }))

      setGlobalKpis(mappedKpis)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  if (!mounted || (loading && globalKpis.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-semibold text-text-muted animate-pulse uppercase tracking-widest">Sincronizando Dashboard Global...</p>
      </div>
    )
  }

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
                {ranking.map((r, i) => (
                  <tr key={i} className="hover:bg-surface/50 transition-colors">
                    <td className="p-4">
                      <p className="text-[11px] font-semibold text-text-heading">{r.equipe}</p>
                      <p className="text-[9px] text-text-muted uppercase font-medium">{r.setor}</p>
                    </td>
                    <td className="p-4 text-right text-xs font-semibold text-rose-500 bg-rose-500/5 tabular-nums">
                      {Math.round(r.ociosidade)}m
                    </td>
                    <td className="p-4 text-right text-xs font-medium text-text-muted tabular-nums">
                      {Math.round(r.produtividade)}%
                    </td>
                  </tr>
                ))}
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


