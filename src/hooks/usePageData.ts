"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"

interface UsePageDataOptions<T> {
    url: string | (() => string)
    syncModule?: string
    deps?: unknown[]
    transform?: (raw: unknown) => T
}

interface UsePageDataResult<T> {
    data: T | null
    loading: boolean
    error: string | null
    reload: (forceSync?: boolean) => void
}

export function usePageData<T = unknown>({
    url,
    syncModule,
    deps = [],
    transform,
}: UsePageDataOptions<T>): UsePageDataResult<T> {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const isInitialMount = useRef(true)

    const reload = useCallback(async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()

        setLoading(true)
        setError(null)
        try {
            if (forceSync && syncModule) await triggerSync(syncModule)
            const endpoint = typeof url === "function" ? url() : url
            const response = await api.get(endpoint, { signal: abortRef.current.signal })
            const result = transform ? transform(response.data) : response.data
            setData(result)
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.name === "CanceledError") return
            }
            if (typeof err === "object" && err !== null && "code" in err) {
                if ((err as { code: string }).code === "ERR_CANCELED") return
            }
            const msg = err instanceof Error ? err.message : "Erro ao carregar dados."
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [url, syncModule, transform]) // eslint-disable-line react-hooks/exhaustive-deps

    // Initial mount: sync + fetch
    useEffect(() => {
        reload(true)
        isInitialMount.current = false
        return () => { abortRef.current?.abort() }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Filter changes: fetch only
    useEffect(() => {
        if (isInitialMount.current) return
        reload(false)
    }, deps) // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error, reload }
}
