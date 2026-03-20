import { useState, useMemo } from "react"

type SortDirection = "asc" | "desc" | null

export function useSortableTable<T extends Record<string, unknown>>(data: T[]) {
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<SortDirection>(null)

    const handleSort = (key: string) => {
        if (sortKey === key) {
            const next: SortDirection = sortDir === "asc" ? "desc" : null
            setSortDir(next)
            if (!next) setSortKey(null)
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
    }

    const sorted = useMemo(() => {
        if (!sortKey || !sortDir) return data
        return [...data].sort((a, b) => {
            const av = a[sortKey]
            const bv = b[sortKey]
            if (typeof av === "number" && typeof bv === "number") {
                return sortDir === "asc" ? av - bv : bv - av
            }
            return sortDir === "asc"
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av))
        })
    }, [data, sortKey, sortDir])

    return { sorted, sortKey, sortDir, handleSort }
}
