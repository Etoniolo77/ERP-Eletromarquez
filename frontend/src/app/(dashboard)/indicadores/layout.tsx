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
                <div className="flex items-center justify-end px-4 py-2 border-b border-border/30 bg-surface/40">
                    <PeriodSelector />
                </div>
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </FilterProvider>
    )
}
