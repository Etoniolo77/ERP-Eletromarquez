export function getDateRange(periodo: string): { startDate: string; endDate: string } {
  const today = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  const endDate = fmt(today)
  let startDate: string

  switch (periodo) {
    case 'day':
      startDate = endDate
      break
    case 'week':
    case '7d': {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      startDate = fmt(d)
      break
    }
    case 'month': {
      startDate = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`
      break
    }
    case 'last_month': {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastMonth = new Date(firstOfThisMonth); lastMonth.setDate(0)
      const firstOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
      startDate = fmt(firstOfLastMonth)
      return { startDate, endDate: fmt(lastMonth) }
    }
    case 'year':
      startDate = `${today.getFullYear()}-01-01`
      break
    case '30d': {
      const d = new Date(today); d.setDate(d.getDate() - 30)
      startDate = fmt(d)
      break
    }
    default:
      startDate = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`
  }

  return { startDate, endDate }
}

export function getPrevDateRange(periodo: string): { startDate: string; endDate: string } {
  const curr = getDateRange(periodo)
  const start = new Date(curr.startDate)
  const end = new Date(curr.endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - diffDays + 1)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd) }
}
