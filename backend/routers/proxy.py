from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import datetime

import models
from database import get_db

router = APIRouter(prefix="/api/v1/proxy", tags=["proxy_to_frontend"])

@router.get("/apr_records")
def list_apr_records(
    sector: Optional[str] = Query(None),
    data_gte: Optional[datetime.date] = Query(None, alias="data.gte"),
    data_lte: Optional[datetime.date] = Query(None, alias="data.lte"),
    select_fields: Optional[str] = Query("*", alias="select"),
    db: Session = Depends(get_db)
):
    query = select(models.AprRecord)
    if sector: query = query.filter(models.AprRecord.sector == sector)
    if data_gte: query = query.filter(models.AprRecord.data >= data_gte)
    if data_lte: query = query.filter(models.AprRecord.data <= data_lte)
    results = db.execute(query).scalars().all()
    output = []
    for r in results:
        data_dict = {
            "id": r.id, "sector": r.sector, "data": r.data.strftime("%Y-%m-%d") if r.data else None,
            "equipe": r.equipe, "setor_name": r.setor_name, "notas_exec": float(r.notas_exec) if r.notas_exec else 0.0,
            "apr_digital": float(r.apr_digital) if r.apr_digital else 0.0, "efetividade": float(r.efetividade) if r.efetividade else 0.0
        }
        if select_fields and select_fields != "*":
            keys = select_fields.split(",")
            output.append({k: data_dict.get(k) for k in keys if k in data_dict})
        else: output.append(data_dict)
    return output

@router.get("/saida_base_records")
def list_saida_base_records(
    regional: Optional[str] = Query(None),
    data_gte: Optional[datetime.date] = Query(None, alias="data.gte"),
    data_lte: Optional[datetime.date] = Query(None, alias="data.lte"),
    db: Session = Depends(get_db)
):
    query = select(models.SaidaBaseRecord)
    if regional: query = query.filter(models.SaidaBaseRecord.regional == regional)
    if data_gte: query = query.filter(models.SaidaBaseRecord.data >= data_gte)
    if data_lte: query = query.filter(models.SaidaBaseRecord.data <= data_lte)
    results = db.execute(query).scalars().all()
    output = []
    for r in results:
        output.append({
            "id": r.id, "data": r.data.strftime("%Y-%m-%d") if r.data else None,
            "regional": r.regional, "equipe": r.equipe, "motivo": r.motivo,
            "tempo_embarque": float(r.tempo_embarque) if r.tempo_embarque else 0.0,
            "custo_total": float(r.custo_total) if r.custo_total else 0.0, "ofensor": r.ofensor
        })
    return output

# --- Rotas específicas de LOGCCM ---

@router.get("/logccm_mb52")
def list_logccm_mb52(db: Session = Depends(get_db)):
    results = db.execute(select(models.LogCcmMb52)).scalars().all()
    return [{"id": r.id, "regional": r.regional, "material": r.material, "grupo": r.grupo, "grupo_nome": r.grupo_nome, "valor_virtual": r.valor_virtual, "valor_fisico": r.valor_fisico, "valor_fisico_sem_pedalada": r.valor_fisico_sem_pedalada} for r in results]

@router.get("/logccm_item")
def list_logccm_item(db: Session = Depends(get_db)):
    results = db.execute(select(models.LogCcmItem)).scalars().all()
    return [{"id": r.id, "regional": r.regional, "tipo": r.tipo, "material": r.material, "descricao": r.descricao, "grupo": r.grupo, "grupo_nome": r.grupo_nome, "deposito": r.deposito, "saldo": r.saldo, "valor": r.valor} for r in results]

