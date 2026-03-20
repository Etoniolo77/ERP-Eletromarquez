
import sqlite3
import pandas as pd
import datetime
import numpy as np

def test_dashboard():
    try:
        conn = sqlite3.connect('data/portal.db')
        cursor = conn.cursor()
        
        # Simular o carregamento do main.py
        rows = cursor.execute('SELECT * FROM saida_base_records').fetchall()
        if not rows:
            print("Sem dados na tabela")
            return
            
        data_list = []
        for r in rows:
            data_list.append({
                "DATA": r[1],
                "REGIONAL": r[2],
                "EQUIPE": r[3],
                "MOTIVO": r[4],
                "TEMPO DE EMBARQUE": r[5],
                "CUSTO TOTAL": r[6],
                "OFENSOR": r[7]
            })
        df = pd.DataFrame(data_list)
        df['DATA'] = pd.to_datetime(df['DATA'])
        hoje = df['DATA'].max()
        meta = 30.0
        
        # Testar as agregações críticas do erro 500
        df_hoje = df[df['DATA'] == hoje]
        df_filtered = df # simular periodo = latest
        
        print("Testando KPIs...")
        media_dia = float(df_hoje['TEMPO DE EMBARQUE'].mean())
        media_periodo = float(df_filtered['TEMPO DE EMBARQUE'].mean())
        
        print("Testando IPE...")
        total_operacoes_periodo = int(len(df_filtered))
        total_dentro_meta_periodo = int(len(df_filtered[df_filtered['TEMPO DE EMBARQUE'] <= meta]))
        
        print("Testando Custo Projetado...")
        df_mes_agg = df_filtered.groupby('DATA').agg(custo=('CUSTO TOTAL', 'sum')).reset_index()
        
        print("Testando Ofensores...")
        ofensores_df = df_filtered.groupby(['EQUIPE', 'OFENSOR']).agg({
            'TEMPO DE EMBARQUE': 'mean',
            'CUSTO TOTAL': 'sum'
        }).reset_index().sort_values('CUSTO TOTAL', ascending=False)
        
        print("Testando Evolução...")
        data_7d = hoje - datetime.timedelta(days=7)
        data_14d = hoje - datetime.timedelta(days=14)
        for equipe in df['EQUIPE'].unique()[:5]:
            df_eq = df[df['EQUIPE'] == equipe]
            sem_atual = df_eq[(df_eq['DATA'] >= data_7d)]['TEMPO DE EMBARQUE']
            
        print("Sucesso! Sem erros 500 detectados no script de teste.")
        conn.close()
    except Exception as e:
        print(f"ERRO ENCONTRADO: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_dashboard()
