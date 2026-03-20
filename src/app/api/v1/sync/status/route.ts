import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .order("last_sync", { ascending: false })
      .limit(10)
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
