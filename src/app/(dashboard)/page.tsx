"use client"

import React, { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { FilterProvider } from "@/components/providers/FilterProvider"
import { URLPeriodSync } from "@/components/providers/URLPeriodSync"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface Insight {
  type: "success" | "warning" | "danger" | "info"
  text: string
}

interface GlobalStats {
  ccmProd: number
  ccmMetaAtingimento: number
  ccmMeta: number
  turmasProd: number
  frotaCusto: number
  aprAprovacao: number
}

function ExecutiveDashboardContent() {
  const searchParams = useSearchParams()
  const periodo = searchParams.get("periodo") || "month"
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [globalInsights, setGlobalInsights] = useState<Insight[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>("")

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Build the query string based on the current period
      const query = new URLSearchParams()
      if (periodo) query.set("periodo", periodo)

      // Fetch all core modules in parallel
      const [ccmRes, turmasRes, frotaRes, aprRes] = await Promise.all([
        fetch(`/api/v1/produtividade/dashboard?${query.toString()}`).catch(() => null),
        fetch(`/api/v1/turmas_rdo/dashboard?${query.toString()}`).catch(() => null),
        fetch(`/api/v1/frota/dashboard?${query.toString()}`).catch(() => null),
        fetch(`/api/v1/apr/dashboard?${query.toString()}`).catch(() => null)
      ])

      const ccmData = ccmRes?.ok ? await ccmRes.json() : null
      const turmasData = turmasRes?.ok ? await turmasRes.json() : null
      const frotaData = frotaRes?.ok ? await frotaRes.json() : null
      const aprData = aprRes?.ok ? await aprRes.json() : null

      // Aggregate Stats
      setStats({
        ccmProd: ccmData?.stats?.media_prod || 0,
        ccmMetaAtingimento: ccmData?.stats?.atingimento_meta || 0,
        ccmMeta: ccmData?.meta_prod || 85,
        turmasProd: turmasData?.stats?.media_prod || 0,
        frotaCusto: frotaData?.stats?.custo_total || 0,
        aprAprovacao: aprData?.stats?.taxa_aprovacao || 0
      })

      // Aggregate Insights
      const insights: Insight[] = []
      
      if (ccmData?.insights) {
        ccmData.insights.forEach((i: any) => insights.push({ ...i, text: `[CCM] ${i.text}` }))
      }
      if (turmasData?.insights) {
        turmasData.insights.forEach((i: any) => insights.push({ ...i, text: `[Turmas] ${i.text}` }))
      }
      if (frotaData?.insights) {
        frotaData.insights.forEach((i: any) => insights.push({ ...i, text: `[Frota] ${i.text}` }))
      }
      if (aprData?.insights) {
        aprData.insights.forEach((i: any) => insights.push({ ...i, text: `[SESMT] ${i.text}` }))
      }

      // Filter to show most critical insights first (danger > warning > info > success)
      const sortedInsights = insights.sort((a, b) => {
        const priority: Record<string, number> = { danger: 1, warning: 2, success: 3, info: 4 }
        return (priority[a.type] || 5) - (priority[b.type] || 5)
      })

      setGlobalInsights(sortedInsights)
      
      const updateDate = new Date().toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      })
      setLastUpdate(updateDate)

    } catch (e) {
      console.error("Dashboard Global Fetch Error:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [periodo])

  return (
    <div className="flex-1 flex flex-col pt-0 p-4 lg:p-6 lg:pt-0 max-w-[1600px] mx-auto w-full gap-6">
      <PageHeader
        icon="monitoring"
        title="DASHBOARD EXECUTIVO"
        fallbackText="Visão Consolidada de Resultado"
        lastUpdate={lastUpdate}
        onRefresh={fetchDashboardData}
        loading={loading}
        showPeriodSelector={true}
      />

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Top KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <KpiCard
                title="Produtividade Global (CCM)"
                subtitle="Equipes na Meta"
                value={`${stats?.ccmProd.toFixed(1)}%`}
                icon="engineering"
                target={`${stats?.ccmMeta}%`}
                variation={stats?.ccmMetaAtingimento}
                colorValue="primary"
                trendMode="up-is-good"
             />
             <KpiCard
                title="Produtividade (Turmas)"
                subtitle="Média Operacional"
                value={`${stats?.turmasProd.toFixed(1)}%`}
                icon="trending_up"
                target="-"
                showVariation={false}
                colorValue="success"
             />
             <KpiCard
                title="Custo Total (Frota)"
                subtitle="Período"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.frotaCusto || 0)}
                icon="local_shipping"
                target="-"
                showVariation={false}
                colorValue="warning"
             />
             <KpiCard
                title="APRs Válidas (SESMT)"
                subtitle="Taxa de Aprovação"
                value={`${stats?.aprAprovacao.toFixed(1)}%`}
                icon="verified_user"
                target="100%"
                showVariation={false}
                colorValue="danger"
             />
          </div>

          {/* Insights Region */}
          <div className="grid gap-6">
            <Card>
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="material-symbols-outlined text-primary">campaign</span>
                  Diagnóstico e Alertas Globais (CSD)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {globalInsights.length > 0 ? (
                    globalInsights.map((insight, idx) => (
                      <div key={idx} className={`p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${insight.type === 'danger' ? 'bg-rose-50/20' : ''}`}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          insight.type === 'danger' ? 'bg-rose-100 text-rose-600' :
                          insight.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                          insight.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <span className="material-symbols-outlined text-[16px]">
                            {insight.type === 'danger' ? 'error' :
                             insight.type === 'warning' ? 'warning' :
                             insight.type === 'success' ? 'check_circle' : 'info'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                           <p className={`text-sm tracking-tight ${insight.type === 'danger' ? 'font-bold text-rose-900' : 'font-medium text-slate-700'}`}>
                             {insight.text}
                           </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      Nenhum alerta crítico encontrado para o período.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default function ExecutiveDashboard() {
  return (
    <FilterProvider>
      <Suspense fallback={<div className="p-8 text-center">Iniciando...</div>}>
         <URLPeriodSync />
         <ExecutiveDashboardContent />
      </Suspense>
    </FilterProvider>
  )
}