@router.get("/logccm_ruptura")
def list_logccm_ruptura(db: Session = Depends(get_db)):
    results = db.execute(select(models.LogCcmRuptura)).scalars().all()
    return [{"id": r.id, "regional": r.regional, "material": r.material, "descricao": r.descricao, "grupo": r.grupo, "grupo_nome": r.grupo_nome, "data_deslig": r.data_deslig.strftime("%Y-%m-%d") if r.data_deslig else None, "qtd_necessaria": r.qtd_necessaria, "qtd_analisar": r.qtd_analisar, "saldo_fisico": r.saldo_fisico, "saldo_sistema": r.saldo_sistema, "diagrama": r.diagrama, "inventario": r.inventario} for r in results]

@router.get("/logccm_serial")
def list_logccm_serial(db: Session = Depends(get_db)):
    results = db.execute(select(models.LogCcmSerial)).scalars().all()
    return [{"id": r.id, "regional": r.regional, "serial": r.serial, "material": r.material, "descricao": r.descricao, "status": r.status, "deposito": r.deposito} for r in results]

# --- Rotas extras (Produtividade e 5S) ---

@router.get("/produtividade_records")
def list_produtividade_records(
    data_gte: Optional[datetime.date] = Query(None, alias="data.gte"),
    data_lte: Optional[datetime.date] = Query(None, alias="data.lte"),
    select_fields: Optional[str] = Query("*", alias="select"),
    db: Session = Depends(get_db)
):
    query = select(models.Produtividade)
    if data_gte: query = query.filter(models.Produtividade.data >= data_gte)
    if data_lte: query = query.filter(models.Produtividade.data <= data_lte)
    results = db.execute(query).scalars().all()
    output = []
    for r in results:
        data_dict = {
            "id": r.id, "data": r.data.strftime("%Y-%m-%d") if r.data else None,
            "equipe": r.equipe, "regional": r.regional, "csd": r.csd, "setor": r.setor,
            "produtividade_pct": float(r.produtividade_pct) if r.produtividade_pct else 0.0,
            "ociosidade_min": float(r.ociosidade_min) if r.ociosidade_min else 0.0,
            "desvios_min": float(r.desvios_min) if r.desvios_min else 0.0,
            "notas_executadas": r.notas_executadas, "notas_rejeitadas": r.notas_rejeitadas, "notas_interrompidas": r.notas_interrompidas
        }
        if select_fields and select_fields != "*":
            keys = select_fields.split(",")
            output.append({k: data_dict.get(k) for k in keys if k in data_dict})
        else: output.append(data_dict)
    return output

@router.get("/auditorias_5s")
def list_auditorias_5s(
    data_gte: Optional[datetime.date] = Query(None, alias="data_auditoria.gte"),
    data_lte: Optional[datetime.date] = Query(None, alias="data_auditoria.lte"),
    base: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = select(models.Auditoria5s)
    if data_gte: query = query.filter(models.Auditoria5s.data_auditoria >= data_gte)
    if data_lte: query = query.filter(models.Auditoria5s.data_auditoria <= data_lte)
    if base and base != "Todas": query = query.filter(models.Auditoria5s.base == base)
    results = db.execute(query).scalars().all()
    output = []
    for r in results:
        output.append({
            "id": r.id, "data_auditoria": r.data_auditoria.strftime("%Y-%m-%d") if r.data_auditoria else None,
            "inspetor": r.inspetor, "base": r.base, "local_auditado": r.local_auditado,
            "nota_1s": float(r.nota_1s) if r.nota_1s else 0.0, "nota_2s": float(r.nota_2s) if r.nota_2s else 0.0,
            "nota_3s": float(r.nota_3s) if r.nota_3s else 0.0, "nota_4s": float(r.nota_4s) if r.nota_4s else 0.0,
            "nota_5s": float(r.nota_5s) if r.nota_5s else 0.0, 
            "conformidade_pct": float(r.conformidade_pct) if r.conformidade_pct else 0.0
        })
    return output

@router.get("/system_configs")
def list_system_configs(
    key: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = select(models.SystemConfig)
    if key: query = query.filter(models.SystemConfig.key == key)
    results = db.execute(query).scalars().all()
    output = []
    for r in results:
        output.append({"key": r.key, "value": r.value})
    return output
