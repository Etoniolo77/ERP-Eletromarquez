"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Plus, Search, ArrowRightLeft, Trash2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Movimentacao, Material, EstoqueLocal, ItemMovimentacao, TipoJustificativa } from "@/types/database"

type MovimentacaoCompleta = Movimentacao & {
  estoque_origem: EstoqueLocal | null
  estoque_destino: EstoqueLocal | null
  criado_por: { nome: string } | null
  itens_movimentacoes: (ItemMovimentacao & { material: Material })[]
}

interface ItemForm {
  material_id: string
  quantidade: string
  valor: string
  observacao: string
  justificativa_id: string
}

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCompleta[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [estoques, setEstoques] = useState<EstoqueLocal[]>([])
  const [justificativas, setJustificativas] = useState<TipoJustificativa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tipoFilter, setTipoFilter] = useState<string>("TODOS")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState("")
  const [itensForm, setItensForm] = useState<ItemForm[]>([{ material_id: "", quantidade: "", valor: "", observacao: "", justificativa_id: "" }])

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: movs }, { data: mats }, { data: estqs }, { data: justs }] = await Promise.all([
      supabase
        .from("movimentacoes")
        .select(`
          *,
          estoque_origem:estoques!movimentacoes_estoque_origem_id_fkey(id, nome, tipo_estoque),
          estoque_destino:estoques!movimentacoes_estoque_destino_id_fkey(id, nome, tipo_estoque),
          criado_por:usuario!movimentacoes_criado_por_id_fkey(nome),
          itens_movimentacoes(*, material:materiais(*))
        `)
        .order("criado_em", { ascending: false })
        .limit(200),
      supabase.from("materiais").select("*").eq("ativo", true).order("descricao"),
      supabase.from("estoques").select("*").order("nome"),
      supabase.from("tipo_justificativa").select("*").order("nome"),
    ])

    setMovimentacoes((movs as MovimentacaoCompleta[]) || [])
    setMateriais(mats || [])
    setEstoques(estqs || [])
    setJustificativas(justs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredMovs = movimentacoes.filter((m) => {
    const itensTexto = m.itens_movimentacoes?.map((i) => `${i.material?.codigo} ${i.material?.descricao}`).join(" ") || ""
    const matchSearch =
      itensTexto.toLowerCase().includes(search.toLowerCase()) ||
      m.referencia?.toLowerCase().includes(search.toLowerCase()) ||
      m.estoque_origem?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      m.estoque_destino?.nome?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = tipoFilter === "TODOS" || m.tipo === tipoFilter
    return matchSearch && matchTipo
  })

  function getTipoBadge(tipo: string) {
    if (tipo === "Transferência") return <Badge variant="default">Transferência</Badge>
    if (tipo === "Entrada") return <Badge variant="success">Entrada</Badge>
    if (tipo === "Saída") return <Badge variant="destructive">Saída</Badge>
    return <Badge>{tipo}</Badge>
  }

  function getSituacaoBadge(situacao: string) {
    if (situacao === "Aprovada") return <Badge variant="success">Aprovada</Badge>
    if (situacao === "Pendente") return <Badge variant="warning">Pendente</Badge>
    if (situacao === "Cancelada") return <Badge variant="destructive">Cancelada</Badge>
    return <Badge>{situacao}</Badge>
  }

  function addItem() {
    setItensForm((prev) => [...prev, { material_id: "", quantidade: "", valor: "", observacao: "", justificativa_id: "" }])
  }

  function removeItem(index: number) {
    setItensForm((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ItemForm, value: string) {
    setItensForm((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const tipo = form.get("tipo") as string

    const movData = {
      tipo,
      estoque_origem_id: parseInt(form.get("estoque_origem_id") as string) || null,
      estoque_destino_id: parseInt(form.get("estoque_destino_id") as string) || null,
      situacao: "Aprovada",
      referencia: (form.get("referencia") as string) || null,
      tipo_estoque: (form.get("tipo_estoque") as string) || null,
    }

    const { data: movimentacao } = await supabase
      .from("movimentacoes")
      .insert(movData)
      .select()
      .single()

    if (movimentacao) {
      const itensValidos = itensForm.filter((i) => i.material_id && i.quantidade)
      if (itensValidos.length > 0) {
        const itens = itensValidos.map((item) => ({
          movimentacao_id: movimentacao.id,
          material_id: parseInt(item.material_id),
          quantidade: parseInt(item.quantidade),
          valor: parseFloat(item.valor) || 0,
          observacao: item.observacao || null,
          justificativa_id: parseInt(item.justificativa_id) || null,
        }))
        await supabase.from("itens_movimentacoes").insert(itens)
      }

      await supabase
        .from("movimentacoes")
        .update({ finalizado_em: new Date().toISOString() })
        .eq("id", movimentacao.id)
    }

    setSaving(false)
    setDialogOpen(false)
    setItensForm([{ material_id: "", quantidade: "", valor: "", observacao: "", justificativa_id: "" }])
    setSelectedTipo("")
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Movimentações</h2>
          <p className="text-gray-500">Controle de transferências e movimentações de materiais</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar material, referência, estoque..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
              <option value="TODOS">Todos os tipos</option>
              <option value="Transferência">Transferência</option>
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Tipo Estoque</TableHead>
                <TableHead>Criado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filteredMovs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">Nenhuma movimentação encontrada.</TableCell>
                </TableRow>
              ) : (
                filteredMovs.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell className="font-mono text-sm">#{mov.id}</TableCell>
                    <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                    <TableCell className="text-sm">{formatDate(mov.criado_em)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {mov.itens_movimentacoes?.slice(0, 2).map((item) => (
                          <div key={item.id} className="text-sm">
                            <span className="font-mono text-xs text-gray-500">{item.material?.codigo}</span>{" "}
                            <span className="font-medium">x{item.quantidade}</span>
                          </div>
                        ))}
                        {(mov.itens_movimentacoes?.length || 0) > 2 && (
                          <p className="text-xs text-gray-400">+{mov.itens_movimentacoes!.length - 2} itens</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{mov.estoque_origem?.nome || "-"}</TableCell>
                    <TableCell className="text-sm">{mov.estoque_destino?.nome || "-"}</TableCell>
                    <TableCell>{getSituacaoBadge(mov.situacao)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{mov.tipo_estoque || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{mov.criado_por?.nome || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogClose onClose={() => setDialogOpen(false)} />
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <DialogContent>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select id="tipo" name="tipo" required value={selectedTipo} onChange={(e) => setSelectedTipo(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_estoque">Tipo Estoque</Label>
                  <Select id="tipo_estoque" name="tipo_estoque">
                    <option value="">Selecione...</option>
                    <option value="Equipe">Equipe</option>
                    <option value="Individual">Individual</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estoque_origem_id">Estoque Origem *</Label>
                  <Select id="estoque_origem_id" name="estoque_origem_id" required>
                    <option value="">Selecione...</option>
                    {estoques.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} ({e.tipo_estoque})</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_destino_id">Estoque Destino</Label>
                  <Select id="estoque_destino_id" name="estoque_destino_id">
                    <option value="">Selecione...</option>
                    {estoques.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} ({e.tipo_estoque})</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referencia">Referência</Label>
                <Input id="referencia" name="referencia" placeholder="NF, OS, requisição..." />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Itens da Movimentação</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                  </Button>
                </div>
                {itensForm.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-gray-50">
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Material *</Label>
                      <Select value={item.material_id} onChange={(e) => updateItem(index, "material_id", e.target.value)} required>
                        <option value="">Selecione...</option>
                        {materiais.map((m) => (
                          <option key={m.id} value={m.id}>{m.codigo} - {m.descricao}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Qtd *</Label>
                      <Input type="number" min="1" required value={item.quantidade} onChange={(e) => updateItem(index, "quantidade", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Valor</Label>
                      <Input type="number" step="0.01" value={item.valor} onChange={(e) => updateItem(index, "valor", e.target.value)} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Justificativa</Label>
                      <Select value={item.justificativa_id} onChange={(e) => updateItem(index, "justificativa_id", e.target.value)}>
                        <option value="">Selecione...</option>
                        {justificativas.map((j) => (
                          <option key={j.id} value={j.id}>{j.nome}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {itensForm.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Registrando..." : "Registrar Movimentação"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
