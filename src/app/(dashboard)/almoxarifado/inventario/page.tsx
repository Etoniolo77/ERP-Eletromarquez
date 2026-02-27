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
import { Plus, ClipboardList, CheckCircle, AlertCircle, Clock, Save, Eye } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Inventario, InventarioItem, EstoqueLocal, Material, InventarioStatus } from "@/types/database"

interface InventarioCompleto extends Inventario {
  estoque: EstoqueLocal
  itens?: InventarioItemCompleto[]
}

interface InventarioItemCompleto extends InventarioItem {
  material: Material
}

export default function InventarioPage() {
  const [inventarios, setInventarios] = useState<InventarioCompleto[]>([])
  const [estoques, setEstoques] = useState<EstoqueLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogNovoOpen, setDialogNovoOpen] = useState(false)
  const [dialogContagemOpen, setDialogContagemOpen] = useState(false)
  const [selectedInventario, setSelectedInventario] = useState<InventarioCompleto | null>(null)
  const [itensContagem, setItensContagem] = useState<InventarioItemCompleto[]>([])
  const [saving, setSaving] = useState(false)
  const [savingContagem, setSavingContagem] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: invs }, { data: estqs }] = await Promise.all([
      supabase
        .from("inventarios")
        .select("*, estoque:estoques(*)")
        .order("created_at", { ascending: false }),
      supabase.from("estoques").select("*").eq("tipo_estoque", "Equipe"),
    ])

    setInventarios((invs as InventarioCompleto[]) || [])
    setEstoques(estqs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function getStatusBadge(status: InventarioStatus) {
    const map: Record<InventarioStatus, { variant: "default" | "warning" | "success" | "destructive"; icon: React.ReactNode }> = {
      ABERTO: { variant: "default", icon: <Clock className="h-3 w-3" /> },
      EM_ANDAMENTO: { variant: "warning", icon: <ClipboardList className="h-3 w-3" /> },
      FINALIZADO: { variant: "success", icon: <CheckCircle className="h-3 w-3" /> },
      CANCELADO: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
    }
    const { variant, icon } = map[status]
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        {icon} {status.replace("_", " ")}
      </Badge>
    )
  }

  async function handleCriarInventario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const estoqueId = parseInt(form.get("estoque_id") as string)
    const mesReferencia = form.get("mes_referencia") as string
    const observacoes = (form.get("observacoes") as string) || null

    const { data: { user } } = await supabase.auth.getUser()

    const { data: inventario } = await supabase
      .from("inventarios")
      .insert({
        estoque_id: estoqueId,
        mes_referencia: mesReferencia + "-01",
        status: "ABERTO",
        responsavel_id: user?.id,
        observacoes,
      })
      .select()
      .single()

    if (inventario) {
      const { data: itensEstoque } = await supabase
        .from("itens_estoque")
        .select("*, material:materiais(*)")
        .eq("estoque_id", estoqueId)

      if (itensEstoque && itensEstoque.length > 0) {
        const itens = itensEstoque.map((e: { material_id: number; saldo: number }) => ({
          inventario_id: inventario.id,
          material_id: e.material_id,
          quantidade_sistema: e.saldo,
        }))
        await supabase.from("inventario_itens").insert(itens)
      }
    }

    setSaving(false)
    setDialogNovoOpen(false)
    loadData()
  }

  async function abrirContagem(inventario: InventarioCompleto) {
    setSelectedInventario(inventario)

    const { data: itens } = await supabase
      .from("inventario_itens")
      .select("*, material:materiais(*)")
      .eq("inventario_id", inventario.id)

    setItensContagem((itens as InventarioItemCompleto[]) || [])
    setDialogContagemOpen(true)

    if (inventario.status === "ABERTO") {
      await supabase
        .from("inventarios")
        .update({ status: "EM_ANDAMENTO", data_inicio: new Date().toISOString() })
        .eq("id", inventario.id)
      loadData()
    }
  }

  async function salvarContagem() {
    if (!selectedInventario) return
    setSavingContagem(true)

    const { data: { user } } = await supabase.auth.getUser()

    for (const item of itensContagem) {
      if (item.quantidade_contagem !== null) {
        const divergencia = item.quantidade_contagem - item.quantidade_sistema
        await supabase
          .from("inventario_itens")
          .update({
            quantidade_contagem: item.quantidade_contagem,
            divergencia,
            justificativa: item.justificativa,
            contado_por: user?.id,
            contado_em: new Date().toISOString(),
          })
          .eq("id", item.id)
      }
    }

    setSavingContagem(false)
  }

  async function finalizarInventario() {
    if (!selectedInventario) return

    await supabase
      .from("inventarios")
      .update({ status: "FINALIZADO", data_fim: new Date().toISOString() })
      .eq("id", selectedInventario.id)

    setDialogContagemOpen(false)
    setSelectedInventario(null)
    loadData()
  }

  function updateItemContagem(itemId: number, field: string, value: string | number | null) {
    setItensContagem((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, [field]: value } : item)
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventário Mensal</h2>
          <p className="text-gray-500">Contagem física e reconciliação de estoque</p>
        </div>
        <Button onClick={() => setDialogNovoOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Inventário
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{inventarios.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Em Andamento</p>
              <p className="text-2xl font-bold text-yellow-600">
                {inventarios.filter((i) => i.status === "EM_ANDAMENTO").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Finalizados</p>
              <p className="text-2xl font-bold text-green-600">
                {inventarios.filter((i) => i.status === "FINALIZADO").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Abertos</p>
              <p className="text-2xl font-bold">
                {inventarios.filter((i) => i.status === "ABERTO").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês Referência</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : inventarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Nenhum inventário criado. Clique em &quot;Novo Inventário&quot; para começar.
                  </TableCell>
                </TableRow>
              ) : (
                inventarios.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {new Date(inv.mes_referencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </TableCell>
                    <TableCell>{inv.estoque?.nome}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-sm">{inv.data_inicio ? formatDate(inv.data_inicio) : "-"}</TableCell>
                    <TableCell className="text-sm">{inv.data_fim ? formatDate(inv.data_fim) : "-"}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{inv.observacoes || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant={inv.status === "FINALIZADO" ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => abrirContagem(inv)}
                      >
                        {inv.status === "FINALIZADO" ? (
                          <><Eye className="h-4 w-4 mr-1" /> Ver</>
                        ) : (
                          <><ClipboardList className="h-4 w-4 mr-1" /> Contar</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Novo Inventário */}
      <Dialog open={dialogNovoOpen} onOpenChange={setDialogNovoOpen}>
        <DialogClose onClose={() => setDialogNovoOpen(false)} />
        <DialogHeader>
          <DialogTitle>Novo Inventário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCriarInventario}>
          <DialogContent>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="estoque_id">Estoque *</Label>
                <Select id="estoque_id" name="estoque_id" required>
                  <option value="">Selecione...</option>
                  {estoques.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mes_referencia">Mês de Referência *</Label>
                <Input id="mes_referencia" name="mes_referencia" type="month" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" name="observacoes" rows={3} />
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogNovoOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Criando..." : "Criar Inventário"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Contagem */}
      <Dialog open={dialogContagemOpen} onOpenChange={setDialogContagemOpen}>
        <div className="!max-w-4xl w-full">
          <DialogClose onClose={() => setDialogContagemOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              Contagem - {selectedInventario?.estoque?.nome} -{" "}
              {selectedInventario && new Date(selectedInventario.mes_referencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>
          <DialogContent>
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Sist.</TableHead>
                    <TableHead className="text-right">Contagem</TableHead>
                    <TableHead className="text-right">Diverg.</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensContagem.map((item) => {
                    const divergencia = item.quantidade_contagem !== null
                      ? item.quantidade_contagem - item.quantidade_sistema
                      : null
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.material?.codigo}</TableCell>
                        <TableCell className="text-sm">{item.material?.descricao}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantidade_sistema}</TableCell>
                        <TableCell className="text-right">
                          {selectedInventario?.status === "FINALIZADO" ? (
                            <span className="font-medium">{item.quantidade_contagem ?? "-"}</span>
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 text-right"
                              value={item.quantidade_contagem ?? ""}
                              onChange={(e) =>
                                updateItemContagem(item.id, "quantidade_contagem", e.target.value ? parseFloat(e.target.value) : null)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {divergencia !== null && (
                            <span className={divergencia === 0 ? "text-green-600" : "text-red-600 font-medium"}>
                              {divergencia > 0 ? "+" : ""}{divergencia}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {selectedInventario?.status === "FINALIZADO" ? (
                            <span className="text-sm">{item.justificativa || "-"}</span>
                          ) : (
                            <Input
                              className="w-40"
                              placeholder="Justificativa..."
                              value={item.justificativa || ""}
                              onChange={(e) => updateItemContagem(item.id, "justificativa", e.target.value)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
          {selectedInventario?.status !== "FINALIZADO" && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogContagemOpen(false)}>Fechar</Button>
              <Button variant="secondary" onClick={salvarContagem} disabled={savingContagem}>
                <Save className="h-4 w-4 mr-1" />
                {savingContagem ? "Salvando..." : "Salvar Contagem"}
              </Button>
              <Button onClick={finalizarInventario}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Finalizar Inventário
              </Button>
            </DialogFooter>
          )}
        </div>
      </Dialog>
    </div>
  )
}
