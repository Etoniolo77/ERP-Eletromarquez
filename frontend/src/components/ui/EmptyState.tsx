interface EmptyStateProps {
    icon?: string
    title?: string
    description?: string
}

export function EmptyState({
    icon = "inbox",
    title = "Sem dados",
    description = "Nenhum registro encontrado para o período selecionado.",
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <span className="material-symbols-outlined text-[32px] text-text-muted/30">{icon}</span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/50">{title}</p>
            <p className="text-[10px] text-text-muted/40 font-medium max-w-[240px] leading-relaxed">{description}</p>
        </div>
    )
}
