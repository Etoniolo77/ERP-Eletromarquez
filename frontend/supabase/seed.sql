-- =====================================================
-- ERP Empresarial - Seed Data
-- Dados reais migrados da planilha
-- =====================================================

-- Unidades de Medida
INSERT INTO public.unidade_medida (id, nome) VALUES
  (1, 'M'),
  (2, 'PEÇ'),
  (3, 'KG'),
  (4, 'CT'),
  (5, 'UN'),
  (6, 'PAR'),
  (7, 'PC')
ON CONFLICT (id) DO NOTHING;
SELECT setval('unidade_medida_id_seq', 7);

-- Tipo de Material
INSERT INTO public.tipo_material (id, nome, justificar) VALUES
  (1, 'EPI', true),
  (2, 'EPC', true),
  (3, 'FERRAMENTA COLETIVA', true),
  (4, 'FERRAMENTA INDIVIDUAL', true),
  (5, 'FERRAMENTA DE BASE', true),
  (6, 'MATERIAIS EPD', true)
ON CONFLICT (id) DO NOTHING;
SELECT setval('tipo_material_id_seq', 6);

-- Tipo de Justificativa
INSERT INTO public.tipo_justificativa (id, nome, destino, estoque_colaborador) VALUES
  (1,  'MAL USO',                    'colaborador',    'entrada'),
  (2,  'DESGASTE NATURAL',           'colaborador',    'entrada'),
  (3,  'PERDA',                      'colaborador',    'entrada'),
  (4,  'FURTO OU ROUBO',             'colaborador',    'entrada'),
  (5,  'EMPRÉSTIMO',                 'colaborador',    'entrada'),
  (6,  'DEVOLUÇÃO DE EMPRÉSTIMO',    'colaborador',    'saída'),
  (7,  'PRIMEIRA ENTREGA',           'colaborador',    'entrada'),
  (8,  'OBSOLETO',                    NULL,             NULL),
  (9,  'ENTRE BASES',                'transferência',  'entrada'),
  (10, 'PRODUTO NOVO',               'fornecedor',     'entrada'),
  (11, 'HIGIENIZADO',                'fornecedor',     'entrada'),
  (12, 'DESLIGAMENTO',               'colaborador',    'saída'),
  (13, 'DESMOBILIZAÇÃO',             'colaborador',    'saída'),
  (14, 'MANUTENÇÃO',                 'depósito',       'entrada'),
  (15, 'TESTE ELÉTRICO',             'depósito',       'entrada'),
  (16, 'DESCARTE',                   'depósito',       'saída'),
  (17, 'PEDIDO DE MATERIAL',         'transferência',  'entrada'),
  (18, 'AJUSTE DE INVENTÁRIO',       'ajuste',         'ajuste'),
  (19, 'REFORMA',                    'fornecedor',     'entrada')
ON CONFLICT (id) DO NOTHING;
SELECT setval('tipo_justificativa_id_seq', 19);

-- Estoques (Equipe e Individual)
INSERT INTO public.estoques (id, nome, tipo_estoque, deposito) VALUES
  (0,    '#x Itens Separados',                       'Equipe',      NULL),
  (1,    'SESMT - ITARANA',                           'Equipe',      'SESMT - ITARANA'),
  (2,    'SESMT - ARACRUZ',                           'Equipe',      'SESMT - ARACRUZ'),
  (4,    'ABRAAO ROSSIMAN RODRIGUES CEZAR',           'Individual',  NULL),
  (5,    'ADENILSON BARBOSA (DESLIGADO)',              'Individual',  NULL),
  (6,    'ADGAR DE SOUZA',                            'Individual',  NULL),
  (8,    'ADRIANO DE PAULO CASTRO',                   'Individual',  NULL),
  (9,    'ADRIANO JOSE DOS SANTOS',                   'Individual',  NULL),
  (10,   'ALEF SANTOS SANTANA',                       'Individual',  NULL),
  (11,   'ALEXANDRE OLIVEIRA PEREIRA FELES',          'Individual',  NULL),
  (12,   'ALEX HANDRIS MAIER',                        'Individual',  NULL),
  (13,   'ALEXSANDRO DA CONCEICAO LIMA',              'Individual',  NULL),
  (132,  'ADENILSON BARBOSA',                         'Individual',  NULL),
  (279,  'ESTOQUE ORIGEM 279',                        'Equipe',      NULL),
  (498,  'ESTOQUE 498',                               'Equipe',      NULL),
  (538,  'ESTOQUE 538',                               'Equipe',      NULL),
  (726,  'ESTOQUE 726',                               'Equipe',      NULL),
  (1100, 'ESTOQUE 1100',                              'Equipe',      NULL),
  (1269, 'ESTOQUE 1269',                              'Equipe',      NULL),
  (1275, 'ESTOQUE 1275',                              'Equipe',      NULL)
