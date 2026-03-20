"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { AlertTriangle, AlertCircle, Package, Search } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { EstoqueResumo } from "@/types/database"

export default function MRPPage() {
  const [itensReposicao, setItensReposicao] = useState<EstoqueResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: itens } = await supabase.from("vw_itens_reposicao").select("*")
    setItensReposicao((itens as EstoqueResumo[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredItens = itensReposicao.filter(
    (i) =>
      i.codigo.toLowerCase().includes(search.toLowerCase()) ||
      i.descricao.toLowerCase().includes(search.toLowerCase())
  )

  const itensCriticos = itensReposicao.filter((i) => i.status_estoque === "CRITICO")
  const itensAlerta = itensReposicao.filter((i) => i.status_estoque === "ALERTA")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">MRP - Planejamento de Materiais</h2>
        <p className="text-gray-500">Controle de necessidade de reposição</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">Críticos</p>
              <p className="text-2xl font-bold text-red-600">{itensCriticos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Em Alerta</p>
              <p className="text-2xl font-bold text-yellow-600">{itensAlerta.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Custo Estimado Reposição</p>
              <p className="text-xl font-bold">
                {formatCurrency(itensReposicao.reduce((acc, i) => acc + i.quantidade_sugerida * i.custo_unitario, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens que Necessitam Reposição</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar material..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
                <TableHead className="text-right">Custo Est.</TableHead>
                <TableHead className="text-right">Lead Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filteredItens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {search ? "Nenhum item encontrado." : "Todos os itens estão com estoque adequado."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItens.map((item) => (
                  <TableRow key={item.material_id}>
                    <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                    <TableCell className="font-medium">{item.descricao}</TableCell>
                    <TableCell>
                      <Badge variant={item.status_estoque === "CRITICO" ? "destructive" : "warning"}>
                        {item.status_estoque === "CRITICO" ? "Crítico" : "Alerta"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.saldo_total}</TableCell>
                    <TableCell className="text-right">{item.estoque_minimo}</TableCell>
                    <TableCell className="text-right font-medium text-blue-600">{item.quantidade_sugerida}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.quantidade_sugerida * item.custo_unitario)}</TableCell>
                    <TableCell className="text-right">{item.lead_time_dias}d</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
