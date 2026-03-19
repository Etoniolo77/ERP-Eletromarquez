import os
import pandas as pd
from datetime import datetime, timedelta
import logging
import config

logger = logging.getLogger(__name__)

# --- MAPEAMENTOS DE PERGUNTAS ---
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
    'field_17': '[S04P02] O plano de emergência está disponível e em local de fácil acesso?',
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

def get_legacy_planos():
    """Lógica avançada: Última resposta NÃO gera ação. Resposta SIM conclui."""
    data_dir = config.S5_RAW_DIR
    donos_file = config.FILE_PATHS.get("5s_donos")
    acoes_file = config.FILE_PATHS.get("5s_acoes")

    try:
        if not os.path.exists(donos_file):
            df_donos = pd.DataFrame(columns=['Título', 'Base', 'Owner', 'Local_Norm'])
        else:
            df_donos = pd.read_excel(donos_file, engine='openpyxl')
            df_donos['Local_Norm'] = df_donos['Título'].astype(str).str.strip().str.upper()
            df_donos['Base_Norm'] = df_donos['Base'].astype(str).str.strip().str.upper()
            
        submit_path = os.path.join(data_dir, "SubmitList.csv")
        if not os.path.exists(submit_path):
            return []
            
        df_submit = pd.read_csv(submit_path)
        
        exclude_aracruz_adm = (df_submit['Base'].str.strip().str.upper() == 'ARACRUZ') & (df_submit['Local'].str.strip().str.upper() == 'ADMINISTRATIVO')
        exclude_trucks = df_submit['Local'].astype(str).str.strip().isin(['435', '436', '437', '438', '440', '441'])
        exclude_nv_421 = (df_submit['Base'].str.strip().str.upper() == 'NOVA VENÉCIA') & (df_submit['Local'].astype(str).str.strip() == '421')
        exclude_itarana_429 = (df_submit['Base'].str.strip().str.upper() == 'ITARANA') & (df_submit['Local'].astype(str).str.strip() == '429')
        exclude_itarana_411 = (df_submit['Base'].str.strip().str.upper() == 'ITARANA') & (df_submit['Local'].astype(str).str.strip() == '411')

        df_submit = df_submit[~(exclude_aracruz_adm | exclude_trucks | exclude_nv_421 | exclude_itarana_429 | exclude_itarana_411)]
        
        date_col = 'DatadeInspe_x00e7__x00e3_o' if 'DatadeInspe_x00e7__x00e3_o' in df_submit.columns else 'Data_Inspeção'
        df_submit['Data_DT'] = pd.to_datetime(df_submit[date_col], dayfirst=True, errors='coerce')
        df_submit = df_submit.dropna(subset=['Data_DT'])

        try:
            df_textos_acoes = pd.read_csv(acoes_file)
            df_textos_acoes['ID_Pergunta'] = df_textos_acoes['ID_Pergunta'].astype(str).str.strip().str.upper()
            df_textos_acoes['Area_Norm'] = df_textos_acoes['Area'].astype(str).str.strip().str.upper()
        except:
            df_textos_acoes = pd.DataFrame(columns=['ID_Pergunta', 'Area_Norm', 'Acao_Sugerida'])

        all_actions = []

        for type_name, conf in DATA_SOURCES.items():
            perguntas_file = os.path.join(data_dir, f"{conf['file']}.csv")
            if not os.path.exists(perguntas_file): continue
            
            df_q_resp = pd.read_csv(perguntas_file)
            if 'ID' in df_q_resp.columns: df_q_resp = df_q_resp.rename(columns={'ID': 'Id'})

            df_submit['PerguntaLocal_ID'] = df_submit['PerguntaLocal_ID'].fillna('').astype(str)
            df_type_submit = df_submit[df_submit['PerguntaLocal_ID'].str.startswith(type_name, na=False)].copy()
            
            latest_subs = df_type_submit.sort_values('Data_DT', ascending=False).groupby(['Base', 'Local']).head(1)
            
            for _, sub in latest_subs.iterrows():
                pid = sub['PerguntaLocal_ID']
                q_id_num_str = pid.replace(type_name, '')
                if not q_id_num_str.isdigit(): continue
                q_id_num = int(q_id_num_str)

                resp_row = df_q_resp[df_q_resp['Id'] == q_id_num]
                if resp_row.empty: continue
                resp_row = resp_row.iloc[0]

                for field, question_text in conf['map'].items():
                    val = str(resp_row.get(field, '')).strip()
                    
                    if val == 'Não':
                        q_code = "???"
                        pergunta_limpa = str(question_text)
                        if '[' in question_text and ']' in question_text:
                            q_code = question_text.split(']')[0].replace('[', '').strip()
                            pergunta_limpa = question_text.split(']')[1].strip()
                        
                        hoje = datetime.now()
                        data_identificacao = sub['Data_DT']
                        dias_aberto = (hoje - data_identificacao).days
                        
                        status = "CRÍTICO" if dias_aberto >= 30 else "PENDENTE"

                        area_map_lookup = {
                            "Sala": "SALA",
                            "Caminhao": "CAMINHÃO",
                            "Patio": "PÁTIO",
                            "Deposito": "DEPÓSITO"
                        }
                        area_lookup = area_map_lookup.get(type_name, type_name.upper())
                        
                        desc_acao_row = df_textos_acoes[
                            (df_textos_acoes['ID_Pergunta'] == q_code.upper()) & 
                            (df_textos_acoes['Area_Norm'] == area_lookup)
                        ]['Acao_Sugerida'].values
                        
                        desc_acao = desc_acao_row[0] if len(desc_acao_row) > 0 else "Regularizar conforme padrão 5S."

                        local_sub = str(sub['Local']).strip().upper()
                        base_sub = str(sub['Base']).strip().upper()
                        
                        dono_filtered = df_donos[(df_donos['Local_Norm'] == local_sub) & (df_donos['Base_Norm'] == base_sub)]
                        dono_raw = dono_filtered['Owner'].values[0] if not dono_filtered.empty else None
                        dono = str(dono_raw) if pd.notnull(dono_raw) else "Gerente da Área"

                        all_actions.append({
                            "id": f"{sub['Base']}_{sub['Local']}_{q_code}",
                            "base": str(sub['Base']),
                            "local": str(sub['Local']),
                            "pergunta": pergunta_limpa,
                            "codigo": q_code,
                            "status": status,
                            "data_identificacao": data_identificacao.strftime('%d/%m/%Y'),
                            "dias_aberto": dias_aberto,
                            "responsavel": dono,
                            "acao_sugerida": str(desc_acao) if pd.notnull(desc_acao) else "Regularizar conforme padrão 5S."
                        })

        # sortBy days_aberto descending
        return sorted(all_actions, key=lambda x: x["dias_aberto"], reverse=True)
    except Exception as e:
        logger.error(f"Erro ao gerar detailed question actions: {e}")
        return []
