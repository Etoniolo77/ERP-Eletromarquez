"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/types/database"

export default function ConfiguracoesPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadProfile() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single()
                if (data) setProfile(data)
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            {/* Header */}
            <div className="bg-surface border border-border p-4 rounded-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                    </div>
                    <div>
                        <h1 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Configurações do Sistema</h1>
                        <p className="text-[10px] text-text-muted font-medium uppercase mt-0.5">Preferências e informações da conta</p>
                    </div>
                </div>
            </div>

            {/* Perfil */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-surface/50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Perfil do Usuário</h2>
                </div>
                <div className="p-4">
                    {loading ? (
                        <p className="text-[11px] text-text-muted uppercase font-medium">Carregando perfil...</p>
                    ) : profile ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] font-semibold uppercase text-text-muted tracking-widest mb-1">Nome Completo</p>
                                <p className="text-sm font-semibold text-text-heading">{profile.nome_completo}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-semibold uppercase text-text-muted tracking-widest mb-1">Perfil de Acesso</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                                    {profile.role}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11px] text-text-muted uppercase font-medium">Perfil não encontrado.</p>
                    )}
                </div>
            </div>

            {/* Sistema */}
            <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-surface/50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-heading">Informações do Sistema</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <p className="text-[9px] font-semibold uppercase text-text-muted tracking-widest mb-1">Versão</p>
                        <p className="text-sm font-semibold text-text-heading">0.1.0</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-semibold uppercase text-text-muted tracking-widest mb-1">Ambiente</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 text-[10px] font-semibold uppercase">
                            Desenvolvimento
                        </span>
                    </div>
                    <div>
                        <p className="text-[9px] font-semibold uppercase text-text-muted tracking-widest mb-1">Empresa</p>
                        <p className="text-sm font-semibold text-text-heading">Eletromarquez Ltda.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