ON CONFLICT (id) DO NOTHING;
SELECT setval('estoques_id_seq', 1275);

-- Usuários (Funcionários)
INSERT INTO public.usuario (id, matricula, nome, email) VALUES
  (1,  17038, 'Vinícius Batista Donato',             'vinicius.donato@eletromarquez.com.br'),
  (2,  25,    'Abraao Rossiman Rodrigues Cezar',      NULL),
  (3,  132,   'Adenilson Barbosa',                     'adenilsonbarbosa2001@gmail.com'),
  (4,  208,   'Adgar de Sousa',                        NULL),
  (5,  61,    'Adrian Kenisson Lusa',                  'adrian.lusa@eletromarquez.com.br'),
  (6,  127,   'Adriano de Paulo Castro',               NULL),
  (7,  210,   'Adriano Jose dos Santos',               'adrianotuinha@hotmail.com'),
  (8,  242,   'Alef Santos Santana',                   NULL),
  (9,  215,   'Alex Handris Maier',                    NULL),
  (10, 18004, 'Alexandre Oliveira Pereira Feles',      NULL),
  (11, 241,   'Alipio Demoner Diniz',                  'alipio.diniz@eletromarquez.com.br'),
  (12, 140,   'Anelito de Araujo Costa',               'anelitoaraujo2017777@gmail.com'),
  (13, 227,   'Arilson Taffner',                       'arilsontaffner@gmail.com'),
  (14, 19011, 'Arthur Das Virgens Sala',               NULL),
  (1063, NULL, 'Usuário 1063',                         NULL),
  (1841, NULL, 'Usuário 1841',                         NULL)
ON CONFLICT (id) DO NOTHING;
SELECT setval('usuario_id_seq', 1841);

-- Materiais
INSERT INTO public.materiais (id, codigo, descricao, tipo_material_id, unidade_id, seriado, custo_unitario) VALUES
  (1,  'EM0001', 'ALICATE AMPERÍMETRO DIGITAL ET-3200 MINIPA',         3, 5, false, 0),
  (2,  'EM0002', 'MATERIAL 2',                                          3, 5, false, 27),
  (3,  'EM0003', 'ARCO DE SERRA FIXO 12" K140 STARRET',                3, 3, false, 33),
  (4,  'EM0004', 'MATERIAL 4',                                          3, 5, false, 150),
  (5,  'EM0005', 'MATERIAL 5',                                          3, 5, false, 13),
  (6,  'EM0006', 'GARRAFÃO INVICTA 5L',                                 3, 3, false, 132),
  (7,  'EM0007', 'LANTERNA HIBRIDA 19LEDS BIVOLT RAYOVAC',             3, 3, false, 4000),
  (8,  'EM0008', 'LONA POLIETILENO 2x2M VONDER',                       3, 3, false, 190),
  (9,  'EM0009', 'MATERIAL 9',                                          3, 5, false, 490),
  (38, 'EM0038', 'MATERIAL 38',                                         3, 5, false, 0),
  (45, 'EM0045', 'MATERIAL 45',                                         3, 5, false, 0),
  (72, 'EM0072', 'MATERIAL 72',                                         3, 5, false, 0),
  (149,'EM0149', 'MATERIAL 149',                                        3, 5, false, 0),
  (195,'EM0195', 'MATERIAL 195',                                        3, 5, false, 0),
  (230,'EM0230', 'MATERIAL 230',                                        3, 5, false, 0),
  (464,'EM0464', 'MATERIAL 464',                                        3, 5, false, 0),
  (885,'EM0885', 'MATERIAL 885',                                        3, 5, false, 0)
