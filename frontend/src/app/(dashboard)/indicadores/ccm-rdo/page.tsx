"use client"

import { HardHat } from "lucide-react"
import { PageHeader } from "@/components/dashboard/PageHeader"

export default function CcmRdoPage() {
  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-700">
      <PageHeader
        icon="engineering"
        title="RDO — CCM"
        insights={[]}
        fallbackText="Relatório Diário de Obra do CCM."
        showPeriodSelector={true}
      />

      <div className="card-premium p-8 flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100">
          <HardHat className="h-8 w-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 uppercase tracking-widest">Módulo em Desenvolvimento</h2>
        <p className="text-sm text-slate-500 max-w-md">
          O Painel de RDO CCM está sendo integrado ao novo motor de dados e será disponibilizado em breve.
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 uppercase tracking-widest">
          Em breve
        </span>
      </div>
    </div>
  )
}
