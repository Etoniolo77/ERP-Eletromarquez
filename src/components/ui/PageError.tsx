"use client"

interface PageErrorProps {
    error: string
    onRetry?: () => void
}

export function PageError({ error, onRetry }: PageErrorProps) {
    return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">{error}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                    Tentar Novamente
                </button>
            )}
        </div>
    )
}
