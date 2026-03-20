"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"

type PeriodType = "day" | "week" | "month" | "year" | string

interface FilterContextType {
    period: PeriodType
    setPeriod: (period: PeriodType) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)
const STORAGE_KEY = "erp_filter_period"

function readStoredPeriod(): PeriodType {
    if (typeof window === "undefined") return "latest"
    try {
        return (localStorage.getItem(STORAGE_KEY) as PeriodType) || "latest"
    } catch {
        return "latest"
    }
}

export function FilterProvider({ children }: { children: ReactNode }) {
    const [period, setPeriodState] = useState<PeriodType>(readStoredPeriod)

    const setPeriod = useCallback((p: PeriodType) => {
        setPeriodState(p)
        try { localStorage.setItem(STORAGE_KEY, p) } catch { /* ignore */ }
    }, [])

    return (
        <FilterContext.Provider value={{ period, setPeriod }}>
            {children}
        </FilterContext.Provider>
    )
}

export function useFilter() {
    const context = useContext(FilterContext)
    if (context === undefined) {
        throw new Error("useFilter must be used within a FilterProvider")
    }
    return context
}
