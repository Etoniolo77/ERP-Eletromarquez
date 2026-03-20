"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

interface HeaderActionsContextValue {
    actions: React.ReactNode
    setActions: (node: React.ReactNode) => void
    clearActions: () => void
}

const HeaderActionsContext = createContext<HeaderActionsContextValue>({
    actions: null,
    setActions: () => {},
    clearActions: () => {},
})

export function HeaderActionsProvider({ children }: { children: React.ReactNode }) {
    const [actions, setActionsState] = useState<React.ReactNode>(null)

    const setActions = useCallback((node: React.ReactNode) => {
        setActionsState(node)
    }, [])

    const clearActions = useCallback(() => {
        setActionsState(null)
    }, [])

    return (
        <HeaderActionsContext.Provider value={{ actions, setActions, clearActions }}>
            {children}
        </HeaderActionsContext.Provider>
    )
}

export function useHeaderActions() {
    return useContext(HeaderActionsContext)
}
