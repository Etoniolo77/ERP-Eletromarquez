import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { HeaderActionsProvider } from "@/components/providers/HeaderActionsProvider"

export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <HeaderActionsProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div
          className="transition-all duration-200"
          style={{ marginLeft: "var(--sidebar-w, 256px)" }}
        >
          <Header />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </HeaderActionsProvider>
  )
}
