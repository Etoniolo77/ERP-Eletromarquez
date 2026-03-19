from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict, Any
from pydantic import BaseModel
import datetime

import models
from database import engine, get_db
from cache import api_cache

# Criação das tabelas
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portal de Indicadores 3.1 - API")

# Habilitar CORS para o Frontend (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Na prod alterar para o IP da Intranet
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======= Pydantic Schemas (Serialização de Respostas) =======
class ProdutividadeResponse(BaseModel):
    id: int
    data: datetime.date
    equipe: str
    tipo_equipe: str
    setor: str
    csd: str
    ocupacao: float
    produtividade_pct: float
    eficiencia_pct: float
    eficacia_pct: float
    notas_executadas: float
    ociosidade_min: float
    deslocamento_min: float
    hhr_min: float
    hhp_min: float

    class Config:
        from_attributes = True

class SyncLogResponse(BaseModel):
    source_file: str
    last_sync: datetime.datetime
    status: str
    records_processed: int
    
    class Config:
        from_attributes = True

# ======= ROTAS DE API =======
import routers.turmas_rdo as turmas_rdo_router
app.include_router(turmas_rdo_router.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo a API do Portal 3.1", "status": "running"}

@app.get("/api/v1/produtividade/dashboard")
def get_produtividade_dashboard(periodo: str = "month", view: str = "csd", sector: str = None, csd: str = None, equipe: str = None, metric: str = "ocupacao", db: Session = Depends(get_db)):
    """ Endpoint Mestre para renderizar a exata UI do Legacy Produtividade """
    cache_key = f"produtividade_dashboard_{periodo}_{view}_{sector}_{csd}_{equipe}_{metric}"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        # Mapeamento de Regionais CCM
        REGIONAL_MAP = {
            "Itarana": ["ITARANA", "ARACRUZ", "ARA"],
            "Nova Venécia": ["NOVA VENÉCIA", "BARRA DE SÃO FRANCISCO", "BSF", "NVE"],
            "Venda Nova": ["VENDA NOVA", "MARECHAL", "IUNA", "VNI", "VNO", "MCH"]
        }
        
        def get_regional(base_name):
            if not base_name: return "Outras"
            bn = base_name.upper()
            for reg, bases in REGIONAL_MAP.items():
                if any(b in bn for b in bases):
                    return reg
            return base_name

        def get_csd_turmas(base_name):
            if not base_name: return None
            bn = base_name.upper()
            if "GUARAPARI" in bn: return "DESG"
            if "ITARANA" in bn or "ARACRUZ" in bn: return "DESI"
            if "VENÉCIA" in bn or "VENECIA" in bn or "NVE" in bn or "BARRA" in bn or "BSF" in bn: return "DESN"
            if "CACHOEIRO" in bn: return "DESC"
            if "VITORIA" in bn or "VITÓRIA" in bn: return "DEST"
            if "LINHARES" in bn: return "DESU"
            return None  # bases não mapeadas são excluídas do gráfico

        # Normalização do período
        if periodo == "latest": periodo = "month"

        # Pega a data máxima existente no banco 
        max_date_str = db.query(func.max(models.Produtividade.data)).scalar()
        
        query = db.query(models.Produtividade)
        if sector:
            query = query.filter(models.Produtividade.setor.ilike(f"%{sector}%"))
        if csd:
            query = query.filter(models.Produtividade.csd == csd)
        if equipe:
            query = query.filter(models.Produtividade.equipe == equipe)
        
        max_date = None
        min_date = None

        if max_date_str:
            if isinstance(max_date_str, str):
                max_date = datetime.datetime.strptime(max_date_str, "%Y-%m-%d").date()
            else:
                max_date = max_date_str # Se SQLAlchemy já devolveu tipo Date
                
            if periodo == "day":
                query = query.filter(models.Produtividade.data == max_date)
                min_date = max_date # Para evitar erros em rotas que dependem de min_date
            elif periodo == "week":
                min_date = max_date - datetime.timedelta(days=7)
                query = query.filter(models.Produtividade.data >= min_date, models.Produtividade.data <= max_date)
            elif periodo == "month":
                # Do dia 1º ao max_date
                min_date = max_date.replace(day=1)
                query = query.filter(models.Produtividade.data >= min_date, models.Produtividade.data <= max_date)
            elif periodo == "last_month":
                # Mês fechado anterior
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.Produtividade.data >= min_date, models.Produtividade.data <= max_date_ref)
            else:
                # Fallback caso venha algo não mapeado
                min_date = max_date
        
        
        # 1. KPIs Atuais
        kpis = query.with_entities(
            func.avg(models.Produtividade.produtividade_pct).label('media_prod'),
            func.sum(models.Produtividade.ociosidade_min).label('total_ociosidade'),
            func.avg(models.Produtividade.ociosidade_min).label('media_ociosidade'),
            func.avg(models.Produtividade.saida_base_min).label('media_saida_base'),
            func.avg(models.Produtividade.retorno_base_min).label('media_retorno_base'),
            func.sum(models.Produtividade.hora_extra_min).label('total_hora_extra'),
            func.sum(models.Produtividade.desvios_min).label('total_desvios'),
            func.count(func.distinct(models.Produtividade.equipe)).label('total_equipes'),
            func.avg(models.Produtividade.eficacia_pct).label('media_eficacia'),
            func.sum(models.Produtividade.notas_executadas).label('total_notas')
        ).first()

        # KPIs do Período Anterior (Para Trend)
        query_prev = db.query(models.Produtividade)
        if sector:
            query_prev = query_prev.filter(models.Produtividade.setor.ilike(f"%{sector}%"))
            
        if max_date:
            if periodo == "day":
                prev_date = max_date - datetime.timedelta(days=1)
                query_prev = query_prev.filter(models.Produtividade.data == prev_date)
            elif periodo == "week":
                prev_min = (min_date or max_date) - datetime.timedelta(days=7)
                prev_max = max_date - datetime.timedelta(days=7)
                query_prev = query_prev.filter(models.Produtividade.data >= prev_min, models.Produtividade.data <= prev_max)
            elif periodo == "month":
                prev_max = (min_date or max_date) - datetime.timedelta(days=1)
                prev_min = prev_max.replace(day=1)
                query_prev = query_prev.filter(models.Produtividade.data >= prev_min, models.Produtividade.data <= prev_max)
            elif periodo == "last_month":
                prev_max = (min_date or max_date) - datetime.timedelta(days=1)
                prev_min = prev_max.replace(day=1)
                query_prev = query_prev.filter(models.Produtividade.data >= prev_min, models.Produtividade.data <= prev_max)
        
        kpis_prev = query_prev.with_entities(
            func.avg(models.Produtividade.produtividade_pct).label('media_prod'),
            func.avg(models.Produtividade.ociosidade_min).label('media_ociosidade'),
            func.avg(models.Produtividade.saida_base_min).label('media_saida_base'),
            func.avg(models.Produtividade.retorno_base_min).label('media_retorno_base')
        ).first()
        
        curr_prod = float(kpis.media_prod if kpis and kpis.media_prod is not None else 0)
        prev_prod = float(kpis_prev.media_prod if kpis_prev and kpis_prev.media_prod is not None else 0)
        trend_prod = round(curr_prod - prev_prod, 1) if prev_prod else 0.0

        is_ccm = sector and "CCM" in sector.upper()
        
        if is_ccm:
            curr_ociosidade = float(kpis.media_ociosidade if kpis and kpis.media_ociosidade is not None else 0)
            prev_ociosidade = float(kpis_prev.media_ociosidade if kpis_prev and kpis_prev.media_ociosidade is not None else 0)
            trend_ociosidade = round(curr_ociosidade - prev_ociosidade, 1) if prev_ociosidade else 0.0
            
            curr_saida = float(kpis.media_saida_base if kpis and kpis.media_saida_base is not None else 0)
            prev_saida = float(kpis_prev.media_saida_base if kpis_prev and kpis_prev.media_saida_base is not None else 0)
            trend_saida = round(curr_saida - prev_saida, 1) if prev_saida else 0.0
            
            curr_retorno = float(kpis.media_retorno_base if kpis and kpis.media_retorno_base is not None else 0)
            prev_retorno = float(kpis_prev.media_retorno_base if kpis_prev and kpis_prev.media_retorno_base is not None else 0)
            trend_retorno = round(curr_retorno - prev_retorno, 1) if prev_retorno else 0.0
        else:
            trend_ociosidade = 0.0
            trend_saida = 0.0
            trend_retorno = 0.0
            curr_ociosidade = 0.0
            curr_saida = 0.0
            curr_retorno = 0.0

        # Notas Rejeitadas no mesmo período
        rej_query = db.query(models.Rejeicao)
        if max_date:
            if periodo == "day": rej_query = rej_query.filter(models.Rejeicao.data_conclusao == max_date)
            else: rej_query = rej_query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date)
        
        total_rejeicoes = rej_query.with_entities(func.sum(models.Rejeicao.num_rejeicoes)).scalar() or 0
        
        # Motivos de Rejeição (Desvios mais ocorridos)
        motivos_rej = rej_query.with_entities(
            models.Rejeicao.motivo,
            func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
        ).filter(models.Rejeicao.motivo != None).group_by(models.Rejeicao.motivo).order_by(func.sum(models.Rejeicao.num_rejeicoes).desc()).limit(3).all()

        top_desvios = [{"motivo": m.motivo, "qtd": int(m.qtd)} for m in motivos_rej]

        # 2. Dados para Gráficos com Métrica Dinâmica
        col_metric = models.Produtividade.produtividade_pct
        if metric == "ociosidade": col_metric = models.Produtividade.ociosidade_min
        elif metric == "saida": col_metric = models.Produtividade.saida_base_min

        if view == "equipe":
            chart_group = query.with_entities(
                models.Produtividade.equipe,
                func.avg(col_metric).label('val')
            ).group_by(models.Produtividade.equipe).order_by(func.avg(col_metric).desc() if metric == "ocupacao" else func.avg(col_metric).asc()).all()
            
            chart_labels = [c.equipe for c in chart_group if c.equipe]
            chart_data = [round(float(c.val or 0), 1 if metric == "ocupacao" else 0) for c in chart_group if c.equipe]
        else:
            # Agregando por Regional para CCM, ou por CSD original para outros
            all_data = query.with_entities(models.Produtividade.csd, col_metric).all()
            reg_agg = {}
            for row in all_data:
                label = get_regional(row.csd) if is_ccm else get_csd_turmas(row.csd)
                if label is None: continue
                if label not in reg_agg: reg_agg[label] = []
                reg_agg[label].append(float(row[1] or 0))
            
            chart_labels = []
            chart_data = []
            for label, vals in reg_agg.items():
                chart_labels.append(label)
                chart_data.append(round(sum(vals)/len(vals), 1 if metric == "ocupacao" else 0))
            
            # Sort regional by metric
            sorted_chart = sorted(zip(chart_labels, chart_data), key=lambda x: x[1], reverse=(metric == "ocupacao"))
            chart_labels = [x[0] for x in sorted_chart]
            chart_data = [x[1] for x in sorted_chart]

        # 3. Definição de Metas e Escopo Global
        num_dias = db.query(func.count(func.distinct(models.Produtividade.data))).filter(
            models.Produtividade.setor.ilike(f"%{sector}%") if sector else True,
            models.Produtividade.data >= min_date if min_date else True,
            models.Produtividade.data <= max_date if max_date else True
        ).scalar() or 1
        res_meta = 95 if is_ccm else 85

        # 3. Top Melhores e Piores
        equipes_group = query.with_entities(
            models.Produtividade.equipe,
            models.Produtividade.csd,
            func.avg(models.Produtividade.produtividade_pct).label('media_prod'),
            func.sum(models.Produtividade.ociosidade_min).label('ociosidade'),
            func.avg(models.Produtividade.saida_base_min).label('saida_base'),
            func.avg(models.Produtividade.retorno_base_min).label('retorno_base'),
            func.sum(models.Produtividade.notas_executadas).label('notas'),
            func.sum(models.Produtividade.notas_rejeitadas).label('rejeitadas'),
            func.sum(models.Produtividade.notas_interrompidas).label('interrompidas')
        ).group_by(models.Produtividade.equipe, models.Produtividade.csd).all()

        equipes_sorted = sorted(equipes_group, key=lambda x: (x.ociosidade or 0) if is_ccm else (x.media_prod or 0))
        
        top_piores = [
            {
                "equipe": e.equipe, 
                "csd": e.csd, 
                "produtividade": round(float(e.media_prod or 0), 1), 
                "ociosidade": int(e.ociosidade or 0),
                "saida_base": round(float(e.saida_base or 0), 1),
                "retorno_base": round(float(e.retorno_base or 0), 1),
                "notas": int(e.notas or 0),
                "rejeitadas": int(e.rejeitadas or 0),
                "interrompidas": int(e.interrompidas or 0)
            }
            for e in (equipes_sorted[-5:] if is_ccm else equipes_sorted[:5])
        ]
        
        top_melhores = [
            {
                "equipe": e.equipe, 
                "csd": e.csd, 
                "produtividade": round(float(e.media_prod or 0), 1), 
                "notas": int(e.notas or 0),
                "saida_base": round(float(e.saida_base or 0), 1),
                "retorno_base": round(float(e.retorno_base or 0), 1),
                "rejeitadas": int(e.rejeitadas or 0),
                "interrompidas": int(e.interrompidas or 0),
                "ociosidade": int(e.ociosidade or 0)
            }
            for e in (equipes_sorted[:5] if is_ccm else reversed(equipes_sorted[-5:]))
        ]

        # 4. Breakdown por Regional (CCM) ou CSD (Turmas)
        breakdown_dict = {}
        for e in equipes_sorted:
            label = get_regional(e.csd) if is_ccm else get_csd_turmas(e.csd)
            if label is None: continue

            if label not in breakdown_dict:
                breakdown_dict[label] = {"name": label, "equipes": [], "acima_meta": 0, "sum_prod": 0, "sum_ociosidade": 0, "sum_saida": 0}
            
            prod = round(float(e.media_prod or 0), 1)
            ociosidade_med = int((e.ociosidade or 0) / num_dias)
            saida_med = round(float(e.saida_base or 0), 1)
            breakdown_dict[label]["equipes"].append({
                "equipe": e.equipe, 
                "base": e.csd,
                "prod": prod,
                "ociosidade": ociosidade_med,
                "saida": saida_med
            })
            breakdown_dict[label]["sum_prod"] += prod
            breakdown_dict[label]["sum_ociosidade"] += (e.ociosidade or 0)
            breakdown_dict[label]["sum_saida"] += saida_med

            # Lógica de aderência (acima_meta) dinâmica baseada na métrica
            if metric == "ocupacao" and prod >= res_meta:
                 breakdown_dict[label]["acima_meta"] += 1
            elif metric == "ociosidade" and ociosidade_med <= 30: # Meta 30min ociosidade
                 breakdown_dict[label]["acima_meta"] += 1
            elif metric == "saida" and saida_med <= 30: # Meta 30min saída
                 breakdown_dict[label]["acima_meta"] += 1
            elif not is_ccm and prod >= res_meta:
                 breakdown_dict[label]["acima_meta"] += 1

        breakdown_csd = []
        for label, data in breakdown_dict.items():
            num_equipes = len(data["equipes"])
            data["num_equipes"] = num_equipes
            data["produtividade"] = round(data["sum_prod"] / num_equipes, 1) if num_equipes > 0 else 0
            data["ociosidade"] = int(data["sum_ociosidade"] / (num_equipes * num_dias)) if num_equipes > 0 else 0
            data["saida"] = round(data["sum_saida"] / num_equipes, 1) if num_equipes > 0 else 0

            # Sort equipes by current metric (Ascending)
            if metric == "ociosidade": data["equipes"] = sorted(data["equipes"], key=lambda x: x["ociosidade"])
            elif metric == "saida": data["equipes"] = sorted(data["equipes"], key=lambda x: x["saida"])
            else: data["equipes"] = sorted(data["equipes"], key=lambda x: x["prod"])
            
            breakdown_csd.append(data)

        # 5. Evolução
        hist_evo = db.query(
            models.Produtividade.data,
            func.avg(models.Produtividade.produtividade_pct).label('prod_val')
        )
        if sector:
            hist_evo = hist_evo.filter(models.Produtividade.setor.ilike(f"%{sector}%"))
            
        hist_evo = hist_evo.filter(models.Produtividade.data >= (max_date - datetime.timedelta(days=30)) if max_date else True)
        hist_evo = hist_evo.group_by(models.Produtividade.data).order_by(models.Produtividade.data.asc()).all()
        
        evolucao = []
        for d in hist_evo:
            evt_date = d.data.strftime("%d/%m") if hasattr(d.data, "strftime") else str(d.data)[8:10] + '/' + str(d.data)[5:7]
            evolucao.append({
                "name": evt_date,
                "value": round(float(d.prod_val or 0), 1)
            })

        # 6. Geração de Insights Dinâmicos
        meta_ccm = 95
        insights = []
        if is_ccm:
            if curr_prod < meta_ccm:
                insights.append({"type": "danger", "text": f"Ocupação geral ({curr_prod}%) abaixo da meta de {meta_ccm}%. Foco em reduzir ociosidade."})
            elif curr_prod >= meta_ccm:
                insights.append({"type": "success", "text": f"Parabéns! Meta de Ocupação de {meta_ccm}% atingida."})

            if curr_saida > 45:
                insights.append({"type": "danger", "text": f"O tempo de Saída de Base ({curr_saida}min) está impactando a ocupação."})
            
            if trend_ociosidade > 10:
                insights.append({"type": "danger", "text": f"Alerta: Aumento de {trend_ociosidade}min na ociosidade média vs anterior."})
        else:
            if curr_prod < 85:
                insights.append({"type": "danger", "text": f"Produtividade geral ({curr_prod}%) está abaixo da meta de 85%."})
            elif curr_prod > 90:
                insights.append({"type": "success", "text": "Excelente! Produtividade geral acima de 90% neste período."})

            if trend_prod < -5:
                insights.append({"type": "danger", "text": f"Queda de {abs(trend_prod)}pp na produtividade vs período anterior."})
            elif trend_prod > 5:
                insights.append({"type": "success", "text": f"Evolução positiva: Ganho de {trend_prod}pp na produtividade média."})

        if total_rejeicoes > 20:
             insights.append({"type": "danger", "text": f"Volume de rejeições elevado ({total_rejeicoes}). Impacto na eficácia operacional."})

        if not insights:
            insights.append({"type": "info", "text": "Indicadores operacionais CCM dentro da normalidade estatística." if is_ccm else "Indicadores Turmas em conformidade."})

        # Busca informações de sincronização
        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "STC_DataProd_export.xlsx").order_by(models.SyncLog.last_sync.desc()).first()
        file_source = sync_log.source_file if sync_log else "STC_DataProd_export.xlsx"
        upd_time = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/A"

        periodo_label = "Período não definido"
        if min_date and max_date:
            periodo_label = f"{min_date.strftime('%d/%m')} a {max_date.strftime('%d/%m')}"
        elif max_date:
            periodo_label = max_date.strftime('%d/%m/%Y')

        result = {
            "meta_prod": res_meta,
            "periodo_ref": periodo_label,
            "source_file": "Dados operacionais CCM.xlsx" if is_ccm else "STC_DataProd_export.xlsx",
            "last_update": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            "stats": {
                "media_prod": round(curr_prod, 1),
                "trend_prod": trend_prod,
                "media_ociosidade": round(curr_ociosidade, 1),
                "trend_ociosidade": trend_ociosidade,
                "media_saida_base": round(curr_saida, 1),
                "trend_saida": trend_saida,
                "media_retorno_base": round(curr_retorno, 1),
                "trend_retorno": trend_retorno,
                "total_ociosidade_hrs": float((kpis.total_ociosidade if kpis else 0) or 0) / 60,
                "total_desvios_hrs": float((kpis.total_desvios if kpis else 0) or 0) / 60,
                "total_hora_extra_hrs": float((kpis.total_hora_extra if kpis else 0) or 0) / 60,
                "total_notas": int((kpis.total_notas if kpis else 0) or 0),
                "total_rejeicoes": int(total_rejeicoes),
                "total_equipes": int((kpis.total_equipes if kpis else 0) or 0),
                "atingimento_meta": round((curr_prod / res_meta) * 100, 1) if curr_prod > 0 else 0,
                "num_dias": int(num_dias)
            },
            "top_desvios": top_desvios,
            "chart": {
                "labels": chart_labels,
                "data": chart_data
            },
            "top_piores": top_piores,
            "top_melhores": top_melhores,
            "breakdown_csd": sorted(breakdown_csd, key=lambda x: x["produtividade"] if metric == "ocupacao" else (x["ociosidade"] if metric == "ociosidade" else x["saida"]), reverse=(metric == "ocupacao")),
            "evolucao": evolucao,
            "insights": insights
        }
        api_cache.set(cache_key, result)
        return result
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/produtividade/evolucao")
def get_produtividade_evolucao(sector: str = None, db: Session = Depends(get_db)):
    """ Retorna a média de produtividade dia a dia para gráficos de linha """
    try:
        query = db.query(
            models.Produtividade.data,
            func.avg(models.Produtividade.produtividade_pct).label('media_prod'),
            func.avg(models.Produtividade.eficacia_pct).label('media_eficacia')
        )
        if sector:
            query = query.filter(models.Produtividade.setor.ilike(f"%{sector}%"))
            
        daily_kpis = query.group_by(models.Produtividade.data).order_by(models.Produtividade.data.asc()).limit(30).all()

        return [
            {"data": kpi.data.strftime("%d/%m"), "produtividade": round(float(kpi.media_prod), 1), "eficacia": round(float(kpi.media_eficacia), 1)} 
            for kpi in daily_kpis
        ]
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/produtividade/ranking")
def get_produtividade_ranking(db: Session = Depends(get_db)):
    """ Retorna lista Top 10 Equipes com maior tempo ocioso ou menor produtividade """
    try:
        rank = db.query(
            models.Produtividade.equipe,
            models.Produtividade.setor,
            func.avg(models.Produtividade.produtividade_pct).label('media_prod'),
            func.sum(models.Produtividade.ociosidade_min).label('total_ocios_min'),
        ).group_by(models.Produtividade.equipe, models.Produtividade.setor).order_by(func.avg(models.Produtividade.produtividade_pct).asc()).limit(10).all()

        return [
            {"equipe": r.equipe, "setor": r.setor, "produtividade": round(float(r.media_prod),1), "ociosidade": int(r.total_ocios_min)}
            for r in rank
        ]
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/5s/dashboard")
def get_5s_dashboard(periodo: str = "month", base: str = None, db: Session = Depends(get_db)):
    try:
        max_date_str = db.query(func.max(models.Auditoria5S.data_auditoria)).scalar()
        query = db.query(models.Auditoria5S).filter(models.Auditoria5S.local_auditado.notin_(['440', '441']))
        
        # Normalização do período
        periodo = str(periodo).lower().strip()
        if periodo not in ["day", "week", "month", "last_month"]:
            periodo = "month"

        if max_date_str:
            if isinstance(max_date_str, str):
                max_date = datetime.datetime.strptime(max_date_str, "%Y-%m-%d").date()
            else:
                max_date = max_date_str

        # 1. KPIs Mensais (Atual e Anterior)
        query_curr = db.query(models.Auditoria5S).filter(models.Auditoria5S.local_auditado.notin_(['440', '441']))
        query_prev = db.query(models.Auditoria5S).filter(models.Auditoria5S.local_auditado.notin_(['440', '441']))
        
        # Filtro de Base (Suporta seleção múltipla via string separada por vírgula)
        if base and base != "ALL":
            base_list = [b.strip().upper() for b in base.split(",") if b.strip()]
            if base_list:
                query_curr = query_curr.filter(models.Auditoria5S.base.in_(base_list))
                query_prev = query_prev.filter(models.Auditoria5S.base.in_(base_list))
                query = query.filter(models.Auditoria5S.base.in_(base_list))

        if max_date_str:
            # Determinando as janelas de data
            if periodo == "day":
                d_curr_max = max_date
                d_curr_min = max_date
                d_prev_max = max_date - datetime.timedelta(days=1)
                d_prev_min = d_prev_max
            elif periodo == "week":
                d_curr_max = max_date
                d_curr_min = max_date - datetime.timedelta(days=7)
                d_prev_max = d_curr_min - datetime.timedelta(days=1)
                d_prev_min = d_prev_max - datetime.timedelta(days=7)
            elif periodo == "last_month":
                d_curr_max = (max_date.replace(day=1) - datetime.timedelta(days=1))
                d_curr_min = d_curr_max.replace(day=1)
                d_prev_max = d_curr_min - datetime.timedelta(days=1)
                d_prev_min = d_prev_max.replace(day=1)
            else: # month (padrão)
                d_curr_max = max_date
                d_curr_min = max_date.replace(day=1)
                d_prev_max = d_curr_min - datetime.timedelta(days=1)
                d_prev_min = d_prev_max.replace(day=1)

            # Aplicando filtros
            query_curr = query_curr.filter(models.Auditoria5S.data_auditoria >= d_curr_min, models.Auditoria5S.data_auditoria <= d_curr_max)
            query_prev = query_prev.filter(models.Auditoria5S.data_auditoria >= d_prev_min, models.Auditoria5S.data_auditoria <= d_prev_max)
            # Atualiza a query principal para as outras partes do código usarem o mesmo filtro temporal
            query = query_curr

        kpis = query_curr.with_entities(
            func.avg(models.Auditoria5S.conformidade_pct).label('media_conformidade'),
            func.avg(models.Auditoria5S.nota_1s).label('s1'),
            func.avg(models.Auditoria5S.nota_2s).label('s2'),
            func.avg(models.Auditoria5S.nota_3s).label('s3'),
            func.avg(models.Auditoria5S.nota_4s).label('s4'),
            func.avg(models.Auditoria5S.nota_5s).label('s5'),
            func.count(models.Auditoria5S.id).label('total_auditorias')
        ).first()

        kpis_prev = query_prev.with_entities(
            func.avg(models.Auditoria5S.conformidade_pct).label('media_conformidade'),
            func.avg(models.Auditoria5S.nota_1s).label('s1'),
            func.avg(models.Auditoria5S.nota_2s).label('s2'),
            func.avg(models.Auditoria5S.nota_3s).label('s3'),
            func.avg(models.Auditoria5S.nota_4s).label('s4'),
            func.avg(models.Auditoria5S.nota_5s).label('s5')
        ).first()

        # 2. Dados do Gráfico de Evolução de Linha
        evo_query = db.query(models.Auditoria5S).filter(
            models.Auditoria5S.data_auditoria != None,
            models.Auditoria5S.local_auditado.notin_(['440', '441'])
        )
        if base and base != "ALL":
             base_list = [b.strip().upper() for b in base.split(",") if b.strip()]
             if base_list:
                 evo_query = evo_query.filter(models.Auditoria5S.base.in_(base_list))
             
        
        if "month" in periodo:
            # Agrupar por Mês (Últimos 12 meses)
            if max_date:
                min_date_evo = (max_date.replace(day=1) - datetime.timedelta(days=365)).replace(day=1)
                evo_query = evo_query.filter(models.Auditoria5S.data_auditoria >= min_date_evo)
            
            results = evo_query.with_entities(
                func.strftime('%Y-%m', models.Auditoria5S.data_auditoria).label('label'),
                func.avg(models.Auditoria5S.conformidade_pct).label('val')
            ).group_by(func.strftime('%Y-%m', models.Auditoria5S.data_auditoria)).order_by(func.strftime('%Y-%m', models.Auditoria5S.data_auditoria).asc()).all()
            
            evolucao_labels = []
            for r in results:
                try:
                    # Garantir que temos algo para converter
                    if r.label:
                        evolucao_labels.append(datetime.datetime.strptime(r.label, "%Y-%m").strftime("%m/%y"))
                    else:
                        evolucao_labels.append("N/D")
                except Exception as e:
                    print(f"Erro formatando label mes ({r.label}): {e}")
                    evolucao_labels.append(str(r.label))
            evolucao_data = [round(float(r.val or 0), 1) for r in results]

        elif "week" in periodo:
            # Agrupar por Semana (Últimas 12 semanas)
            if max_date:
                min_date_evo = max_date - datetime.timedelta(weeks=12)
                evo_query = evo_query.filter(models.Auditoria5S.data_auditoria >= min_date_evo)
            
            results = evo_query.with_entities(
                func.strftime('%Y-%W', models.Auditoria5S.data_auditoria).label('label'),
                func.avg(models.Auditoria5S.conformidade_pct).label('val')
            ).group_by(func.strftime('%Y-%W', models.Auditoria5S.data_auditoria)).order_by(func.strftime('%Y-%W', models.Auditoria5S.data_auditoria).asc()).all()
            
            evolucao_labels = [f"Sem {r.label.split('-')[1]}" if r.label and '-' in str(r.label) else f"S.{r.label}" for r in results]
            evolucao_data = [round(float(r.val or 0), 1) for r in results]
            
        else: # "day" ou qualquer outro fallback
            # Agrupar por Dia (Últimos 30 dias)
            if max_date:
                min_date_evo = max_date - datetime.timedelta(days=30)
                evo_query = evo_query.filter(models.Auditoria5S.data_auditoria >= min_date_evo)
            
            results = evo_query.with_entities(
                models.Auditoria5S.data_auditoria,
                func.avg(models.Auditoria5S.conformidade_pct).label('val')
            ).group_by(models.Auditoria5S.data_auditoria).order_by(models.Auditoria5S.data_auditoria.asc()).all()
            
            evolucao_labels = [r.data_auditoria.strftime("%d/%m") if r.data_auditoria else "N/D" for r in results]
            evolucao_data = [round(float(r.val or 0), 1) for r in results]


        # 3. Hierarquia (Base -> Local com as notas de todos os 'S')
        # 3. Hierarquia (Base -> Local com as notas de todos os 'S') em SQL para performance
        hierarchy_results = query.with_entities(
            models.Auditoria5S.base,
            models.Auditoria5S.local_auditado,
            func.count(models.Auditoria5S.id).label('auditorias'),
            func.avg(models.Auditoria5S.nota_1s).label('s1'),
            func.avg(models.Auditoria5S.nota_2s).label('s2'),
            func.avg(models.Auditoria5S.nota_3s).label('s3'),
            func.avg(models.Auditoria5S.nota_4s).label('s4'),
            func.avg(models.Auditoria5S.nota_5s).label('s5'),
            func.avg(models.Auditoria5S.conformidade_pct).label('conformidade'),
            func.max(models.Auditoria5S.data_auditoria).label('ultima_data'),
            func.max(models.Auditoria5S.inspetor).label('ultimo_inspetor')
        ).group_by(models.Auditoria5S.base, models.Auditoria5S.local_auditado).all()

        from collections import defaultdict
        base_groups = defaultdict(list)
        
        for r in hierarchy_results:
            bname = str(r.base or 'S/N').upper()
            base_groups[bname].append({
                "name": str(r.local_auditado or 'GERAL').upper(),
                "auditorias": int(r.auditorias or 0),
                "s1": round(float(r.s1 or 0), 1),
                "s2": round(float(r.s2 or 0), 1),
                "s3": round(float(r.s3 or 0), 1),
                "s4": round(float(r.s4 or 0), 1),
                "s5": round(float(r.s5 or 0), 1),
                "conformidade": round(float(r.conformidade or 0), 1),
                "ultima_data": r.ultima_data.strftime("%d/%m/%Y") if r.ultima_data else "N/D",
                "ultimo_inspetor": str(r.ultimo_inspetor or 'N/D').upper()
            })

        hierarchy = []
        for bname, locais in base_groups.items():
            # Calcula médias da base a partir dos locais
            b_audits = sum(l['auditorias'] for l in locais)
            # Pegar a data e inspetor mais recentes entre os locais da base
            from datetime import datetime as dt
            def parse_date(d_str):
                try: return dt.strptime(d_str, "%d/%m/%Y")
                except: return dt(2000, 1, 1)
            
            lat_local = max(locais, key=lambda x: parse_date(x["ultima_data"]))

            hierarchy.append({
                "name": bname,
                "auditorias": b_audits,
                "s1": round(sum(l['s1'] for l in locais)/len(locais), 1) if locais else 0,
                "s2": round(sum(l['s2'] for l in locais)/len(locais), 1) if locais else 0,
                "s3": round(sum(l['s3'] for l in locais)/len(locais), 1) if locais else 0,
                "s4": round(sum(l['s4'] for l in locais)/len(locais), 1) if locais else 0,
                "s5": round(sum(l['s5'] for l in locais)/len(locais), 1) if locais else 0,
                "conformidade": round(sum(l['conformidade'] for l in locais)/len(locais), 1) if locais else 0,
                "ultima_data": lat_local["ultima_data"],
                "ultimo_inspetor": lat_local["ultimo_inspetor"],
                "locais": sorted(locais, key=lambda x: x["conformidade"], reverse=True)
            })

        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "Relatorio_Consolidado_5S.csv").order_by(models.SyncLog.last_sync.desc()).first()
        file_source = sync_log.source_file if sync_log else "Relatorio_Consolidado_5S.csv"
        upd_time = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/A"

        def calc_trend(curr, prev):
            if curr is None: curr = 0
            if prev is None: prev = 0
            return round(float(curr) - float(prev), 1)

        # Lista de todas as bases disponíveis (para o filtro no front)
        all_bases_results = db.query(models.Auditoria5S.base).filter(models.Auditoria5S.local_auditado.notin_(['440', '441'])).distinct().all()
        all_bases = sorted([str(b[0]).upper() for b in all_bases_results if b[0]])

        return {
            "meta_5s": 90,
            "source_file": file_source,
            "last_update": upd_time,
            "all_bases": all_bases,
            "debug_timestamp": datetime.datetime.now().isoformat(),
            "periodo_ref": max_date.strftime('%d/%m/%Y') if hasattr(max_date, 'strftime') else str(max_date),
            "stats": {
                "media_conformidade": round(float(kpis.media_conformidade or 0), 1),
                "trend_conformidade": calc_trend(kpis.media_conformidade, kpis_prev.media_conformidade),
                "total_auditorias": int(kpis.total_auditorias or 0),
                "s1": round(float(kpis.s1 or 0), 1),
                "s1_trend": calc_trend(kpis.s1, kpis_prev.s1),
                "s2": round(float(kpis.s2 or 0), 1),
                "s2_trend": calc_trend(kpis.s2, kpis_prev.s2),
                "s3": round(float(kpis.s3 or 0), 1),
                "s3_trend": calc_trend(kpis.s3, kpis_prev.s3),
                "s4": round(float(kpis.s4 or 0), 1),
                "s4_trend": calc_trend(kpis.s4, kpis_prev.s4),
                "s5": round(float(kpis.s5 or 0), 1),
                "s5_trend": calc_trend(kpis.s5, kpis_prev.s5),
                "bases_auditadas": len(hierarchy)
            },
            "evolucao": {
                "labels": evolucao_labels,
                "data": evolucao_data
            },
            "hierarchy": sorted(hierarchy, key=lambda x: x["conformidade"], reverse=True)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/5s/historico")
def get_5s_historico(periodo: str = "month", base: str = None, db: Session = Depends(get_db)):
    try:
        query = db.query(models.Auditoria5S).filter(
            models.Auditoria5S.local_auditado.notin_(['440', '441'])
        )
        
        if base and base != "ALL":
             base_list = [b.strip().upper() for b in base.split(",") if b.strip()]
             if base_list:
                 query = query.filter(models.Auditoria5S.base.in_(base_list))

        query = query.order_by(models.Auditoria5S.data_auditoria.desc())
        
        import datetime
        min_date = datetime.date.today() - datetime.timedelta(days=365)
        records = query.filter(models.Auditoria5S.data_auditoria >= min_date).all()
        
        history = []
        for r in records:
            history.append({
                "data": r.data_auditoria.strftime("%d/%m/%Y") if r.data_auditoria else "N/A",
                "base": str(r.base or ""),
                "local": str(r.local_auditado or ""),
                "tipo": str(r.tipo_auditoria or ""),
                "nota": round(float(r.conformidade_pct or 0), 1),
                "inspetor": str(r.inspetor or "")
            })
            
        return {"items": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/5s/planos")
def get_5s_planos(base: str = "ALL", db: Session = Depends(get_db)):
    try:
        from planos_5s_legacy import get_legacy_planos
        actions = get_legacy_planos()
        
        if base and base != "ALL":
            base_list = [b.strip().upper() for b in base.split(",") if b.strip()]
            actions = [a for a in actions if str(a.get("base", "")).upper() in base_list]

        return {"action_plans": actions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/5s/planos/export")
def export_5s_planos(senso: str = "ALL", status: str = "ALL", base: str = "ALL", resp: str = "ALL", search: str = "", db: Session = Depends(get_db)):
    from planos_5s_legacy import get_legacy_planos
    import pandas as pd
    import io
    from fastapi.responses import StreamingResponse

    try:
        actions = get_legacy_planos()
        df = pd.DataFrame(actions)
        
        if df.empty:
             df = pd.DataFrame(columns=['base', 'local', 'responsavel', 'codigo', 'pergunta', 'acao_sugerida', 'dias_aberto', 'status'])

        # Filtering logic
        if search:
            s = search.lower()
            df = df[df.apply(lambda r: s in str(r['base']).lower() or 
                                       s in str(r['local']).lower() or 
                                       s in str(r['responsavel']).lower() or 
                                       s in str(r['acao_sugerida']).lower() or 
                                       s in str(r['pergunta']).lower(), axis=1)]
        
        if status != "ALL":
            df = df[df['status'] == status]
            
        if senso != "ALL":
            df = df[df['codigo'].str.startswith(senso, na=False)]
            
        if base != "ALL":
            df = df[df['base'] == base]
            
        if resp != "ALL":
            df = df[df['responsavel'] == resp]

        # Column mapping
        column_map = {
            'base': 'Base',
            'local': 'Local',
            'responsavel': 'Responsável',
            'codigo': 'Código/Senso',
            'pergunta': 'Pergunta/GAP',
            'acao_sugerida': 'Ação Sugerida',
            'dias_aberto': 'Dias em Aberto',
            'status': 'Status'
        }
        
        if not df.empty:
            df = df[list(column_map.keys())].rename(columns=column_map)
        else:
            df = pd.DataFrame(columns=column_map.values())

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Plano_de_Acao_5S')
        output.seek(0)
        
        filename = f"Plano_de_Acao_5S_{datetime.datetime.now().strftime('%Y%m%d')}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/rejeicoes/dashboard")
def get_rejeicoes_dashboard(periodo: str = "month", db: Session = Depends(get_db)):
    try:
        max_date_str = db.query(func.max(models.Rejeicao.data_conclusao)).scalar()
        query = db.query(models.Rejeicao)
        
        # Normalização robusta para bater com Header.tsx e variações
        p_raw = str(periodo).lower().strip()
        mapping = {
            "latest": "day", "day": "day", "diário": "day", "diario": "day",
            "week": "7d", "7d": "7d", "semanal": "7d", "semana": "7d",
            "30d": "30d", "month": "month", "mensal": "month", "mês": "month", "mes": "month",
            "last_month": "last_month", "mês anterior": "last_month",
            "year": "year", "anual": "year", "ano": "year"
        }
        p_norm = mapping.get(p_raw, "month")

        if max_date_str:
            if isinstance(max_date_str, str):
                max_date = datetime.datetime.strptime(max_date_str, "%Y-%m-%d").date()
            else:
                max_date = max_date_str
                
            if p_norm == "day":
                query = query.filter(models.Rejeicao.data_conclusao == max_date)
            elif p_norm == "7d":
                min_date = max_date - datetime.timedelta(days=7)
                query = query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date)
            elif p_norm == "30d":
                min_date = max_date - datetime.timedelta(days=30)
                query = query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date)
            elif p_norm == "month":
                min_date = max_date.replace(day=1)
                query = query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date)
            elif p_norm == "year":
                min_date = max_date.replace(month=1, day=1)
                query = query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date)
            elif p_norm == "last_month":
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.Rejeicao.data_conclusao >= min_date, models.Rejeicao.data_conclusao <= max_date_ref)
                max_date = max_date_ref
        else:
            # Se não há data no banco, a query deve ser vazia ou limitada
            query = query.filter(models.Rejeicao.id == -1)

        total_rejeicoes = query.with_entities(func.sum(models.Rejeicao.num_rejeicoes)).scalar() or 0
        total_dias = query.with_entities(func.count(func.distinct(models.Rejeicao.data_conclusao))).scalar() or 1
        media_dia = total_rejeicoes / total_dias if total_dias > 0 else 0

        bk_stats = query.with_entities(
            models.Rejeicao.backoffice_em,
            func.sum(models.Rejeicao.num_rejeicoes).label('total')
        ).group_by(models.Rejeicao.backoffice_em).all()

        global_status = {}
        auditadas = 0
        pendentes = 0
        for b in bk_stats:
            nome = str(b.backoffice_em).strip().title()
            val = int(b.total or 0)
            if nome in ["Indefinido", "", "None", "Nan"]:
                nome = "Não Tratado"
            global_status[nome] = global_status.get(nome, 0) + val
            if nome.lower() in ["procedente", "improcedente"]:
                auditadas += val
            else:
                pendentes += val

        aderencia_pct = (auditadas / total_rejeicoes * 100) if total_rejeicoes > 0 else 0

        hist_query = db.query(models.Rejeicao).filter(models.Rejeicao.data_conclusao != None)
        if p_norm == "year":
             # Agrupar por mes
             today_date = datetime.date.today()
             min_d = max_date.replace(month=1, day=1) if max_date else today_date.replace(month=1, day=1)
             hist_results = hist_query.filter(models.Rejeicao.data_conclusao >= min_d).with_entities(
                 func.strftime('%Y-%m', models.Rejeicao.data_conclusao).label('periodo_key'),
                 func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
             ).group_by('periodo_key').order_by('periodo_key').all()
             history = [{"MesAno": datetime.datetime.strptime(r.periodo_key, "%Y-%m").strftime("%b/%y"), "Qtd": int(r.qtd or 0)} for r in hist_results]
        else:
            # Diário (respeitando o filtro de p_norm)
            if p_norm == "day":
                # Mostra os ultimos 30 dias para ter contexto suficiente no grafico
                f_min = max_date - datetime.timedelta(days=30)
                daily_data_query = hist_query.filter(models.Rejeicao.data_conclusao >= f_min, models.Rejeicao.data_conclusao <= max_date)
            else:
                # Usa a query ja filtrada para o grafico (7d, 30d, month)
                daily_data_query = query.filter(models.Rejeicao.data_conclusao != None)

            daily_kpis = daily_data_query.with_entities(
                models.Rejeicao.data_conclusao,
                func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
            ).group_by(models.Rejeicao.data_conclusao).order_by(models.Rejeicao.data_conclusao.asc()).all()
            history = [{"MesAno": d.data_conclusao.strftime("%d/%m"), "Qtd": int(d.qtd or 0)} for d in daily_kpis]

        eq_group = query.with_entities(
            models.Rejeicao.equipe,
            func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
        ).group_by(models.Rejeicao.equipe).order_by(func.sum(models.Rejeicao.num_rejeicoes).desc()).limit(5).all()
        top_equipes = [{"Equipe": str(e.equipe), "Qtd": int(e.qtd or 0)} for e in eq_group if e.equipe]

        # Ranking Eletricistas
        el_group = query.with_entities(
            models.Rejeicao.eletricista,
            func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
        ).group_by(models.Rejeicao.eletricista).order_by(func.sum(models.Rejeicao.num_rejeicoes).desc()).limit(5).all()
        top_eletricistas = [{"Equipe": str(e.eletricista).upper(), "Qtd": int(e.qtd or 0)} for e in el_group if e.eletricista]

        motivos_group = query.with_entities(
            models.Rejeicao.motivo,
            func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
        ).group_by(models.Rejeicao.motivo).order_by(func.sum(models.Rejeicao.num_rejeicoes).desc()).limit(10).all()
        
        pareto = []
        for m in motivos_group:
            if m.motivo:
                m_qtd = int(m.qtd or 0)
                pareto.append({
                    "Motivo": str(m.motivo)[:50] + "..." if len(str(m.motivo)) > 50 else str(m.motivo),
                    "Qtd": m_qtd,
                    "Pct": round((m_qtd / total_rejeicoes * 100), 1) if total_rejeicoes > 0 else 0
                })

        reg_bk = query.with_entities(
            models.Rejeicao.analista,
            models.Rejeicao.status,
            func.sum(models.Rejeicao.num_rejeicoes).label('qtd')
        ).group_by(models.Rejeicao.analista, models.Rejeicao.status).all()

        backoffice_dict = {}

        for r in reg_bk:
            bname = str(r.analista).upper().strip() if r.analista else "NÃO TRATADO"
            if bname in ["NONE", "NAN", "INDEFINIDO", ""]: bname = "NÃO TRATADO"
            status = str(r.status).strip().title()
            val = int(r.qtd or 0)
            
            if bname not in backoffice_dict:
                backoffice_dict[bname] = {"Backoffice": bname, "Procedente": 0, "Improcedente": 0, "Em Análise": 0}
            
            if status in backoffice_dict[bname]:
                backoffice_dict[bname][status] += val
            else:
                backoffice_dict[bname]["Em Análise"] += val

        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "Controle de Rejeições - Versão 2.xlsx").order_by(models.SyncLog.last_sync.desc()).first()
        file_source = sync_log.source_file if sync_log else "Controle de Rejeições - Versão 2.xlsx"
        upd_time = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/A"

        recent_query = query.order_by(models.Rejeicao.data_conclusao.desc())
        recent_records = recent_query.all()
        recent_list = []
        for r in recent_records:
            recent_list.append({
                "data": r.data_conclusao.strftime("%d/%m/%Y") if r.data_conclusao else "--",
                "status": str(r.status).strip().title() if r.status else "Em Análise",
                "equipe": str(r.equipe).upper() if r.equipe else "--",
                "nota": str(r.nota) if r.nota else "--",
                "motivo": str(r.motivo) if r.motivo else "--",
                "observacao": str(r.descricao) if r.descricao else "--",
                "regional": str(r.regional).upper() if r.regional else "--"
            })

        return {
            "period_label": max_date_str.strftime('%d/%m/%Y') if hasattr(max_date_str, 'strftime') else str(max_date_str),
            "source_file": file_source,
            "last_update": upd_time,
            "stats": {
                "total": total_rejeicoes,
                "media_dia": round(media_dia, 1),
                "media_prev": round(media_dia * 0.9, 1), 
                "aderencia_pct": aderencia_pct,
                "status_resumo": {"auditadas": auditadas, "pendentes": pendentes},
                "kpi1": {"label": "Total Rejeições", "value": str(total_rejeicoes), "legend": "Volume bruto", "trend": "down", "border": "var(--primary)"},
                "kpi2": {"label": "Tratadas", "value": str(auditadas), "legend": "Via Backoffice", "trend": "up", "border": "var(--success)"},
                "kpi3": {"label": "Pendentes", "value": str(pendentes), "legend": "Fila de auditoria", "trend": "down", "border": "var(--warning)"},
                "kpi4": {"label": "Aderência", "value": f"{round(aderencia_pct, 1)}%", "legend": "Tratado vs Total", "trend": "up", "border": "var(--success)"}
            },
            "top_equipes": top_equipes,
            "top_eletricistas": top_eletricistas, 
            "pareto": pareto,
            "backoffice_data": list(backoffice_dict.values()),
            "global_status": global_status,
            "history": history,
            "recent_records": recent_list
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/v1/frota/dashboard")
def get_frota_dashboard(periodo: str = "month", sector: str = None, regional: str = None, db: Session = Depends(get_db)):
    # Normalização rigorosa
    p_norm = str(periodo).lower().strip()
    if p_norm not in ["all", "day", "week", "month", "last_month", "year", "last12"]:
        p_norm = "all"
        
    s_norm = sector.strip() if sector else None
    r_norm = regional.strip() if regional else None
    
    # Cache key v4 (para forçar atualização e ignorar lixo de versões anteriores)
    cache_key = f"frota_v4_{p_norm}_{s_norm}_{r_norm}"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        today = datetime.date.today()
        # Data máxima real para cálculos (ignorando erros de digitação/futuro)
        base_date_query = db.query(func.max(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao <= today).scalar()
        # Data máxima absoluta (para o disclaimer)
        abs_max_date = db.query(func.max(models.FrotaCustos.data_solicitacao)).scalar()
        
        has_future_data = False
        if abs_max_date:
            if isinstance(abs_max_date, str):
                actual_abs_max = datetime.datetime.strptime(abs_max_date, "%Y-%m-%d").date()
            else:
                actual_abs_max = abs_max_date
            if actual_abs_max > today:
                has_future_data = True

        max_date = today
        if base_date_query:
            if isinstance(base_date_query, str):
                max_date = datetime.datetime.strptime(base_date_query, "%Y-%m-%d").date()
            else:
                max_date = base_date_query

        # Conforme revisar.md: Mapear Histórico (all) para os últimos 12 meses
        if p_norm == "all":
            ref_date = max_date if max_date else today
            min_allowed_date = ref_date.replace(day=1)
            for _ in range(11):
                min_allowed_date = (min_allowed_date - datetime.timedelta(days=1)).replace(day=1)
        else:
            min_allowed_date = datetime.date(2022, 1, 1)

        query = db.query(models.FrotaCustos).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date)
        
        if max_date:
            prev_query = db.query(models.FrotaCustos).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date)
            if p_norm == "month":
                min_date = max_date.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date)
                # Mes Anterior
                prev_end = min_date - datetime.timedelta(days=1)
                prev_start = prev_end.replace(day=1)
                prev_query = prev_query.filter(models.FrotaCustos.data_solicitacao >= prev_start, models.FrotaCustos.data_solicitacao <= prev_end)
            elif p_norm == "last_month":
                # Mês fechado anterior relativo à última data do banco
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date_ref)
                
                # Tendência: Mês Retrasado
                prev_end = min_date - datetime.timedelta(days=1)
                prev_start = prev_end.replace(day=1)
                prev_query = prev_query.filter(models.FrotaCustos.data_solicitacao >= prev_start, models.FrotaCustos.data_solicitacao <= prev_end)
                
                max_date = max_date_ref # Atualiza para o label mostrar Jan/2026 por exemplo
            elif p_norm == "year":
                min_date = max_date.replace(month=1, day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date)
                # Ano Anterior
                prev_end = min_date - datetime.timedelta(days=1)
                prev_start = prev_end.replace(month=1, day=1)
                prev_query = prev_query.filter(models.FrotaCustos.data_solicitacao >= prev_start, models.FrotaCustos.data_solicitacao <= prev_end)
            elif p_norm == "last12":
                first_day_current = max_date.replace(day=1)
                min_date = (first_day_current - datetime.timedelta(days=1)).replace(day=1)
                for _ in range(10): min_date = (min_date - datetime.timedelta(days=1)).replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date)
                # Periodo anterior de 12 meses
                prev_end = min_date - datetime.timedelta(days=1)
                prev_start = prev_end.replace(day=1)
                for _ in range(11): prev_start = (prev_start - datetime.timedelta(days=1)).replace(day=1)
                prev_query = prev_query.filter(models.FrotaCustos.data_solicitacao >= prev_start, models.FrotaCustos.data_solicitacao <= prev_end)
            # Default "all" não aplica filtro adicional

        # Filtros Adicionais de Regional e Setor (Novidade: AFETA TODO O DASHBOARD)
        if sector: 
            query = query.filter(models.FrotaCustos.setor.ilike(f"%{sector}%"))
            prev_query = prev_query.filter(models.FrotaCustos.setor.ilike(f"%{sector}%"))
        if regional:
            query = query.filter(models.FrotaCustos.regional.ilike(f"%{regional}%"))
            prev_query = prev_query.filter(models.FrotaCustos.regional.ilike(f"%{regional}%"))

        # KPIs Basicos (Atual vs Anterior)
        total_custos = query.with_entities(func.sum(models.FrotaCustos.custo_val)).scalar() or 0.0
        qtd_servicos = query.with_entities(func.count(models.FrotaCustos.id)).scalar() or 0
        ticket_medio = total_custos / qtd_servicos if qtd_servicos > 0 else 0
        total_frota = query.with_entities(func.count(func.distinct(models.FrotaCustos.veiculo_id))).scalar() or 0

        # Valores anteriores para calculo de trend
        prev_total = prev_query.with_entities(func.sum(models.FrotaCustos.custo_val)).scalar() or 0.0
        prev_qtd = prev_query.with_entities(func.count(models.FrotaCustos.id)).scalar() or 0
        prev_ticket = prev_total / prev_qtd if prev_qtd > 0 else 0
        prev_frota = prev_query.with_entities(func.count(func.distinct(models.FrotaCustos.veiculo_id))).scalar() or 0

        def calc_trend(curr, prev):
            if not prev or prev == 0: return 0
            return ((curr - prev) / prev) * 100

        trend_custo = calc_trend(total_custos, prev_total)
        trend_ticket = calc_trend(ticket_medio, prev_ticket)
        trend_frota = calc_trend(total_frota, prev_frota)
        trend_servicos = calc_trend(qtd_servicos, prev_qtd)

        # Calcular Pareto de Veículos (Top Offensers 80/20)
        from sqlalchemy import text
        
        veiculos_group = query.with_entities(
            models.FrotaCustos.veiculo_id,
            models.FrotaCustos.modelo,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(models.FrotaCustos.id).label('count_manutencao')
        ).group_by(models.FrotaCustos.veiculo_id, models.FrotaCustos.modelo).order_by(func.sum(models.FrotaCustos.custo_val).desc()).all()
        
        pareto_list = []
        custo_acumulado = 0
        meta_80 = total_custos * 0.80
        total_frota = len(veiculos_group)
        ofendores_count = 0
        
        for v in veiculos_group:
            vid = str(v.veiculo_id) if v.veiculo_id else "N/D"
            mod = str(v.modelo) if v.modelo else "N/D"
            val = float(v.total or 0)
            
            custo_acumulado += val
            pct = (custo_acumulado / total_custos * 100) if total_custos > 0 else 0
            
            if custo_acumulado <= meta_80 or ofendores_count == 0:
                ofendores_count += 1
                if len(pareto_list) < 15: # limitar a lista q vai pro front
                    pareto_list.append({
                        "id": vid,
                        "modelo": mod,
                        "custo_total": val,
                        "qtd_manutencoes": int(v.count_manutencao or 0),
                        "custo": val / int(v.count_manutencao or 1),
                        "percent": pct
                    })
        
        pct_ofendores = (ofendores_count / total_frota * 100) if total_frota > 0 else 0

        # Evolução Diária ou Mensal com preenchimento de lacunas
        hist_query = query.filter(models.FrotaCustos.data_solicitacao != None)
        
        if p_norm == "month" and max_date:
             daily_evo = hist_query.with_entities(
                 models.FrotaCustos.data_solicitacao,
                 func.sum(models.FrotaCustos.custo_val).label('total')
             ).group_by(models.FrotaCustos.data_solicitacao).order_by(models.FrotaCustos.data_solicitacao.asc()).all()
             
             history = [{"MesAno": d.data_solicitacao.strftime("%d/%m/%Y") if hasattr(d.data_solicitacao, 'strftime') else str(d.data_solicitacao)[8:10] + '/' + str(d.data_solicitacao)[5:7], 
                         "Val": float(d.total or 0)} for d in daily_evo if d.data_solicitacao]
        else:
             # Agrupar por Mes
             monthly_evo_results = hist_query.with_entities(
                 func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao).label('mes_ano'),
                 func.sum(models.FrotaCustos.custo_val).label('total')
             ).group_by(func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao)).all()
             
             evo_map = {r.mes_ano: float(r.total or 0) for r in monthly_evo_results}
             
             # Gerar range de meses
             if p_norm == "year":
                 start_date = max_date.replace(month=1, day=1)
             elif p_norm == "last12" or p_norm == "all":
                 start_date = max_date.replace(day=1)
                 for _ in range(11):
                     start_date = (start_date - datetime.timedelta(days=1)).replace(day=1)
             else: # all, last_month ou outros
                 min_date_db = db.query(func.min(models.FrotaCustos.data_solicitacao)).scalar()
                 if isinstance(min_date_db, str):
                     start_date = datetime.datetime.strptime(min_date_db, "%Y-%m-%d").date().replace(day=1)
                 elif min_date_db:
                     start_date = min_date_db.replace(day=1)
                 else:
                     start_date = max_date.replace(month=1, day=1) if max_date else datetime.date.today().replace(month=1, day=1)

             history = []
             curr = start_date
             while curr <= max_date.replace(day=1):
                 m_key = curr.strftime("%Y-%m")
                 m_label = curr.strftime("%m/%Y")
                 history.append({
                     "MesAno": m_label,
                     "Val": evo_map.get(m_key, 0.0)
                 })
                 # Advance
                 if curr.month == 12:
                     curr = curr.replace(year=curr.year + 1, month=1)
                 else:
                     curr = curr.replace(month=curr.month + 1)

        # Setores e Custo Médio por Setor
        setor_group = query.with_entities(
            models.FrotaCustos.setor,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('unique_veiculos')
        ).group_by(models.FrotaCustos.setor).order_by(func.sum(models.FrotaCustos.custo_val).desc()).all()
        
        regionais = [] # Vai guardar o formato legado caso o front antigo dependa
        setores = []
        custo_medio_setor = []
        for r in setor_group:
            s_name = str(r.setor) if r.setor else "N/D"
            if s_name.lower() == 'nan': continue
            s_name = s_name.title()
            val = float(r.total or 0)
            u_v = int(r.unique_veiculos or 1)
            regionais.append({"name": s_name, "value": val})
            setores.append({"name": s_name, "value": val})
            custo_medio_setor.append({"name": s_name, "custo": val / u_v if u_v > 0 else 0, "veiculos": u_v})

        custo_medio_setor = sorted(custo_medio_setor, key=lambda x: x["custo"], reverse=True)

        # Custo médio por Tipo de Veículo
        tipo_group = query.with_entities(
            models.FrotaCustos.tipo,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('unique_veiculos')
        ).group_by(models.FrotaCustos.tipo).order_by(func.sum(models.FrotaCustos.custo_val).desc()).all()
        
        custo_medio_tipo = []
        for r in tipo_group:
            t_name = str(r.tipo) if r.tipo else "N/D"
            if t_name.lower() == 'nan': continue
            t_name = t_name.title()
            val = float(r.total or 0)
            u_v = int(r.unique_veiculos or 1)
            custo_medio_tipo.append({"name": t_name, "custo": val / u_v if u_v > 0 else 0, "veiculos": u_v})
        
        custo_medio_tipo = sorted(custo_medio_tipo, key=lambda x: x["custo"], reverse=True)

        # Fornecedores
        forn_group = query.with_entities(
            models.FrotaCustos.fornecedor,
            func.sum(models.FrotaCustos.custo_val).label('total')
        ).group_by(models.FrotaCustos.fornecedor).order_by(func.sum(models.FrotaCustos.custo_val).desc()).limit(10).all()
        fornecedores = [{"name": str(r.fornecedor)[:30], "value": float(r.total or 0)} for r in forn_group if r.fornecedor]

        # Manutenção Preventiva vs Corretiva
        maint_group = query.with_entities(
            models.FrotaCustos.tipo_manutencao,
            func.sum(models.FrotaCustos.custo_val).label('total')
        ).group_by(models.FrotaCustos.tipo_manutencao).all()
        manutencoes = [{"name": str(m.tipo_manutencao), "value": float(m.total or 0)} for m in maint_group if m.tipo_manutencao]
        
        # Idade de Veículos (Custo Total e Custo Médio por Veículo)
        idade_group = query.with_entities(
            models.FrotaCustos.ano_veiculo,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('unique_veiculos')
        ).group_by(models.FrotaCustos.ano_veiculo).all()
        
        current_year = datetime.datetime.now().year
        idade_map = {"0-2 Anos": [0,0], "3-5 Anos": [0,0], "6-8 Anos": [0,0], "9+ Anos": [0,0], "N/D": [0,0]}
        for ig in idade_group:
            ano = ig.ano_veiculo
            val = float(ig.total or 0)
            u_v = int(ig.unique_veiculos or 1)
            
            if not ano or ano == 0 or ano > current_year:
                idade_map["N/D"][0] += val
                idade_map["N/D"][1] += u_v
            else:
                idade = current_year - ano
                cat = "0-2 Anos" if idade <= 2 else ("3-5 Anos" if idade <= 5 else ("6-8 Anos" if idade <= 8 else "9+ Anos"))
                idade_map[cat][0] += val
                idade_map[cat][1] += u_v
        
        idades = [{"name": k, "value": v[0], "media": v[0]/v[1] if v[1]>0 else 0} for k, v in idade_map.items() if k != "N/D"]

        # Top Serviços / Itens
        serv_group = query.with_entities(
            models.FrotaCustos.nome_servico,
            func.sum(models.FrotaCustos.custo_val).label('total')
        ).group_by(models.FrotaCustos.nome_servico).order_by(func.sum(models.FrotaCustos.custo_val).desc()).limit(10).all()
        top_servicos = [{"name": str(r.nome_servico)[:35], "value": float(r.total or 0)} for r in serv_group if r.nome_servico and r.nome_servico.strip() != ""]

        # Matriz de Eficiência (Regional x Setor)
        matrix_group = query.with_entities(
            models.FrotaCustos.regional,
            models.FrotaCustos.setor,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('veiculos')
        ).group_by(models.FrotaCustos.regional, models.FrotaCustos.setor).all()
        matrix = [
            {
                "regional": str(m.regional).upper(),
                "setor": str(m.setor).upper(),
                "total": float(m.total or 0),
                "veiculos": int(m.veiculos or 0),
                "medio": float(m.total or 0) / int(m.veiculos or 1)
            }
            for m in matrix_group if m.regional and m.setor and str(m.regional).lower() not in ['nan', 'none', 'n/d'] and str(m.setor).lower() not in ['nan', 'none', 'n/d']
        ]

        return {
            "period_label": max_date.strftime('%d/%m/%Y') if hasattr(max_date, 'strftime') else str(max_date),
            "stats": {
                "total_custo": total_custos,
                "trend_custo": trend_custo,
                "ticket_medio": ticket_medio,
                "trend_ticket": trend_ticket,
                "qtd_servicos": qtd_servicos,
                "trend_servicos": trend_servicos,
                "total_frota": total_frota,
                "trend_frota": trend_frota
            },
            "pareto": {
                "total_veiculos": total_frota,
                "veiculos_ofensores": ofendores_count,
                "percentual_ofensores": pct_ofendores,
                "custo_ofensores": meta_80
            },
            "history": history,
            "regionais": regionais, 
            "setores": setores,
            "fornecedores": fornecedores,
            "manutencoes": manutencoes,
            "idades": idades,
            "top_offenders": pareto_list,
            "custo_medio_tipo": custo_medio_tipo,
            "custo_medio_setor": custo_medio_setor,
            "top_servicos": top_servicos,
            "matrix": matrix,
            "has_future_data": has_future_data,
            "source_file": "FROTA 2025.xlsx",
            "last_update": db.query(models.SyncLog).filter(models.SyncLog.source_file == "FROTA 2025.xlsx").order_by(models.SyncLog.last_sync.desc()).first().last_sync.strftime("%d/%m/%Y %H:%M") if db.query(models.SyncLog).filter(models.SyncLog.source_file == "FROTA 2025.xlsx").first() else "N/A"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/frota/custos-regional")
def get_frota_custos_regional(periodo: str = "month", sector: str = None, db: Session = Depends(get_db)):
    try:
        min_allowed_date = datetime.date(2022, 1, 1)
        query = db.query(models.FrotaCustos).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date)
        
        # Filtro de Período (ignora datas futuras)
        today = datetime.date.today()
        max_date_query = db.query(func.max(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao <= today).scalar()
        if max_date_query:
            if isinstance(max_date_query, str):
                max_date = datetime.datetime.strptime(max_date_query, "%Y-%m-%d").date()
            else:
                max_date = max_date_query
                
            p_norm = str(periodo).lower().strip()
            if p_norm == "month":
                min_date = max_date.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif p_norm == "last_month":
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date_ref)
            elif p_norm == "year":
                min_date = max_date.replace(month=1, day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif p_norm == "last12":
                min_date = max_date - datetime.timedelta(days=365)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)

        if sector:
            # Se vier filtro de setor, aplicamos
            query = query.filter(models.FrotaCustos.setor.ilike(f"%{sector}%"))

        # Agrupamento por Regional
        regional_group = query.with_entities(
            models.FrotaCustos.regional,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('veiculos')
        ).group_by(models.FrotaCustos.regional).order_by(func.sum(models.FrotaCustos.custo_val).desc()).all()

        return [
            {
                "name": str(r.regional or "N/D").upper(),
                "total": float(r.total or 0),
                "medio": float(r.total or 0) / int(r.veiculos or 1),
                "veiculos": int(r.veiculos or 0)
            }
            for r in regional_group if r.regional and str(r.regional).lower() not in ['nan', 'none', 'n/d']
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/frota/custos-setor")
def get_frota_custos_setor(periodo: str = "month", regional: str = None, db: Session = Depends(get_db)):
    try:
        min_allowed_date = datetime.date(2022, 1, 1)
        query = db.query(models.FrotaCustos).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date)
        
        # Filtro de Período (ignora datas futuras)
        today = datetime.date.today()
        max_date_query = db.query(func.max(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao <= today).scalar()
        if max_date_query:
            if isinstance(max_date_query, str):
                max_date = datetime.datetime.strptime(max_date_query, "%Y-%m-%d").date()
            else:
                max_date = max_date_query
                
            p_norm = str(periodo).lower().strip()
            if p_norm == "month":
                min_date = max_date.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif p_norm == "last_month":
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date_ref)
            elif p_norm == "year":
                min_date = max_date.replace(month=1, day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif p_norm == "last12":
                min_date = max_date - datetime.timedelta(days=365)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)

        if regional:
            query = query.filter(models.FrotaCustos.regional.ilike(f"%{regional}%"))

        # Agrupamento por Setor
        setor_group = query.with_entities(
            models.FrotaCustos.setor,
            func.sum(models.FrotaCustos.custo_val).label('total'),
            func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('veiculos')
        ).group_by(models.FrotaCustos.setor).order_by(func.sum(models.FrotaCustos.custo_val).desc()).all()

        return [
            {
                "name": str(r.setor or "N/D").upper(),
                "total": float(r.total or 0),
                "medio": float(r.total or 0) / int(r.veiculos or 1),
                "veiculos": int(r.veiculos or 0)
            }
            for r in setor_group if r.setor and str(r.setor).lower() not in ['nan', 'none', 'n/d']
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/frota/evolucao-medio")
def get_frota_evolucao_medio(periodo: str = "all", sector: str = None, regional: str = None, tipo: str = None, compare: str = None, db: Session = Depends(get_db)):
    try:
        min_allowed_date = datetime.date(2022, 1, 1)
        query = db.query(models.FrotaCustos).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date)
        
        # Filtro de Período adicional para a evolução
        today = datetime.date.today()
        base_date_query = db.query(func.max(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao <= today).scalar()
        
        if base_date_query:
            if isinstance(base_date_query, str):
                max_date = datetime.datetime.strptime(base_date_query, "%Y-%m-%d").date()
            else:
                max_date = base_date_query
                
            if periodo == "month":
                min_date = max_date.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif periodo == "year":
                min_date = max_date.replace(month=1, day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)
            elif periodo == "last_month":
                # Mês fechado anterior
                first_day_curr = max_date.replace(day=1)
                max_date_ref = first_day_curr - datetime.timedelta(days=1)
                min_date = max_date_ref.replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date, models.FrotaCustos.data_solicitacao <= max_date_ref)
                max_date = max_date_ref
            elif periodo == "last12":
                # Mesma logica de 12 meses fechados
                first_day_current = max_date.replace(day=1)
                min_date = (first_day_current - datetime.timedelta(days=1)).replace(day=1)
                for _ in range(10):
                    min_date = (min_date - datetime.timedelta(days=1)).replace(day=1)
                query = query.filter(models.FrotaCustos.data_solicitacao >= min_date)

        if sector: query = query.filter(models.FrotaCustos.setor.ilike(f"%{sector}%"))
        if regional: query = query.filter(models.FrotaCustos.regional.ilike(f"%{regional}%"))
        if tipo: query = query.filter(models.FrotaCustos.tipo.ilike(f"%{tipo}%"))

        history_limit = 12

        if compare in ["regional", "setor"]:
            # Identificar os Top 3 do grupo para não poluir o gráfico
            group_field = models.FrotaCustos.regional if compare == "regional" else models.FrotaCustos.setor
            top_3 = query.with_entities(group_field, func.sum(models.FrotaCustos.custo_val)).filter(group_field != None, group_field != 'N/D', group_field != 'n/d').group_by(group_field).order_by(func.sum(models.FrotaCustos.custo_val).desc()).limit(3).all()
            top_names = [str(x[0]) for x in top_3 if x[0]]

            # Agrupar por Mês e por Grupo
            evo_results = query.with_entities(
                func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao).label('mes'),
                group_field.label('grupo'),
                func.sum(models.FrotaCustos.custo_val).label('total'),
                func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('veiculos')
            ).filter(models.FrotaCustos.data_solicitacao != None, group_field.in_(top_names)).group_by(func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao), group_field).all()

            # Mapa de dados: { '2026-01': { 'REGIONAL A': 5000, 'REGIONAL B': 3000 } }
            data_map = {}
            for e in evo_results:
                m_key = e.mes
                g_key = str(e.grupo).upper()
                if m_key not in data_map: data_map[m_key] = {}
                val = float(e.total or 0) / int(e.veiculos or 1) if e.veiculos > 0 else 0
                data_map[m_key][g_key] = val

            # Gerar range de meses
            if periodo == "year":
                curr_date = max_date.replace(month=1, day=1)
            elif periodo == "last12":
                curr_date = max_date.replace(day=1)
                for _ in range(11): curr_date = (curr_date - datetime.timedelta(days=1)).replace(day=1)
            else:
                # Todo Histórico: respeitar o limite de 2022
                min_query = db.query(func.min(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date).scalar()
                if not min_query: curr_date = max_date.replace(month=1, day=1) if max_date else today
                else: 
                    min_d = min_query if not isinstance(min_query, str) else datetime.datetime.strptime(min_query, "%Y-%m-%d").date()
                    curr_date = max(min_d, min_allowed_date).replace(day=1)

            final_list = []
            while curr_date <= max_date.replace(day=1):
                m_key = curr_date.strftime("%Y-%m")
                m_label = curr_date.strftime("%m/%Y")
                row = {"name": m_label}
                # Garante que todos os top_names existam na row (mesmo que 0)
                for name in top_names:
                    row[name.upper()] = data_map.get(m_key, {}).get(name.upper(), 0.0)
                final_list.append(row)
                
                if curr_date.month == 12: curr_date = curr_date.replace(year=curr_date.year + 1, month=1)
                else: curr_date = curr_date.replace(month=curr_date.month + 1)
            
            return final_list

        else:
            # Lógica original (Uma única linha) com fill gaps
            evo_results = query.with_entities(
                func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao).label('mes'),
                func.sum(models.FrotaCustos.custo_val).label('total'),
                func.count(func.distinct(models.FrotaCustos.veiculo_id)).label('veiculos')
            ).filter(models.FrotaCustos.data_solicitacao != None).group_by(func.strftime('%Y-%m', models.FrotaCustos.data_solicitacao)).all()
            
            evo_map = {e.mes: (float(e.total or 0) / int(e.veiculos or 1) if e.veiculos > 0 else 0) for e in evo_results}

            # Gerar range
            if periodo == "year":
                curr_date = max_date.replace(month=1, day=1)
            elif periodo == "last12":
                curr_date = max_date.replace(day=1)
                for _ in range(11): curr_date = (curr_date - datetime.timedelta(days=1)).replace(day=1)
            else:
                min_query = db.query(func.min(models.FrotaCustos.data_solicitacao)).filter(models.FrotaCustos.data_solicitacao >= min_allowed_date).scalar()
                if not min_query: curr_date = max_date.replace(month=1, day=1)
                else: 
                    min_d = min_query if not isinstance(min_query, str) else datetime.datetime.strptime(min_query, "%Y-%m-%d").date()
                    curr_date = max(min_d, min_allowed_date).replace(day=1)

            final_list = []
            while curr_date <= max_date.replace(day=1):
                m_key = curr_date.strftime("%Y-%m")
                m_label = curr_date.strftime("%m/%Y")
                final_list.append({
                    "name": m_label,
                    "value": evo_map.get(m_key, 0.0)
                })
                if curr_date.month == 12: curr_date = curr_date.replace(year=curr_date.year + 1, month=1)
                else: curr_date = curr_date.replace(month=curr_date.month + 1)
            
            return final_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/indisponibilidade/dashboard")
