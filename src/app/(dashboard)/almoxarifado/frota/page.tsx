"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Search, Truck, Users, Package } from "lucide-react"
import type { EstoqueLocal, ItemEstoque, Material } from "@/types/database"

type ItemComRelacoes = ItemEstoque & {
  material: Material
  estoque: EstoqueLocal
}

export default function AlmoxarifadoFrotaPage() {
  const [itens, setItens] = useState<ItemComRelacoes[]>([])
  const [estoques, setEstoques] = useState<EstoqueLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: items }, { data: estqs }] = await Promise.all([
      supabase
        .from("itens_estoque")
        .select("*, material:materiais(*), estoque:estoques(*)")
        .gt("saldo", 0)
        .order("estoque_id"),
      supabase.from("estoques").select("*").order("nome"),
    ])

    setItens((items as ItemComRelacoes[]) || [])
    setEstoques(estqs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = itens.filter((i) => {
    const matchSearch =
      i.material?.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      i.material?.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      i.estoque?.nome?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = filtroTipo === "TODOS" || i.estoque?.tipo_estoque === filtroTipo
    return matchSearch && matchTipo
  })

  const estEquipe = estoques.filter((e) => e.tipo_estoque === "Equipe")
  const estIndividual = estoques.filter((e) => e.tipo_estoque === "Individual")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Estoques por Local</h2>
        <p className="text-gray-500">Visualização de saldos por estoque (Equipe e Individual)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total Itens em Estoque</p>
              <p className="text-2xl font-bold">{itens.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Truck className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Estoques Equipe</p>
              <p className="text-2xl font-bold">{estEquipe.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Estoques Individual</p>
              <p className="text-2xl font-bold">{estIndividual.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar material, código ou estoque..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {["TODOS", "Equipe", "Individual"].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipo(tipo)}
                  className={`px-3 py-2 text-sm rounded-md border cursor-pointer ${
                    filtroTipo === tipo ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tipo === "TODOS" ? "Todos" : tipo}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estoque</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    {search ? "Nenhum item encontrado." : "Nenhum item em estoque."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.estoque?.nome || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={item.estoque?.tipo_estoque === "Equipe" ? "default" : "secondary"}>
                        {item.estoque?.tipo_estoque}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.material?.codigo || "-"}</TableCell>
                    <TableCell>{item.material?.descricao || "-"}</TableCell>
                    <TableCell className="text-right font-medium">{item.saldo}</TableCell>
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
