import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
import config
import os
import tempfile
import shutil
import datetime
import subprocess
import sys
from utils.normalization import normalize_regional, normalize_sector, normalize_base

Base.metadata.create_all(bind=engine)

def log_sync(db: Session, file_name: str, status: str, records: int):
    log = models.SyncLog(source_file=file_name, status=status, records_processed=records)
    db.add(log)
    db.commit()

def sync_produtividade(db: Session):
    print("[SYNC] Iniciando sincronização da Produtividade (TURMAS)...")
    file_path = config.FILE_PATHS.get("produtividade")
    if not file_path or not os.path.exists(file_path):
        print(f"[SYNC ERROR] Arquivo de Produtividade não encontrado: {file_path}")
        return

    temp_path = None
    try:
        # Usar tempfile previne travar a planilha original dos Analistas/Robôs.
        fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        shutil.copy2(file_path, temp_path)

        # Ler Planilha com OpenPyXL
        df = pd.read_excel(temp_path, engine='openpyxl')
        
        # Limpar apenas os registros que não são CCM (deixar para o sync_produtividade_ccm)
        db.query(models.Produtividade).filter(models.Produtividade.setor != 'DEPC-CCM').delete()

        records_inserted = 0
        
        # Tratamento de Nulos
        df = df.fillna(0)

        # Inserção em massa (List comprehension -> Bulk Save)
        from sqlalchemy import insert
        
        data_to_insert = []
        for index, row in df.iterrows():
            try:
                # Converter data 
                ano = int(row.get('Ano', 2026))
                mes = int(row.get('Mês', 1))
                dia = int(row.get('Dia', 1))
                d_date = datetime.date(ano, mes, dia)

                data_to_insert.append({
                    "equipe": str(row.get('Equipe', '')),
                    "tipo_equipe": str(row.get('Tipo Equipe', '')),
                    "setor": str(row.get('Setor', '')),
                    "data": d_date,
                    "csd": str(row.get('CSD', '')),
                    "ocupacao": float(row.get('Ocupação', 0)),
                    "produtividade_pct": float(row.get('Produtividade (%)', 0)),
                    "eficiencia_pct": float(row.get('Eficiência (%)', 0)),
                    "eficacia_pct": float(row.get('Eficácia (%)', 0)),
                    "notas_executadas": float(row.get('Notas Executadas', 0)),
                    "notas_interrompidas": float(row.get('Notas Interrompidas', 0)),
                    "notas_rejeitadas": float(row.get('Notas Rejeitadas', 0)),
                    "ociosidade_min": float(row.get('Ociosidade (min)', 0)),
                    "desvios_min": float(row.get('Desvios (min)', 0)),
                    "deslocamento_min": float(row.get('HHP Deslocamento (min)', 0)),
                    "hhr_min": float(row.get('HHR (min)', 0)),
                    "hhp_min": float(row.get('HHP (min)', 0))
                })
                records_inserted += 1
            except Exception as e:
                pass # Pular linha corrompida silenciosamente se ocorrer

        if data_to_insert:    
            db.execute(insert(models.Produtividade), data_to_insert)
            db.commit()

        log_sync(db, "STC_DataProd_export.xlsx", "SUCCESS", records_inserted)
        print(f"[SYNC] {records_inserted} registros inseridos com sucesso em Produtividade.")

    except Exception as e:
        print(f"[SYNC ERROR] {e}")
        db.rollback()
        log_sync(db, "STC_DataProd_export.xlsx", f"ERROR: {str(e)[:50]}", 0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

def sync_produtividade_ccm(db: Session):
    print("[SYNC] Iniciando sincronização da Produtividade (CCM)...")
    file_path = config.FILE_PATHS.get("produtividade_ccm")
    if not file_path or not os.path.exists(file_path):
        print(f"[SYNC ERROR] Arquivo de Produtividade CCM não encontrado: {file_path}")
        return

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        shutil.copy2(file_path, temp_path)

        df = pd.read_excel(temp_path, sheet_name='Sheet1', engine='openpyxl')
        
        # Limpar apenas registros CCM
        db.query(models.Produtividade).filter(models.Produtividade.setor == 'DEPC-CCM').delete()

        records_inserted = 0
        df = df.fillna(0)
        from sqlalchemy import insert
        
        data_to_insert = []
        for index, row in df.iterrows():
            try:
                # A data já vem no formato Timestamp no Sheet1
                raw_date = row.get('data')
                if isinstance(raw_date, pd.Timestamp):
                    d_date = raw_date.date()
                else:
                    # Fallback construct date
                    ano = int(row.get('Início Escala - Ano', 2026))
                    mes_str = str(row.get('Início Escala - Mês', 'janeiro')).lower()
                    meses = {
                        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
                        'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
                        'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
                    }
                    mes = meses.get(mes_str, 1)
                    dia = int(row.get('Início Escala - Dia', 1))
                    d_date = datetime.date(ano, mes, dia)

                def clean_val(v):
                    import math
                    try:
                        val = float(v)
                        return val if not math.isnan(val) else 0.0
                    except:
                        return 0.0

                ociosidade = clean_val(row.get('Soma de Ociosidade (min)', 0))
                saida_base = clean_val(row.get('Soma de Saída de Base (min)', 0))
                retorno_base = clean_val(row.get('Soma de Retorno à Base (min)', 0))
                hora_extra = clean_val(row.get('Soma de Hora Extra (min)', 0))

                # Formula de Produtividade CCM (Baseada em Disponibilidade de 480 min)
                prod_pct = round(max(0, 100 * (1 - (ociosidade / 480))), 1)

                data_to_insert.append({
                    "equipe": str(row.get('Equipe', '')),
                    "tipo_equipe": "CCM",
                    "setor": "DEPC-CCM",
                    "data": d_date,
                    "csd": str(row.get('Base Equipe', '')),
                    "ocupacao": 100.0,
                    "produtividade_pct": prod_pct,
                    "eficiencia_pct": prod_pct,
                    "eficacia_pct": 100.0 if ociosidade < 60 else 80.0,
                    "notas_executadas": clean_val(row.get('Soma de Notas Executadas', 0)),
                    "notas_interrompidas": clean_val(row.get('Soma de Notas Interrompidas', 0)),
                    "notas_rejeitadas": clean_val(row.get('Soma de Notas Rejeitadas', 0)),
                    "ociosidade_min": ociosidade,
                    "saida_base_min": saida_base,
                    "retorno_base_min": retorno_base,
                    "hora_extra_min": hora_extra,
                    "desvios_min": clean_val(row.get('Soma de Atraso Entrada (min)', 0)) + clean_val(row.get('Soma de Antecipação Saída (min)', 0)),
                    "deslocamento_min": saida_base + retorno_base,
                    "hhr_min": 0.0,
                    "hhp_min": 480.0
                })
                records_inserted += 1
            except Exception as e:
                pass

        if data_to_insert:    
            db.execute(insert(models.Produtividade), data_to_insert)
            db.commit()

        log_sync(db, "Dados gerais por dia e por equipe - CCM.xlsx", "SUCCESS", records_inserted)
        print(f"[SYNC] {records_inserted} registros inseridos com sucesso em Produtividade CCM.")

    except Exception as e:
        print(f"[SYNC ERROR CCM] {e}")
        db.rollback()
        log_sync(db, "Dados gerais por dia e por equipe - CCM.xlsx", f"ERROR: {str(e)[:50]}", 0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

def sync_5s(db: Session):
    print("[SYNC] Iniciando sincronização do relatorio 5S...")
    
    scripts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts", "s5")
    ps_download = os.path.join(scripts_dir, "download_s5.ps1")
    py_processor = os.path.join(scripts_dir, "processor.py")

    # 1. Tentar Baixar Novos Dados (Opcional se falhar, continua com os que tem)
    if os.path.exists(ps_download):
        try:
            print("[SYNC 5S] Executando download do SharePoint...")
            subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", ps_download], check=False)
        except Exception as e:
            print(f"[SYNC 5S WARNING] Falha no download PnP: {e}")

    # 2. Consolidar Dados (Transforma Raw -> Relatorio_Consolidado_5S.csv)
    if os.path.exists(py_processor):
        try:
            print("[SYNC 5S] Executando processamento de consolidação...")
            subprocess.run([sys.executable, py_processor], check=True)
        except Exception as e:
            print(f"[SYNC 5S ERROR] Falha na consolidação: {e}")
            # Se a consolidação falhou e não temos o arquivo, abortamos
    
    file_path = config.FILE_PATHS.get("5s_consolidado")
    if not file_path or not os.path.exists(file_path):
        print(f"[SYNC ERROR] Arquivo 5S consolidado não encontrado em: {file_path}")
        return

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".csv")
        os.close(fd)
        shutil.copy2(file_path, temp_path)

        df = pd.read_csv(temp_path, encoding='utf-8')
        db.query(models.Auditoria5S).delete()

        records_inserted = 0
        df = df.fillna(0)
        from sqlalchemy import insert
        
        data_to_insert = []
        for index, row in df.iterrows():
            try:
                # O formato da data no CSV era: 05/06/2024 11:24:00
                raw_date = str(row.get('Data', ''))
                d_date = None
                if raw_date and raw_date != '0':
                    try:
                        d_date = datetime.datetime.strptime(raw_date.split(' ')[0], "%d/%m/%Y").date()
                    except:
                        pass
                if not d_date:
                     d_date = datetime.date.today()
                     
                def safe_float(val):
                    try: return float(val)
                    except: return 0.0

                data_to_insert.append({
                    "data_auditoria": d_date,
                    "base": normalize_base(row.get('Base', '')),
                    "inspetor": str(row.get('Inspetor', '')),
                    "local_auditado": str(row.get('Local_Auditado', '')),
                    "tipo_auditoria": str(row.get('Tipo_Auditoria', '')),
                    "conformidade_pct": safe_float(row.get('Conformidade_%', 0)),
                    "nota_1s": safe_float(row.get('Nota_1S', 0)),
                    "nota_2s": safe_float(row.get('Nota_2S', 0)),
                    "nota_3s": safe_float(row.get('Nota_3S', 0)),
                    "nota_4s": safe_float(row.get('Nota_4S', 0)),
                    "nota_5s": safe_float(row.get('Nota_5S', 0)),
                })
                records_inserted += 1
            except Exception:
                pass

        if data_to_insert:    
            db.execute(insert(models.Auditoria5S), data_to_insert)
            db.commit()

        log_sync(db, "Relatorio_Consolidado_5S.csv", "SUCCESS", records_inserted)
        print(f"[SYNC] {records_inserted} registros inseridos com sucesso em 5S.")

    except Exception as e:
        print(f"[SYNC ERROR 5S] {e}")
        db.rollback()
        log_sync(db, "Relatorio_Consolidado_5S.csv", f"ERROR: {str(e)[:50]}", 0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

def sync_rejeicoes(db: Session):
    print("[SYNC] Iniciando sincronização das Rejeições...")
    file_path = config.FILE_PATHS.get("rejeicoes")
    if not file_path or not os.path.exists(file_path):
        print(f"[SYNC ERROR] Arquivo de Rejeições não encontrado: {file_path}")
        return

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        shutil.copy2(file_path, temp_path)

        abas_regionais = {
            'NVE': 'Nova Venécia', 
            'ITA': 'Itarana', 
            'VNI': 'Venda Nova'
        }
        
        db.query(models.Rejeicao).delete()

        records_inserted = 0
        from sqlalchemy import insert
        
        xl = pd.ExcelFile(temp_path, engine='openpyxl')
        data_to_insert = []
        
        for sheet_name in xl.sheet_names:
            if sheet_name in abas_regionais:
                # Descobrindo o skiprows real
                df_temp = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=10)
                header_idx = 0
                for idx, row in df_temp.iterrows():
                    row_str = ' '.join([str(x).upper() for x in row.values if pd.notna(x)])
                    if 'EQUIPE' in row_str and 'NOTA' in row_str:
                        header_idx = idx
                        break

                df = pd.read_excel(xl, sheet_name=sheet_name, skiprows=header_idx)
                
                if 'Equipe' not in df.columns or 'Data Conclusão' not in df.columns:
                    continue
                
                df = df.dropna(subset=['Equipe', 'Data Conclusão'])
                df = df.fillna('')
                
                for _, row in df.iterrows():
                    try:
                        dt_conclusao = None
                        raw_date = row.get('Data Conclusão')
                        if isinstance(raw_date, pd.Timestamp):
                            dt_conclusao = raw_date.date()
                        elif isinstance(raw_date, str) and raw_date:
                            dt_conclusao = pd.to_datetime(raw_date, errors='coerce').date()
                        elif hasattr(raw_date, 'date'):
                            dt_conclusao = raw_date.date()

                        if not dt_conclusao or pd.isna(dt_conclusao):
                            continue 
                        
                        num_rej_val = row.get('Num Rejeições', 1)
                        if isinstance(num_rej_val, str) and not num_rej_val.isdigit():
                            num_rej_val = 1
                        else:
                            num_rej_val = int(num_rej_val) if num_rej_val else 1
                            
                        # Lógica para "Apenas 1 Nome" e Coluna U
                        # Column U is Index 20
                        # Column for Status in VNI is Index 23
                        # Column for Eletricista in VNI is Index 27
                        
                        raw_analista = str(row.iloc[20]).strip() if len(row) > 20 else ""
                        if not raw_analista or raw_analista.lower() in ['nan', 'none', '0', '0.0']:
                            # Fallback para o mapa de regionais se a coluna U estiver vazia
                            regional_analistas = {
                                'Nova Venécia': 'TAYLA',
                                'Itarana': 'LARISSA',
                                'Venda Nova': 'MAYARA'
                            }
                            analista_nome = regional_analistas.get(abas_regionais[sheet_name], "INDEFINIDO")
                        else:
                            # Pega apenas o primeiro nome
                            analista_nome = raw_analista.split()[0].upper()

                        # Status de tratativa (Procedente/Improcedente)
                        # No VNI está na col 23. No NVE/ITA pode estar em 'Backoffice EM' (col 11/14)
                        raw_status = ""
                        if sheet_name == 'VNI' and len(row) > 23:
                            raw_status = str(row.iloc[23]).strip()
                        else:
                            raw_status = str(row.get('Backoffice EM', '')).strip()
                        
                        status_val = raw_status.title()
                        if status_val.lower() in ['nan', 'none', '', 'false', '0']:
                            status_val = "Em Análise"
                        
                        # Eletricista - "Apenas 1 Nome"
                        # No VNI está na col 27. Fallback para Equipe.
                        raw_eletricista = ""
                        if sheet_name == 'VNI' and len(row) > 27:
                            raw_eletricista = str(row.iloc[27]).strip()
                        
                        if not raw_eletricista or raw_eletricista.lower() in ['nan', 'none', '']:
                            raw_eletricista = str(row.get('Equipe', ''))
                        
                        eletricista_nome = raw_eletricista.split()[0].upper()

                        data_to_insert.append({
                            "regional": normalize_regional(abas_regionais[sheet_name]),
                            "setor": normalize_sector(row.get('Setor', '')),
                            "nota": str(row.get('Nota', '')).strip(),
                            "tipo": str(row.get('Tipo', '')).strip(),
                            "equipe": str(row.get('Equipe', '')).strip(),
                            "descricao": str(row.get('Descrição', '')).strip(),
                            "cidade": str(row.get('Cidade', '')).strip(),
                            "codigo_motivo": str(row.get('Código Motivo', '')).strip(),
                            "motivo": str(row.get('Motivo', '')).strip()[:200],
                            "backoffice_em": status_val, # Mantendo para compatibilidade
                            "status": status_val,
                            "analista": analista_nome,
                            "eletricista": eletricista_nome,
                            "telefone_contato": str(row.get('Contato Cliente', '')).strip()[:50] if 'Contato Cliente' in row else '',
                            "data_conclusao": dt_conclusao,
                            "num_rejeicoes": num_rej_val
                        })
                        records_inserted += 1
                    except Exception as loop_e:
                        pass
        
        if data_to_insert:    
            chunk_size = 500
            for i in range(0, len(data_to_insert), chunk_size):
                chunk = data_to_insert[i:i+chunk_size]
                db.execute(insert(models.Rejeicao), chunk)
            db.commit()

        log_sync(db, "Controle de Rejeições - Versão 2.xlsx", "SUCCESS", records_inserted)
        print(f"[SYNC] {records_inserted} registros inseridos com sucesso em Rejeições.")

    except Exception as e:
        print(f"[SYNC ERROR REJEICOES] {e}")
        db.rollback()
        log_sync(db, "Controle de Rejeições - Versão 2.xlsx", f"ERROR: {str(e)[:50]}", 0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

def __clean_currency(val):
    if pd.isna(val): return 0.0
    if isinstance(val, (int, float)): return float(val)
    if isinstance(val, str):
        val = val.replace('R$', '').strip().replace('.', '').replace(',', '.')
        try: return float(val)
        except ValueError: return 0.0
    return 0.0

def sync_frota(db: Session):
    print("[SYNC] Iniciando sincronização da Frota...")
    file_path = config.FILE_PATHS.get("frota")
    if not file_path or not os.path.exists(file_path):
        print(f"[SYNC ERROR] Arquivo de Frota não encontrado: {file_path}")
        return

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        shutil.copy2(file_path, temp_path)
        
        # Lendo ABA de Custos
        df_custos = pd.read_excel(temp_path, header=1, sheet_name='FROTA')
        if df_custos.empty: return
        df_custos.columns = [str(c).strip().upper() for c in df_custos.columns]

        # Lendo ABA de BD para JOIN
        try:
            df_bd = pd.read_excel(temp_path, header=0, sheet_name='Frota BD')
            df_bd.columns = [str(c).strip().upper() for c in df_bd.columns]
        except Exception:
            df_bd = pd.DataFrame()

        if 'PLACA' not in df_custos.columns:
             print("[SYNC ERROR] Coluna PLACA não encontrada na aba FROTA.")
             return
             
        df_custos['PLACA_KEY'] = df_custos['PLACA'].astype(str).str.strip().str.upper()
        
        if not df_bd.empty and 'PLACA' in df_bd.columns:
            df_bd['PLACA_KEY'] = df_bd['PLACA'].astype(str).str.strip().str.upper()
            cols_bd = ['PLACA_KEY', 'MODELO', 'TIPO', 'MARCA', 'REGIONAL', 'SETOR', 'ANO', 'FROTA']
            cols_bd = [c for c in cols_bd if c in df_bd.columns]
            
            df_bd_subset = df_bd[cols_bd].rename(columns={
                'MODELO': 'MODELO_FROTA', 'TIPO': 'TIPO_FROTA', 'MARCA': 'MARCA_FROTA',
                'FROTA': 'FROTA_NUM', 'REGIONAL': 'REGIONAL_FROTA', 'SETOR': 'SETOR_FROTA', 'ANO': 'ANO_VEICULO'
            })
            df = pd.merge(df_custos, df_bd_subset, on='PLACA_KEY', how='left')
        else:
            df = df_custos
            df['MODELO_FROTA'] = df.get('MODELO', 'N/A')
            df['TIPO_FROTA'] = df.get('TIPO EQUIPAM.', 'N/A')
            df['FROTA_NUM'] = df.get('FROTA', 'N/A')
            df['ANO_VEICULO'] = df.get('ANO', 0)

        col_custo = 'TOTAL ORÇAMENTO' if 'TOTAL ORÇAMENTO' in df.columns else 'VALOR TOTAL'
        if col_custo in df.columns:
             df['CUSTO_VAL'] = df[col_custo].apply(__clean_currency)
        else:
             df['CUSTO_VAL'] = 0.0
             
        df = df[df['PLACA_KEY'].notna()]
        
        col_data = 'DT SOLICITAÇÃO' if 'DT SOLICITAÇÃO' in df.columns else 'DT AUTORIZAÇÃO'
        if col_data in df.columns:
            df['DATA'] = pd.to_datetime(df[col_data], errors='coerce')
        else:
            df['DATA'] = pd.NaT

        key_veiculo = 'FROTA_NUM' if 'FROTA_NUM' in df.columns else 'PLACA_KEY'
        df['VEICULO_ID'] = df[key_veiculo].fillna(df['PLACA_KEY'])
        
        keywords_prev = ['REVISAO', 'PREVENTIVA', 'OLEO', 'FILTRO', 'LAVAGEM', 'PNEU', 'BALANCEAMENTO', 'ALINHAMENTO', 'REVISÃO']
        def classify_maint(item_name):
            if not isinstance(item_name, str): return 'CORRETIVA'
            if any(k in item_name.upper() for k in keywords_prev):
                return 'PREVENTIVA'
            return 'CORRETIVA'

        if 'NOME DO ITEM' in df.columns:
            df['TIPO_MANUTENCAO'] = df['NOME DO ITEM'].apply(classify_maint)
        else:
             df['TIPO_MANUTENCAO'] = 'CORRETIVA'

        db.query(models.FrotaCustos).delete()

        records_inserted = 0
        from sqlalchemy import insert
        data_to_insert = []
        
        for _, row in df.iterrows():
            if pd.isna(row['DATA']):
                continue
            
            val_ano = row.get('ANO_VEICULO', 0)
            try:
                val_ano = int(val_ano)
            except:
                val_ano = 0

            data_to_insert.append({
                "placa": str(row['PLACA_KEY']),
                "veiculo_id": str(row['VEICULO_ID']),
                "data_solicitacao": row['DATA'].date(),
                "modelo": str(row.get('MODELO_FROTA', '')).strip(),
                "marca": str(row.get('MARCA_FROTA', '')).strip(),
                "tipo": str(row.get('TIPO_FROTA', '')).strip(),
                "ano_veiculo": val_ano,
                "setor": normalize_sector(row.get('SETOR_FROTA', row.get('SETOR', ''))),
                "regional": normalize_regional(row.get('REGIONAL_FROTA', row.get('REGIONAL', ''))),
                "fornecedor": str(row.get('FORNECEDOR', 'N/D')).strip(),
                "nome_servico": str(row.get('NOME DO ITEM', 'N/D')).strip(),
                "tipo_manutencao": str(row['TIPO_MANUTENCAO']),
                "custo_val": float(row['CUSTO_VAL'])
            })
            records_inserted += 1
            
        if data_to_insert:    
            chunk_size = 500
            for i in range(0, len(data_to_insert), chunk_size):
                chunk = data_to_insert[i:i+chunk_size]
                db.execute(insert(models.FrotaCustos), chunk)
            db.commit()

        log_sync(db, "FROTA 2025.xlsx", "SUCCESS", records_inserted)
        print(f"[SYNC] {records_inserted} registros inseridos com sucesso em FrotaCustos.")

    except Exception as e:
        print(f"[SYNC ERROR FROTA] {e}")
        db.rollback()
        log_sync(db, "FROTA 2025.xlsx", f"ERROR: {str(e)[:50]}", 0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass

def sync_indisponibilidade(db: Session):
    print("[SYNC] Iniciando sincronização de Indisponibilidades...")
    base_dir = config.INDISP_ROOT
    if not base_dir or not os.path.exists(base_dir):
        print(f"[SYNC ERROR] Diretório base de Indisponibilidade não encontrado: {base_dir}")
        return

    # Deletar dados antigos para evitar duplicidade
    db.query(models.Indisponibilidade).delete()
    
    total_inserted = 0
    from sqlalchemy import insert

    # Percorrer todas as pastas (YYYYMM)
    try:
        for folder_name in os.listdir(base_dir):
            folder_path = os.path.join(base_dir, folder_name)
            if not os.path.isdir(folder_path) or not folder_name.isdigit():
                continue
                
            mes_ref = folder_name # ex: 202602
            
            # Localizar Arquivos `.xlsm`
            files = [f for f in os.listdir(folder_path) if f.endswith('.xlsm')]
            for f in files:
                file_path = os.path.join(folder_path, f)
                
                # Definir Regional baseada no Nome do Arquivo
                # Padrão: "Desvios - AlgumaCoisa - NOME_REGIONAL.xlsm" ou algo parecido
                regional_name = "N/D"
                parts = f.replace('.xlsm', '').split('-')
                if len(parts) >= 2:
                    regional_name = parts[-1].strip().upper()
                else:
                    regional_name = f.replace('.xlsm', '').strip().upper()

                temp_path = None
                try:
                    fd, temp_path = tempfile.mkstemp(suffix=".xlsm")
                    os.close(fd)
                    shutil.copy2(file_path, temp_path)
                    
                    # Tentar descobrir o Header ('Checado?') verificando as primeiras linhas
                    df_scout = pd.read_excel(temp_path, sheet_name="Desvios", engine="openpyxl", header=None, nrows=20)
                    header_row_idx = None
                    for idx, row in df_scout.iterrows():
                        row_vals = [str(x).strip() for x in row.values]
                        if "Checado?" in row_vals or "Indisponibilidade" in row_vals:
                            header_row_idx = idx
                            break
                            
                    if header_row_idx is None:
                        continue # Pula este arquivo pois não tem a estrutura padrão
                        
                    df = pd.read_excel(temp_path, sheet_name="Desvios", engine="openpyxl", header=header_row_idx)
                    df.columns = df.columns.astype(str).str.strip()
                    
                    if "Indisponibilidade" not in df.columns:
                        continue
                        
                    df["Indisponibilidade"] = pd.to_numeric(df["Indisponibilidade"], errors='coerce').fillna(0)
                    
                    data_to_insert = []
                    for _, row in df.iterrows():
                        val = float(row["Indisponibilidade"])
                        if val == 0: continue # Ignora zerados
                        
                        checado = False
                        if "Checado?" in df.columns:
                            c_val = str(row["Checado?"]).strip().upper()
                            if c_val == "SIM": checado = True
                            
                        tipo_desvio = "OUTROS"
                        if "Tipo" in df.columns:
                            tipo_desvio = str(row["Tipo"]).strip().upper()
                            
                        tempo_val = val # A coluna 'Indisponibilidade' contém os minutos centesimais
                            
                        data_to_insert.append({
                            "mes_ref": mes_ref,
                            "regional": regional_name,
                            "tipo_desvio": tipo_desvio,
                            "checado": checado,
                            "valor": val,
                            "tempo": tempo_val
                        })
                        total_inserted += 1
                        
                    if data_to_insert:
                        # Batch insert chunk by chunk
                        chunk_size = 500
                        for i in range(0, len(data_to_insert), chunk_size):
                            chunk = data_to_insert[i:i+chunk_size]
                            db.execute(insert(models.Indisponibilidade), chunk)
                        db.commit()
                        
                except Exception as ex_file:
                    print(f"[SYNC WARNING] Erro ao ler {f}: {ex_file}")
                finally:
                    if temp_path and os.path.exists(temp_path):
                        try: os.remove(temp_path)
                        except: pass

        log_sync(db, "Pastas de Indisponibilidades", "SUCCESS", total_inserted)
        print(f"[SYNC] {total_inserted} registros (desvios) extraídos de Indisponibilidade.")
        
    except Exception as e:
        print(f"[SYNC ERROR INDISPO] {e}")
        db.rollback()
        log_sync(db, "Pastas de Indisponibilidades", f"ERROR: {str(e)[:50]}", 0)

def safe_float(val):
    try:
        if pd.isna(val) or val is None or val == '': return 0.0
        if isinstance(val, (int, float)): return float(val)
        s = str(val).strip()
        if s.startswith('(') and s.endswith(')'): s = '-' + s[1:-1]
        elif s.endswith('-'): s = '-' + s[:-1]
        if ',' in s and '.' in s:
            if s.rfind(',') > s.rfind('.'): s = s.replace('.', '').replace(',', '.')
            else: s = s.replace(',', '')
        elif ',' in s: s = s.replace(',', '.')
        return float(s)
    except: return 0.0

def process_group_names(df, group_map):
    try:
        cols_norm = {str(c).upper().strip(): c for c in df.columns}
        col_id = next((cols_norm[k] for k in ['GRUPO DE MERCADORIA', 'GRUPO', 'COD', 'CODIGO'] if k in cols_norm), None)
        col_name = next((cols_norm[k] for k in ['DESCRIÇÃO DO GRUPO', 'DESCRICAO', 'NOME'] if k in cols_norm), None)
        if col_id is None:
            col_id = df.columns[0]
            col_name = df.columns[1] if len(df.columns) > 1 else df.columns[0]
        for _, row in df.iterrows():
            code = str(row[col_id]).strip()
            if code.endswith('.0'): code = code[:-2]
            name = str(row[col_name]).strip() if col_name else code
            if code and name and code != 'nan' and name != 'nan':
                group_map[code] = name
    except Exception as e: pass

def process_mb52_mapping(df, mapping):
    try:
        mat_col = next((c for c in df.columns if str(c).upper().strip() == 'MATERIAL'), None)
        grp_col = next((c for c in df.columns if 'GRUPO' in str(c).upper().strip() and 'MERC' in str(c).upper().strip()), None)
        if mat_col and grp_col:
            for _, row in df.iterrows():
                mat = str(row[mat_col]).strip()
                if mat.endswith('.0'): mat = mat[:-2]
                grp = str(row[grp_col]).strip()
                if mat: mapping[mat] = grp
    except Exception: pass

def sync_logccm(db: Session):
    print("[SYNC] Iniciando sincronização da Logística CCM (MB52)...")
    
    # Limpar as tabelas LogCCM
    db.query(models.LogCcmMb52).delete()
    db.query(models.LogCcmItem).delete()
    db.query(models.LogCcmRuptura).delete()
    db.query(models.LogCcmSerial).delete()
    db.commit()

    group_name_map = {}
    if os.path.exists(config.LOGCCM_GROUPS_FILE):
        try:
            df_gr = pd.read_excel(config.LOGCCM_GROUPS_FILE, dtype=str)
            process_group_names(df_gr, group_name_map)
        except Exception: pass

    records_inserted = 0
    from sqlalchemy import insert

    for regional, path in config.LOGCCM_FILES.items():
        if not os.path.exists(path): continue
        temp_path = None
        try:
            fd, temp_path = tempfile.mkstemp(suffix=".xlsm")
            os.close(fd)
            shutil.copy2(path, temp_path)
            xls = pd.ExcelFile(temp_path, engine='openpyxl')
            
            material_group_map = {}
            inventory_map = {}

            if 'CONTAGEM' in xls.sheet_names:
                try:
                    df_cont = pd.read_excel(xls, 'CONTAGEM')
                    for _, row in df_cont.iterrows():
                        m = str(row.get('MATERIAL', '')).strip()
                        if m.endswith('.0'): m = m[:-2]
                        if m: inventory_map[m] = str(row.get('Situação', '')).upper()
                except: pass

            if 'GR.MERCADORIA' in xls.sheet_names:
                df_gr_local = pd.read_excel(xls, 'GR.MERCADORIA')
                process_group_names(df_gr_local, group_name_map)

            if 'MB52' in xls.sheet_names:
                df_mb52 = pd.read_excel(xls, 'MB52')
                process_mb52_mapping(df_mb52, material_group_map)
                
                cols_upper = {str(c).upper().strip(): i for i, c in enumerate(df_mb52.columns)}
                idx_f = 5 if len(df_mb52.columns) > 5 else None
                idx_l = 11 if len(df_mb52.columns) > 11 else None
                
                if not idx_f or 'VALOR' not in str(df_mb52.columns[idx_f]).upper():
                    idx_f = next((i for k, i in cols_upper.items() if 'VALOR' in k and 'UTIL' in k), idx_f)
                
                if not idx_l or 'DIF' not in str(df_mb52.columns[idx_l]).upper():
                    idx_l = next((i for k, i in cols_upper.items() if 'VALOR' in k and 'DIF' in k), idx_l)
                    
                idx_n = 13 if len(df_mb52.columns) > 13 else None
                if not idx_n or 'ONF' not in str(df_mb52.columns[idx_n]).upper():
                     idx_n = next((i for k, i in cols_upper.items() if 'VALOR' in k and 'DIF' in k and 'ONF' in k), idx_n)

                if idx_f is not None and idx_l is not None:
                    col_f = df_mb52.columns[idx_f]
                    col_l = df_mb52.columns[idx_l]
                    col_n = df_mb52.columns[idx_n] if idx_n is not None else None
                    col_mat = next((c for c in df_mb52.columns if str(c).upper().strip() == 'MATERIAL'), df_mb52.columns[0])

                    mb52_chunks = []
                    for _, row in df_mb52.iterrows():
                        mat = str(row[col_mat]).strip().replace('.0', '')
                        grp = material_group_map.get(mat, 'Outros')
                        grp_name = group_name_map.get(grp, grp)
                        
                        mb52_chunks.append({
                            "regional": regional,
                            "material": mat,
                            "grupo": grp,
                            "grupo_nome": grp_name,
                            "valor_virtual": safe_float(row[col_f]),
                            "valor_fisico": safe_float(row[col_l]),
                            "valor_fisico_sem_pedalada": safe_float(row[col_n]) if col_n else safe_float(row[col_l])
                        })
                    
                    if mb52_chunks:
                        for i in range(0, len(mb52_chunks), 500):
                            db.execute(insert(models.LogCcmMb52), mb52_chunks[i:i+500])
                        records_inserted += len(mb52_chunks)

            # Process FALTAS e SOBRAS
            def process_items(sheet_name, tipo):
                if sheet_name in xls.sheet_names:
                    df_items = pd.read_excel(xls, sheet_name, header=1)
                    cols_map = {c: str(c).upper().strip() for c in df_items.columns}
                    col_mat = next((k for k, v in cols_map.items() if 'MATERIAL' in v and 'TEXTO' not in v), None)
                    col_desc = next((k for k, v in cols_map.items() if 'TEXTO' in v), None)
                    col_saldo = next((k for k, v in cols_map.items() if v == 'DIFERENÇA'), None) or next((k for k, v in cols_map.items() if 'DIFERENÇA' in v or 'SALDO' in v), None)
                    col_valor = next((k for k, v in cols_map.items() if v == 'VL. DIFERENÇA'), None) or next((k for k, v in cols_map.items() if 'VALOR' in v or 'VL.' in v), None)
                    col_deposito = next((k for k, v in cols_map.items() if v == 'DEPÓSITO'), None) or next((k for k, v in cols_map.items() if v == 'CENTRO'), None)
                    
                    if col_mat:
                        item_chunks = []
                        for _, row in df_items.iterrows():
                            mat = row.get(col_mat)
                            if pd.isna(mat): continue
                            mat_str = str(mat).strip().replace('.0', '')
                            grp = material_group_map.get(mat_str, 'Outros')
                            
                            item_chunks.append({
                                "regional": regional,
                                "tipo": tipo,
                                "material": mat_str,
                                "descricao": str(row.get(col_desc, "")).strip(),
                                "grupo": grp,
                                "grupo_nome": group_name_map.get(grp, grp),
                                "deposito": str(row.get(col_deposito, f"{regional}")).strip().replace('.0', ''),
                                "saldo": safe_float(row.get(col_saldo)),
                                "valor": safe_float(row.get(col_valor))
                            })
                        if item_chunks:
                            for i in range(0, len(item_chunks), 500):
                                db.execute(insert(models.LogCcmItem), item_chunks[i:i+500])
                            nonlocal records_inserted
                            records_inserted += len(item_chunks)

            process_items('FALTAS', 'FALTA')
            process_items('SOBRAS', 'SOBRA')

            # Ruptura
            sheet_ruptura = next((s for s in xls.sheet_names if 'PLANMAT' in s.upper()), None)
            if not sheet_ruptura and 'RUPTURA' in xls.sheet_names: sheet_ruptura = 'RUPTURA'

            if sheet_ruptura:
                df_ruptura = pd.read_excel(xls, sheet_ruptura)
                cols_map = {c: str(c).upper().strip() for c in df_ruptura.columns}
                col_mat = next((k for k, v in cols_map.items() if v == 'MATERIAL'), None)
                col_desc = next((k for k, v in cols_map.items() if 'TEXTO' in v and 'MATERIAL' in v), None)
                col_data = next((k for k, v in cols_map.items() if 'DATA' in v and ('DESL' in v or 'DESLG' in v)), None)
                col_qtd_nec = next((k for k, v in cols_map.items() if v == 'QTD.NECESSIDADE'), None)
                col_qtd_ana = next((k for k, v in cols_map.items() if v == 'QTDE. ANALISAR'), None)
                col_diag = next((k for k, v in cols_map.items() if 'DIAGRAMA' in v), None)
                col_saldo_fis = next((k for k, v in cols_map.items() if v == 'SALDO FÍSICO'), None)
                col_saldo_sis = next((k for k, v in cols_map.items() if v == 'SALDO SISTEMA'), None)
                
                if col_mat:
                    today = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                    start_date = today - datetime.timedelta(days=3)
                    limit_date = today + datetime.timedelta(days=21)
                    
                    ruptura_chunks = []
                    for _, row in df_ruptura.iterrows():
                        mat = str(row.get(col_mat, '')).strip().replace('.0', '')
                        if not mat or mat == 'None': continue
                        data_raw = row.get(col_data)
                        dt_deslig = None
                        if pd.notnull(data_raw):
                            if isinstance(data_raw, (datetime.datetime, pd.Timestamp)):
                                dt_deslig = data_raw
                            elif isinstance(data_raw, str):
                                cd = data_raw.split(' ')[0].strip()
                                for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]:
                                    try: 
                                        dt_deslig = datetime.datetime.strptime(cd, fmt)
                                        break
                                    except: pass
                        if dt_deslig and start_date <= dt_deslig <= limit_date:
                            grp = material_group_map.get(mat, 'Outros')
                            dia_raw = str(row.get(col_diag, "-")).strip().replace('.0', '')
                            if dia_raw == 'nan' or dia_raw == 'None': dia_raw = '-'
                            
                            ruptura_chunks.append({
                                "regional": regional,
                                "material": mat,
                                "descricao": str(row.get(col_desc, "")).strip(),
                                "grupo": grp,
                                "grupo_nome": group_name_map.get(grp, grp),
                                "data_deslig": dt_deslig.date(),
                                "qtd_necessaria": safe_float(row.get(col_qtd_nec if col_qtd_nec else col_qtd_ana)),
                                "qtd_analisar": safe_float(row.get(col_qtd_ana)),
                                "saldo_fisico": safe_float(row.get(col_saldo_fis)),
                                "saldo_sistema": safe_float(row.get(col_saldo_sis)),
                                "diagrama": dia_raw,
                                "inventario": inventory_map.get(mat, '-')
                            })
                    if ruptura_chunks:
                        for i in range(0, len(ruptura_chunks), 500):
                            db.execute(insert(models.LogCcmRuptura), ruptura_chunks[i:i+500])
                        records_inserted += len(ruptura_chunks)

            # IQ09
            iq09_sheet = 'IQ09' if 'IQ09' in xls.sheet_names else ('IQ09_EP1' if 'IQ09_EP1' in xls.sheet_names else None)
            if iq09_sheet:
                df_iq09 = pd.read_excel(xls, iq09_sheet)
                serial_chunks = []
                for _, row in df_iq09.iterrows():
                    serial_chunks.append({
                        "regional": regional,
                        "serial": str(row.get("Nº de série", "")).strip(),
                        "material": str(row.get("Material", "")).strip(),
                        "descricao": str(row.get("Texto breve material", "")).strip(),
                        "status": str(row.get("Status do sistema", "")).strip(),
                        "deposito": str(row.get("Depósito", "")).strip()
                    })
                if serial_chunks:
                    for i in range(0, len(serial_chunks), 500):
                        db.execute(insert(models.LogCcmSerial), serial_chunks[i:i+500])
                    records_inserted += len(serial_chunks)
            
            db.commit()

        except Exception as e:
            print(f"[SYNC WARNING LOGCCM] Erro ao ler {path}: {e}")
        finally:
            if temp_path and os.path.exists(temp_path):
                try: os.remove(temp_path)
                except: pass

    log_sync(db, "Logística CCM MB52", "SUCCESS", records_inserted)
    print(f"[SYNC] {records_inserted} registros inseridos em LogCCM.")

def sync_apr(db: Session):
    print("[SYNC] Iniciando sincronização do APR Digital...")
    db.query(models.AprRecord).delete()
    db.commit()

    records_inserted = 0
    from sqlalchemy import insert
    
    # Mapeamento Base 
    SECTOR_MAP = {
        'Eletromarquez-Itarana': 'ITARANA',
        'Eletromarquez-Nova Venécia': 'NOVA VENÉCIA',
        'Eletromarquez-Venda Nova': 'VENDA NOVA DO IMIGRANTE'
    }

    for file_key, sector_str in [("apr_ccm", "CCM"), ("apr_turmas", "TURMAS")]:
        path = config.FILE_PATHS.get(file_key)
        if not path or not os.path.exists(path): continue
        temp_path = None
        try:
            fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
            os.close(fd)
            shutil.copy2(path, temp_path)
            
            sheet_name = "Quantidade notas" if sector_str == "CCM" else "Quantidade de notas "
            
            # --- Correção: Ler abas Export para obter mapeamento de equipe > setor ---
            equipe_setor_map = {}
            if 'Export' in pd.ExcelFile(temp_path).sheet_names:
                df_export = pd.read_excel(temp_path, sheet_name='Export', engine='openpyxl')
                df_export.columns = [str(c).strip() for c in df_export.columns]
                
                # Procura a coluna de setor independentemente de espaços na digitação
                col_setor = next((c for c in df_export.columns if 'SETOR' in c.upper()), None)
                col_equipe = next((c for c in df_export.columns if 'EQUIPE' in c.upper()), None)
                
                if col_setor and col_equipe:
                    for _, row_exp in df_export.dropna(subset=[col_setor, col_equipe]).iterrows():
                        eq_exp = str(row_exp[col_equipe]).strip()
                        setor_exp = str(row_exp[col_setor]).strip()
                        if eq_exp and setor_exp:
                            equipe_setor_map[eq_exp] = setor_exp
            
            df = pd.read_excel(temp_path, sheet_name=sheet_name, engine='openpyxl')
            df.columns = [c.strip() if isinstance(c, str) else c for c in df.columns]
            
            if 'Data' not in df.columns: continue
            df['Data'] = pd.to_datetime(df['Data'], errors='coerce')
            df = df.dropna(subset=['Data'])
            
            chunks = []
            for _, row in df.iterrows():
                eq = str(row.get('Equipe', '')).strip()
                
                # Pega do map que criamos a partir do 'Export', se não tiver pega do row
                s = equipe_setor_map.get(eq, str(row.get('Setor', '')).strip())
                base_name = SECTOR_MAP.get(s, s)

                
                chunks.append({
                    "sector": sector_str,
                    "data": row['Data'].date(),
                    "equipe": eq,
                    "setor_name": base_name,
                    "notas_exec": safe_float(row.get('Notas Exec')),
                    "apr_digital": safe_float(row.get('APR Digital')),
                    "efetividade": safe_float(row.get('Efetividade'))
                })
            
            if chunks:
                for i in range(0, len(chunks), 1000):
                    db.execute(insert(models.AprRecord), chunks[i:i+1000])
                records_inserted += len(chunks)
                db.commit()
                
        except Exception as e:
            print(f"[SYNC WARNING APR] Erro ao ler {path}: {e}")
        finally:
            if temp_path and os.path.exists(temp_path):
                try: os.remove(temp_path)
                except: pass

    log_sync(db, "APR Digital", "SUCCESS", records_inserted)
    print(f"[SYNC] {records_inserted} registros inseridos em APR Digital.")

def sync_saida_base(db: Session):
    print("[SYNC] Iniciando sincronização de Saída de Base (CCM)...")
    db.query(models.SaidaBaseRecord).delete()
    db.commit()
    
    path = config.FILE_PATHS.get("saida_base_ccm")
    if not path or not os.path.exists(path):
        print("[SYNC WARNING] Arquivo Saída Base CCM não encontrado.")
        return
        
    records_inserted = 0
    from sqlalchemy import insert
    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(fd)
        shutil.copy2(path, temp_path)
        
        df = pd.read_excel(temp_path, sheet_name="GERAL", engine='openpyxl')
        df.columns = [str(c).strip() for c in df.columns]
        
        if 'DATA' not in df.columns: return
        df['DATA'] = pd.to_datetime(df['DATA'], errors='coerce')
        df = df.dropna(subset=['DATA'])
        
        if pd.api.types.is_timedelta64_dtype(df['TEMPO DE EMBARQUE']):
            df['TEMPO DE EMBARQUE'] = df['TEMPO DE EMBARQUE'].dt.total_seconds() / 60
            df.loc[df['TEMPO DE EMBARQUE'] < 0, 'TEMPO DE EMBARQUE'] = np.nan
        elif pd.api.types.is_datetime64_any_dtype(df['TEMPO DE EMBARQUE']):
            df['TEMPO DE EMBARQUE'] = (df['TEMPO DE EMBARQUE'].dt.hour * 60 + df['TEMPO DE EMBARQUE'].dt.minute)
        else:
            df['TEMPO DE EMBARQUE'] = pd.to_numeric(df['TEMPO DE EMBARQUE'], errors='coerce')
            
        custo_col = next((c for c in df.columns if 'Custo Total' in c), 'Custo Total')
        df['Custo Total'] = pd.to_numeric(df[custo_col], errors='coerce').fillna(0)
        ofensor_col = 'OFENSOR' if 'OFENSOR' in df.columns else 'REGIONAL'
        
        chunks = []
        for _, row in df.iterrows():
            chunks.append({
                "data": row['DATA'].date(),
                "regional": str(row.get('REGIONAL', '')).strip(),
                "equipe": str(row.get('EQUIPE', '')).strip(),
                "motivo": str(row.get('MOTIVO', '')).strip(),
                "tempo_embarque": safe_float(row.get('TEMPO DE EMBARQUE')),
                "custo_total": safe_float(row.get('Custo Total')),
                "ofensor": str(row.get(ofensor_col, '')).strip()
            })
            
        if chunks:
            for i in range(0, len(chunks), 1000):
                db.execute(insert(models.SaidaBaseRecord), chunks[i:i+1000])
            records_inserted += len(chunks)
            db.commit()
            
    except Exception as e:
        print(f"[SYNC WARNING SAIDA BASE] Erro ao carregar: {e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass
            
    log_sync(db, "Saída de Base CCM", "SUCCESS", records_inserted)
    print(f"[SYNC] {records_inserted} registros inseridos em Saída de Base.")

def run_all_syncs(db: Session = None):
    local_session = False
    if not db:
        db = SessionLocal()
        local_session = True
        
    try:
        sync_produtividade(db)
        sync_5s(db)
        sync_rejeicoes(db)
        sync_frota(db)
        sync_indisponibilidade(db)
        sync_logccm(db)
        sync_apr(db)
        sync_saida_base(db)
        
        # Invalidar cache da API após sincronização para garantir dados frescos
        try:
            from cache import api_cache
            api_cache.clear()
            print("[SYNC] Cache da API invalidado com sucesso.")
        except Exception as cache_err:
            print(f"[SYNC WARNING] Falha ao invalidar cache: {cache_err}")
    finally:
        if local_session:
            db.close()

if __name__ == "__main__":
    run_all_syncs()