ON CONFLICT (id) DO NOTHING;
SELECT setval('materiais_id_seq', 885);

-- Itens de Estoque (saldos)
INSERT INTO public.itens_estoque (id, estoque_id, material_id, saldo) VALUES
  (7636,  498, 72,  2),
  (22693, 498, 195, 1),
  (22707, 498, 149, 1),
  (22712, 498, 230, 3),
  (22714, 498, 464, 4),
  (28055, 498, 885, 1),
  (29330, 1,   38,  232),
  (29337, 1,   45,  24)
ON CONFLICT (id) DO NOTHING;
SELECT setval('itens_estoque_id_seq', 29337);

-- Movimentações
INSERT INTO public.movimentacoes (id, tipo, estoque_origem_id, estoque_destino_id, criado_por_id, finalizado_por_id, criado_em, finalizado_em, situacao, referencia, tipo_estoque, mes_ano) VALUES
  (72701, 'Transferência', 279,  1100, 1063, 1063, '2024-12-12 14:22:47', '2024-12-12 14:23:19', 'Aprovada', '0',             'Individual', '12-2024'),
  (72700, 'Transferência', 279,  538,  1063, 1063, '2024-12-12 14:22:10', '2024-12-12 14:22:23', 'Aprovada', '0',             'Individual', '12-2024'),
  (72699, 'Transferência', 279,  726,  1063, 1063, '2024-12-12 14:18:29', '2024-12-12 14:21:18', 'Aprovada', '0',             'Individual', '12-2024'),
  (72698, 'Transferência', 1269, 1,    1841, 1841, '2024-12-12 14:07:12', '2024-12-12 14:07:28', 'Aprovada', 'Transferência', 'Equipe',     '12-2024'),
  (72697, 'Transferência', 1269, 1275, 1841, 1841, '2024-12-12 14:02:52', '2024-12-12 14:07:00', 'Aprovada', 'Transferência', 'Equipe',     '12-2024'),
  (72696, 'Transferência', 1,    132,  1841, 1841, '2024-12-12 14:00:12', '2024-12-12 14:00:25', 'Aprovada', 'Transferência', 'Individual', '12-2024'),
  (72695, 'Transferência', 132,  1275, 1841, 1841, '2024-12-12 13:59:37', '2024-12-12 13:59:59', 'Aprovada', 'Transferência', 'Equipe',     '12-2024'),
  (72694, 'Transferência', 1275, 1,    1841, 1841, '2024-12-12 13:45:50', '2024-12-12 13:46:11', 'Aprovada', 'Transferência', 'Equipe',     '12-2024')
ON CONFLICT (id) DO NOTHING;
SELECT setval('movimentacoes_id_seq', 72701);

-- Itens de Movimentação (movimentacao_ids corrigidos para referenciar IDs reais)
INSERT INTO public.itens_movimentacoes (id, movimentacao_id, material_id, quantidade, observacao, material_seriado_id, valor, justificativa_id) VALUES
  (1, 72694, 1, 118, NULL, NULL, 34,   7),
  (2, 72695, 6, 93,  NULL, NULL, 132,  7),
  (3, 72695, 7, 25,  NULL, NULL, 4000, 7),
  (4, 72695, 8, 4,   NULL, NULL, 190,  7),
  (5, 72695, 9, 6,   NULL, NULL, 490,  7),
  (6, 72696, 4, 40,  NULL, NULL, 150,  7),
  (7, 72696, 5, 18,  NULL, NULL, 13,   7),
  (8, 72697, 2, 167, NULL, NULL, 27,   7),
  (9, 72697, 3, 154, NULL, NULL, 33,   7)
ON CONFLICT (id) DO NOTHING;
SELECT setval('itens_movimentacoes_id_seq', 9);
