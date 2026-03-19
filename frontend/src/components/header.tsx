"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { User, ChevronRight } from "lucide-react"
import type { Profile } from "@/types/database"
import { useHeaderActions } from "@/components/providers/HeaderActionsProvider"

const labelMap: Record<string, string> = {
  indicadores: "Indicadores",
  "ccm-rdo": "RDO",
  "saida-base": "Saída de Base",
  produtividade: "Tempos Operacionais",
  turmas: "Turmas",
  rdo: "RDO",
  indisponibilidade: "Indisponibilidade",
  rejeicoes: "Rejeições",
  apr: "APR Digital",
  "5s": "Programa 5S",
  frota: "Frota",
  logccm: "Logística CCM",
  almoxarifado: "Almoxarifado",
  sesmt: "SESMT",
  ccm: "CCM",
  configuracoes: "Configurações",
  mrp: "MRP",
  movimentacoes: "Movimentações",
  inventario: "Inventário",
  obras: "Obras",
  emergencias: "Emergências",
}

function buildCrumbs(pathname: string) {
  if (pathname === "/") return [{ label: "Dashboard", href: "/" }]
  const parts = pathname.split("/").filter(Boolean)
  const crumbs = [{ label: "Dashboard", href: "/" }]
  let acc = ""
  for (const part of parts) {
    acc += "/" + part
    crumbs.push({ label: labelMap[part] ?? part, href: acc })
  }
  return crumbs
}

export function Header() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const pathname = usePathname()
  const supabase = createClient()
  const crumbs = buildCrumbs(pathname)
  const { actions } = useHeaderActions()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
        if (data) setProfile(data)
      }
    }
    loadProfile()
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
            <span
              className={
                i === crumbs.length - 1
                  ? "font-semibold text-slate-900"
                  : "text-slate-400 hover:text-slate-600 cursor-pointer"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Page actions slot */}
      <div className="flex items-center gap-3">
        {actions}
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-slate-900 leading-none">{profile.nome_completo}</p>
              <p className="text-[11px] text-slate-400 capitalize mt-0.5">{profile.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