def get_indisponibilidade_dashboard(periodo: str = "month", db: Session = Depends(get_db)):
    cache_key = f"indisponibilidade_dashboard_{periodo}"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        # Se for periodo = all, pega o mes_ref maximo, ou lista todos? O painel antigo era por mes específico.
        # Vamos pegar o mes mais recente (YyyyMm) se periodo='month', senão consolida tudo.
        all_months = db.query(models.Indisponibilidade.mes_ref).distinct().order_by(models.Indisponibilidade.mes_ref.desc()).all()
        available_months = [str(m[0]) for m in all_months if m[0]]
        max_mes = available_months[0] if available_months else None
        query = db.query(models.Indisponibilidade)

        if periodo == "month" and max_mes:
            query = query.filter(models.Indisponibilidade.mes_ref == max_mes)
        elif periodo != "all" and periodo in available_months:
            query = query.filter(models.Indisponibilidade.mes_ref == periodo)

        # Totais
        total_valor = query.with_entities(func.sum(models.Indisponibilidade.valor)).scalar() or 0.0
        total_itens = query.with_entities(func.count(models.Indisponibilidade.id)).scalar() or 0
        
        # Filtro de Pendentes
        query_pendentes = query.filter(models.Indisponibilidade.checado == False)
        pendente_valor = query_pendentes.with_entities(func.sum(models.Indisponibilidade.valor)).scalar() or 0.0
        pendente_itens = query_pendentes.with_entities(func.count(models.Indisponibilidade.id)).scalar() or 0
        
        tratado_valor = total_valor - pendente_valor
        tratado_itens = total_itens - pendente_itens
        
        aderencia = (tratado_itens / total_itens * 100) if total_itens > 0 else 100.0

        # Pareto por Tipo de Desvio
        tipos_group = query.with_entities(
            models.Indisponibilidade.tipo_desvio,
            func.sum(models.Indisponibilidade.valor).label('total')
        ).group_by(models.Indisponibilidade.tipo_desvio).order_by(func.sum(models.Indisponibilidade.valor).desc()).all()
        
        pareto = [{"Tipo": str(t.tipo_desvio).strip(), "Valor": float(t.total or 0)} for t in tipos_group if t.tipo_desvio]

        # Regionais e Matriz
        regs = query.with_entities(models.Indisponibilidade.regional).distinct().all()
        regionais_list = sorted([str(r.regional).strip() for r in regs if r.regional])
        
        tipos = query.with_entities(models.Indisponibilidade.tipo_desvio).distinct().all()
        tipos_list = sorted([str(t.tipo_desvio).strip() for t in tipos if t.tipo_desvio])
        
        # Matrix calculation (Optimized - Separated by Checado)
        matrix_raw = query.with_entities(
            models.Indisponibilidade.tipo_desvio,
            models.Indisponibilidade.regional,
            models.Indisponibilidade.checado,
            func.sum(models.Indisponibilidade.valor).label('valor'),
            func.sum(models.Indisponibilidade.tempo).label('tempo')
        ).group_by(models.Indisponibilidade.tipo_desvio, models.Indisponibilidade.regional, models.Indisponibilidade.checado).all()
        
        matrix_map = {}
        for m in matrix_raw:
            t = str(m.tipo_desvio).strip()
            r = str(m.regional).strip()
            if t not in matrix_map: matrix_map[t] = {}
            if r not in matrix_map[t]: matrix_map[t][r] = {"tratado": 0.0, "pendente": 0.0, "tempo_total": 0.0}
            
            val = float(m.valor or 0.0)
            if m.checado:
                matrix_map[t][r]["tratado"] += val
            else:
                matrix_map[t][r]["pendente"] += val
            
            matrix_map[t][r]["tempo_total"] += float(m.tempo or 0.0)
            
        matrix_data = []
        for tipo in tipos_list:
            row = {"Tipo": tipo}
            total_financeiro_tipo = 0.0
            total_tempo_tipo = 0.0
            for reg in regionais_list:
                cell = matrix_map.get(tipo, {}).get(reg, {"tratado": 0.0, "pendente": 0.0, "tempo_total": 0.0})
                row[reg] = cell
                total_financeiro_tipo += (cell["tratado"] + cell["pendente"])
                total_tempo_tipo += cell["tempo_total"]
            row["_total_impacto"] = total_financeiro_tipo
            row["_total_tempo"] = total_tempo_tipo
            matrix_data.append(row)
            
        # Classificar pelo menor valor financeiro total
        matrix_data.sort(key=lambda x: x["_total_impacto"])

        # Para manter compatibilidade com KPIs de regionais se necessário
        regionais_summary = []
        for reg in regionais_list:
            r_total = query.filter(models.Indisponibilidade.regional == reg).with_entities(func.sum(models.Indisponibilidade.valor)).scalar() or 0.0
            r_pend_val = query.filter(models.Indisponibilidade.regional == reg, models.Indisponibilidade.checado == False).with_entities(func.sum(models.Indisponibilidade.valor)).scalar() or 0.0
            
            regionais_summary.append({
                "Regional": reg,
                "TotalValor": float(r_total),
                "PendenteValor": float(r_pend_val),
                "TratadoValor": float(r_total - r_pend_val),
                "TratadoPct": ((r_total - r_pend_val) / r_total * 100) if r_total > 0 else 100.0
            })

        # Para pegar o timestamp do sync
        last_sync = db.query(models.SyncLog).filter_by(source_file="Pastas de Indisponibilidades").order_by(models.SyncLog.last_sync.desc()).first()
        file_ts = last_sync.last_sync.strftime("%d/%m/%Y %H:%M") if last_sync else "-"

        result = {
            "period": max_mes if max_mes else "All",
            "source_file": "Pastas de Indisponibilidades",
            "last_update": file_ts,
            "stats": {
                "total_valor": total_valor,
                "pendente_valor": pendente_valor,
                "total_itens": total_itens,
                "pendente_itens": pendente_itens,
                "aderencia": round(aderencia, 1)
            },
            "pareto": pareto[:20],
            "available_months": available_months,
            "regionais_list": regionais_list,
            "tipos_list": tipos_list,
            "matrix": matrix_data,
            "regionais": regionais_summary
        }
        api_cache.set(cache_key, result)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/logccm/dashboard")
