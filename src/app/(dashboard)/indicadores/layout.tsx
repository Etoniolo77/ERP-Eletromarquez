import React from "react"
import { FilterProvider } from "@/components/providers/FilterProvider"

export default function IndicadoresLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <FilterProvider>
            <div className="bg-background text-foreground min-h-full">
                {children}
            </div>
        </FilterProvider>
    )
}
