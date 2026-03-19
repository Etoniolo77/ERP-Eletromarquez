-- ==========================================
-- SCRIPT DE VIEWS PARA INDICADORES (CORRIGIDO)
-- ==========================================

-- 1. View de Ranking de Produtividade (Média por Equipe)
CREATE OR REPLACE VIEW public.view_ranking_produtividade AS
SELECT 
    equipe,
    setor,
    ROUND(AVG(produtividade_pct)::numeric, 1) as produtividade,
    SUM(ociosidade_min) as ociosidade
FROM public.produtividade
GROUP BY equipe, setor
ORDER BY produtividade ASC;

-- 2. View de Evolução Diária (Dashboard Geral)
CREATE OR REPLACE VIEW public.view_evolucao_diaria AS
SELECT 
    data,
    ROUND(AVG(produtividade_pct)::numeric, 1) as produtividade,
    ROUND(AVG(eficacia_pct)::numeric, 1) as eficacia
FROM public.produtividade
GROUP BY data
ORDER BY data ASC;

-- 3. View de KPIs Globais (Resumo Dashboard Home)
CREATE OR REPLACE VIEW public.view_dashboard_global AS
SELECT 
    (SELECT ROUND(AVG(produtividade_pct)::numeric, 1) FROM public.produtividade) as avg_prod,
    (SELECT SUM(custo_val) FROM public.frota_custos) as total_frota,
    (SELECT ROUND(AVG(conformidade_pct)::numeric, 1) FROM public.auditorias_5s WHERE local_auditado NOT IN ('440', '441')) as avg_5s,
    (SELECT SUM(valor) FROM public.indisponibilidade WHERE checado = false) as valor_indisp;

-- Dar acesso às views (GRANT SELECT em TABLES já cobre VIEWS no PostgreSQL)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
