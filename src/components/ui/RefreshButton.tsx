"use client"

import React from "react"

interface RefreshButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
}

export function RefreshButton({ loading = false, className = "", ...props }: RefreshButtonProps) {
    return (
        <button
            {...props}
            title="Atualizar"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-white transition-all active:scale-95 disabled:opacity-50 hover:bg-primary/80 ${className}`}
            disabled={loading || props.disabled}
        >
            <span className={`material-symbols-outlined text-[15px] ${loading ? "animate-spin" : ""}`}>refresh</span>
        </button>
    )
}
