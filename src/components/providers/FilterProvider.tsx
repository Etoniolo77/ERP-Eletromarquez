"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

type PeriodType = "day" | "week" | "month" | "year" | string

interface FilterContextType {
    period: PeriodType
    setPeriod: (period: PeriodType) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
    const [period, setPeriod] = useState<PeriodType>("latest")

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
