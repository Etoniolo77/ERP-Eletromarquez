import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const regional = searchParams.get("regional") || ""
    const setor = searchParams.get("setor") || ""

    let path = `/proxy/audit_5s`
    const params = new URLSearchParams()
    if (regional) params.append("regional", regional)
    if (setor) params.append("setor", setor)
    
    const queryString = params.toString()
    if (queryString) path += `?${queryString}`

    const data = await safeFetch<any[]>(path, [])

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
