interface SortableHeaderProps {
    label: string
    sortKey: string
    activeSortKey: string | null | undefined
    sortDir: "asc" | "desc" | null
    onSort: (key: string) => void
    className?: string
}

export function SortableHeader({
    label, sortKey, activeSortKey, sortDir, onSort, className = ""
}: SortableHeaderProps) {
    const isActive = activeSortKey === sortKey
    const icon = isActive && sortDir === "asc" ? "arrow_upward" : isActive && sortDir === "desc" ? "arrow_downward" : "unfold_more"

    return (
        <th
            className={`p-3 cursor-pointer select-none group ${className}`}
            onClick={() => onSort(sortKey)}
        >
            <span className="flex items-center gap-1">
                <span>{label}</span>
                <span className={`material-symbols-outlined text-[12px] transition-colors ${isActive ? "text-primary" : "text-text-muted/30 group-hover:text-text-muted/60"}`}>
                    {icon}
                </span>
            </span>
        </th>
    )
}
