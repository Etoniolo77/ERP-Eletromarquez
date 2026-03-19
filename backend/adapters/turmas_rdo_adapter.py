import pandas as pd
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import sys

# Adaptação para importar do mesmo diretório
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

logger = logging.getLogger(__name__)

class TurmasRDOAdapter:
    """
    Adapter para processar os arquivos de Gestão Integrada RDO das Turmas (Regionais).
    Lê 'RegistroIndicadores' e 'RegistroPresença'.
    """
    REGIONAIS = {
        "Itarana": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Performance - Documentos\TURMAS\Gestão Integrada\RDO ITA TURMAS V4.xlsm",
        "Nova Venécia": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Performance - Documentos\TURMAS\Gestão Integrada\RDO NVE TURMAS V4.xlsm",
        "Venda Nova do Imigrante": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Performance - Documentos\TURMAS\Gestão Integrada\RDO VNO TURMAS V4.xlsm"
    }
    
    # Cache em nível de classe para persistência entre requisições
    _cached_data = None
    _last_mtimes = {}

    def __init__(self, excel_cache=None):
        self.cache = excel_cache

    def load_data(self) -> Dict[str, pd.DataFrame]:
        """
        Carrega e processa os dados de Indicadores e Presença de todas as regionais.
        Usa cache baseado no mtime dos arquivos para performance.
        """
        # 1. Verificar tempos de modificação
        current_mtimes = {}
        for desc, path in self.REGIONAIS.items():
            if os.path.exists(path):
                current_mtimes[path] = os.path.getmtime(path)
        
        # 2. Se o cache existir e os arquivos não mudaram, retorna cache
        if TurmasRDOAdapter._cached_data and current_mtimes == TurmasRDOAdapter._last_mtimes:
            print(">>> [TURMAS RDO] Cache hit! Retornando dados processados.")
            return TurmasRDOAdapter._cached_data

        print(">>> [TURMAS RDO] Cache miss ou arquivos alterados. Reprocessando...")
        all_ind = []
        all_pres = []

        for desc_regional, filepath in self.REGIONAIS.items():
            print(f"--- Lendo Regional: {desc_regional} -> {filepath}")
            if not os.path.exists(filepath):
                logger.warning(f"[TURMAS RDO] Arquivo não encontrado para {desc_regional}: {filepath}")
                continue

            try:
                # ------ LER INDICADORES ------
                # Aumentado para 4000 linhas para garantir que pegamos todo o histórico (Nova Venécia e Venda Nova passaram de 1000 linhas)
                df_ind = pd.read_excel(filepath, sheet_name="RegistroIndicadores", header=1, engine="openpyxl", nrows=4000)
                print(f"   - RegistroIndicadores lido: {len(df_ind)} linhas")
                
                # ... resto do código igual mas com proteção de NaNs ...
                if df_ind.empty: continue
                
                col_data = df_ind.columns[0]
                col_ind = df_ind.columns[1]
                
                df_ind = df_ind.rename(columns={col_data: "Data", col_ind: "Indicador"})
                df_ind["Data"] = pd.to_datetime(df_ind["Data"], errors="coerce")
                df_ind = df_ind.dropna(subset=["Indicador"])
                
                # Filtrar colunas de equipes (excluir Unnamed e as fixas)
                equipe_cols = [c for c in df_ind.columns if str(c) not in ("Data", "Indicador") and not str(c).startswith("Unnamed")]
                
                df_ind_melt = df_ind.melt(id_vars=["Data", "Indicador"], value_vars=equipe_cols, var_name="Equipe", value_name="Nota")
                df_ind_melt["Nota"] = pd.to_numeric(df_ind_melt["Nota"], errors="coerce").fillna(0)
                df_ind_melt["Regional"] = desc_regional
                all_ind.append(df_ind_melt)

            except Exception as e:
                print(f"Erro em {desc_regional} (Indicadores): {e}")
                logger.error(f"[TURMAS RDO] Erro ao ler RegistroIndicadores {desc_regional}: {e}")

            try:
                # ------ LER PRESENÇA ------
                # Aumentado para 4000 linhas para consistência
                df_pres = pd.read_excel(filepath, sheet_name="RegistroPresença", header=0, engine="openpyxl", nrows=4000)
                print(f"   - RegistroPresença lido: {len(df_pres)} linhas")

                
                if df_pres.empty: continue

                df_pres = df_pres.rename(columns={df_pres.columns[0]: "Data", df_pres.columns[1]: "Indice"})
                df_pres["Data"] = pd.to_datetime(df_pres["Data"], errors="coerce")
                df_pres = df_pres.dropna(subset=["Data"])
                
                funcao_cols = [c for c in df_pres.columns if str(c) not in ("Data", "Indice") and not str(c).startswith("Unnamed")]
                
                df_pres_melt = df_pres.melt(id_vars=["Data"], value_vars=funcao_cols, var_name="Funcao", value_name="Presenca")
                df_pres_melt["Presenca"] = pd.to_numeric(df_pres_melt["Presenca"], errors="coerce").fillna(0).clip(0, 1)
                df_pres_melt["Regional"] = desc_regional
                all_pres.append(df_pres_melt)

            except Exception as e:
                print(f"Erro em {desc_regional} (Presença): {e}")
                logger.error(f"[TURMAS RDO] Erro ao ler RegistroPresença {desc_regional}: {e}")


        # Consolidar
        df_ind_final = pd.concat(all_ind, ignore_index=True) if all_ind else pd.DataFrame(columns=["Data", "Indicador", "Equipe", "Nota", "Regional"])
        df_pres_final = pd.concat(all_pres, ignore_index=True) if all_pres else pd.DataFrame(columns=["Data", "Funcao", "Presenca", "Regional"])

        # Retira NaTs em "Data"
        df_ind_final = df_ind_final.dropna(subset=['Data'])
        df_pres_final = df_pres_final.dropna(subset=['Data'])

        # Criar colunas Auxiliares de Período (Ano-Mes e Ano-Semana)
        if not df_ind_final.empty:
            df_ind_final["AnoMes"] = df_ind_final["Data"].dt.strftime("%Y-%m")
            df_ind_final["AnoSemana"] = df_ind_final["Data"].dt.strftime("%Y-%V")
            
        if not df_pres_final.empty:
            df_pres_final["AnoMes"] = df_pres_final["Data"].dt.strftime("%Y-%m")
            df_pres_final["AnoSemana"] = df_pres_final["Data"].dt.strftime("%Y-%V")

        result = {
            "indicadores": df_ind_final,
            "presenca": df_pres_final
        }
        
        # Salvar no cache
        TurmasRDOAdapter._cached_data = result
        TurmasRDOAdapter._last_mtimes = current_mtimes
        
        return result
