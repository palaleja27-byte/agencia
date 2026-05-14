-- ══════════════════════════════════════════════════════════════════════════
-- CALIBRACIÓN DELTA-SHIFT™ — MAÑANA 14-Mayo-2026
-- Fuente: Corte manual 10:00 AM Colombia
-- Propósito: Fijar puntos_baseline = "Comienza" (valor al inicio del turno 6 AM)
--            y recalcular puntos_neto = puntos_total - puntos_baseline
-- ══════════════════════════════════════════════════════════════════════════

-- Paso 1: Upsert de TODOS los perfiles activos con sus baselines exactos del corte 10:00 AM
-- El "Comienza" del corte ES el puntos_baseline (valor al inicio del turno)
-- El "En Curso" del corte ES el puntos_total (valor actual acumulado de Datame)
-- El "Total" del corte = puntos_total - puntos_baseline = puntos_neto

-- ═══════════════════════════════════════
-- PANEL 1 — Perfiles principales
-- ═══════════════════════════════════════

-- 88243516 | RICARDO | Comienza=3475.80 | En Curso=3484.44 | Total=8.64
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('88243516', 'RICARDO', 3484.44, 3475.80, 8.64, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 3484.44, puntos_baseline = 3475.80, puntos_neto = 8.64;

-- 95956014 | PABLO | Comienza=1089.60 | En Curso=1094.40 | Total=4.80
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('95956014', 'PABLO', 1094.40, 1089.60, 4.80, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1094.40, puntos_baseline = 1089.60, puntos_neto = 4.80;

-- 91360720 | SANDRA MARIA | Comienza=736.50 | En Curso=739.98 | Total=3.48
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('91360720', 'SANDRA MARIA', 739.98, 736.50, 3.48, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 739.98, puntos_baseline = 736.50, puntos_neto = 3.48;

-- 143017065 | MARIO | Comienza=289.84 | En Curso=293.40 | Total=3.56
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('143017065', 'MARIO', 293.40, 289.84, 3.56, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 293.40, puntos_baseline = 289.84, puntos_neto = 3.56;

-- 91733663 | DANIEL 68 | Comienza=3882.98 | En Curso=3922.70 | Total=39.72
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('91733663', 'DANIEL 68', 3922.70, 3882.98, 39.72, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 3922.70, puntos_baseline = 3882.98, puntos_neto = 39.72;

-- 153039388 | AGUSTIN FERNANDO | Comienza=161.80 | En Curso=162.64 | Total=0.84
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('153039388', 'AGUSTIN FERNANDO', 162.64, 161.80, 0.84, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 162.64, puntos_baseline = 161.80, puntos_neto = 0.84;

-- 79679899 | NORBERTO | Comienza=427.74 | En Curso=432.06 | Total=4.32
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('79679899', 'NORBERTO', 432.06, 427.74, 4.32, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 432.06, puntos_baseline = 427.74, puntos_neto = 4.32;

-- 109551682 | RENATO | Comienza=254.58 | En Curso=254.70 | Total=0.12
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('109551682', 'RENATO', 254.70, 254.58, 0.12, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 254.70, puntos_baseline = 254.58, puntos_neto = 0.12;

-- 131130713 | LUIS JOAO | Comienza=1212.00 | En Curso=1253.88 | Total=41.88
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('131130713', 'LUIS JOAO', 1253.88, 1212.00, 41.88, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1253.88, puntos_baseline = 1212.00, puntos_neto = 41.88;

-- 101652076 | CARINA | Comienza=21.12 | En Curso=21.12 | Total=0.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('101652076', 'CARINA', 21.12, 21.12, 0.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 21.12, puntos_baseline = 21.12, puntos_neto = 0.00;

-- 108018336 | LUCAS | Comienza=1985.52 | En Curso=2054.94 | Total=69.42
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('108018336', 'LUCAS', 2054.94, 1985.52, 69.42, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 2054.94, puntos_baseline = 1985.52, puntos_neto = 69.42;

-- 103289167 | LUIS DAROSA | Comienza=1807.98 | En Curso=1826.40 | Total=18.42
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('103289167', 'LUIS DAROSA', 1826.40, 1807.98, 18.42, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1826.40, puntos_baseline = 1807.98, puntos_neto = 18.42;

-- 118179794 | HORACIO | Comienza=1092.12 | En Curso=1105.02 | Total=12.90
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('118179794', 'HORACIO', 1105.02, 1092.12, 12.90, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1105.02, puntos_baseline = 1092.12, puntos_neto = 12.90;

-- 130338853 | IVALDO | Comienza=1062.42 | En Curso=1069.02 | Total=6.60
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('130338853', 'IVALDO', 1069.02, 1062.42, 6.60, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1069.02, puntos_baseline = 1062.42, puntos_neto = 6.60;

-- 160352260 | JUVENAL | Comienza=256.08 | En Curso=256.08 | Total=0.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('160352260', 'JUVENAL', 256.08, 256.08, 0.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 256.08, puntos_baseline = 256.08, puntos_neto = 0.00;

-- 145834230 | MURILO | Comienza=114.12 | En Curso=114.12 | Total=0.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('145834230', 'MURILO', 114.12, 114.12, 0.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 114.12, puntos_baseline = 114.12, puntos_neto = 0.00;

-- 120720195 | MARCOS | Comienza=733.44 | En Curso=741.12 | Total=7.68
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('120720195', 'MARCOS', 741.12, 733.44, 7.68, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 741.12, puntos_baseline = 733.44, puntos_neto = 7.68;

-- 139247498 | DAMIAN | Comienza=1221.24 | En Curso=1255.38 | Total=34.14
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('139247498', 'DAMIAN', 1255.38, 1221.24, 34.14, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1255.38, puntos_baseline = 1221.24, puntos_neto = 34.14;

-- 120275229 | GERMAN | Comienza=140.16 | En Curso=140.16 | Total=0.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('120275229', 'GERMAN', 140.16, 140.16, 0.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 140.16, puntos_baseline = 140.16, puntos_neto = 0.00;

-- 157067734 | VALDEMIR | Comienza=1501.50 | En Curso=1507.50 | Total=6.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('157067734', 'VALDEMIR', 1507.50, 1501.50, 6.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1507.50, puntos_baseline = 1501.50, puntos_neto = 6.00;

-- 103291980 | ARMANDO | Comienza=313.50 | En Curso=315.90 | Total=2.40
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('103291980', 'ARMANDO', 315.90, 313.50, 2.40, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 315.90, puntos_baseline = 313.50, puntos_neto = 2.40;

-- 130431310 | RAFAEL | Comienza=566.00 | En Curso=568.16 | Total=2.16
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('130431310', 'RAFAEL', 568.16, 566.00, 2.16, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 568.16, puntos_baseline = 566.00, puntos_neto = 2.16;

-- 98389135 | RAUL | Comienza=292.26 | En Curso=295.98 | Total=3.72
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('98389135', 'RAUL', 295.98, 292.26, 3.72, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 295.98, puntos_baseline = 292.26, puntos_neto = 3.72;

-- 139245989 | ALFREDO | Comienza=555.56 | En Curso=562.52 | Total=6.96
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('139245989', 'ALFREDO', 562.52, 555.56, 6.96, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 562.52, puntos_baseline = 555.56, puntos_neto = 6.96;

-- 98540781 | LEANDRO | Comienza=190.80 | En Curso=222.06 | Total=31.26
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('98540781', 'LEANDRO', 222.06, 190.80, 31.26, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 222.06, puntos_baseline = 190.80, puntos_neto = 31.26;

-- 156881990 | RALPH | Comienza=631.14 | En Curso=664.86 | Total=33.72
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('156881990', 'RALPH', 664.86, 631.14, 33.72, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 664.86, puntos_baseline = 631.14, puntos_neto = 33.72;

-- 151070498 | VALQUIMAR | Comienza=98.64 | En Curso=99.84 | Total=1.20
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('151070498', 'VALQUIMAR', 99.84, 98.64, 1.20, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 99.84, puntos_baseline = 98.64, puntos_neto = 1.20;

-- 130422416 | RAONI/KETY | Comienza=1856.52 | En Curso=1903.80 | Total=47.28
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('130422416', 'RAONI', 1903.80, 1856.52, 47.28, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1903.80, puntos_baseline = 1856.52, puntos_neto = 47.28;

-- 138130329 | AGUSTIN | Comienza=886.50 | En Curso=890.82 | Total=4.32
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('138130329', 'AGUSTIN', 890.82, 886.50, 4.32, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 890.82, puntos_baseline = 886.50, puntos_neto = 4.32;

-- 133085188 | MARCOS ANTONIO | Comienza=879.66 | En Curso=880.02 | Total=0.36
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('133085188', 'MARCOS ANTONIO', 880.02, 879.66, 0.36, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 880.02, puntos_baseline = 879.66, puntos_neto = 0.36;

-- 118692242 | FRANCISCO | Comienza=93.82 | En Curso=93.94 | Total=0.12
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('118692242', 'FRANCISCO', 93.94, 93.82, 0.12, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 93.94, puntos_baseline = 93.82, puntos_neto = 0.12;

-- 143014129 | RENEE | Comienza=87.60 | En Curso=88.20 | Total=0.60
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('143014129', 'RENEE', 88.20, 87.60, 0.60, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 88.20, puntos_baseline = 87.60, puntos_neto = 0.60;

-- 95955130 | HECTOR | Comienza=238.98 | En Curso=241.26 | Total=2.28
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('95955130', 'HECTOR', 241.26, 238.98, 2.28, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 241.26, puntos_baseline = 238.98, puntos_neto = 2.28;

-- 145211163 | FERAN/FERMIN | Comienza=107.16 | En Curso=108.12 | Total=0.96
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('145211163', 'FERAN', 108.12, 107.16, 0.96, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 108.12, puntos_baseline = 107.16, puntos_neto = 0.96;

-- 144863124 | FERNANDO | Comienza=1220.76 | En Curso=1231.46 | Total=10.70
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('144863124', 'FERNANDO', 1231.46, 1220.76, 10.70, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1231.46, puntos_baseline = 1220.76, puntos_neto = 10.70;

-- 145844971 | RODRIGO | Comienza=1515.36 | En Curso=1531.02 | Total=15.66
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('145844971', 'RODRIGO', 1531.02, 1515.36, 15.66, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1531.02, puntos_baseline = 1515.36, puntos_neto = 15.66;

-- 156716207 | AGNALDO | Comienza=188.94 | En Curso=189.54 | Total=0.60
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('156716207', 'AGNALDO', 189.54, 188.94, 0.60, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 189.54, puntos_baseline = 188.94, puntos_neto = 0.60;

-- 137163229 | SEBASTIAN | Comienza=144.54 | En Curso=144.54 | Total=0.00
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('137163229', 'SEBASTIAN', 144.54, 144.54, 0.00, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 144.54, puntos_baseline = 144.54, puntos_neto = 0.00;

-- 157112125 | LUIZ | Comienza=1571.04 | En Curso=1580.64 | Total=9.60
INSERT INTO operaciones (id_perfil, agencia, puntos_total, puntos_baseline, puntos_neto, fecha_dia, jornada)
VALUES ('157112125', 'LUIZ', 1580.64, 1571.04, 9.60, '2026-05-14', 'Mañana')
ON CONFLICT (id_perfil, fecha_dia, jornada)
DO UPDATE SET puntos_total = 1580.64, puntos_baseline = 1571.04, puntos_neto = 9.60;

-- ═══════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════
-- Total esperado del corte: 438.42 pts neto combinado
-- Correr esta query para verificar:
-- SELECT id_perfil, agencia, puntos_baseline, puntos_total, puntos_neto, jornada
-- FROM operaciones
-- WHERE fecha_dia = '2026-05-14' AND jornada = 'Mañana'
-- ORDER BY puntos_neto DESC;
