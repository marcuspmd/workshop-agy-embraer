-- Dados fictícios para desenvolvimento e testes.
INSERT INTO aeronaves (matricula, modelo, numero_serie, operador, status) VALUES
    ('PR-ABC', 'E195-E2', '19020001', 'Linhas Aéreas Exemplo', 'ativa'),
    ('PR-XYZ', 'E175',    '17000123', 'Linhas Aéreas Exemplo', 'manutencao'),
    ('PS-EMB', 'E190-E2', '19010042', 'Táxi Aéreo Demonstração', 'ativa');

INSERT INTO voos (id, matricula, origem, destino, decolagem_em, pouso_em, horas_voo, ciclos) VALUES
    (1, 'PR-ABC', 'SBGR', 'SBRJ', '2026-11-01 10:00:00', '2026-11-01 11:05:00', 1.08, 1),
    (2, 'PR-ABC', 'SBRJ', 'SBGR', '2026-11-01 13:00:00', '2026-11-01 14:02:00', 1.03, 1),
    (3, 'PR-ABC', 'SBGR', 'SBPA', '2026-11-03 08:30:00', '2026-11-03 10:15:00', 1.75, 1),
    (4, 'PR-XYZ', 'SBKP', 'SBCF', '2026-10-28 18:00:00', '2026-10-28 19:10:00', 1.17, 1),
    (5, 'PS-EMB', 'SBSJ', 'SBGR', '2026-11-05 07:00:00', '2026-11-05 07:40:00', 0.67, 1);

INSERT INTO manutencoes (id, matricula, tipo, descricao, realizada_em, responsavel_matricula) VALUES
    (1, 'PR-XYZ', 'corretiva', 'Troca de válvula de sangria do motor 2', '2026-10-30', 'MEC-0042'),
    (2, 'PR-ABC', 'inspecao',  'Inspeção A-check', '2026-10-15', 'MEC-0007');
