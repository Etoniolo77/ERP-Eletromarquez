from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timedelta
import pandas as pd
import math

from database import get_db
from adapters.turmas_rdo_adapter import TurmasRDOAdapter
from cache import api_cache

router = APIRouter(prefix="/api/v1/turmas_rdo", tags=["Turmas RDO"])

@router.get("/dashboard")
def get_turmas_rdo_dashboard(
    periodo: str = "month",
    regional: Optional[str] = "all",
    refresh: bool = False
):
    """
    Retorna os KPIs consolidados, matriz de Indicadores x Equipes, 
    controle de presenças, histórico e rankings.
    """
    cache_key = f"turmas_rdo_dashboard_{periodo}_{regional}"
    if not refresh:
        cached = api_cache.get(cache_key)
        if cached: return cached
    
    try:
        adapter = TurmasRDOAdapter()
        
        # Obter tempo de atualização real baseado nos arquivos
        max_mtime = 0
        from datetime import datetime
        import os
        for path in adapter.REGIONAIS.values():
            if os.path.exists(path):
                max_mtime = max(max_mtime, os.path.getmtime(path))
        
        upd_time = datetime.fromtimestamp(max_mtime).strftime("%d/%m/%Y %H:%M") if max_mtime > 0 else "N/A"
        
        data_dicts = adapter.load_data()
        df_ind = data_dicts["indicadores"]
        df_pres = data_dicts["presenca"]

        # Remover Equipe "0" que pode vir de colunas vazias no Excel
        if not df_ind.empty:
            df_ind = df_ind[~df_ind["Equipe"].isin(["0", 0, "0.0", 0.0])]
        
        # Limpezas e padronizações na Presença
        if not df_pres.empty:
            # Unificar funções de Supervisor
            if "Funcao" in df_pres.columns:
                mask_sup = df_pres["Funcao"].str.contains("SUPERVISOR", case=False, na=False)
                df_pres.loc[mask_sup, "Funcao"] = "SUPERVISOR"

        if df_ind.empty and df_pres.empty:
            return {
                "period_label": "Sem Dados",
                "source_file": "Arquivos RDO Regionais",
                "last_update": upd_time,
                "stats": {
                    "kpi1": {"label": "Nota Geral Geral", "value": "0.00", "legend": "Baseado nos Indicadores"},
                    "kpi2": {"label": "Presença Geral", "value": "0%", "legend": "Total Mês/Semana"},
                    "kpi3": {"label": "Total Equipes", "value": "0", "legend": "Avaliadas"},
                    "kpi4": {"label": "Alertas Operacionais", "value": "0", "legend": "Pontos de atenção"}
                },
                "matriz": [],
                "indicadores_labels": [],
                "history": [],
                "top_melhores": [],
                "top_piores": [],
                "presenca_history": [],
                "insights": []
            }

        # Filtro de Regional
        if regional and regional != "all":
            df_ind = df_ind[df_ind["Regional"] == regional]
            df_pres = df_pres[df_pres["Regional"] == regional]

        # Achar a Data Máxima de todo DataFrame para delimitar Month/Week
        max_date = pd.Timestamp.today().normalize()
        if not df_ind.empty:
            max_date = df_ind["Data"].max()

        # Filtro de Data
        min_date = max_date
        if periodo == "latest":
            min_date = max_date - pd.Timedelta(days=3)
            mask_ind = (df_ind["Data"] >= min_date) & (df_ind["Data"] <= max_date)
            mask_pres = (df_pres["Data"] >= min_date) & (df_pres["Data"] <= max_date)
        elif periodo == "week":
            min_date = max_date - pd.Timedelta(days=7)
            mask_ind = (df_ind["Data"] >= min_date) & (df_ind["Data"] <= max_date)
            mask_pres = (df_pres["Data"] >= min_date) & (df_pres["Data"] <= max_date)
        elif periodo == "month":
            min_date = max_date.replace(day=1)
            mask_ind = (df_ind["Data"] >= min_date) & (df_ind["Data"] <= max_date)
            mask_pres = (df_pres["Data"] >= min_date) & (df_pres["Data"] <= max_date)
        else: # year or all
             min_date = max_date.replace(month=1, day=1)
             mask_ind = (df_ind["Data"] >= min_date) & (df_ind["Data"] <= max_date)
             mask_pres = (df_pres["Data"] >= min_date) & (df_pres["Data"] <= max_date)

        df_ind_filtered = df_ind[mask_ind] if not df_ind.empty else df_ind
        df_pres_filtered = df_pres[mask_pres] if not df_pres.empty else df_pres

        # ==========================================
        # 1. KPIs - Cálculos de Período Atual vs Anterior
        # ==========================================
        
        # 1.1 Dados Atuais
        df_ind_curr = df_ind_filtered
        df_pres_curr = df_pres_filtered

        # 1.2 Calcular Datas do Período Anterior
        days_in_period = (max_date - min_date).days + 1
        prev_max_date = min_date - pd.Timedelta(days=1)
        prev_min_date = prev_max_date - pd.Timedelta(days=days_in_period-1)

        mask_ind_prev = (df_ind["Data"] >= prev_min_date) & (df_ind["Data"] <= prev_max_date)
        mask_pres_prev = (df_pres["Data"] >= prev_min_date) & (df_pres["Data"] <= prev_max_date)
        
        df_ind_prev = df_ind[mask_ind_prev] if not df_ind.empty else df_ind
        df_pres_prev = df_pres[mask_pres_prev] if not df_pres.empty else df_pres

        # Funções auxiliares de cálculo
        def calc_metrics(df_i, df_p):
            m_geral = df_i["Nota"].mean() * 100 if not df_i.empty and not df_i["Nota"].isna().all() else 0.0
            m_pres = df_p["Presenca"].mean() * 100 if not df_p.empty and not df_p["Presenca"].isna().all() else 0.0
            t_equipes = df_i["Equipe"].nunique() if not df_i.empty else 0
            
            eq_meta = 0
            ad_pct = 0.0
            if t_equipes > 0:
                df_m = df_i.groupby("Equipe")["Nota"].mean()
                eq_meta = len(df_m[df_m >= 0.9])
                ad_pct = (eq_meta / t_equipes) * 100
            
            f_totais = len(df_p[df_p["Presenca"] == 0]) if not df_p.empty else 0
            return m_geral, m_pres, t_equipes, eq_meta, ad_pct, f_totais

        # Métricas Atuais
        media_geral, media_presenca, total_equipes, equipes_meta, aderencia_pct, faltas_totais = calc_metrics(df_ind_curr, df_pres_curr)
        
        # Métricas Anteriores para Tendência
        m_geral_prev, m_pres_prev, t_eq_prev, eq_meta_prev, ad_pct_prev, f_tot_prev = calc_metrics(df_ind_prev, df_pres_prev)

        # Geração de Alertas (Insights)
        insights = []
        if media_geral < 95:
            insights.append({"type": "danger", "text": f"Qualidade técnica global abaixo da meta (95%): atual {media_geral:.1f}%"})
        if media_presenca < 95:
            insights.append({"type": "warning", "text": f"Presença global crítica identificada: {media_presenca:.1f}%"})
        
        if not df_ind_curr.empty:
            low_perf_teams = df_ind_curr.groupby("Equipe")["Nota"].mean()
            critical_teams = low_perf_teams[low_perf_teams < 0.8]
            if not critical_teams.empty:
                insights.append({"type": "danger", "text": f"{len(critical_teams)} equipes com performance abaixo de 80%"})

        if aderencia_pct < 80:
            insights.append({"type": "info", "text": f"Baixa aderência à meta: apenas {equipes_meta} equipes conformes"})

        def get_trend(curr, prev):
            if prev == 0: return 0.0
            return ((curr - prev) / prev) * 100

        stats = {
            "kpi1": {
                "label": "Qualidade Técnica", 
                "value": f"{media_geral:.1f}%", 
                "legend": "Conformidade dos Processos", 
                "trend": get_trend(media_geral, m_geral_prev),
                "trend_label": "vs período anterior",
                "border": "var(--primary)"
            },
            "kpi2": {
                "label": "Presença Global", 
                "value": f"{media_presenca:.1f}%", 
                "legend": "Assiduidade das Equipes", 
                "trend": get_trend(media_presenca, m_pres_prev),
                "trend_label": "vs período anterior",
                "border": "var(--success)"
            },
            "kpi3": {
                "label": "Aderência à Meta", 
                "value": f"{aderencia_pct:.1f}%", 
                "legend": f"{equipes_meta} de {total_equipes} equipes conformes", 
                "trend": get_trend(aderencia_pct, ad_pct_prev),
                "trend_label": "vs período anterior",
                "border": "var(--secondary)"
            },
            "kpi4": {
                "label": "Alertas Operacionais", 
                "value": str(len(insights)), 
                "legend": "Pontos de atenção identificados", 
                "trend": float(len(insights)), 
                "trend_label": "alertas ativos",
                "border": "var(--danger)"
            }
        }

        # Redefinir variáveis para uso posterior no script (matriz, ranks, etc)
        df_ind_filtered = df_ind_curr
        df_pres_filtered = df_pres_curr

        # ==========================================
        # 2. Matriz: Indicadores x Equipes
        # ==========================================
        matriz = []
        indicadores_labels = []
        if not df_ind_filtered.empty:
            # Agrupar media de nota por (Indicador, Equipe)
            pivot_ind = df_ind_filtered.groupby(["Indicador", "Equipe"])["Nota"].mean().unstack(fill_value=0)
            indicadores_labels = pivot_ind.columns.tolist() # As Equipes

            for ind in pivot_ind.index:
                row_dict = {"indicador": str(ind)}
                soma_linha = 0
                for eq in pivot_ind.columns:
                    val = pivot_ind.loc[ind, eq]
                    row_dict[eq] = round(val * 100, 1) # percentual da nota 0 a 1
                    soma_linha += val
                
                # Média Geral do Indicador
                row_dict["media_ind"] = round((soma_linha / len(pivot_ind.columns)) * 100, 1) if len(pivot_ind.columns) > 0 else 0
                matriz.append(row_dict)

            # Adicionar Linha de Média Final das Equipes (Rodapé)
            footer_avg = {"indicador": "MÉDIA FINAL DAS EQUIPES", "is_footer": True}
            soma_total_regionais = 0
            for eq in pivot_ind.columns:
                val_eq = pivot_ind[eq].mean()
                footer_avg[eq] = round(val_eq * 100, 1)
                soma_total_regionais += val_eq
            
            footer_avg["media_ind"] = round((soma_total_regionais / len(pivot_ind.columns)) * 100, 1) if len(pivot_ind.columns) > 0 else 0
            matriz.append(footer_avg)

        # ==========================================
        # 3. TOP / BOTTOM Equipes e Indicadores
        # ==========================================
        top_melhores = []
        top_piores = []
        top_piores_indicadores = []
        if not df_ind_filtered.empty:
            # Equipes
            equipes_nota = df_ind_filtered.groupby("Equipe")["Nota"].mean().reset_index()
            equipes_nota["Nota"] = equipes_nota["Nota"] * 100
            
            melhores = equipes_nota.sort_values(by="Nota", ascending=False).head(5)
            piores = equipes_nota.sort_values(by="Nota", ascending=True).head(5)

            top_melhores = [{"Equipe": str(r["Equipe"]), "Nota": round(r["Nota"], 1)} for _, r in melhores.iterrows()]
            top_piores = [{"Equipe": str(r["Equipe"]), "Nota": round(r["Nota"], 1)} for _, r in piores.iterrows()]

            # Piores Indicadores (Ofensores)
            inds_nota = df_ind_filtered.groupby("Indicador")["Nota"].mean().reset_index()
            inds_nota["Nota"] = inds_nota["Nota"] * 100
            ofensores = inds_nota.sort_values(by="Nota", ascending=True).head(5)
            top_piores_indicadores = [{"Indicador": str(r["Indicador"]), "Nota": round(r["Nota"], 1)} for _, r in ofensores.iterrows()]

        # ==========================================
        # 4. Histórico Evolutivo - Indicadores (Regional)
        # ==========================================
        history = []
        if not df_ind.empty:
            group_col = "AnoSemana" if periodo == "week" else "AnoMes"
            evo_df = df_ind.groupby([group_col, "Regional"])["Nota"].mean().unstack(fill_value=0).reset_index()
            evo_df = evo_df.sort_values(by=group_col).tail(6)
            for _, r in evo_df.iterrows():
                row_data = {"Periodo": str(r[group_col])}
                for reg in self_get_active_regionals(df_ind):
                    row_data[reg] = round(float(r.get(reg, 0)) * 100, 1)
                history.append(row_data)

        # ==========================================
        # 5. Evolução de Presença - Por Função
        # ==========================================
        presenca_history = []
        if not df_pres_filtered.empty:
             pres_ev_df = df_pres_filtered.groupby("Funcao")["Presenca"].mean().reset_index()
             pres_ev_df["Presenca"] = pres_ev_df["Presenca"] * 100
             pres_ev_df = pres_ev_df.sort_values(by="Presenca", ascending=False)
             for _, r in pres_ev_df.iterrows():
                 presenca_history.append({"Funcao": str(r["Funcao"]), "PresencaPct": round(r["Presenca"], 1)})

        # ==========================================
        # 6. Matriz de Presença: Função x Regional
        # ==========================================
        matriz_presenca = []
        regionais_presenca_labels = []
        if not df_pres_filtered.empty:
            import unicodedata
            def normalize(s):
                if not s: return ""
                return "".join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper()

            def map_func(f):
                f_norm = normalize(f)
                if "ALMOXARIFE" in f_norm or "ALMOXARIFADO" in f_norm: return "Almoxarife"
                if "FROTA" in f_norm: return "Controlador de Frota"
                if "GERENTE" in f_norm: return "Gerente de Base"
                if "SEGURANCA" in f_norm or "SESMT" in f_norm: return "Técnico de Segurança"
                if "SUPERVISOR" in f_norm: return "Supervisor"
                if "ADMINISTRA" in f_norm or "ADM" in f_norm: return "Administrativo"
                return None
            
            # Lista de todas as regionais que devem aparecer como COULNAS
            active_regionals = sorted(df_pres["Regional"].unique().tolist())
            # Lista de todas as funções que devem aparecer como LINHAS
            target_rows = ["Gerente de Base", "Supervisor", "Administrativo", "Técnico de Segurança", "Controlador de Frota", "Almoxarife"]

            df_pres_mapped = df_pres_filtered.copy()
            df_pres_mapped["Funcao_Mapped"] = df_pres_mapped["Funcao"].apply(map_func)
            df_pres_final = df_pres_mapped[df_pres_mapped["Funcao_Mapped"].notna()]

            if not df_pres_final.empty:
                # Média real por (Função, Regional). Usamos dropna=False para preservar a estrutura se necessário
                pivot_pres = df_pres_final.groupby(["Funcao_Mapped", "Regional"])["Presenca"].mean().unstack()
                # Reindex para garantir que TODAS as funções alvo e TODAS as regionais apareçam, mas mantendo NaNs onde não há dados
                pivot_pres = pivot_pres.reindex(index=target_rows, columns=active_regionals)
                regionais_presenca_labels = pivot_pres.columns.tolist()
                
                for f_name in pivot_pres.index:
                    row_dict = {"funcao": str(f_name)}
                    # A média deve ser calculada apenas sobre valores não nulos para ser "fiel" ao dado existente
                    media_val = pivot_pres.loc[f_name].mean()
                    row_dict["media_func"] = round(media_val * 100, 1) if pd.notna(media_val) else 0
                    
                    for reg in pivot_pres.columns:
                        val = pivot_pres.loc[f_name, reg]
                        if pd.notna(val):
                            row_dict[reg] = round(val * 100, 1)
                        else:
                            row_dict[reg] = 0.0 # Ou "-" se preferred, mas o frontend espera numero
                    
                    matriz_presenca.append(row_dict)

        period_str = max_date.strftime('%d/%m/%Y') if isinstance(max_date, pd.Timestamp) else str(max_date)
        
        result = {
            "period_label": period_str,
            "source_file": "Arquivos RDO Regionais",
            "last_update": upd_time,
            "stats": stats,
            "matriz": matriz,
            "indicadores_labels": indicadores_labels,
            "matriz_presenca": matriz_presenca,
            "regionais_presenca_labels": regionais_presenca_labels,
            "top_melhores": top_melhores,
            "top_piores": top_piores,
            "top_piores_indicadores": top_piores_indicadores,
            "history": history,
            "presenca_history": presenca_history,
            "insights": insights
        }
        api_cache.set(cache_key, result)
        return result
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def self_get_active_regionals(df):
    if "Regional" in df.columns:
        return df["Regional"].unique().tolist()
    return []
