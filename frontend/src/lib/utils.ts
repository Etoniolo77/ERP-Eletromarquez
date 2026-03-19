import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/** Formata moeda sem centavos — ex: R$ 1.234 */
export function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date))
}

/** Paleta de cores padrão para gráficos */
export const CHART_COLORS = [
  "#1152d4",
  "#10b981",
  "#f43f5e",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
]

/** Cores por regional (CCM) */
export const REGIONAL_COLORS: Record<string, string> = {
  ITA: "#1152d4",
  ITARANA: "#1152d4",
  NVE: "#f43f5e",
  "NOVA VENÉCIA": "#f43f5e",
  VNO: "#64748b",
  "VENDA NOVA DO IMIGRANTE": "#64748b",
}
