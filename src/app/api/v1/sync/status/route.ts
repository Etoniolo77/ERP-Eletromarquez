import { NextResponse } from "next/server"
import { safeFetch } from "@/lib/apiFetcher"

export async function GET() {
  try {
    const data = await safeFetch<any>("/proxy/sync_status", {
      status: "unknown",
      last_sync: null,
      message: "Erro ao conectar com o motor de gestão."
    })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ 
      status: "error", 
      message: err.message 
    }, { status: 500 })
  }
}
