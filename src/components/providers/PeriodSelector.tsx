"use client"

import { useFilter } from "@/components/providers/FilterProvider"

const PERIODS = [
    { value: "latest", label: "Último" },
    { value: "day", label: "Hoje" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
    { value: "year", label: "Ano" },
]

export function PeriodSelector() {
    const { period, setPeriod } = useFilter()

    return (
        <div className="flex items-center gap-1 bg-surface border border-border px-2 py-1 rounded-sm shadow-sm">
            <span className="material-symbols-outlined text-[13px] text-primary">calendar_month</span>
            <div className="flex gap-0.5">
                {PERIODS.map((p) => (
                    <button
                        key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={`text-[9px] uppercase font-bold px-2.5 py-1 rounded-sm transition-all ${
                            period === p.value
                                ? "bg-primary text-white"
                                : "text-text-muted hover:text-primary"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
