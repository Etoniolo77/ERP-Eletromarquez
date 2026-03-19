"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useFilter } from "@/components/providers/FilterProvider"

/**
 * Syncs the global period filter with the URL query param `?periodo=`.
 * - On mount: if URL has `?periodo=`, it overrides the stored period.
 * - When period changes: URL is updated to reflect it.
 * Must be wrapped in <Suspense> at usage site (Next.js requirement for useSearchParams).
 */
export function URLPeriodSync() {
    const { period, setPeriod } = useFilter()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // On mount: apply URL param if present
    useEffect(() => {
        const urlPeriod = searchParams.get("periodo")
        if (urlPeriod && urlPeriod !== period) {
            setPeriod(urlPeriod)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Keep URL in sync when period changes
    useEffect(() => {
        const currentURLPeriod = searchParams.get("periodo") ?? "latest"
        if (period === currentURLPeriod) return

        const params = new URLSearchParams(searchParams.toString())
        if (period === "latest") {
            params.delete("periodo")
        } else {
            params.set("periodo", period)
        }
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
    }, [period])

    return null
}
