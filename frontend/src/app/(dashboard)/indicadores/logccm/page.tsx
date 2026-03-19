"use client"

import React, { useState, useEffect, useMemo, useRef, Fragment } from "react"
import api from "@/lib/api"
import { triggerSync } from "@/lib/sync"
import { formatCurrency as formatCurrencyFull } from "@/lib/utils"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DashboardSkeleton } from "@/components/ui/PageSkeleton"
import { EmptyState } from "@/components/ui/EmptyState"

interface LogCcmDashboard {
    source_file: string
    last_update: string
    kpis_globais: {
        saldo_virtual: number
        saldo_fisico: number
        valor_faltas: number
        valor_sobras: number
        compensacao: number
    }
    resumo_grupos: any[]
    resumo_grupos_sem_pedalada: any[]
    faltas: any[]
    sobras: any[]
    ruptura: any[]
    serializados: any[]
    insights: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[]
}

// display compacto para células e cards (0 decimais)
const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

const formatMi = (val: number) => {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    const absVal = Math.abs(val);
    if (absVal >= 1000000) return (
        <span className="flex items-baseline gap-1">
            {(val / 1000000).toFixed(2)}
            <span className="text-[12px] font-semibold">Mi</span>
        </span>
    );
    if (absVal >= 1000) return (
        <span className="flex items-baseline gap-1">
            {(val / 1000).toFixed(1)}
            <span className="text-[12px] font-semibold lowercase">k</span>
        </span>
    );
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function LogCcmPage() {
    const [data, setData] = useState<LogCcmDashboard | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('resumo')
    const [selectedBase, setSelectedBase] = useState('Todas')
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [matrixFilter, setMatrixFilter] = useState<'net' | 'faltas' | 'sobras'>('net')
    const [matrixSort, setMatrixSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'material', dir: 'asc' })
    const [ruptureGroupBy, setRuptureGroupBy] = useState<'material' | 'data'>('material')
    const [ruptureDays, setRuptureDays] = useState(21)
    const [ruptureDaysInput, setRuptureDaysInput] = useState('21')
    const [expandedRuptura, setExpandedRuptura] = useState<Record<string, boolean>>({})
    const [rupturaRegional, setRupturaRegional] = useState('Todas')
    const [mounted, setMounted] = useState(false)
    const abortRef = useRef<AbortController | null>(null)

    const loadData = async (forceSync = false) => {
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()
        setLoading(true)
        setError(null)
        try {
            if (forceSync) await triggerSync("logccm")
            const response = await api.get(`/logccm/dashboard`, { signal: abortRef.current.signal })
            setData(response.data)
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
            setError(err.message || 'Erro ao carregar dados da Logística.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setMounted(true)
        loadData(true)
    }, [])

    const filteredData = useMemo(() => {
        if (!data) return null;
        if (selectedBase === 'Todas') return data;

        const faltas = data.faltas.filter((i: any) => i.regional === selectedBase);
        const sobras = data.sobras.filter((i: any) => i.regional === selectedBase);
        const ruptura = data.ruptura.filter((i: any) => i.regional === selectedBase);
        const serializados = data.serializados.filter((i: any) => i.regional === selectedBase);

        // Recalcular resumo_grupos dinamicamente para regional específica
        const groups: Record<string, any> = {};
        [...faltas, ...sobras].forEach(i => {
            if (!groups[i.grupo]) {
                groups[i.grupo] = {
                    grupo: i.grupo,
                    nome: i.nome_grupo || i.grupo,
                    valor_falta: 0,
                    valor_sobra: 0,
                    compensacao: 0
                };
            }
            if (i.valor < 0) groups[i.grupo].valor_falta += i.valor;
            else groups[i.grupo].valor_sobra += i.valor;
            groups[i.grupo].compensacao += i.valor;
        });

        return {
            ...data,
            faltas,
            sobras,
            ruptura,
            serializados,
            resumo_grupos: Object.values(groups).sort((a: any, b: any) => a.grupo.localeCompare(b.grupo))
        };
    }, [data, selectedBase]);

    const toggleGroup = (grp: string) => setExpandedGroups(prev => ({ ...prev, [grp]: !prev[grp] }))
    const toggleRuptura = (key: string) => setExpandedRuptura(prev => ({ ...prev, [key]: !prev[key] }))
    const handleMatrixSort = (key: string) => {
        setMatrixSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
    }

    const matrizData = useMemo(() => {
        if (!data) return { waterfall: [], matList: [], depots: [], totalFaltas: 0, totalSobras: 0, balanceNet: 0 };
        const allItems = [...data.faltas, ...data.sobras];

        const depData: Record<string, number> = {};
        allItems.forEach(i => {
            const val = i.valor || 0;
            if (matrixFilter === 'faltas' && val >= 0) return;
            if (matrixFilter === 'sobras' && val <= 0) return;
            depData[i.deposito] = (depData[i.deposito] || 0) + val;
        });

        const depots = Object.keys(depData).sort();
        const values = depots.map(d => depData[d]);
        const total = values.reduce((a, b) => a + b, 0);

        const waterfall = [];
        let current = 0;
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            const start = current;
            current += val;
            waterfall.push({
                name: depots[i],
                value: [Math.min(start, current), Math.max(start, current)],
                valNet: val,
                fill: val < 0 ? '#f43f5e' : '#10b981'
            });
        }
        waterfall.push({
            name: 'TOTAL NET',
            value: [Math.min(0, total), Math.max(0, total)],
            valNet: total,
            fill: '#1152d4',
            isTotal: true
        });

        const materials: Record<string, { material: string, desc: string, data: Record<string, { qty: number, val: number }> }> = {};
        allItems.forEach(i => {
            if (!materials[i.material]) materials[i.material] = { material: i.material, desc: i.descricao, data: {} };
            if (!materials[i.material].data[i.deposito]) materials[i.material].data[i.deposito] = { qty: 0, val: 0 };
            materials[i.material].data[i.deposito].qty += (i.saldo || 0);
            materials[i.material].data[i.deposito].val += (i.valor || 0);
        });

        let matList = Object.values(materials).filter(m => {
            let rowTotalVal = Object.values(m.data).reduce((acc: number, d: any) => acc + d.val, 0);
            if (matrixFilter === 'faltas') return rowTotalVal < 0;
            if (matrixFilter === 'sobras') return rowTotalVal > 0;
            return true;
        });

        matList.sort((a, b) => {
            let valA, valB;
            if (matrixSort.key === 'material') { valA = a.material; valB = b.material; }
            else if (matrixSort.key === 'descricao') { valA = a.desc; valB = b.desc; }
            else if (matrixSort.key === 'total') {
                valA = Object.values(a.data).reduce((acc: number, d: any) => acc + d.val, 0);
                valB = Object.values(b.data).reduce((acc: number, d: any) => acc + d.val, 0);
            } else {
                valA = a.data[matrixSort.key]?.val || 0;
                valB = b.data[matrixSort.key]?.val || 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return matrixSort.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return matrixSort.dir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return {
            waterfall,
            matList,
            depots,
            totalFaltas: data.faltas.reduce((a, b) => a + (b.valor || 0), 0),
            totalSobras: data.sobras.reduce((a, b) => a + (b.valor || 0), 0),
            balanceNet: total
        };
    }, [data, matrixFilter, matrixSort]);

    const rupturaData = useMemo(() => {
        if (!data) return { byDate: [], byMat: [] };

        const parseDate = (dstr: string) => {
            if (!dstr) return new Date();
            const parts = dstr.split('/');
            return parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) : new Date();
        }

        // Janela futura: hoje até hoje + N dias
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoffEnd = new Date(today);
        cutoffEnd.setDate(cutoffEnd.getDate() + ruptureDays);

        const rupturaSource = rupturaRegional === 'Todas'
            ? data.ruptura
            : data.ruptura.filter((i: any) => i.regional === rupturaRegional);

        const filtered = rupturaSource.filter((i: any) => {
            const d = parseDate(i.data_deslig);
            return d >= today && d <= cutoffEnd;
        });

        const groupedByDate: Record<string, any[]> = {};
        filtered.forEach(i => {
            if (!groupedByDate[i.data_deslig]) groupedByDate[i.data_deslig] = [];
            groupedByDate[i.data_deslig].push(i);
        });

        const sortedDates = Object.keys(groupedByDate).sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime());

        const byDate = sortedDates.map(d => {
            const rawItems = groupedByDate[d];
            const itemsInDate = rawItems.map(i => {
                const matGroup = rupturaSource.filter((m: any) => m.material === i.material);
                let runningFis = i.saldo_fisico || 0;
                const sorted = matGroup.sort((a, b) => parseDate(a.data_deslig).getTime() - parseDate(b.data_deslig).getTime());

                let balanceBefore = 0;
                for (let item of sorted) {
                    balanceBefore = runningFis;
                    runningFis -= (item.qtd_necessaria || 0);
                    if (item.diagrama === i.diagrama && item.data_deslig === i.data_deslig) break;
                }
                return { ...i, balanceBefore, projectedBalance: runningFis };
            }).filter(i => i.projectedBalance < 0);

            return { date: d, key: d, items: itemsInDate };
        }).filter(g => g.items.length > 0);

        const groupedByMat: Record<string, any> = {};
        filtered.forEach(i => {
            const key = `${i.material} - ${i.descricao}`;
            if (!groupedByMat[key]) groupedByMat[key] = { key, material: i.material, descricao: i.descricao, saldo_fisico: i.saldo_fisico, items: [] };
            groupedByMat[key].items.push(i);
        });

        const matKeys = Object.keys(groupedByMat).filter(k => {
            const g = groupedByMat[k];
            let runningFis = g.saldo_fisico || 0;
            const sorted = [...g.items].sort((a, b) => parseDate(a.data_deslig).getTime() - parseDate(b.data_deslig).getTime());
            return sorted.some(i => {
                runningFis -= (i.qtd_necessaria || 0);
                return runningFis < 0;
            });
        }).sort();

        const byMat = matKeys.map(k => {
            const g = groupedByMat[k];
            let runningSaldoFis = g.saldo_fisico || 0;
            let runningSaldoSis = g.items[0]?.saldo_sistema || 0;
            const sortedItems = [...g.items].sort((a, b) => parseDate(a.data_deslig).getTime() - parseDate(b.data_deslig).getTime());

            const itemsWithBalance = sortedItems.map(i => {
                runningSaldoFis -= (i.qtd_necessaria || 0);
                runningSaldoSis -= (i.qtd_necessaria || 0);
                let classif = (i.saldo_fisico >= i.qtd_analisar && (i.inventario || '').toUpperCase() === 'CONFIÁVEL') ? "OK" : (runningSaldoSis < 0 ? "REPOSIÇÃO EDP" : "FALTA MATERIAL");
                return { ...i, currentBalance: runningSaldoFis, classif };
            });

            return {
                ...g,
                itemsWithBalance: itemsWithBalance.filter(i => i.currentBalance < 0),
                total_necessaria: g.items.reduce((a: number, c: any) => a + (c.qtd_necessaria || 0), 0)
            };
        });

        return { byDate, byMat };
    }, [data, rupturaRegional, ruptureDays]);

    const computedInsights = useMemo(() => {
        if (!data) return [];
        const ins: { type: 'success' | 'warning' | 'danger' | 'info', text: string }[] = [];

        const rupturaCount = data.ruptura.length;
        if (rupturaCount > 0) {
            ins.push({ type: 'danger', text: `${rupturaCount} ocorrências de ruptura crítica identificadas no horizonte de planejamento operacional.` });
        } else {
            ins.push({ type: 'success', text: 'Nenhuma ruptura crítica identificada no horizonte de planejamento.' });
        }

        const netBalance = data.kpis_globais.valor_sobras - data.kpis_globais.valor_faltas;
        if (netBalance < 0) {
            ins.push({ type: 'warning', text: `Balanço físico negativo de ${formatCurrencyFull(netBalance)} — faltas superam sobras no inventário CCM.` });
        } else {
            ins.push({ type: 'success', text: `Balanço físico positivo de ${formatCurrencyFull(netBalance)} — sobras compensam as faltas registradas.` });
        }

        return ins;
    }, [data]);

    const kpis = useMemo(() => {
        if (!filteredData || !data) return { saldo_virtual: 0, saldo_fisico: 0, valor_faltas: 0, valor_sobras: 0, compensacao: 0 };
        if (selectedBase === 'Todas') return data.kpis_globais || { saldo_virtual: 0, saldo_fisico: 0, valor_faltas: 0, valor_sobras: 0, compensacao: 0 };

        const f = filteredData.faltas.reduce((a, b) => a + (b.valor || 0), 0);
        const s = filteredData.sobras.reduce((a, b) => a + (b.valor || 0), 0);
        const v = filteredData.ruptura.reduce((a, b) => a + (b.valor_virtual || 0), 0);

        return {
            saldo_virtual: v,
            saldo_fisico: f + s,
            valor_faltas: f,
            valor_sobras: s,
            compensacao: (f + s)
        };
    }, [filteredData, selectedBase, data]);

    if (!mounted || (loading && !data)) return <DashboardSkeleton kpis={4} charts={0} tables={2} />

    if (error) return (
        <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-rose-500 rounded-sm m-4 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="font-semibold text-xs uppercase tracking-widest text-center">Falha crítica de auditoria: {error}</p>
            <button onClick={() => loadData()} className="px-6 py-2 bg-primary text-white text-xs font-semibold uppercase rounded-sm shadow-lg shadow-primary/10 transition-all hover:scale-105">Recarregar SAP</button>
        </div>
    )
    if (!data || !filteredData) return null

    const baseOptions = [
        { value: 'Todas', label: 'Todas as Regionais' },
        { value: 'Aracruz', label: 'Aracruz' },
        { value: 'Itarana', label: 'Itarana' },
        { value: 'BSF', label: 'Barra de S. F.' },
        { value: 'Nova Venécia', label: 'Nova Venécia' },
        { value: 'VNI', label: 'Venda Nova' }
    ];

    return (
        <div className="p-4 space-y-4 animate-in fade-in duration-700">
            <PageHeader
                icon="inventory_2"
                title="Inteligência de Negócio"
                insights={computedInsights}
                fallbackText="Monitoramento de inventário e ruptura para operação digital."
                sourceFile={data?.source_file}
                lastUpdate={data?.last_update}
                onRefresh={() => loadData(true)}
                loading={loading}
            />

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
                <KpiCard title="Virtual SAP" value={formatMi(kpis.saldo_virtual)} icon="database" colorValue="slate" showVariation={false} />
                <KpiCard title="Físico Net" value={formatMi(kpis.saldo_fisico)} icon="warehouse" colorValue="primary" showVariation={false} />
                <KpiCard title="Faltas (R$)" value={formatMi(kpis.valor_faltas)} icon="trending_down" colorValue="danger" showVariation={false} />
                <KpiCard title="Sobras (R$)" value={formatMi(kpis.valor_sobras)} icon="trending_up" colorValue="success" showVariation={false} />
                <KpiCard title="Balanço Final" value={formatMi(kpis.compensacao)} icon="balance" colorValue="warning" showVariation={false} />
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-8 border-b border-border px-2 pt-2">
                {[
                    { id: 'resumo', label: 'Resumo Grupo Material', icon: 'list_alt' },
                    { id: 'matriz', label: 'Balanço Depósitos', icon: 'grid_view' },
                    { id: 'ruptura', label: 'Análise Ruptura', icon: 'warning' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 pb-3 text-[12px] font-semibold uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'text-primary' : 'text-text-muted hover:text-text-heading'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                        {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary animate-in fade-in duration-300" />}
                    </button>
                ))}
            </div>

            {/* Tab Body */}
            <main className="min-h-[500px] animate-in fade-in duration-500 mt-2">
                {activeTab === 'resumo' && (
                    <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
                            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Consolidação por Grupo de Mercadoria</h3>
                            <div className="bg-surface border border-border rounded-sm px-2 py-1 flex items-center gap-1.5 shadow-sm">
                                <span className="material-symbols-outlined text-[10px] text-primary">filter_list</span>
                                <select
                                    value={selectedBase}
                                    onChange={(e) => setSelectedBase(e.target.value)}
                                    className="bg-transparent border-none outline-none text-[10px] font-semibold uppercase tracking-tighter text-text-heading cursor-pointer min-w-[100px]"
                                >
                                    {baseOptions.map(b => (
                                        <option key={b.value} value={b.value}>{b.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-surface/50 border-b border-border text-[11px] font-semibold uppercase text-text-muted tracking-widest">
                                    <tr>
                                        <th className="p-2 w-12 text-center">#</th>
                                        <th className="p-2 w-20">G.M</th>
                                        <th className="p-2">Descrição Operacional</th>
                                        <th className="p-2 text-right">Faltas</th>
                                        <th className="p-2 text-right">Sobras</th>
                                        <th className="p-2 text-right">S/ Pedalada</th>
                                        <th className="p-2 text-right text-rose-500 underline decoration-rose-500/20 underline-offset-4">Ofn (Pedalada)</th>
                                        <th className="p-2 text-right bg-primary/5 text-primary">Balanço Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-[12px]">
                                    {filteredData.resumo_grupos.filter(g => Math.abs(g.valor_falta) > 1 || Math.abs(g.valor_sobra) > 1).length > 0 ? filteredData.resumo_grupos.filter(g => Math.abs(g.valor_falta) > 1 || Math.abs(g.valor_sobra) > 1).map((g, idx) => {
                                        const withoutMap = data.resumo_grupos_sem_pedalada.find(sem => sem.grupo === g.grupo) || { compensacao: 0 };
                                        const compSem = withoutMap.compensacao;
                                        const compCom = g.compensacao;
                                        const pedalada = compCom - compSem;
                                        const isExpanded = !!expandedGroups[g.grupo];
                                        const itemsDoGrupo = [...filteredData.faltas, ...filteredData.sobras].filter(i => i.grupo === g.grupo);

                                        return (
                                            <Fragment key={idx}>
                                                <tr onClick={() => toggleGroup(g.grupo)} className="hover:bg-surface/50 transition-colors cursor-pointer group">
                                                    <td className="p-2 text-center">
                                                        <span className={`material-symbols-outlined text-[16px] text-text-muted/50 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                                                    </td>
                                                    <td className="p-2 text-text-muted font-semibold">{g.grupo || '??'}</td>
                                                    <td className="p-2 text-text-heading uppercase truncate max-w-[300px]">{g.nome}</td>
                                                    <td className="p-2 text-right text-text-muted font-semibold tabular-nums">{formatCurrency(Math.abs(withoutMap.valor_falta || 0))}</td>
                                                    <td className="p-2 text-right text-text-muted font-semibold tabular-nums">{formatCurrency(withoutMap.valor_sobra || 0)}</td>
                                                    <td className="p-2 text-right text-text-muted font-semibold italic tabular-nums">{formatCurrency(compSem)}</td>
                                                    <td className="p-2 text-right text-rose-500 font-semibold tabular-nums">{formatCurrency(pedalada)}</td>
                                                    <td className={`p-2 text-right font-semibold text-sm bg-primary/5 ${compCom >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(compCom)}</td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-surface/20">
                                                        <td colSpan={8} className="p-4 border-l-2 border-primary">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {itemsDoGrupo.map((it, i) => (
                                                                    <div key={i} className="bg-surface p-3 rounded-sm border border-border flex justify-between items-center group/item hover:border-primary/50 transition-colors">
                                                                        <div className="overflow-hidden">
                                                                            <p className="text-[12px] font-semibold text-text-heading uppercase truncate">{it.material}</p>
                                                                            <p className="text-[10px] text-text-muted font-medium uppercase truncate max-w-[150px]">{it.descricao}</p>
                                                                            <p className="text-[9px] text-primary font-semibold uppercase mt-1">{it.deposito} • {it.regional}</p>
                                                                        </div>
                                                                        <span className={`text-[11px] font-semibold tabular-nums ${it.valor > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                            {formatCurrency(it.valor)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan={8} className="p-0">
                                                <EmptyState icon="table_rows" title="Sem registros" description="Nenhum dado disponível para este período." />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'matriz' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-8 bg-surface border border-border p-4 rounded-sm flex flex-col h-[400px] shadow-sm">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Fluxo de Exposição por Depósito</h3>
                                    <span className="px-2 py-1 bg-primary text-white text-[9px] font-semibold uppercase rounded-sm shadow-md">Balanço NET: {formatCurrency(matrizData.balanceNet)}</span>
                                </div>
                                <div className="flex-1 w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={matrizData.waterfall}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.05)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }} />
                                            <YAxis axisLine={false} tickLine={false} hide />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '2px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}
                                                formatter={(v: any) => [formatCurrencyFull(v), "Valor"]}
                                            />
                                            <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.2)" />
                                            <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={32}>
                                                {matrizData.waterfall.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="lg:col-span-4 grid grid-rows-3 gap-3">
                                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col justify-center bg-rose-500/5 shadow-sm">
                                    <p className="text-[9px] font-semibold text-rose-500 uppercase tracking-widest mb-1">Faltas Críticas</p>
                                    <h4 className="text-2xl font-semibold text-rose-500 tabular-nums">{formatCurrency(matrizData.totalFaltas)}</h4>
                                </div>
                                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col justify-center bg-emerald-500/5 shadow-sm">
                                    <p className="text-[9px] font-semibold text-emerald-500 uppercase tracking-widest mb-1">Sobras Ativas</p>
                                    <h4 className="text-2xl font-semibold text-emerald-500 tabular-nums">{formatCurrency(matrizData.totalSobras)}</h4>
                                </div>
                                <div className="bg-surface border border-border p-4 rounded-sm flex flex-col justify-center bg-primary/5 shadow-sm">
                                    <p className="text-[9px] font-semibold text-primary uppercase tracking-widest mb-1">Equilíbrio (Net)</p>
                                    <h4 className="text-2xl font-semibold text-primary tabular-nums">{formatCurrency(matrizData.balanceNet)}</h4>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface/50">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-heading">Matriz Detalhada SKU / Depósito</h3>
                                <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10">
                                    <button onClick={() => setMatrixFilter('net')} className={`text-[9px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${matrixFilter === 'net' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}>NET</button>
                                    <button onClick={() => setMatrixFilter('faltas')} className={`text-[9px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${matrixFilter === 'faltas' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-rose-500'}`}>Faltas</button>
                                    <button onClick={() => setMatrixFilter('sobras')} className={`text-[9px] uppercase font-semibold px-4 py-1.5 rounded-sm transition-all ${matrixFilter === 'sobras' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-emerald-500'}`}>Sobras</button>
                                </div>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                    <thead className="sticky top-0 z-20 bg-surface border-b border-border text-[11px] font-semibold uppercase text-text-muted tracking-widest shadow-sm">
                                        <tr>
                                            <th className="p-2 cursor-pointer hover:text-primary transition-colors border-r border-border min-w-[150px]" onClick={() => handleMatrixSort('material')}>Mat {matrixSort.key === 'material' && '↕'}</th>
                                            <th className="p-2 cursor-pointer hover:text-primary transition-colors min-w-[350px]" onClick={() => handleMatrixSort('descricao')}>Descrição {matrixSort.key === 'descricao' && '↕'}</th>
                                            {matrizData.depots.map(d => (
                                                <th key={d} className="p-2 text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleMatrixSort(d)}>{d} {matrixSort.key === d && '↕'}</th>
                                            ))}
                                            <th className="p-2 text-right bg-primary/5 text-primary cursor-pointer" onClick={() => handleMatrixSort('total')}>Bal Net {matrixSort.key === 'total' && '↕'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-[12px]">
                                        {matrizData.matList && matrizData.matList.length > 0 ? (
                                            matrizData.matList.map((m, idx) => {
                                                let rowTotalVal = Object.values(m.data).reduce((acc: number, d: any) => acc + d.val, 0);
                                                let rowTotalQty = Object.values(m.data).reduce((acc: number, d: any) => acc + d.qty, 0);
                                                return (
                                                    <tr key={idx} className="hover:bg-surface/50 transition-colors">
                                                        <td className="p-2 font-semibold text-text-heading border-r border-border tabular-nums min-w-[150px]">{m.material}</td>
                                                        <td className="p-2 text-text-muted font-semibold uppercase truncate min-w-[350px]">{m.desc}</td>
                                                        {matrizData.depots.map(d => {
                                                            const dData = m.data[d];
                                                            if (!dData || (dData.qty === 0 && dData.val === 0)) return <td key={d} className="p-2 text-right text-border">—</td>;
                                                            return (
                                                                <td key={d} className="p-2 text-right whitespace-nowrap">
                                                                    <p className={`text-[11px] font-semibold tabular-nums ${dData.val < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrency(dData.val)}</p>
                                                                    <p className="text-[8px] text-text-muted/50 font-semibold uppercase">{dData.qty.toFixed(0)} u</p>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-2 text-right bg-primary/5 tabular-nums">
                                                            <p className={`text-[11px] font-semibold ${rowTotalVal < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrency(rowTotalVal)}</p>
                                                            <p className="text-[8px] text-text-muted font-semibold uppercase">{rowTotalQty.toFixed(0)} u</p>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={99} className="p-0">
                                                    <EmptyState icon="table_rows" title="Sem registros" description="Nenhum dado disponível para este período." />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ruptura' && (
                    <div className="space-y-4">
                        <div className="bg-surface/50 p-4 border border-border rounded-sm flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-surface p-1 rounded-sm flex gap-1 border border-border/10">
                                    <button onClick={() => setRuptureGroupBy('material')} className={`text-[11px] uppercase font-semibold px-6 py-1.5 rounded-sm transition-all ${ruptureGroupBy === 'material' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}>Por Material</button>
                                    <button onClick={() => setRuptureGroupBy('data')} className={`text-[11px] uppercase font-semibold px-6 py-1.5 rounded-sm transition-all ${ruptureGroupBy === 'data' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-primary'}`}>Diagrama</button>
                                </div>
                                <div className="bg-surface border border-border rounded-sm px-2 py-1 flex items-center gap-1.5 shadow-sm">
                                    <span className="material-symbols-outlined text-[10px] text-primary">filter_list</span>
                                    <select
                                        value={rupturaRegional}
                                        onChange={(e) => setRupturaRegional(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[10px] font-semibold uppercase tracking-tighter text-text-heading cursor-pointer min-w-[100px]"
                                    >
                                        {baseOptions.map(b => (
                                            <option key={b.value} value={b.value}>{b.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-sm">
                                <span className="text-[10px] font-semibold text-text-muted uppercase">Janela:</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={ruptureDaysInput}
                                    onChange={(e) => {
                                        setRuptureDaysInput(e.target.value);
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v) && v >= 1) setRuptureDays(v);
                                    }}
                                    onBlur={(e) => {
                                        const v = parseInt(e.target.value);
                                        if (isNaN(v) || v < 1) {
                                            setRuptureDaysInput(ruptureDays.toString());
                                        }
                                    }}
                                    className="w-12 bg-transparent text-primary font-semibold text-[11px] text-center focus:outline-none"
                                />
                                <span className="text-[10px] font-semibold text-text-muted uppercase">dias</span>
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-sm overflow-hidden shadow-sm">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-rose-500/5 border-b border-border text-[11px] font-semibold uppercase text-text-muted tracking-widest">
                                        <tr>
                                            {ruptureGroupBy === 'material' ? (
                                                <>
                                                    <th className="p-2 w-12 text-center">#</th>
                                                    <th className="p-2">Material em Risco</th>
                                                    <th className="p-2 text-right">Saldo Físico</th>
                                                    <th className="p-2 text-right text-rose-500">Demanda OS</th>
                                                    <th className="p-2 text-center">Status</th>
                                                </>
                                            ) : (
                                                <><th className="p-2 w-12 text-center">#</th><th className="p-2">Agendamento Crítico / Alocação</th></>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-[12px]">
                                        {ruptureGroupBy === 'material' ? (
                                            rupturaData.byMat.length === 0 ? (
                                                <tr><td colSpan={5} className="p-0"><EmptyState icon="warning" title="Nenhum ofensor identificado" description="Sem ruptura crítica identificada no horizonte de planejamento." /></td></tr>
                                            ) : (
                                                rupturaData.byMat.map((g, idx) => {
                                                    const isExpanded = !!expandedRuptura[g.key];
                                                    return (
                                                        <Fragment key={g.key}>
                                                            <tr onClick={() => toggleRuptura(g.key)} className="hover:bg-rose-500/5 transition-colors cursor-pointer group">
                                                                <td className="p-2 text-center">
                                                                    <span className={`material-symbols-outlined text-[16px] text-text-muted/50 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                                                                </td>
                                                                <td className="p-2">
                                                                    <p className="text-text-heading font-semibold uppercase text-[13px] group-hover:text-rose-500 transition-colors">{g.material}</p>
                                                                    <p className="text-[11px] text-text-muted font-medium uppercase truncate max-w-[350px]">{g.descricao}</p>
                                                                </td>
                                                                <td className="p-2 text-right text-text-muted font-semibold tabular-nums text-[13px]">{g.saldo_fisico.toFixed(1)}</td>
                                                                <td className="p-2 text-right text-rose-500 font-semibold tabular-nums text-[13px]">{g.total_necessaria.toFixed(1)}</td>
                                                                <td className="p-2 text-center">
                                                                    <span className="px-2 py-0.5 bg-rose-500 text-white rounded-sm text-[8px] font-semibold uppercase">{g.itemsWithBalance.length} Alertas</span>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-surface/20">
                                                                    <td colSpan={5} className="p-4 border-l-2 border-rose-500">
                                                                        <div className="bg-surface border border-border rounded-sm shadow-inner overflow-hidden">
                                                                            <table className="w-full text-left text-[11px] font-semibold uppercase tracking-tight">
                                                                                <thead className="bg-surface/50 border-b border-border text-text-muted">
                                                                                    <tr>
                                                                                        <th className="p-2">Regional</th>
                                                                                        <th className="p-2">Diagrama</th>
                                                                                        <th className="p-2 text-center">Data</th>
                                                                                        <th className="p-2 text-right">Demanda</th>
                                                                                        <th className="p-2 text-right">Projetado</th>
                                                                                        <th className="p-2 text-center">Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-border">
                                                                                    {g.itemsWithBalance.map((i: any, subIdx: number) => (
                                                                                        <tr key={subIdx} className="hover:bg-primary/5 transition-colors">
                                                                                            <td className="p-2 text-text-heading uppercase">{i.regional}</td>
                                                                                            <td className="p-2 text-text-muted">{i.diagrama || 'N/A'}</td>
                                                                                            <td className="p-2 text-center text-primary font-semibold">{i.data_deslig}</td>
                                                                                            <td className="p-2 text-right text-text-muted">{i.qtd_necessaria.toFixed(1)}</td>
                                                                                            <td className="p-2 text-right text-rose-500 font-semibold">{i.currentBalance.toFixed(1)}</td>
                                                                                            <td className="p-2 text-center">
                                                                                                <span className={`px-1.5 py-0.5 rounded-sm border ${i.classif.includes('REPOSIÇÃO') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{i.classif}</span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    )
                                                })
                                            )
                                        ) : (
                                            rupturaData.byDate.length === 0 ? (
                                                <tr><td colSpan={2} className="p-0"><EmptyState icon="warning" title="Nenhum ofensor identificado" description="Sem eventos críticos previstos no horizonte selecionado." /></td></tr>
                                            ) : (
                                                rupturaData.byDate.map((g, idx) => {
                                                    const isExpanded = !!expandedRuptura[g.key];
                                                    return (
                                                        <Fragment key={g.key}>
                                                            <tr onClick={() => toggleRuptura(g.key)} className="hover:bg-surface/50 transition-colors cursor-pointer group">
                                                                <td className="p-4 text-center">
                                                                    <span className={`material-symbols-outlined text-[16px] text-text-muted/50 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>calendar_today</span>
                                                                </td>
                                                                <td className="p-4 flex items-center gap-4">
                                                                    <span className="text-[14px] font-semibold text-primary tabular-nums tracking-tighter">{g.date}</span>
                                                                    <span className="text-[9px] text-text-muted font-semibold uppercase">{g.items.length} SKUs em Ruptura Crítica</span>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && g.items.map((i: any, subIdx: number) => (
                                                                <tr key={subIdx} className="bg-rose-500/[0.02]">
                                                                    <td></td>
                                                                    <td className="p-3">
                                                                        <div className="bg-surface border border-border p-3 rounded-sm flex justify-between items-center border-l-2 border-l-rose-500">
                                                                            <div>
                                                                                <p className="text-[10px] font-semibold text-text-heading uppercase">{i.material} • <span className="text-primary">{i.regional}</span></p>
                                                                                <p className="text-[9px] text-text-muted font-medium uppercase truncate max-w-[200px]">{i.descricao}</p>
                                                                                <p className="text-[8px] text-text-muted/50 font-semibold uppercase mt-1">Diagrama: {i.diagrama || 'N/A'}</p>
                                                                            </div>
                                                                            <div className="flex gap-8 text-right">
                                                                                <div>
                                                                                    <p className="text-[8px] font-semibold text-text-muted uppercase mb-1">Impacto OS</p>
                                                                                    <p className="text-[14px] font-semibold text-text-heading tabular-nums">{i.qtd_necessaria.toFixed(1)} <span className="text-[8px] opacity-40">un</span></p>
                                                                                </div>
                                                                                <div className="bg-rose-500/5 p-2 rounded-sm border border-rose-500/10 min-w-[120px]">
                                                                                    <p className="text-[8px] font-semibold text-rose-500 uppercase mb-1">Déficit Projetado</p>
                                                                                    <p className="text-[14px] font-semibold text-rose-500 tabular-nums animate-pulse">
                                                                                        <span className="text-[9px] opacity-40 mr-1 italic">{i.balanceBefore.toFixed(1)} →</span>
                                                                                        {i.projectedBalance.toFixed(1)}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </Fragment>
                                                    )
                                                })
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}

        </div>
    );
}


