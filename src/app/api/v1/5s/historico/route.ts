import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()
    const since = new Date()
    since.setFullYear(since.getFullYear() - 1)
    const sinceStr = since.toISOString().split("T")[0]

    const { data: rows } = await supabase
      .from("auditorias_5s")
      .select("data_auditoria, base, inspetor, local_auditado, tipo_auditoria, conformidade_pct")
      .gte("data_auditoria", sinceStr)
      .order("data_auditoria", { ascending: false })
      .limit(500)

    const items = (rows || []).map((r: any) => ({
      data: r.data_auditoria || "",
      base: r.base || "",
      local: r.local_auditado || "",
      tipo: r.tipo_auditoria || "",
      nota: r.conformidade_pct || 0,
      inspetor: r.inspetor || "",
    }))

    return NextResponse.json({ items })
  } catch (err: any) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }
}
