"use client"

interface PageLoaderProps {
    message?: string
}

export function PageLoader({ message = "Carregando..." }: PageLoaderProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-text-muted animate-pulse uppercase tracking-widest">
                {message}
            </p>
        </div>
    )
}
