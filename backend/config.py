import os

# Configurações de Caminhos - Servindo de Ponte entre o Legado (Excel) e o Motor SQLite
DATA_DIR = r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Performance - Documentos\FONTE DE DADOS (cuidado)"
INDISP_ROOT = r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\EDP TURMAS - Documentos\Indisponibilidades"
REJEICOES_DIR = r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\EDP TURMAS - Documentos\Notas rejeitadas"

# --- Configurações S5 Independente ---
S5_BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "s5")
S5_RAW_DIR = os.path.join(S5_BASE_DIR, "raw")
S5_PROCESSED_DIR = os.path.join(S5_BASE_DIR, "processed")
S5_METADATA_DIR = os.path.join(S5_BASE_DIR, "metadata")

FILE_PATHS = {
    "produtividade": os.path.join(DATA_DIR, "STC_DataProd_export.xlsx"),
    "produtividade_ccm": os.path.join(DATA_DIR, "Dados gerais por dia e por equipe - CCM.xlsx"),
    "5s_consolidado": os.path.join(S5_PROCESSED_DIR, "Relatorio_Consolidado_5S.csv"),
    "5s_donos": os.path.join(S5_METADATA_DIR, "Donos de area.xlsx"),
    "5s_acoes": os.path.join(S5_METADATA_DIR, "Acoes_Corretivas_5S.csv"),
    "rejeicoes": os.path.join(REJEICOES_DIR, "Controle de Rejeições - Versão 2.xlsx"),
    "frota": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Frota - Documentos\PLANILHA DE CUSTOS\FROTA 2025.xlsx",
    "apr_turmas": os.path.join(DATA_DIR, "APR TURMAS.xlsx"),
    "apr_ccm": os.path.join(DATA_DIR, "APR CCM.xlsx"),
    "saida_base_ccm": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Performance - Documentos\CCM\SAÍDA DE BASE - CCM\Saída de Base_2026.xlsx"
}

LOGCCM_FILES = {
    "Aracruz": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Estoques - Documentos\CCM\Aracruz\Controle Estoque - CCM - ARA V5.xlsm",
    "Itarana": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Estoques - Documentos\CCM\Itarana\Controle Estoque - CCM - ITA V5.xlsm",
    "BSF": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Estoques - Documentos\CCM\Barra de São Francisco\Controle Estoque - CCM - BSF V5.xlsm",
    "Nova Venécia": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Estoques - Documentos\CCM\Nova Venécia\Controle Estoque - CCM - NVE V5.xlsm",
    "VNI": r"C:\Users\EvandroCesarToniolo\ELETROMARQUEZ LTDA\Gestão de Estoques - Documentos\CCM\Venda Nova do Imigrante\Controle Estoque - CCM - VNO V5.xlsm"
}
LOGCCM_GROUPS_FILE = os.path.join(DATA_DIR, "grupos_mercadoria.xlsx")
