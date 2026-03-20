"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  Warehouse,
  Truck,
  HardHat,
  Shield,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

interface NavChild {
  label: string
  href: string
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  href?: string
  children?: NavChild[]
}

const navigation: NavGroup[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5 shrink-0" />,
  },
  {
    label: "CCM",
    icon: <HardHat className="h-5 w-5 shrink-0" />,
    children: [
      { label: "RDO", href: "/indicadores/ccm-rdo" },
      { label: "Saída de Base", href: "/indicadores/saida-base" },
      { label: "Tempos Operacionais", href: "/indicadores/produtividade" },
    ],
  },
  {
    label: "Turmas",
    icon: <BarChart3 className="h-5 w-5 shrink-0" />,
    children: [
      { label: "RDO", href: "/indicadores/turmas/rdo" },
      { label: "Produtividade", href: "/indicadores/turmas" },
      { label: "Indisponibilidade", href: "/indicadores/indisponibilidade" },
      { label: "Rejeições", href: "/indicadores/rejeicoes" },
    ],
  },
  {
    label: "SESMT",
    icon: <Shield className="h-5 w-5 shrink-0" />,
    children: [
      { label: "APR Digital", href: "/indicadores/apr" },
      { label: "Programa 5S", href: "/indicadores/5s" },
    ],
  },
  {
    label: "Frota",
    icon: <Truck className="h-5 w-5 shrink-0" />,
    children: [
      { label: "Custos", href: "/indicadores/frota" },
    ],
  },
  {
    label: "Logística",
    icon: <Warehouse className="h-5 w-5 shrink-0" />,
    children: [
      { label: "Almoxarifado CCM", href: "/indicadores/logccm" },
      { label: "Almoxarifado Turmas", href: "/almoxarifado/turmas" },
      { label: "Almoxarifado SESMT", href: "/almoxarifado/sesmt" },
      { label: "Almoxarifado Frota", href: "/almoxarifado/frota" },
    ],
  },
]

function getActiveGroup(pathname: string): string | null {
  for (const item of navigation) {
    if (item.children) {
      if (item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        return item.label
      }
    }
  }
  return null
}

export function MainSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(() => getActiveGroup(pathname))
  const [collapsed, setCollapsed] = useState(false)

  // Auto-open active group on navigation
  useEffect(() => {
    const active = getActiveGroup(pathname)
    if (active) setExpanded(active)
  }, [pathname])

  // Communicate sidebar width to layout via CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? "64px" : "256px"
    )
  }, [collapsed])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  function toggleGroup(label: string) {
    setExpanded((prev: string | null) => (prev === label ? null : label))
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-blue-600">
              <span className="text-xs font-bold text-white">E</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 truncate">Eletromarquez</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 mx-auto">
            <span className="text-xs font-bold text-white">E</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v: boolean) => !v)}
          className={cn(
            "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0",
            collapsed && "mx-auto mt-0"
          )}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        {navigation.map((item) => {
          if (item.href) {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          }

          const isOpen = expanded === item.label
          const hasActive = item.children?.some(
            (c) => pathname === c.href || pathname.startsWith(c.href + "/")
          )

          return (
            <div key={item.label}>
              <button
                onClick={() => !collapsed && toggleGroup(item.label)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  hasActive
                    ? "text-blue-700"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && isOpen && item.children && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
                  {item.children.map((child) => {
                    const isActive =
                      pathname === child.href || pathname.startsWith(child.href + "/")
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded px-2.5 py-1.5 text-[13px] transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-2 space-y-0.5">
        <Link
          href="/configuracoes"
          title={collapsed ? "Configurações" : undefined}
          className={cn(
            "flex items-center gap-3 rounded px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded px-2.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  )

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full bg-white border-r border-slate-200 transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {sidebarContent}
    </aside>
  )
}
