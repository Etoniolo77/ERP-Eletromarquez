import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || ""

    let path = `/proxy/planos_5s`
    if (status) path += `?status=${encodeURIComponent(status)}`

    const data = await safeFetch<any[]>(path, [])

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
