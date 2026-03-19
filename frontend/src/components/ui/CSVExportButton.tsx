import { exportCSV } from "@/lib/exportCSV"

interface CSVExportButtonProps {
    data: Record<string, unknown>[]
    filename: string
    disabled?: boolean
}

export function CSVExportButton({ data, filename, disabled }: CSVExportButtonProps) {
    return (
        <button
            title="Exportar CSV"
            disabled={disabled || !data.length}
            onClick={() => exportCSV(data, filename)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-sm text-text-muted hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
            <span className="material-symbols-outlined text-[14px]">download</span>
        </button>
    )
}
