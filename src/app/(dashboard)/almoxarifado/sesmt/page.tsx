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
import { Plus, Search, Edit2, Package, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { TipoMaterial, UnidadeMedida, EstoqueResumo } from "@/types/database"

export default function AlmoxarifadoSESMTPage() {
  const [materiais, setMateriais] = useState<EstoqueResumo[]>([])
  const [tiposMaterial, setTiposMaterial] = useState<TipoMaterial[]>([])
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: mats }, { data: tipos }, { data: uns }] = await Promise.all([
      supabase.from("vw_estoque_resumo").select("*").order("codigo"),
      supabase.from("tipo_material").select("*").order("nome"),
      supabase.from("unidade_medida").select("*").order("nome"),
    ])

    setMateriais((mats as EstoqueResumo[]) || [])
    setTiposMaterial(tipos || [])
    setUnidades(uns || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredMateriais = materiais.filter(
    (m) =>
      m.codigo.toLowerCase().includes(search.toLowerCase()) ||
      m.descricao.toLowerCase().includes(search.toLowerCase())
  )

  const criticos = materiais.filter((m) => m.status_estoque === "CRITICO")
  const alertas = materiais.filter((m) => m.status_estoque === "ALERTA")

  function getEstoqueVariant(status: string) {
    if (status === "CRITICO") return "destructive"
    if (status === "ALERTA") return "warning"
    return "success"
  }

  function getEstoqueLabel(status: string) {
    if (status === "CRITICO") return "Crítico"
    if (status === "ALERTA") return "Alerta"
    return "Normal"
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const data = {
      codigo: form.get("codigo") as string,
      descricao: form.get("descricao") as string,
      tipo_material_id: parseInt(form.get("tipo_material_id") as string) || null,
      unidade_id: parseInt(form.get("unidade_id") as string) || null,
      localizacao: (form.get("localizacao") as string) || null,
      estoque_minimo: parseFloat(form.get("estoque_minimo") as string) || 0,
      estoque_maximo: parseFloat(form.get("estoque_maximo") as string) || null,
      ponto_reposicao: parseFloat(form.get("ponto_reposicao") as string) || null,
      lead_time_dias: parseInt(form.get("lead_time_dias") as string) || 7,
      custo_unitario: parseFloat(form.get("custo_unitario") as string) || 0,
      ca_numero: (form.get("ca_numero") as string) || null,
      ca_validade: (form.get("ca_validade") as string) || null,
      observacoes: (form.get("observacoes") as string) || null,
    }

    if (editingId) {
      await supabase.from("materiais").update(data).eq("id", editingId)
    } else {
      await supabase.from("materiais").insert(data)
    }

    setSaving(false)
    setDialogOpen(false)
    setEditingId(null)
    loadData()
  }

  function openEdit(mat: EstoqueResumo) {
    setEditingId(mat.material_id)
    setDialogOpen(true)
  }

  const editing = editingId ? materiais.find((m) => m.material_id === editingId) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Almoxarifado SESMT</h2>
          <p className="text-gray-500">Gestão de materiais de Segurança do Trabalho</p>
        </div>
        <Button onClick={() => { setEditingId(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />
          Novo Material
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Total de Itens</p>
                <p className="text-2xl font-bold">{materiais.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Estoque Crítico</p>
                <p className="text-2xl font-bold text-red-600">{criticos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Em Alerta</p>
                <p className="text-2xl font-bold text-yellow-600">{alertas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Valor Estimado</p>
                <p className="text-xl font-bold">
                  {formatCurrency(materiais.reduce((acc, m) => acc + (m.saldo_total * m.custo_unitario), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Buscar por código ou descrição..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo Material</TableHead>
                <TableHead>UN</TableHead>
                <TableHead>CA</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Custo Un.</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">Carregando...</TableCell>
                </TableRow>
              ) : filteredMateriais.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    {search ? "Nenhum material encontrado." : "Nenhum material cadastrado. Clique em 'Novo Material' para começar."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMateriais.map((material) => (
                  <TableRow key={material.material_id}>
                    <TableCell className="font-mono text-sm">{material.codigo}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{material.descricao}</TableCell>
                    <TableCell className="text-sm text-gray-500">{material.tipo_material_nome || "-"}</TableCell>
                    <TableCell className="text-sm">{material.unidade_nome || "-"}</TableCell>
                    <TableCell className="text-sm">{material.ca_numero || "-"}</TableCell>
                    <TableCell className="text-right font-medium">{material.saldo_total}</TableCell>
                    <TableCell>
                      <Badge variant={getEstoqueVariant(material.status_estoque)}>{getEstoqueLabel(material.status_estoque)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(material.custo_unitario)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{material.localizacao || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(material)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
          <DialogTitle>{editingId ? "Editar Material" : "Novo Material"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <DialogContent>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input id="codigo" name="codigo" required defaultValue={editing?.codigo || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_material_id">Tipo Material</Label>
                  <Select id="tipo_material_id" name="tipo_material_id" defaultValue={editing?.tipo_material_id?.toString() || ""}>
                    <option value="">Selecione...</option>
                    {tiposMaterial.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input id="descricao" name="descricao" required defaultValue={editing?.descricao || ""} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidade_id">Unidade</Label>
                  <Select id="unidade_id" name="unidade_id" defaultValue={editing?.unidade_id?.toString() || ""}>
                    <option value="">Selecione...</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                  <Input id="custo_unitario" name="custo_unitario" type="number" step="0.01" defaultValue={editing?.custo_unitario || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input id="localizacao" name="localizacao" placeholder="Prateleira, gaveta..." defaultValue={editing?.localizacao || ""} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estoque_minimo">Estoque Mínimo *</Label>
                  <Input id="estoque_minimo" name="estoque_minimo" type="number" step="0.01" required defaultValue={editing?.estoque_minimo || "0"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_maximo">Estoque Máximo</Label>
                  <Input id="estoque_maximo" name="estoque_maximo" type="number" step="0.01" defaultValue={editing?.estoque_maximo || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ponto_reposicao">Ponto Reposição</Label>
                  <Input id="ponto_reposicao" name="ponto_reposicao" type="number" step="0.01" defaultValue={editing?.ponto_reposicao || ""} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead_time_dias">Lead Time (dias)</Label>
                  <Input id="lead_time_dias" name="lead_time_dias" type="number" defaultValue={editing?.lead_time_dias || "7"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ca_numero">Nº CA (EPI)</Label>
                  <Input id="ca_numero" name="ca_numero" placeholder="CA-XXXXX" defaultValue={editing?.ca_numero || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ca_validade">Validade CA</Label>
                  <Input id="ca_validade" name="ca_validade" type="date" defaultValue={editing?.ca_validade || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" name="observacoes" rows={2} defaultValue="" />
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
