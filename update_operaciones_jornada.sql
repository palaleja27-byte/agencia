-- ======================================================================
-- 🛠️ SCRIPT DE EMERGENCIA: RESTAURACIÓN EXACTA DE PUNTOS MAÑANA
-- Ejecutar en el SQL Editor de Supabase
-- ======================================================================

-- 1. Restaurar el baseline (Comienza) exacto cruzando con la tabla datame_perfiles
UPDATE operaciones o
SET puntos_baseline = CASE
    WHEN p.modelo = 'RICARDO' THEN 7587.18
    WHEN p.modelo = 'PABLO' THEN 1409.88
    WHEN p.modelo = 'SANDRA MARIA' THEN 1061.28
    WHEN p.modelo = 'NORBERTO' THEN 594.54
    WHEN p.modelo = 'DANIEL 68' THEN 6834.42
    WHEN p.modelo = 'AGUSTIN FERNANDO' THEN 501.72
    WHEN p.modelo = 'FRANCISCO' THEN 352.74
    WHEN p.modelo = 'RENATO' THEN 516.60
    WHEN p.modelo = 'LUIS JOAO' THEN 1649.46
    WHEN p.modelo = 'HECTOR' THEN 250.02
    WHEN p.modelo = 'LUCAS' THEN 4598.46
    WHEN p.modelo = 'LUIS DAROSA' THEN 2892.54
    WHEN p.modelo = 'HORACIO' THEN 2344.92
    WHEN p.modelo = 'IVALDO' THEN 2771.88
    WHEN p.modelo = 'SEBASTIAN' THEN 248.70
    WHEN p.modelo = 'JUVENAL' THEN 32.28
    WHEN p.modelo = 'RAUL' THEN 507.78
    WHEN p.modelo = 'MARCOS' THEN 2698.62
    WHEN p.modelo = 'DAMIAN' THEN 4895.70
    WHEN p.modelo = 'KETY' THEN 54.30
    WHEN p.modelo = 'LEANDRO' THEN 641.52
    WHEN p.modelo = 'VALDEMIR' THEN 2278.02
    WHEN p.modelo = 'ARMANDO' THEN 719.70
    WHEN p.modelo = 'RAFAEL' THEN 1396.98
    WHEN p.modelo = 'CARINA' THEN 29.37
    WHEN p.modelo = 'ALFREDO' THEN 1878.00
    WHEN p.modelo = 'GERMAN' THEN 211.98
    WHEN p.modelo = 'RALPH' THEN 743.40
    WHEN p.modelo = 'VALQUIMAR' THEN 258.60
    WHEN p.modelo = 'RAONI' THEN 5604.42
    WHEN p.modelo = 'AGUSTIN' THEN 1469.70
    WHEN p.modelo = 'MARCOS ANTONIO' THEN 3021.60
    WHEN p.modelo = 'BEATRIZ' THEN 19.53
    WHEN p.modelo = 'RENEE' THEN 222.72
    WHEN p.modelo = 'MARIO' THEN 435.66
    WHEN p.modelo = 'FERMIN' THEN 471.54
    WHEN p.modelo = 'FERNANDO' THEN 4534.92
    WHEN p.modelo = 'MURILO' THEN 192.54
    WHEN p.modelo = 'RODRIGO' THEN 3878.70
    WHEN p.modelo = 'AGNALDO' THEN 414.54
    WHEN p.modelo = 'LUIZ' THEN 547.80
    ELSE o.puntos_baseline
END
FROM datame_perfiles p
WHERE o.id_perfil = p.id_datame
  AND o.fecha_dia = CURRENT_DATE 
  AND o.jornada = 'Mañana';

-- 2. Recalcular el neto exacto de la Mañana con la fórmula oficial (total - baseline)
UPDATE operaciones
SET puntos_neto = GREATEST(0, puntos_total - puntos_baseline)
WHERE fecha_dia = CURRENT_DATE 
  AND jornada = 'Mañana'
  AND puntos_total > 0;
