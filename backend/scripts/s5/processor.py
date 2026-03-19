import pandas as pd
import os
from datetime import datetime
import sys

# Add backend to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config

# Configurações de Caminho vindas do config.py
DATA_DIR = config.S5_RAW_DIR
OUTPUT_FILE = config.FILE_PATHS["5s_consolidado"]

# Novos Mapeamentos de Dicionários (Idênticos ao Original para manter compatibilidade)
SALA_MAP = {
    'field_0': '[S01P01] Todos os materiais presentes fazem parte da rotina da sala?',
    'field_1': '[S01P02] O ambiente está livre de pertences pessoais fora dos locais identificados?',
    'field_2': '[S01P03] Os papéis e documentos físicos existentes são necessários e estão organizados adequadamente?',
    'field_3': '[S01P04] Os materiais de escritório estão sendo utilizados de maneira coletiva?',
    'field_4': '[S02P01] Os materiais de escritório estão organizados e com fácil acesso?',
    'field_5': '[S02P02] Gavetas, armários e prateleiras estão organizados e em ordem?',
    'field_6': '[S02P03] Os documentos e arquivos estão identificados e armazenados conforme padrão OD-01?',
    'field_7': '[S02P04] Cabos de equipamentos eletrônicos estão organizados e oferecem segurança (sem risco de queda)?',
    'field_8': '[S02P05] A organização da sala atende plenamente aos padrões estabelecidos?',
    'field_9': '[S03P01] As superfícies das mesas de trabalho estão limpas?',
    'field_10': '[S03P02] Equipamentos eletrônicos estão limpos e com boa aparência?',
    'field_11': '[S03P03] O teto está limpo e livre de teias de aranha?',
    'field_12': '[S03P04] O piso está limpo no momento da inspeção?',
    'field_14': '[S03P05] As janelas, vidros e persianas estão limpos?',
    'field_15': '[S03P06] A limpeza e o aspecto do ambiente atendem plenamente aos padrões?',
    'field_16': '[S04P01] Os colaboradores estão identificados com crachá?',
    'field_17': '[S04P02] A sala possui identificação na porta com nome do setor e ocupantes?',
    'field_18': '[S04P03] O formulário de limpeza FM-60 está visível e atualizado nos últimos 7 dias?',
    'field_19': '[S04P04] O padrão de organização das estações de trabalho está sendo seguido?',
    '_x005b_S04P05_x005d_Asalapossuip': '[S04P05] O ambiente possui padrão visual definido e ele está sendo seguido?',
    'field_20': '[S05P01] Os líderes e gestores são exemplos nas práticas do 5S?',
    'field_21': '[S05P02] Os funcionários têm clareza sobre suas responsabilidades individuais no 5S?',
    '_x005b_S05P03_x005d_Otimerecebeo': '[S05P03] O time recebe o feedback das auditorias anteriores?',
}

CAMINHAO_MAP = {
    'field_1': '[S01P01] Todos os materiais de serviço presentes são necessários para o veículo?',
    'field_2': '[S01P02] Todos os EPIs e EPCs são homologados e estão em quantidade adequada?',
    'field_3': '[S01P03] EPIs, EPCs e ferramentas estão em boas condições e com fácil acesso?',
    'field_4': '[S02P01] A cabine está livre de materiais estranhos (copos, garrafas, objetos pessoais)?',
    'field_5': '[S02P02] As ferramentas e materiais estão organizados conforme manual FM-046?',
    'field_6': '[S02P03] Os EPI\'s estão armazenados em locais específicos e identificados?',
    'field_7': '[S02P04] Os equipamentos coletivos têm locais designados e identificados?',
    'field_8': '[S02P05] O banheiro possui organização que facilita a limpeza e o uso?',
    'field_9': '[S03P01] O interior da cabine do caminhão está limpo e sem resíduos alimentícios?',
    'field_10': '[S03P02] Janelas e espelhos do caminhão estão limpos garantindo visibilidade clara e segura?',
    'field_11': '[S03P03] A carroceria do caminhão está livre de sujeira e detritos estranhos à atividade?',
    'field_12': '[S03P04] Compartimentos de armazenamento e ferramentas estão limpos e sem materiais estranhos?',
    'field_13': '[S03P05] EPI\'s, EPC\'s e uniformes estão em boas condições de limpeza?',
    'field_14': '[S04P01] O padrão visual conforme IT-046 está implementado e sendo seguido?',
    'field_15': '[S04P02] Existe padrão de identificação de onde cada objeto/ferramenta deve estar?',
    'field_16': '[S04P03] Os kits para limpeza do caminhão estão disponíveis e sendo utilizados?',
    'field_17': '[S04P04] O plano de emergência está disponível e em local de fácil acesso?',
    'field_18': '[S04P05] A lavagem mensal do caminhão está sendo executada conforme cronograma?',
    'field_19': '[S05P01] A equipe está comprometida em manter o caminhão organizado e limpo?',
    'field_20': '[S05P02] A equipe recebe orientações regulares sobre a importância do 5S?',
    'field_21': '[S05P03] Os membros da equipe seguem as regras de uso e armazenamento?',
    'field_22': '[S05P04] A manutenção do veículo está sendo feita periodicamente?',
}

