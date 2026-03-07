"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Avoid hydration mismatch
    React.useEffect(() => setMounted(true), [])

    if (!mounted) {
        return <div className="p-2 w-9 h-9" />
    }

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-text-muted hover:text-primary transition-all duration-300 border border-transparent hover:border-border group flex items-center justify-center overflow-hidden"
            aria-label="Toggle theme"
        >
            <div className="relative w-[18px] h-[18px] flex items-center justify-center">
                <span className={`material-symbols-outlined absolute text-[18px] transition-all duration-500 ease-in-out ${theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 group-hover:rotate-12'}`}>
                    light_mode
                </span>
                <span className={`material-symbols-outlined absolute text-[18px] transition-all duration-500 ease-in-out ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100 group-hover:-rotate-12' : '-rotate-90 scale-0 opacity-0'}`}>
                    dark_mode
                </span>
            </div>
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
