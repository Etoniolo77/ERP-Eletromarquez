"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, ArrowRightLeft, AlertTriangle, Warehouse } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Movimentacao, EstoqueLocal } from "@/types/database"

interface DashboardStats {
  totalMateriais: number
  totalMovimentacoes: number
  itensAlerta: number
  totalEstoques: number
}

type MovRecente = Movimentacao & {
  estoque_origem: EstoqueLocal | null
  estoque_destino: EstoqueLocal | null
  criado_por: { nome: string } | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMateriais: 0,
    totalMovimentacoes: 0,
    itensAlerta: 0,
    totalEstoques: 0,
  })
  const [movRecentes, setMovRecentes] = useState<MovRecente[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadStats() {
      const [
        { count: totalMateriais },
        { count: totalMovimentacoes },
        { data: itensAlerta },
        { count: totalEstoques },
        { data: recentes },
      ] = await Promise.all([
        supabase.from("materiais").select("*", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("movimentacoes").select("*", { count: "exact", head: true }),
        supabase.from("vw_itens_reposicao").select("*"),
        supabase.from("estoques").select("*", { count: "exact", head: true }).eq("tipo_estoque", "Equipe"),
        supabase
          .from("movimentacoes")
          .select(`
            *,
            estoque_origem:estoques!movimentacoes_estoque_origem_id_fkey(nome),
            estoque_destino:estoques!movimentacoes_estoque_destino_id_fkey(nome),
            criado_por:usuario!movimentacoes_criado_por_id_fkey(nome)
          `)
          .order("criado_em", { ascending: false })
          .limit(5),
      ])

      setStats({
        totalMateriais: totalMateriais || 0,
        totalMovimentacoes: totalMovimentacoes || 0,
        itensAlerta: itensAlerta?.length || 0,
        totalEstoques: totalEstoques || 0,
      })
      setMovRecentes((recentes as MovRecente[]) || [])
      setLoading(false)
    }

    loadStats()
  }, [])

  const cards = [
    { title: "Total de Materiais", value: stats.totalMateriais, icon: <Package className="h-5 w-5 text-blue-600" />, color: "bg-blue-50" },
    { title: "Movimentações", value: stats.totalMovimentacoes, icon: <ArrowRightLeft className="h-5 w-5 text-green-600" />, color: "bg-green-50" },
    { title: "Itens em Alerta", value: stats.itensAlerta, icon: <AlertTriangle className="h-5 w-5 text-red-600" />, color: "bg-red-50" },
    { title: "Estoques (Equipe)", value: stats.totalEstoques, icon: <Warehouse className="h-5 w-5 text-indigo-600" />, color: "bg-indigo-50" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {loading ? "..." : card.value}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Módulos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { nome: "Almoxarifado SESMT", status: "Ativo", cor: "bg-green-100 text-green-800" },
                { nome: "Movimentações", status: "Ativo", cor: "bg-green-100 text-green-800" },
                { nome: "Inventário", status: "Ativo", cor: "bg-green-100 text-green-800" },
                { nome: "MRP", status: "Ativo", cor: "bg-green-100 text-green-800" },
                { nome: "SESMT", status: "Em breve", cor: "bg-gray-100 text-gray-600" },
                { nome: "CCM", status: "Em breve", cor: "bg-gray-100 text-gray-600" },
                { nome: "Turmas", status: "Em breve", cor: "bg-gray-100 text-gray-600" },
              ].map((mod) => (
                <div key={mod.nome} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <span className="text-sm font-medium text-gray-900">{mod.nome}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${mod.cor}`}>
                    {mod.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : movRecentes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma movimentação recente.</p>
            ) : (
              <div className="space-y-3">
                {movRecentes.map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={mov.situacao === "Aprovada" ? "success" : "default"}>
                        {mov.tipo}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">
                          {mov.estoque_origem?.nome || "?"} → {mov.estoque_destino?.nome || "?"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {mov.criado_por?.nome || "Sistema"} · {formatDate(mov.criado_em)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={mov.situacao === "Aprovada" ? "success" : "warning"}>
                      {mov.situacao}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
