from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean
from database import Base
import datetime

class Produtividade(Base):
    __tablename__ = "produtividade"
    id = Column(Integer, primary_key=True, index=True)
    equipe = Column(String, index=True)
    tipo_equipe = Column(String)
    setor = Column(String, index=True)
    data = Column(Date, index=True)
    csd = Column(String)
    ocupacao = Column(Float)
    produtividade_pct = Column(Float)
    eficiencia_pct = Column(Float)
    eficacia_pct = Column(Float)
    notas_executadas = Column(Float)
    notas_interrompidas = Column(Float, default=0.0)
    notas_rejeitadas = Column(Float, default=0.0)
    ociosidade_min = Column(Float)
    desvios_min = Column(Float)
    deslocamento_min = Column(Float)
    hhp_min = Column(Float)
    
    # Indicadores específicos CCM
    saida_base_min = Column(Float, default=0.0)
    retorno_base_min = Column(Float, default=0.0)
    hora_extra_min = Column(Float, default=0.0)
    
class Auditoria5S(Base):
    __tablename__ = "auditorias_5s"
    id = Column(Integer, primary_key=True, index=True)
    data_auditoria = Column(Date, index=True)
    base = Column(String, index=True)
    inspetor = Column(String)
    local_auditado = Column(String)
    tipo_auditoria = Column(String)
    conformidade_pct = Column(Float)
    nota_1s = Column(Float)
    nota_2s = Column(Float)
    nota_3s = Column(Float)
    nota_4s = Column(Float)
    nota_5s = Column(Float)

class FrotaCustos(Base):
    __tablename__ = "frota_custos"
    id = Column(Integer, primary_key=True, index=True)
    placa = Column(String, index=True)
    veiculo_id = Column(String, index=True) # Num Frota ou Placa
    data_solicitacao = Column(Date, index=True)
    
    # Dados do Veículo (vindas do BD Frota)
    modelo = Column(String)
    marca = Column(String)
    tipo = Column(String)
    ano_veiculo = Column(Integer)
    setor = Column(String, index=True)
    regional = Column(String, index=True)
    
    # Dados do Custo
    fornecedor = Column(String)
    nome_servico = Column(String)
    tipo_manutencao = Column(String) # Preventiva, Corretiva, Abastecimento, Locação
    custo_val = Column(Float, default=0.0)
    
class Indisponibilidade(Base):
    __tablename__ = "indisponibilidade"
    id = Column(Integer, primary_key=True, index=True)
    mes_ref = Column(String, index=True) # Formato YYYYMM
    regional = Column(String, index=True)
    tipo_desvio = Column(String)
    checado = Column(Boolean, default=False)
    valor = Column(Float, default=0.0)
    tempo = Column(Float, default=0.0) # Quantidade de horas ou minutos

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    source_file = Column(String, index=True)
    last_sync = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String)
    records_processed = Column(Integer)

class Rejeicao(Base):
    __tablename__ = "rejeicoes"
    
    id = Column(Integer, primary_key=True, index=True)
    regional = Column(String, index=True)
    setor = Column(String, index=True)
    nota = Column(String, index=True)
    tipo = Column(String)
    equipe = Column(String, index=True)
    descricao = Column(String)
    cidade = Column(String)
    codigo_motivo = Column(String)
    motivo = Column(String)
    backoffice_em = Column(String, index=True) # Legado/Status
    telefone_contato = Column(String)
    data_conclusao = Column(Date, index=True)
    num_rejeicoes = Column(Integer, default=1)
    eletricista = Column(String, index=True)
    analista = Column(String, index=True)
    status = Column(String, index=True)

class LogCcmMb52(Base):
    __tablename__ = "logccm_mb52"
    id = Column(Integer, primary_key=True, index=True)
    regional = Column(String, index=True)
    material = Column(String, index=True)
    grupo = Column(String, index=True)
    grupo_nome = Column(String)
    valor_virtual = Column(Float, default=0.0)
    valor_fisico = Column(Float, default=0.0) # Com pedalada
    valor_fisico_sem_pedalada = Column(Float, default=0.0) # Sem pedalada

class LogCcmItem(Base):
    __tablename__ = "logccm_item"
    id = Column(Integer, primary_key=True, index=True)
    regional = Column(String, index=True)
    tipo = Column(String, index=True) # SOBRA ou FALTA
    material = Column(String, index=True)
    descricao = Column(String)
    grupo = Column(String, index=True)
    grupo_nome = Column(String)
    deposito = Column(String) # Deposit or Centro
    saldo = Column(Float, default=0.0)
    valor = Column(Float, default=0.0)

class LogCcmRuptura(Base):
    __tablename__ = "logccm_ruptura"
    id = Column(Integer, primary_key=True, index=True)
    regional = Column(String, index=True)
    material = Column(String, index=True)
    descricao = Column(String)
    grupo = Column(String, index=True)
    grupo_nome = Column(String)
    data_deslig = Column(Date, index=True)
    qtd_necessaria = Column(Float, default=0.0)
    qtd_analisar = Column(Float, default=0.0)
    saldo_fisico = Column(Float, default=0.0)
    saldo_sistema = Column(Float, default=0.0)
    diagrama = Column(String)
    inventario = Column(String)

class LogCcmSerial(Base):
    __tablename__ = "logccm_serial"
    id = Column(Integer, primary_key=True, index=True)
    regional = Column(String, index=True)
    serial = Column(String, index=True)
    material = Column(String, index=True)
    descricao = Column(String)
    status = Column(String)
    deposito = Column(String)

class AprRecord(Base):
    __tablename__ = "apr_records"
    id = Column(Integer, primary_key=True, index=True)
    sector = Column(String, index=True) # 'CCM' ou 'TURMAS'
    data = Column(Date, index=True)
    equipe = Column(String, index=True)
    setor_name = Column(String)
    notas_exec = Column(Float, default=0.0)
    apr_digital = Column(Float, default=0.0)
    efetividade = Column(Float, default=0.0)

class SaidaBaseRecord(Base):
    __tablename__ = "saida_base_records"
    id = Column(Integer, primary_key=True, index=True)
    data = Column(Date, index=True)
    regional = Column(String, index=True)
    equipe = Column(String, index=True)
    motivo = Column(String)
    tempo_embarque = Column(Float, default=0.0)
    custo_total = Column(Float, default=0.0)
    ofensor = Column(String)

class SystemConfig(Base):
    __tablename__ = "system_configs"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