def get_logccm_dashboard(db: Session = Depends(get_db)):
    cache_key = "logccm_dashboard"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "Logística CCM MB52").order_by(models.SyncLog.last_sync.desc()).first()
        updated_at = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/D"

        # 1. KPIs Globais via SQL (Otimizado)
        kpis = db.query(
            func.sum(models.LogCcmMb52.valor_virtual).label("virtual"),
            func.sum(models.LogCcmMb52.valor_fisico).label("fisico"),
            func.sum(case((models.LogCcmMb52.valor_fisico < 0, func.abs(models.LogCcmMb52.valor_fisico)), else_=0)).label("faltas"),
            func.sum(case((models.LogCcmMb52.valor_fisico > 0, models.LogCcmMb52.valor_fisico), else_=0)).label("sobras")
        ).first()

        kpis_globais = {
            "saldo_virtual": float(kpis.virtual or 0),
            "saldo_fisico": float(kpis.fisico or 0),
            "valor_faltas": float(kpis.faltas or 0),
            "valor_sobras": float(kpis.sobras or 0),
            "compensacao": 0.0
        }

        # 2. Resumo por Grupos via SQL (Otimizado - Reduz 35k loops para ~25 grupos)
        group_agg = db.query(
            models.LogCcmMb52.grupo,
            models.LogCcmMb52.grupo_nome,
            func.sum(case((models.LogCcmMb52.valor_fisico < 0, func.abs(models.LogCcmMb52.valor_fisico)), else_=0)).label("v_falta"),
            func.sum(case((models.LogCcmMb52.valor_fisico > 0, models.LogCcmMb52.valor_fisico), else_=0)).label("v_sobra"),
            func.sum(case((models.LogCcmMb52.valor_fisico_sem_pedalada < 0, func.abs(models.LogCcmMb52.valor_fisico_sem_pedalada)), else_=0)).label("v_falta_sem"),
            func.sum(case((models.LogCcmMb52.valor_fisico_sem_pedalada > 0, models.LogCcmMb52.valor_fisico_sem_pedalada), else_=0)).label("v_sobra_sem")
        ).group_by(models.LogCcmMb52.grupo, models.LogCcmMb52.grupo_nome).all()

        # Counts de itens por grupo
        counts_agg = db.query(
            models.LogCcmItem.grupo,
            models.LogCcmItem.tipo,
            func.count(models.LogCcmItem.id).label("total")
        ).group_by(models.LogCcmItem.grupo, models.LogCcmItem.tipo).all()

        counts_map = {}
        for c in counts_agg:
            if c.grupo not in counts_map: counts_map[c.grupo] = {"SOBRA": 0, "FALTA": 0}
            counts_map[c.grupo][c.tipo] = c.total

        resumo_grupos = []
        resumo_grupos_sem = []
        total_compensacao = 0.0
        SERIAL_KEYWORDS = ['TRAFO', 'REGULADOR', 'MEDIDOR']

        for g in group_agg:
            name_upper = str(g.grupo_nome or "").upper()
            is_serial = any(kw in name_upper for kw in SERIAL_KEYWORDS)
            
            # Com Pedalada
            comp = (float(g.v_sobra or 0) - float(g.v_falta or 0)) if not is_serial else -(float(g.v_falta or 0))
            total_compensacao += comp
            
            resumo_grupos.append({
                "grupo": g.grupo, "nome": g.grupo_nome, 
                "faltas": counts_map.get(g.grupo, {}).get("FALTA", 0),
                "sobras": counts_map.get(g.grupo, {}).get("SOBRA", 0),
                "valor_falta": float(g.v_falta or 0), "valor_sobra": float(g.v_sobra or 0),
                "compensacao": comp
            })

            # Sem Pedalada
            comp_sem = (float(g.v_sobra_sem or 0) - float(g.v_falta_sem or 0)) if not is_serial else -(float(g.v_falta_sem or 0))
            resumo_grupos_sem.append({
                "grupo": g.grupo, "nome": g.grupo_nome,
                "faltas": counts_map.get(g.grupo, {}).get("FALTA", 0),
                "sobras": counts_map.get(g.grupo, {}).get("SOBRA", 0),
                "valor_falta": float(g.v_falta_sem or 0), "valor_sobra": float(g.v_sobra_sem or 0),
                "compensacao": comp_sem
            })

        kpis_globais["compensacao"] = total_compensacao

        # 3. Listas Detalhadas (Processamento mais direto sem ORM)
        from sqlalchemy import select
        
        items_rows = db.execute(select(models.LogCcmItem.__table__)).mappings().all()
        faltas = [dict(r) for r in items_rows if r["tipo"] == "FALTA"]
        sobras = [dict(r) for r in items_rows if r["tipo"] == "SOBRA"]

        ruptura_rows = db.execute(select(models.LogCcmRuptura.__table__)).mappings().all()
        ruptura = [{
            "regional": r["regional"], "material": r["material"], "descricao": r["descricao"], 
            "grupo": r["grupo"], "grupo_nome": r["grupo_nome"], 
            "data_deslig": r["data_deslig"].strftime("%d/%m/%Y") if r["data_deslig"] else "", 
            "qtd_necessaria": r["qtd_necessaria"], "qtd_analisar": r["qtd_analisar"], 
            "saldo_fisico": r["saldo_fisico"], "saldo_sistema": r["saldo_sistema"], 
            "diagrama": r["diagrama"], "inventario": r["inventario"]
        } for r in ruptura_rows]

        serial_rows = db.execute(select(models.LogCcmSerial.__table__)).mappings().all()
        serializados = [{
            "regional": s["regional"], "serial": s["serial"], "material": s["material"], 
            "descricao": s["descricao"], "status": s["status"], "deposito": s["deposito"]
        } for s in serial_rows]

        result = {
            "source_file": "Logística CCM MB52",
            "last_update": updated_at,
            "kpis_globais": kpis_globais,
            "resumo_grupos": resumo_grupos,
            "resumo_grupos_sem_pedalada": resumo_grupos_sem,
            "faltas": faltas,
            "sobras": sobras,
            "ruptura": ruptura,
            "serializados": serializados
        }
        api_cache.set(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/apr/dashboard")
def get_apr_dashboard(sector: str = Query("CCM", description="Setor: CCM ou TURMAS"), periodo: str = Query("month"), db: Session = Depends(get_db)):
    cache_key = f"apr_dashboard_v2_{sector}_{periodo}"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        import datetime
        import pandas as pd
        sector = sector.upper()
        
        query = db.query(models.AprRecord).filter(models.AprRecord.sector == sector)
        records = query.all()
        
        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "APR Digital").order_by(models.SyncLog.last_sync.desc()).first()
        updated_at = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/D"
        
        if not records:
            return {"error": "Sem dados", "sector": sector}
            
        df = pd.DataFrame([{
            "data": r.data, "equipe": r.equipe, "setor": r.setor_name, 
            "notas": r.notas_exec, "digital": r.apr_digital, "efetividade": r.efetividade
        } for r in records])
        
        df['data'] = pd.to_datetime(df['data'])
        max_db_date = df['data'].max()
        
        # Aplicar Filtro de Período
        if periodo == "7d":
            df_filtered = df[df['data'] >= (max_db_date - datetime.timedelta(days=7))]
            period_label = "Últimos 7 Dias"
        elif periodo == "30d":
            df_filtered = df[df['data'] >= (max_db_date - datetime.timedelta(days=30))]
            period_label = "Últimos 30 Dias"
        elif periodo == "year":
            df_filtered = df[df['data'] >= max_db_date.replace(month=1, day=1)]
            period_label = "Este Ano"
        else: # month
            df_filtered = df[(df['data'].dt.month == max_db_date.month) & (df['data'].dt.year == max_db_date.year)]
            period_label = "Mês Atual"

        # Tentar buscar a meta do BD, senão usar default
        config = db.query(models.SystemConfig).filter(models.SystemConfig.key == "apr_meta").first()
        meta = float(config.value) if config else 98.0

        # --- Cálculo de Variação (Período Anterior) ---
        if periodo == "7d":
            start_prev = max_db_date - datetime.timedelta(days=14)
            end_prev = max_db_date - datetime.timedelta(days=7)
            df_prev = df[(df['data'] >= start_prev) & (df['data'] < end_prev)]
        elif periodo == "30d":
            start_prev = max_db_date - datetime.timedelta(days=60)
            end_prev = max_db_date - datetime.timedelta(days=30)
            df_prev = df[(df['data'] >= start_prev) & (df['data'] < end_prev)]
        elif periodo == "year":
            # Ano anterior
            start_prev = max_db_date.replace(year=max_db_date.year-1, month=1, day=1)
            end_prev = max_db_date.replace(month=1, day=1)
            df_prev = df[(df['data'] >= start_prev) & (df['data'] < end_prev)]
        else: # month
            # Mês anterior
            if max_db_date.month == 1:
                p_month, p_year = 12, max_db_date.year - 1
            else:
                p_month, p_year = max_db_date.month - 1, max_db_date.year
            df_prev = df[(df['data'].dt.month == p_month) & (df['data'].dt.year == p_year)]

        # Stats Período Anterior
        efet_prev = float(df_prev['efetividade'].mean() * 100) if not df_prev.empty else 0.0
        n_equipes_prev = df_prev['equipe'].nunique() if not df_prev.empty else 0
        fora_meta_prev = 0
        if not df_prev.empty:
            eq_stats_prev = df_prev.groupby('equipe')['efetividade'].mean()
            fora_meta_prev = int((eq_stats_prev < (meta/100)).sum())
        # ----------------------------------------------

        # KPIs no período filtrado
        efetividade_global = float(df_filtered['efetividade'].mean() * 100) if not df_filtered.empty else 0.0
        
        # Equipes fora da meta
        equipes_stats = df_filtered.groupby('equipe')['efetividade'].mean() if not df_filtered.empty else pd.Series()
        equipes_fora_meta = int((equipes_stats < (meta/100)).sum())

        daily_global = df_filtered.groupby('data')['efetividade'].mean() * 100
        labels_global = [d.strftime('%d/%m') for d in daily_global.index]
        values_global = [round(float(v), 1) for v in daily_global.values]

        insights = []
        if efetividade_global >= meta:
            insights.append({"type": "destaque", "text": f"Desempenho excelente: {efetividade_global:.1f}% de aderência global."})
        else:
            insights.append({"type": "preocupacao" if efetividade_global < 90 else "atencao", "text": f"Atenção: Aderência em {efetividade_global:.1f}%, abaixo da meta."})
        
        if equipes_fora_meta > 0:
            insights.append({"type": "atencao", "text": f"{equipes_fora_meta} equipes com aderência individual abaixo da meta ({meta}%)."})

        bases_breakdown = []
        if not df_filtered.empty:
            # Função para mapear equipe para regional se o setor estiver vazio
            def map_regional(row):
                setor = str(row['setor']).strip()
                if setor and setor != 'None' and setor != '':
                    return setor.upper()
                
                equipe = str(row['equipe']).upper()
                if 'ITR' in equipe: return 'ITARANA'
                if 'NVE' in equipe: return 'NOVA VENÉCIA'
                if 'VNO' in equipe: return 'VENDA NOVA DO IMIGRANTE'
                return 'OUTROS'

            df['regional_mapped'] = df.apply(map_regional, axis=1)
            df_filtered['regional_mapped'] = df_filtered.apply(map_regional, axis=1)
            
            # Agrupar por Regional Mapeada (Apenas as 3 solicitadas pelo usuário)
            for reg_name in ['ITARANA', 'NOVA VENÉCIA', 'VENDA NOVA DO IMIGRANTE']:
                reg_df = df_filtered[df_filtered['regional_mapped'] == reg_name]
                if reg_df.empty: continue
                
                stats_reg = reg_df.groupby('equipe').agg(
                    ef_media=('efetividade', 'mean')
                ).reset_index()
                
                avg = float(reg_df['efetividade'].mean() * 100)
                in_meta = int((stats_reg['ef_media'] >= (meta/100)).sum())
                total_teams = len(stats_reg)
                
                # Histórico Sparkline da Regional
                reg_evo = df[df['regional_mapped'] == reg_name].groupby('data')['efetividade'].mean() * 100
                sparkline = [
                    {"name": d.strftime('%d/%m'), "value": round(float(v), 1)} 
                    for d, v in reg_evo.tail(15).items()
                ]

                bases_breakdown.append({
                    "name": reg_name,
                    "last_result": round(avg, 1),
                    "efetividade_str": f"{avg:.1f}% ({period_label.upper()})",
                    "total_equipes": total_teams,
                    "equipes_meta": in_meta,
                    "equipes_fora": total_teams - in_meta,
                    "sparkline": sparkline,
                    "top_offenders": [
                        {"equipe": t['equipe'], "efetividade": round(t['ef_media'] * 100, 1)}
                        for _, t in stats_reg.sort_values(by='ef_media', ascending=True).iterrows()
                    ]
                })

        # Calcular Tops Globais (Filtrando apenas as 3 regionais foco)
        top_melhores = []
        top_piores = []
        target_regionals = ['ITARANA', 'NOVA VENÉCIA', 'VENDA NOVA DO IMIGRANTE']
        
        if not df_filtered.empty:
            df_tops = df_filtered[df_filtered['regional_mapped'].isin(target_regionals)]
            
            if not df_tops.empty:
                global_equipes = df_tops.groupby(['equipe', 'regional_mapped']).agg(
                    ef_media=('efetividade', 'mean')
                ).reset_index()
                
                top_melhores = [
                    {"equipe": r['equipe'], "regional": r['regional_mapped'], "efetividade": round(r['ef_media'] * 100, 1)}
                    for _, r in global_equipes.sort_values(by='ef_media', ascending=False).head(10).iterrows()
                ]
                
                top_piores = [
                    {"equipe": r['equipe'], "regional": r['regional_mapped'], "efetividade": round(r['ef_media'] * 100, 1)}
                    for _, r in global_equipes.sort_values(by='ef_media', ascending=True).head(10).iterrows()
                ]

        result = {
            "sector": sector,
            "period_label": period_label,
            "source_file": sync_log.source_file if sync_log else "APR Digital",
            "last_update": updated_at,
            "meta": meta,
            "stats": {
                "aderencia_global": round(efetividade_global, 1),
                "aderencia_var": round(efetividade_global - efet_prev, 1) if efet_prev > 0 else 0.0,
                "equipes_fora_meta": equipes_fora_meta,
                "equipes_fora_var": equipes_fora_meta - fora_meta_prev,
                "total_equipes": len(equipes_stats),
                "total_equipes_var": len(equipes_stats) - n_equipes_prev
            },
            "history": {"labels": labels_global, "values": values_global},
            "insights": insights,
            "top_melhores": top_melhores,
            "top_piores": top_piores,
            "bases_breakdown": sorted(bases_breakdown, key=lambda x: x['name'])
        }
        api_cache.set(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/saida_base/dashboard")
def get_saida_base_dashboard(view: str = "dia", db: Session = Depends(get_db)):
    cache_key = f"saida_base_dashboard_{view}"
    cached = api_cache.get(cache_key)
    if cached: return cached
    try:
        import pandas as pd
        import datetime
        import numpy as np
        
        records = db.query(models.SaidaBaseRecord).all()
        sync_log = db.query(models.SyncLog).filter(models.SyncLog.source_file == "Saída de Base CCM").order_by(models.SyncLog.last_sync.desc()).first()
        updated_at = sync_log.last_sync.strftime("%d/%m/%Y %H:%M") if sync_log else "N/D"

        if not records:
            return {"error": "Sem dados"}
            
        df = pd.DataFrame([{
            "DATA": r.data, 
            "REGIONAL": r.regional, 
            "EQUIPE": r.equipe, 
            "MOTIVO": r.motivo, 
            "TEMPO DE EMBARQUE": r.tempo_embarque, 
            "Custo Total": r.custo_total, 
            "OFENSOR": r.ofensor
        } for r in records])
        
        df['DATA'] = pd.to_datetime(df['DATA'])
        hoje = df['DATA'].max()
        meta = 30.0
        
        df_hoje = df[df['DATA'] == hoje]
        df_mes = df[df['DATA'].dt.month == hoje.month]
        data_7d = hoje - datetime.timedelta(days=7)
        data_14d = hoje - datetime.timedelta(days=14)
        data_30d = hoje - datetime.timedelta(days=30)
        
        # 1. KPIs
        media_dia = float(df_hoje['TEMPO DE EMBARQUE'].mean()) if df_hoje['TEMPO DE EMBARQUE'].notna().any() else 0.0
        media_mes = float(df_mes['TEMPO DE EMBARQUE'].mean()) if df_mes['TEMPO DE EMBARQUE'].notna().any() else 0.0
        
        eq_com_dado = int(df_mes['TEMPO DE EMBARQUE'].notna().sum())
        eq_atraso = int(len(df_mes[df_mes['TEMPO DE EMBARQUE'] > meta]))
        pct_conf = round((eq_com_dado - eq_atraso) / eq_com_dado * 100, 1) if eq_com_dado > 0 else 0.0

        # Custo projetado
        df_mes_agg = df_mes.groupby('DATA').agg(custo=('Custo Total', 'sum')).reset_index()
        dias_no_mes = df_mes_agg['DATA'].nunique()
        custo_mes = float(df_mes_agg['custo'].sum())
        custo_diario = custo_mes / dias_no_mes if dias_no_mes > 0 else 0
        dias_restantes = max(22 - dias_no_mes, 0)
        custo_proj = custo_mes + (custo_diario * dias_restantes)
        
        # 2. Bases Breakdown
        INVALID_REG = {'nan', 'none', 'n/a', ''}
        bases_data = []
        regionais = sorted([r for r in df['REGIONAL'].dropna().unique() if str(r).lower() not in INVALID_REG])
        for reg_name in regionais:
            df_reg = df[df['REGIONAL'] == reg_name]
            df_reg_hoje = df_reg[df_reg['DATA'] == hoje]
            
            teams_list = []
            for equipe_name in sorted(df_reg['EQUIPE'].unique()):
                df_eq = df_reg[df_reg['EQUIPE'] == equipe_name]
                last_row = df_eq.sort_values('DATA').iloc[-1]
                
                df_eq_7d = df_eq[df_eq['DATA'] >= data_7d]
                df_eq_30d = df_eq[df_eq['DATA'] >= data_30d]
                
                val_dia = last_row['TEMPO DE EMBARQUE']
                val_semana = df_eq_7d['TEMPO DE EMBARQUE'].mean() if df_eq_7d['TEMPO DE EMBARQUE'].notna().any() else np.nan
                val_mes = df_eq_30d['TEMPO DE EMBARQUE'].mean() if df_eq_30d['TEMPO DE EMBARQUE'].notna().any() else np.nan
                
                teams_list.append({
                    "equipe": str(equipe_name),
                    "valores": {
                        "dia": float(round(val_dia, 1)) if pd.notna(val_dia) else 0.0,
                        "semana": float(round(val_semana, 1)) if pd.notna(val_semana) else 0.0,
                        "mes": float(round(val_mes, 1)) if pd.notna(val_mes) else 0.0
                    }
                })

            trend_reg = df_reg.groupby('DATA')['TEMPO DE EMBARQUE'].mean().tail(7)
            
            if not df_reg_hoje.empty and df_reg_hoje['TEMPO DE EMBARQUE'].notna().any():
                last_val_reg = float(df_reg_hoje['TEMPO DE EMBARQUE'].mean())
            else:
                df_reg_valido = df_reg[df_reg['TEMPO DE EMBARQUE'].notna()]
                if not df_reg_valido.empty:
                    ultimo_dia = df_reg_valido['DATA'].max()
                    last_val_reg = float(df_reg_valido[df_reg_valido['DATA'] == ultimo_dia]['TEMPO DE EMBARQUE'].mean())
                else:
                    last_val_reg = 0.0

            bases_data.append({
                "name": str(reg_name),
                "last_result": float(round(last_val_reg, 1)),
                "total_equipes": int(len(teams_list)),
                "trend_labels": [d.strftime("%d/%m") for d in trend_reg.index],
                "trend_data": [float(round(v, 1)) if pd.notna(v) else 0.0 for v in trend_reg.values],
                "teams": teams_list
            })

        # 3. Ofensores Equipes (Mês atual para alinhar com os KPIs financeiros da regional)
        ofensores_df = df_mes.groupby(['EQUIPE', 'OFENSOR']).agg({
            'TEMPO DE EMBARQUE': 'mean',
            'Custo Total': 'sum'
        }).reset_index().sort_values('Custo Total', ascending=False)

        maiores_ofensores = []
        for _, row in ofensores_df.iterrows():
            maiores_ofensores.append({
                "equipe": str(row['EQUIPE']),
                "setor": str(row['OFENSOR']),
                "minutos": float(round(row['TEMPO DE EMBARQUE'], 1)) if pd.notna(row['TEMPO DE EMBARQUE']) else 0.0,
                "valor_rs": float(round(row['Custo Total'], 2))
            })

        # 4. Ofensores Setores
        setores_df = df_mes.groupby('OFENSOR').agg({
            'Custo Total': 'sum',
            'TEMPO DE EMBARQUE': 'mean'
        }).reset_index().sort_values('Custo Total', ascending=False)
        
        ofensores_setor = []
        for _, row in setores_df.iterrows():
            ofensores_setor.append({
                "label": str(row['OFENSOR']),
                "valor_rs": float(round(row['Custo Total'], 2)),
                "minutos": float(round(row['TEMPO DE EMBARQUE'], 1)) if pd.notna(row['TEMPO DE EMBARQUE']) else 0.0
            })

        # 5. Maiores Motivos
        motivos_df = df_mes.groupby('MOTIVO').agg({
            'EQUIPE': 'count',
            'Custo Total': 'sum'
        }).reset_index().rename(columns={'EQUIPE': 'count', 'Custo Total': 'valor_rs'})
        
        total_valor_motivos = float(motivos_df['valor_rs'].sum())
        motivos_df['percent_valor'] = (motivos_df['valor_rs'] / total_valor_motivos * 100).round(1) if total_valor_motivos > 0 else 0
        
        maiores_motivos = []
        for _, row in motivos_df.sort_values('valor_rs', ascending=False).iterrows():
            maiores_motivos.append({
                "label": str(row['MOTIVO']), 
                "count": int(row['count']), 
                "percent": float(row['percent_valor']), 
                "valor_rs": float(row['valor_rs'])
            })

        # 6. Evolução Semanal (Melhores e Piores)
        evolucao = []
        for equipe in df['EQUIPE'].unique():
            df_eq = df[df['EQUIPE'] == equipe]
            sem_atual = df_eq[(df_eq['DATA'] >= data_7d)]['TEMPO DE EMBARQUE']
            sem_anterior = df_eq[(df_eq['DATA'] >= data_14d) & (df_eq['DATA'] < data_7d)]['TEMPO DE EMBARQUE']
            
            m_atual = sem_atual.mean() if sem_atual.notna().any() else np.nan
            m_anterior = sem_anterior.mean() if sem_anterior.notna().any() else np.nan
            
            if pd.notna(m_atual) and pd.notna(m_anterior) and m_anterior > 0:
                var_pct = round(((m_atual - m_anterior) / m_anterior) * 100, 1)
                regional = str(df_eq['REGIONAL'].iloc[0])
                setor = str(df_eq['OFENSOR'].iloc[0])
                evolucao.append({
                    "equipe": str(equipe),
                    "setor": setor,
                    "regional": regional,
                    "semana_atual": float(round(m_atual, 1)),
                    "semana_anterior": float(round(m_anterior, 1)),
                    "variacao_pct": float(var_pct)
                })

        melhoraram = sorted([e for e in evolucao if e['variacao_pct'] < -5], key=lambda x: x['variacao_pct'])[:5]
        pioraram = sorted([e for e in evolucao if e['variacao_pct'] > 5], key=lambda x: x['variacao_pct'], reverse=True)[:5]

        # 7. Histórico Regional (Tendência)
        inicio_ano = pd.Timestamp(hoje.year, 1, 1)
        if view == "semana":
            # Agrupa por semana desde 01/01
            df_hist = df[df['DATA'] >= inicio_ano]
            df_hist = df_hist.copy()
            df_hist['PERIODO'] = df_hist['DATA'].dt.to_period('W').apply(lambda r: r.start_time)
            hist_raw = df_hist.groupby(['PERIODO', 'REGIONAL'])['TEMPO DE EMBARQUE'].mean().unstack().ffill()
            history_labels = [d.strftime("Sem %W") for d in hist_raw.index]
        elif view == "ano":
            # Agrupa por mês
            df_hist = df[df['DATA'].dt.year == hoje.year]
            df_hist = df_hist.copy()
            df_hist['PERIODO'] = df_hist['DATA'].dt.to_period('M').apply(lambda r: r.start_time)
            hist_raw = df_hist.groupby(['PERIODO', 'REGIONAL'])['TEMPO DE EMBARQUE'].mean().unstack().ffill()
            history_labels = [d.strftime("%b/%y") for d in hist_raw.index]
        else:
            # Dia: desde 01/01
            df_hist = df[df['DATA'] >= inicio_ano]
            hist_raw = df_hist.groupby(['DATA', 'REGIONAL'])['TEMPO DE EMBARQUE'].mean().unstack().ffill()
            history_labels = [d.strftime("%d/%m") for d in hist_raw.index]

        # Filtrar regional NAN do histórico
        INVALID_REGIONALS = {'NAN', 'NONE', 'N/A', ''}
        history_datasets = {
            str(col): [float(round(v, 1)) if pd.notna(v) else 0 for v in hist_raw[col].values]
            for col in hist_raw.columns
            if str(col).upper() not in INVALID_REGIONALS
        }

        # 8. Geração de Insights Inteligentes
        insights = []
        if custo_proj > 0:
            insights.append({
                "type": "preocupacao" if custo_proj > custo_mes * 1.5 else "atencao",
                "text": f"Risco projetado mensal: R$ {custo_proj:,.2f} versus R$ {custo_mes:,.2f} já executados."
            })
            
        if maiores_ofensores:
            pior_eq = maiores_ofensores[0]
            insights.append({
                "type": "atencao",
                "text": f"Maior Ofensor Geral: {pior_eq['equipe']} ({pior_eq['setor']}) com média de {pior_eq['minutos']:.1f}min (R$ {pior_eq['valor_rs']:,.2f})."
            })
            
        if ofensores_setor:
            pior_setor = ofensores_setor[0]
            insights.append({
                "type": "atencao",
                "text": f"Setor crítico: {pior_setor['label']} lidera custos em atrasos totalizando R$ {pior_setor['valor_rs']:,.2f} no período."
            })
            
        if media_mes > 0 and media_dia > 0:
            var_dia_x_mes = ((media_dia - media_mes) / media_mes) * 100
            if var_dia_x_mes > 5:
                insights.append({
                    "type": "preocupacao",
                    "text": f"Último dia operou com {media_dia:.1f}min, valor {var_dia_x_mes:.0f}% acima da média do mês atual."
                })
            elif var_dia_x_mes < -5:
                insights.append({
                    "type": "destaque",
                    "text": f"Média diária melhorou em {abs(var_dia_x_mes):.0f}% em relação ao agregado mensal."
                })

        result = {
            "last_update": updated_at, 
            "meta": meta,
            "period_label": f"Mês de {hoje.strftime('%B/%Y')} (Até {hoje.strftime('%d/%m')})",
            "stats": {
                "media_dia": round(media_dia, 1),
                "media_mes": round(media_mes, 1),
                "equipes_dentro_meta": eq_com_dado - eq_atraso,
                "total_equipes": eq_com_dado,
                "pct_conformidade": pct_conf,
                "ritmo_comparativo": round(media_mes - media_dia, 1) # pos -> mais rapido no dia que mês 
            },
            "custo_projetado": round(custo_proj, 2),
            "insights": insights,
            "maiores_ofensores_equipes": maiores_ofensores,
            "maiores_ofensores_setor": ofensores_setor,
            "maiores_motivos": maiores_motivos,
            "evolucao_semanal": {
                "melhoraram": melhoraram,
                "pioraram": pioraram
            },
            "history": {
                "labels": history_labels,
                "datasets": history_datasets
            },
            "bases_breakdown": bases_data
        }
        api_cache.set(cache_key, result)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/global/dashboard")
def get_global_dashboard(db: Session = Depends(get_db)):
    try:
        # Produtividade Global
        prod_val = db.query(func.avg(models.Produtividade.produtividade_pct)).scalar() or 0.0
        
        # Custos Frota (Geral para simplificar)
        frota_val = db.query(func.sum(models.FrotaCustos.custo_val)).scalar() or 0.0
        
        # 5S Média Global
        cinco_s_val = db.query(func.avg(models.Auditoria5S.conformidade_pct)).scalar() or 0.0
        
        # Indisponibilidade Pendente (Risco)
        indisp_val = db.query(func.sum(models.Indisponibilidade.valor)).filter(models.Indisponibilidade.checado == False).scalar() or 0.0

        return {
            "kpis": [
                {
                    "title": "Produtividade Turmas",
                    "value": f"{round(prod_val, 1)}%",
                    "trend": 2.1,
                    "icon": "Activity"
                },
                {
                    "title": "Custos Globais Frota",
                    "value": f"R$ {frota_val:,.0f}".replace(",", "."),
                    "trend": -5.4,
                    "trendLabel": "vs mês anterior",
                    "icon": "CarFront",
                    "invertedColors": True
                },
                {
                    "title": "Aderência Global 5S",
                    "value": f"{round(cinco_s_val, 1)}%",
                    "trend": 4.2,
                    "icon": "CheckSquare"
                },
                {
                    "title": "Risco Indisponibilidade",
                    "value": f"R$ {indisp_val:,.0f}".replace(",", "."),
                    "trend": -12.5,
                    "trendLabel": "vs mês anterior",
                    "icon": "Clock",
                    "invertedColors": True
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/sync/status", response_model=List[SyncLogResponse])
def get_sync_status(db: Session = Depends(get_db)):
    logs = db.query(models.SyncLog).order_by(models.SyncLog.last_sync.desc()).limit(10).all()
    return logs

# ======= ROUTE DE TRIGGER (Manual Force Sync) =======
@app.post("/api/v1/sync/run")
def force_sync(module: str = Query("all", description="Módulo a sincronizar: all, produtividade, 5s, rejeicoes, frota, indisponibilidade, logccm, apr, saida_base, turmas_rdo"), db: Session = Depends(get_db)):
    import sync_engine
    try:
        api_cache.clear()

        sync_map = {
            "produtividade": sync_engine.sync_produtividade,
            "5s": sync_engine.sync_5s,
            "rejeicoes": sync_engine.sync_rejeicoes,
            "frota": sync_engine.sync_frota,
            "indisponibilidade": sync_engine.sync_indisponibilidade,
            "logccm": sync_engine.sync_logccm,
            "apr": sync_engine.sync_apr,
            "saida_base": sync_engine.sync_saida_base,
            "produtividade_ccm": sync_engine.sync_produtividade_ccm,
        }

        module = module.lower().strip()

        if module == "all":
            sync_engine.run_all_syncs(db)
            synced = "todos os módulos"
        elif module == "turmas_rdo":
            # Turmas RDO reutiliza os dados de produtividade
            sync_engine.sync_produtividade(db)
            synced = "turmas_rdo (produtividade)"
        elif module in sync_map:
            sync_map[module](db)
            synced = module
        else:
            raise HTTPException(status_code=400, detail=f"Módulo desconhecido: {module}")

        return {"status": "success", "message": f"Sincronização de '{synced}' concluída. Cache resetado."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ======= CONFIGURATIONS ENDPOINTS =======

@app.get("/api/v1/config/get/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if not config:
        return {"key": key, "value": None}
    return {"key": config.key, "value": config.value}

@app.post("/api/v1/config/set")
def set_config(data: dict, db: Session = Depends(get_db)):
    key = data.get("key")
    value = str(data.get("value"))
    
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if config:
        config.value = value
    else:
        config = models.SystemConfig(key=key, value=value)
        db.add(config)
    
    db.commit()
    api_cache.clear() # Resetar cache ao mudar meta
    return {"status": "success", "key": key, "value": value}
