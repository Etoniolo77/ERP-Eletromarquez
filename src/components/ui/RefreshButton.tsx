"use client"

import React from "react"

interface RefreshButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
}

export function RefreshButton({ loading = false, className = "", ...props }: RefreshButtonProps) {
    return (
        <button
            {...props}
            className={`btn-premium btn-primary h-9 gap-2 shadow-lg shadow-primary/20 ${className}`}
            disabled={loading || props.disabled}
        >
            <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>refresh</span>
            <span className="leading-none">Atualizar</span>
        </button>
    )
}
