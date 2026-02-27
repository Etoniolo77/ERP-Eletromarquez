"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  ArrowRightLeft,
  ClipboardList,
  BarChart3,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  User,
  Menu,
  X,
  Warehouse,
  Truck,
  HardHat,
  Shield,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
}

const navigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Almoxarifado",
    icon: <Warehouse className="h-5 w-5" />,
    children: [
      { label: "Materiais (SESMT)", href: "/almoxarifado/sesmt" },
      { label: "Estoques", href: "/almoxarifado/frota" },
      { label: "Movimentações", href: "/almoxarifado/movimentacoes" },
      { label: "Inventário", href: "/almoxarifado/inventario" },
      { label: "MRP", href: "/almoxarifado/mrp" },
    ],
  },
  {
    label: "SESMT",
    icon: <Shield className="h-5 w-5" />,
    children: [
      { label: "5S", href: "/sesmt/5s" },
      { label: "APR Digital", href: "/sesmt/apr" },
    ],
  },
  {
    label: "CCM",
    icon: <HardHat className="h-5 w-5" />,
    children: [
      { label: "5S", href: "/ccm/5s" },
      { label: "Emergências", href: "/ccm/emergencias" },
      { label: "Obras", href: "/ccm/obras" },
      { label: "Saída de Base", href: "/ccm/saida-base" },
      { label: "RDO", href: "/ccm/rdo" },
    ],
  },
  {
    label: "Turmas",
    icon: <Users className="h-5 w-5" />,
    children: [
      { label: "RDO", href: "/turmas/rdo" },
      { label: "Indisponibilidade", href: "/turmas/indisponibilidade" },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedItems, setExpandedItems] = useState<string[]>(["Almoxarifado"])
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleExpanded(label: string) {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    )
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600">
          <span className="text-sm font-bold text-white">E</span>
        </div>
        <span className="text-lg font-semibold text-gray-900">ERP Empresarial</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => {
          if (item.href) {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          }

          const isExpanded = expandedItems.includes(item.label)
          const hasActiveChild = item.children?.some((child) =>
            pathname.startsWith(child.href)
          )

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleExpanded(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  hasActiveChild
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {isExpanded && item.children && (
                <div className="ml-5 mt-1 space-y-1 border-l border-gray-200 pl-4">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href || pathname.startsWith(child.href + "/")
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
      <div className="border-t border-gray-200 p-3 space-y-1">
        <Link
          href="/configuracoes"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Settings className="h-5 w-5" />
          Configurações
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 rounded-md bg-white p-2 shadow-md lg:hidden cursor-pointer"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 bg-white border-r border-gray-200 transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
