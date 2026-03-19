import { createServiceClient } from "@/lib/supabase/serviceClient"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data: configRow } = await supabase
      .from("system_configs")
      .select("value")
      .eq("key", "5s_action_plans")
      .maybeSingle()

    if (configRow?.value) {
      try {
        const action_plans = JSON.parse(configRow.value)
        return NextResponse.json({ action_plans })
      } catch {
        // fall through
      }
    }

    return NextResponse.json({ action_plans: [] })
  } catch {
    return NextResponse.json({ action_plans: [] }, { status: 200 })
  }
}
