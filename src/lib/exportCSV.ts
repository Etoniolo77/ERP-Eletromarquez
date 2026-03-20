export function exportCSV(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csvRows = [
        headers.join(";"),
        ...rows.map(row =>
            headers.map(h => {
                const val = row[h]
                const str = val == null ? "" : String(val)
                return str.includes(";") || str.includes('"') || str.includes("\n")
                    ? `"${str.replace(/"/g, '""')}"`
                    : str
            }).join(";")
        )
    ]
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
}