PATIO_MAP = {
    'field_0': '[S01P01] Todos os equipamentos e ferramentas presentes estão sendo utilizados?',
    'field_1': '[S01P02] Todos os materiais presentes fazem parte da rotina?',
    'field_2': '[S02P01] Existe delimitação clara para estacionamento?',
    'field_3': '[S02P02] Todos os veículos estão estacionados dentro da área demarcada?',
    'field_4': '[S02P03] A faixa de pedestre está visível e acessível para uso?',
    'field_5': '[S02P04] As bobinas de cabos e ramais estão organizadas e identificadas?',
    'field_6': '[S02P05] As sucatas de materiais estão armazenadas em local adequado e organizado?',
    'field_7': '[S02P06] Todos os transformadores sucata estão dentro da bacia de contenção?',
    'field_8': '[S02P07] Todos os postes estão dentro das baias?',
    'field_9': '[S02P08] O pátio está limpo e livre de materiais estranhos (copos, garrafas, EPIs ou mato alto)?',
    'field_10': '[S03P01] O piso está limpo e livre de resíduos materiais e químicos?',
    'field_11': '[S03P02] A bacia de contenção dos transformadores está livre de óleo e água acumulada?',
    'field_12': '[S03P03] O pátio está livre de materiais espalhados (sucata, bags, paletes, sacolas)?',
    'field_13': '[S03P04] O pátio está livre de vegetação?',
    'field_14': '[S03P05] O pátio de postes está livre de excesso de mato?',
    'field_15': '[S03P06] De forma geral, o pátio está limpo e bem cuidado?',
    'field_16': '[S04P01] Os portões de acesso permanecem fechados e com controle restrito?',
    'field_17': '[S04P02] Existe demarcação no estacionamento adequada para carros e motos?',
    'field_18': '[S04P03] Há sinalização orientando a forma correta de estacionar veículos?',
    'field_19': '[S04P04] Todos os veículos estão estacionados conforme o padrão exigido?',
    'field_20': '[S04P05] Os locais de armazenamento de materiais estão identificados corretamente?',
    'field_21': '[S05P01] Materiais de uso comum (vassouras, pás) são guardados nos locais devidos após o uso?',
    'field_22': '[S05P02] A área de sucata está devidamente sinalizada?',
}

DEPOSITO_MAP = {
    'field_0': '[S01P01] Os materiais que não estão em uso estão armazenados na posição correta?',
    'field_1': '[S01P02] Todos os materiais e objetos presentes pertencem ao depósito?',
    'field_2': '[S01P03] Produtos químicos abertos e fora de uso estão acondicionados em armários apropriados?',
    'field_3': '[S01P04] O ambiente está livre de paletes, caixas e embalagens sem uso?',
    'field_4': '[S01P05] O local está livre de sucata acumulada?',
    'field_5': '[S02P01] Os materiais estão livres de umidade, deterioração ou risco de queda?',
    'field_6': '[S02P02] Os materiais estão nos locais corretos, identificados e organizados?',
    'field_7': '[S02P03] Prateleiras e racks estão livres de objetos estranhos (copos, garrafas, itens pessoais)?',
    'field_8': '[S02P04] Produtos químicos estão identificados e guardados em local apropriado?',
    'field_9': '[S02P05] EPIs fora de uso estão armazenados em local adequado?',
    'field_10': '[S03P01] As superfícies das mesas estão limpas e livres de poeira?',
    'field_11': '[S03P02] Equipamentos eletrônicos estão limpos?',
    'field_12': '[S03P03] Prateleiras e racks estão limpos e sem materiais estranhos?',
    'field_13': '[S03P04] Paredes e teto estão limpos e conservados?',
    'field_14': '[S03P05] O piso está limpo e livre de resíduos?',
    'field_15': '[S04P01] Colaboradores estão uniformizados e identificados?',
    'field_16': '[S04P02] Todo material possui local específico e identificado para armazenamento?',
    'field_17': '[S04P03] As demarcações de piso estão visíveis e sendo respeitadas?',
    'field_18': '[S04P04] Existe mapa de localização do depósito e ele está sendo seguido?',
    'field_19': '[S04P05] Etiquetas de identificação estão legíveis?',
    'field_20': '[S04P06] Documentos físicos estão organizados e arquivados corretamente?',
    'field_21': '[S04P07] A coleta de lixo é realizada conforme frequência definida?',
    'field_23': '[S05P01] Líderes e gestores praticam e reforçam os princípios do 5S?',
    'field_24': '[S05P02] Colaboradores do depósito praticam o 5S diariamente?',
}

