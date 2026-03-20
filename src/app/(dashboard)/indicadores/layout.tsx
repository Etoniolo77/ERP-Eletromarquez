import React, { Suspense } from "react"
import { FilterProvider } from "@/components/providers/FilterProvider"
import { PeriodSelector } from "@/components/providers/PeriodSelector"
import { URLPeriodSync } from "@/components/providers/URLPeriodSync"

export default function IndicadoresLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <FilterProvider>
            <Suspense fallback={null}>
                <URLPeriodSync />
            </Suspense>
            <div className="bg-background text-foreground min-h-full flex flex-col">
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </FilterProvider>
    )
}
