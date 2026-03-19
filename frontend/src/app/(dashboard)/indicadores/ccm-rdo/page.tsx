"use client"

import { HardHat } from "lucide-react"

export default function CcmRdoPage() {
  return (
    <div className="page-container">
      <div className="card-premium p-8 flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100">
          <HardHat className="h-8 w-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">RDO — CCM</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Relatório Diário de Obra do CCM. Esta página está em desenvolvimento e será disponibilizada em breve.
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
          Em desenvolvimento
        </span>
      </div>
    </div>
  )
}
