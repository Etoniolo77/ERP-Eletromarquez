"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"

/**
 * Reads a single query param from the URL and provides a setter that updates the URL
 * without a full navigation (replaces the current history entry).
 */
export function useURLState(key: string, defaultValue: string): [string, (value: string) => void] {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const value = searchParams.get(key) ?? defaultValue

    const setValue = useCallback((newValue: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (newValue === defaultValue) {
            params.delete(key)
        } else {
            params.set(key, newValue)
        }
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
    }, [key, defaultValue, pathname, router, searchParams])

    return [value, setValue]
}