DATA_SOURCES = {
    "Sala": {"file": "PerguntasSala", "map": SALA_MAP},
    "Caminhao": {"file": "PerguntasCaminhao", "map": CAMINHAO_MAP},
    "Patio": {"file": "PerguntasPatio", "map": PATIO_MAP},
    "Deposito": {"file": "PerguntasDeposito", "map": DEPOSITO_MAP}
}

def load_csv(file_basename):
    csv_path = os.path.join(DATA_DIR, f"{file_basename}.csv")
    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            if 'ID' in df.columns:
                df = df.rename(columns={'ID': 'Id'})
            return df
        except Exception as e:
            print(f"Erro ao ler CSV {csv_path}: {e}")
    return pd.DataFrame()

def calculate_compliance(row, mapping):
    scores = {
        'Global': {'sim': 0, 'total': 0},
        '1S': {'sim': 0, 'total': 0},
        '2S': {'sim': 0, 'total': 0},
        '3S': {'sim': 0, 'total': 0},
        '4S': {'sim': 0, 'total': 0},
        '5S': {'sim': 0, 'total': 0}
    }

    for field, question_text in mapping.items():
        val = str(row.get(field, '')).strip()
        if val in ['Sim', 'Não']:
            senso_key = 'Global' 
            if '[S01' in question_text: senso_key = '1S'
            elif '[S02' in question_text: senso_key = '2S'
            elif '[S03' in question_text: senso_key = '3S'
            elif '[S04' in question_text: senso_key = '4S'
            elif '[S05' in question_text: senso_key = '5S'
            
            scores['Global']['total'] += 1
            if val == 'Sim':
                scores['Global']['sim'] += 1
                
            if senso_key in scores:
                scores[senso_key]['total'] += 1
                if val == 'Sim':
                    scores[senso_key]['sim'] += 1

    final_results = {}
    for k, v in scores.items():
        pct = (v['sim'] / v['total'] * 100) if v['total'] > 0 else 0
        final_results[k] = round(pct, 1)
        
    return final_results

def run_consolidation():
    print(f"[PROCESSOR 5S] Iniciando consolidação ({datetime.now().strftime('%d/%m/%Y %H:%M')})")
    
    df_submit = load_csv("SubmitList")
    if df_submit.empty:
        print("[PROCESSOR 5S] Erro: Lista de submissões (SubmitList.csv) não encontrada.")
        return False

    all_reports = []
    
    # Locais desativados a serem filtrados
    DEACTIVATED_LOCALS = ['435', '436', '437', '438', '440', '441']
    
    date_col = 'DatadeInspe_x00e7__x00e3_o' if 'DatadeInspe_x00e7__x00e3_o' in df_submit.columns else ('Data_Inspeção' if 'Data_Inspeção' in df_submit.columns else 'DatadeInspeção')
    
    # Filtro Global de Locais Desativados
    df_submit = df_submit[~df_submit['Local'].astype(str).str.strip().isin(DEACTIVATED_LOCALS)]
    
    for type_name, s_config in DATA_SOURCES.items():
        df_questions = load_csv(s_config['file'])
        if df_questions.empty: continue
            
        df_submit['PerguntaLocal_ID'] = df_submit['PerguntaLocal_ID'].fillna('').astype(str)
        df_type_submit = df_submit[df_submit['PerguntaLocal_ID'].str.startswith(type_name, na=False)].copy()
        
        for _, submit in df_type_submit.iterrows():
            try:
                pid = str(submit['PerguntaLocal_ID'])
                q_id_str = ''.join(filter(str.isdigit, pid))
                if not q_id_str: continue
                q_id = int(q_id_str)
                
                q_row = df_questions[df_questions['Id'] == q_id]
                if q_row.empty: continue
                
                results = calculate_compliance(q_row.iloc[0], s_config['map'])
                
                all_reports.append({
                    'Data': submit.get(date_col, ''),
                    'Base': submit.get('Base', 'Não Informado'),
                    'Inspetor': submit.get('NomedoInspetor', ''),
                    'Local_Auditado': submit.get('Local', ''),
                    'Tipo_Auditoria': type_name,
                    'Conformidade_%': results['Global'],
                    'Nota_1S': results['1S'],
                    'Nota_2S': results['2S'],
                    'Nota_3S': results['3S'],
                    'Nota_4S': results['4S'],
                    'Nota_5S': results['5S']
                })
            except Exception as e:
                continue

    if not all_reports:
        print("[PROCESSOR 5S] Nenhum dado cruzado com sucesso.")
        return False

    df_final = pd.DataFrame(all_reports)
    df_final['Base'] = df_final['Base'].fillna('NÃO INFORMADO').str.strip().str.upper()
    df_final['Local_Auditado'] = df_final['Local_Auditado'].fillna('N/A').str.strip().str.upper()

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    df_final.to_csv(OUTPUT_FILE, index=False, encoding='utf-8-sig')
    print(f"✅ [PROCESSOR 5S] Relatório consolidado gerado em: {OUTPUT_FILE}")
    return True

if __name__ == "__main__":
    run_consolidation()
