import re
from typing import Any

# Padrões de Regionais
REGIONAL_MAP = {
    'ITA': 'ITARANA',
    'ITARANA': 'ITARANA',
    'ARACRUZ': 'ARACRUZ',
    'VNI': 'VENDA NOVA DO IMIGRANTE',
    'VENDA NOVA': 'VENDA NOVA DO IMIGRANTE',
    'VENDA NOVA DO IMIGRANTE': 'VENDA NOVA DO IMIGRANTE',
    'MARECHAL FLORIANO': 'MARECHAL FLORIANO',
    'NVE': 'NOVA VENÉCIA',
    'NOVA VENECIA': 'NOVA VENÉCIA',
    'NOVA VENÉCIA': 'NOVA VENÉCIA',
    'BARRA': 'BARRA DE SÃO FRANCISCO',
    'BARRA DE SÃO FRANCISCO': 'BARRA DE SÃO FRANCISCO',
    'BSF': 'BARRA DE SÃO FRANCISCO',
    'SERRA': 'SERRA',
    'LINHARES': 'LINHARES',
    'MONTANHA': 'MONTANHA',
    'SÃO MATEUS': 'SÃO MATEUS',
    'SAO MATEUS': 'SÃO MATEUS'
}

# Padrões de Setores
SECTOR_MAP = {
    'CCM': 'CCM',
    'CONSTRUÇÃO': 'CCM',
    'CONSTRUCAO': 'CCM',
    'TURMAS': 'TURMAS',
    'MANUTENÇÃO': 'TURMAS',
    'MANUTENCAO': 'TURMAS',
    'ADM': 'ADM',
    'ADMINISTRATIVO': 'ADM',
    'FROTA': 'FROTA',
    'SESMT': 'SESMT',
    'STC': 'STC',
    'SETOR TECNICO': 'STC',
    'SETOR TÉCNICO': 'STC',
    'LOG': 'LOGÍSTICA',
    'LOGISTICA': 'LOGÍSTICA',
    'LOGÍSTICA': 'LOGÍSTICA',
    'COM': 'COMERCIAL',
    'COMERCIAL': 'COMERCIAL'
}

def normalize_regional(name: Any) -> str:
    if not name or str(name).strip() == '0' or str(name).strip().lower() == 'nan':
        return "N/D"
    name_str = str(name).strip().upper()
    # Tenta match exato primeiro
    if name_str in REGIONAL_MAP:
        return REGIONAL_MAP[name_str]
    # Tenta busca parcial se necessário
    for key, val in REGIONAL_MAP.items():
        if key in name_str:
            return val
    return name_str

def normalize_sector(name: Any) -> str:
    if not name or str(name).strip() == '0' or str(name).strip().lower() == 'nan':
        return "N/D"
    name_str = str(name).strip().upper()
    if name_str in SECTOR_MAP:
        return SECTOR_MAP[name_str]
    for key, val in SECTOR_MAP.items():
        if key in name_str:
            return val
    return name_str

def normalize_base(name: Any) -> str:
    """Bases geralmente são as próprias regionais ou cidades específicas"""
    return normalize_regional(name)
