"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useFilter, FilterProvider } from "@/components/providers/FilterProvider"
import { URLPeriodSync } from "@/components/providers/URLPeriodSync"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { TrendLineChart } from "@/components/dashboard/TrendLineChart"
import { CsdBarChart } from "@/components/dashboard/CsdBarChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CHART_COLORS, formatCurrencyCompact } from "@/lib/utils"

export interface Insight {
  type: "success" | "warning" | "danger" | "info"
  text: string
}

function ExecutiveSummaryContent() {
  const { period } = useFilter()
  const searchParams = useSearchParams()
  const [stats, setStats] = useState({
    ccm_prod: 0,
    ccm_meta: 95,
    ccm_trend: 0,
    turmas_rdo: 0,
    turmas_meta: 85,
    frota_ticket: 0,
    frota_trend: 0,
    apr_media: 0,
    apr_total: 0
  })
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [ccmChartData, setCcmChartData] = useState<{name: string; prod: number}[]>([])
  const [frotaEvolucao, setFrotaEvolucao] = useState<any[]>([])

  useEffect(() => {
    async function loadAllData() {
      setLoading(true)
      try {
        const query = new URLSearchParams(searchParams.toString())
        query.set("periodo", period)
        if (period === "latest") query.set("periodo", "month") 

        // Always fetch from Next.js API Routes (which will proxy or hit Supabase)
        // Use relative URL so it works on browser on both localhost and Vercel.
        const [ccmRes, turmasRes, frotaRes, aprRes] = await Promise.all([
          fetch(`/api/v1/produtividade/dashboard?${query.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/v1/turmas_rdo/dashboard?${query.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/v1/frota/dashboard?${query.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/v1/apr/dashboard?${query.toString()}`).then(r => r.ok ? r.json() : null).catch(() => null)
        ])

        const ccmData = ccmRes || null
        const turmasData = turmasRes || null
        const frotaData = frotaRes || null
        const aprData = aprRes || null

        // Aggregate Stats
        setStats({
          ccm_prod: ccmData?.stats?.media_prod || 0,
          ccm_meta: ccmData?.meta_prod || 95,
          ccm_trend: ccmData?.stats?.trend_prod || 0,
          turmas_rdo: 0, // Not implemented yet
          turmas_meta: 85,
          frota_ticket: frotaData?.stats?.ticket_medio || 0,
          frota_trend: frotaData?.stats?.trend_ticket || 0,
          apr_media: aprData?.stats?.notas_exec_media || 0,
          apr_total: aprData?.stats?.total_apr || 0
        })

        if (ccmData?.chart?.labels && ccmData?.chart?.data) {
          setCcmChartData(ccmData.chart.labels.map((lbl: string, i: number) => ({
            name: String(lbl),
            prod: Number(ccmData.chart.data[i])
          })).sort((a: any, b: any) => b.prod - a.prod))
        } else {
          setCcmChartData([])
        }

        if (frotaData?.history) {
            setFrotaEvolucao(frotaData.history.map((h: any) => ({
                name: h.MesAno,
                Custo: h.Val
            })))
        } else {
            setFrotaEvolucao([])
        }

        // Aggregate Insights
        const allInsights: Insight[] = []
        if (ccmData?.insights) allInsights.push(...ccmData.insights.map((i: any) => ({ ...i, text: `[Produtividade] ${i.text}` })))
        if (turmasData?.insights) allInsights.push(...turmasData.insights.map((i: any) => ({ ...i, text: `[Turmas] ${i.text}` })))
        if (frotaData?.insights) allInsights.push(...frotaData.insights.map((i: any) => ({ ...i, text: `[Frota] ${i.text}` })))
        if (aprData?.insights) allInsights.push(...aprData.insights.map((i: any) => ({ ...i, text: `[SEG] ${i.text}` })))
        
        if (allInsights.length === 0) {
            allInsights.push({ type: "info", text: "Nenhum alerta crítico para o período selecionado em nenhum dos módulos operacionais." })
        }

        setInsights(allInsights)
      } catch (e) {
        console.error("Dashboard Global Error:", e)
      } finally {
        setLoading(false)
      }
    }

    loadAllData()
  }, [period, searchParams])

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-700">
      <PageHeader
        title="Dashboard Executivo Global"
        icon="language"
        insights={loading ? [] : insights.slice(0, 1)}
        loading={loading}
        showPeriodSelector={true}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Produtividade Geral (CCM)"
          value={`${stats.ccm_prod.toFixed(1)}%`}
          variation={stats.ccm_trend}
          target={`Meta Institucional: ${stats.ccm_meta}%`}
          icon="timer"
        />
        <KpiCard
          title="Conformidade RDO (Turmas)"
          value={`${stats.turmas_rdo}%`}
          target={`Meta: ${stats.turmas_meta}%`}
          icon="verified"
        />
        <KpiCard
          title="Ticket Médio (Frota)"
          value={formatCurrencyCompact(stats.frota_ticket)}
          variation={stats.frota_trend}
          target="Custo por Veículo"
          icon="directions_car"
          trendMode="down-is-good"
        />
        <KpiCard
          title="Efetividade de SESMT / APR"
          value={stats.apr_media.toFixed(1)}
          target={`${stats.apr_total} Auditorias`}
          icon="health_and_safety"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-surface border border-border px-4 py-3 rounded-sm flex flex-col h-[380px] shadow-sm hover:border-primary/30 transition-all">
            <div className="flex flex-col gap-0.5 mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">
                        analytics
                    </span>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-heading">
                        Aderência Operacional por Regional
                    </h3>
                </div>
                <p className="text-[9px] text-text-muted font-medium uppercase">Produtividade de Turmas CCM</p>
            </div>
            <div className="flex-1 w-full min-h-0 mt-2">
                {ccmChartData.length > 0 ? (
                    <CsdBarChart
                        data={ccmChartData}
                        meta={stats.ccm_meta}
                        unit="%"
                        variant="status"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-[11px] font-medium uppercase">
                        Dados de produtividade não disponíveis para o período
                    </div>
                )}
            </div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-sm flex flex-col h-[380px] shadow-sm hover:border-primary/30 transition-all">
            <div className="flex flex-col gap-0.5 mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                        trending_down
                    </span>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-heading">
                        Evolução Histórica Custo de Frota
                    </h3>
                </div>
                <p className="text-[9px] text-text-muted font-medium uppercase">Custo Geral Mês a Mês</p>
            </div>
            <div className="flex-1 w-full relative mt-2">
                {frotaEvolucao.length > 0 ? (
                    <TrendLineChart
                        data={frotaEvolucao}
                        tooltipLabel="Custo Total"
                        lines={[
                            { key: 'Custo', color: CHART_COLORS[0], label: 'Custo R$' }
                        ]}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted text-[11px] font-medium uppercase">
                        Histórico de Frota não disponível
                    </div>
                )}
            </div>
        </div>
      </div>

      {insights.length > 0 && (
        <Card className="bg-surface border-border shadow-sm rounded-sm">
          <CardHeader className="pb-3 px-4 pt-4 border-b border-border bg-slate-50/50">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-text-heading flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">insights</span>
              Diagnóstico Global Integrado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-4 max-h-[250px] overflow-y-auto custom-scrollbar">
            <div className="grid gap-3">
              {insights.map((insight, idx) => {
                const colors = {
                  success: "bg-emerald-500 border-emerald-500",
                  warning: "bg-amber-500 border-amber-500",
                  danger: "bg-rose-500 border-rose-500",
                  info: "bg-blue-500 border-blue-500"
                }
                const icons = {
                  success: "check_circle",
                  warning: "warning",
                  danger: "error",
                  info: "info"
                }
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-sm border border-border/50 bg-white/50 hover:bg-white transition-colors">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${colors[insight.type]}`} />
                    <p className="text-[11px] font-medium text-text-heading leading-relaxed">{insight.text}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="p-4 space-y-4">
        <div className="h-24 bg-surface animate-pulse rounded-sm" />
        <div className="grid grid-cols-4 gap-4"><div className="h-32 bg-surface animate-pulse rounded-sm" /><div className="h-32 bg-surface animate-pulse rounded-sm" /><div className="h-32 bg-surface animate-pulse rounded-sm" /><div className="h-32 bg-surface animate-pulse rounded-sm" /></div>
        <div className="grid grid-cols-2 gap-4"><div className="h-64 bg-surface animate-pulse rounded-sm" /><div className="h-64 bg-surface animate-pulse rounded-sm" /></div>
      </div>
    }>
      <FilterProvider>
        <URLPeriodSync />
        <ExecutiveSummaryContent />
      </FilterProvider>
    </Suspense>
  )
}
