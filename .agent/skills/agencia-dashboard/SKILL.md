---
name: Editor Quirúrgico AgenciaRR (index.html)
description: Mapa y reglas para realizar cambios rápidos y precisos en la aplicación monolítica index.html. Incluye el algoritmo DELTA-SHIFT™ para distribución de puntos por operador y turno, y el estado actual del proyecto al 24-Abr-2026.
---

# 🛠️ Skill: Editor Quirúrgico AgenciaRR
## Proyecto base — Estado al 24-Abr-2026

Esta Skill es la documentación técnica viva del proyecto AgenciaRR. Contiene el mapa del código, el algoritmo oficial de puntos y las reglas de edición quirúrgica.

---

## 📋 1. Reglas de Modificación Quirúrgica

- **PROHIBIDO leer el archivo completo.** El `index.html` tiene +14,400 líneas.
- **Flujo obligatorio**:
  1. Usar `grep_search` o `Select-String` para localizar identificadores clave.
  2. Usar `view_file` con `StartLine`/`EndLine` precisos (radio de ±50 líneas).
  3. Editar con `replace_file_content` o `multi_replace_file_content`.
  4. Siempre hacer `git add -A; git commit -m "..."; git push` al finalizar.

---

## 🏆 2. Algoritmo DELTA-SHIFT™

**Nombre oficial del algoritmo de puntos de AgenciaRR.**

### Concepto
DELTA-SHIFT™ mide la **producción neta de cada operador en su turno**, usando el total acumulado mensual de Datame como fuente y un *baseline* fijado al inicio del turno como punto de referencia.

```
DELTA-SHIFT™ Formula:
  puntos_neto = puntos_total_actual - puntos_baseline_inicio_turno

Donde:
  puntos_total   = total acumulado del perfil en Datame (rango 01/mes → hoy+2días)
  puntos_baseline = valor de puntos_total en el momento exacto en que inicia el turno
  puntos_neto    = lo que produjo el perfil SOLO en este turno (empieza en 0)
```

### Turnos
```
MAÑANA:  06:00 → 14:00  (Colombia, America/Bogota)
TARDE:   14:00 → 22:00
NOCHE:   22:00 → 06:00
```

### Flujo completo DELTA-SHIFT™
```
06:00 — Inicio turno MAÑANA
  Watcher scrape Datame con rango 2026-04-01 → 2026-04-26 (+2 días)
  Datame devuelve puntos_total = 7,257.90
  → puntos_baseline = 7,257.90  (SE FIJA UNA VEZ, NUNCA SE SOBREESCRIBE)
  → puntos_neto     = 0.0 pts   (operador empieza desde cero)

10:00 — Lectura del watcher
  Datame devuelve puntos_total = 7,342.84
  → puntos_neto = 7,342.84 - 7,257.90 = 84.94 pts ✅

14:00 — Cambio a TARDE (nuevo operador logueado)
  Watcher detecta nueva jornada 'Tarde'
  → Nuevo registro: puntos_baseline = 7,342.84
  → puntos_neto_tarde = 0.0 pts (nuevo operador empieza en 0)
  El historial de MAÑANA queda guardado permanentemente en la DB.
```

### Regla de Sanidad del Baseline
Si `puntos_neto > puntos_total * 0.60` → el baseline es corrupto.
- El watcher **limpia su memoria** y **no escribe en DB**.
- El próximo ciclo lee `puntos_baseline` directamente del campo en Supabase.
- **Causa típica**: un SQL de corrección manual asignó el baseline de otro perfil por error.

### Distribución a Operadores (PSA — Puntos Sin Asignar)
```
Cada perfil en Datame → tiene un operador asignado en la asistencia del turno
Si el operador se logueó → sus perfiles se vinculan automáticamente (auto-asistencia)
Si NO se logueó          → los puntos van a "Puntos Sin Asignar"
                           → Admin/Monitor puede asignarlos manualmente con dropdown
```

### Valor en pesos colombianos
```
1 punto = $1,400 COP
COP = puntos_neto × 1,400
```

---

## 🗺️ 3. Mapa Rápido del Monolito (index.html)

### HTML por secciones
| Zona | Descripción |
|---|---|
| `#login-screen` | Login con PIN, selector de rol |
| `#op-dashboard` | Vista del operador logueado |
| `#admin-panel` | Vista admin/monitor |
| `#rk-psa-panel` | Cajón Puntos Sin Asignar (monitor/admin) |
| `#datame-panels-wrap` | Panel de cards Datame (monitor/admin) |
| `#modal-meta-diaria` | Modal "Meta del Día" al login del operador |

### Módulos JS Clave

| Módulo | Línea aprox. | Descripción |
|---|---|---|
| `renderOpDashboard` | L10964 | Vista principal del operador logueado |
| `finalizarLoginOperador` | L10648 | Hook post-login: auto-asistencia + timer turno |
| `mostrarModalMeta` | L10440 | Modal Meta del Día con perfiles seleccionables |
| `_agregarPerfilLogin` | L10600 | Función global para agregar perfil extra en el modal |
| `registrarAutoAsistencia` | L10560 | Marca asistencia automáticamente al login |
| `renderPSAPanel` | L7840 | Cajón PSA (puntos sin asignar) clásico |
| `psaCargarDesdeSupabase` | L7697 | PSA Smart: carga puntos del turno desde Supabase |
| `psaAsignarManual` | L7742 | Asigna manualmente un perfil a un operador |
| `renderPSASmartPanel` | L7760 | Renderiza el PSA Smart con dropdown de asignación |
| `dpRenderGrid` | L13746 | Cards de perfiles por panel Datame |
| `sincronizarDatamePaneles` | L13848 | Sync con Supabase + Realtime |
| `opRtActivar` | L14325 | Activa Realtime del operador (OP-SESSION) |
| `_opRtSync` | L14215 | Consulta Supabase y calcula DELTA-SHIFT™ del operador |
| `_opRtRenderWidget` | L14165 | Widget de puntos en tiempo real con desglose por perfil |

---

## 🗃️ 4. Base de Datos Supabase

### Tabla `operaciones` (principal — DELTA-SHIFT™)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial | PK auto |
| `id_perfil` | text | ID del perfil en Datame (7-10 dígitos) |
| `agencia` | text | Nombre del modelo/perfil |
| `puntos` | numeric | Legado — igual a `puntos_total` |
| `puntos_total` | numeric(12,2) | Total mensual acumulado (directo de Datame) |
| `puntos_baseline` | numeric(12,2) | Total al INICIO del turno (fijado 1 vez) |
| `puntos_neto` | numeric(10,2) | Producción del turno = `puntos_total - puntos_baseline` |
| `fecha_corte` | timestamptz | Timestamp de la última captura |
| `fecha_dia` | date | Fecha en zona Colombia |
| `jornada` | text | `'Mañana'` / `'Tarde'` / `'Noche'` / `'Auto'` |

**Constraint único**: `UNIQUE(id_perfil, fecha_dia, jornada)`

### Tabla `op_sessions` (historial por sesión de login)

| Columna | Descripción |
|---|---|
| `operador` | Nombre del operador |
| `perfil_ids` | Array de IDs que manejó en la sesión |
| `baseline_total` | Total Datame al momento del login |
| `puntos_sesion` | Neto acumulado de toda la sesión |
| `jornada` | Turno de la sesión |
| `fecha_dia` | Fecha en zona Colombia |

### Tabla `datame_panels` + `datame_perfiles`
- `datame_panels`: credenciales por panel (email, password, activo, nombre)
- `datame_perfiles`: mapeo id_datame → modelo → panel_id

### Estado RLS y Realtime
```sql
CREATE POLICY "write_ops" ON operaciones FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE operaciones;
```

---

## 🤖 5. Watcher (GitHub Actions)

**Archivo**: `watcher.js`  
**Trigger**: GitHub Actions cron — cada 6 horas  
**Runtime máximo**: 5.5 horas por ejecución  
**Ciclo interno**: cada 10 minutos (3 segundos por perfil)

### Comportamiento clave del watcher

```javascript
// 1. Rango de Datame: inicio del mes → hoy + 2 días
//    Los +2 días capturan el lag contable de algunos paneles
rangoMesActual() → { start: '2026-04-01', end: '2026-04-26' }

// 2. Detección de jornada por hora Colombia
detectarJornada() → 'Mañana' | 'Tarde' | 'Noche'

// 3. Baseline en memoria (clave única por perfil+día+turno)
shiftBaselines['95956014__2026-04-24__Mañana'] = 7257.90

// 4. Al reiniciar (nueva ejecución de GitHub Actions):
//    Lee puntos_baseline DIRECTO del campo en Supabase (NO recalcula)

// 5. RADAR XHR: detecta puntos en 8 campos de la API de Datame:
//    bonuses | total | total_points | bonuses_total |
//    points  | amount | tokens | score

// 6. Sanidad: si neto > 60% del total → baseline corrupto
//    Acción: delete shiftBaselines[key] + return (no escribe en DB)
```

### Tablas usadas
- Lee: `datame_panels`, `datame_perfiles`
- Escribe: `operaciones` (upsert con conflict en id_perfil+fecha_dia+jornada)

---

## 📱 6. Vista del Operador (OP-SESSION)

### Variables de estado
```javascript
_opRtOpName       // Nombre del operador logueado
_opRtBaseline     // Total Datame al momento del login (null = no fijado aún)
_opRtTotalMes     // Total mensual real de Datame (fuente de verdad para métrica ABRIL)
_opRtPtosSesion   // Suma de netos individuales de todos sus perfiles
_opRtPerfilesNeto // [{ id, nombre, neto, total }] — desglose por perfil
_opRtBaselineMap  // { id_perfil: baseline } — baseline individual por perfil
_opRtTurnos       // { Mañana: X, Tarde: Y, Noche: Z } — historial del día
_opRtSessionId    // ID del registro en op_sessions
```

### Widget de tiempo real
```
⚡ TIEMPO REAL — MAÑANA 🌅          🛰️ 13:45
           87.4 pts en tu turno — 3 perfiles
           $122,360 COP ganados

📊 Por perfil:
  DANIEL 68   91733663  │  75.1 pts (86%)
  NORBERTO    79679899  │  10.3 pts (12%)
  AGUSTIN     153039388 │   2.0 pts ( 2%)
  ─────────────────────────────────────────
  Total sesión  87.4 pts · $122,360 COP

🌅 Mañana: 87.4 pts (turno actual)
```

### Métrica ABRIL en el dashboard
- **Prioridad 1**: `_opRtTotalMes` (Supabase real, se actualiza cada sync)
- **Prioridad 2**: Cortes de localStorage filtrados (solo si puntos < 50,000)
- **Prioridad 3**: `op[curr]` del array estático `operatorsData`

### Flujo de login del operador
```
1. Operador ingresa PIN → loginSuccess('operador', 'ANAZARED')
2. mostrarModalMeta() → muestra Meta del Día + lista de perfiles con checkboxes
3. Operador puede agregar perfil extra → _agregarPerfilLogin()
4. Al confirmar → registrarAutoAsistencia(opName, perfilesElegidos)
5. finalizarLoginOperador(opName)
6. opRtActivar(opName) → fija _opRtBaseline + suscribe Realtime
7. Cada 10 min → _opRtSync() → actualiza widget con neto real
```

---

## 📊 7. Panel Datame (Admin/Monitor)

### Datos visualizados por card
- **Cifra grande**: `puntos_total` (total mensual de Datame)
- **HOY POR TURNO**: `puntos_neto` de cada jornada del día
- **Historial**: turnos anteriores del perfil

### Sync y Realtime
```javascript
sincronizarDatamePaneles()  // consulta operaciones desde 6am hoy
dpIniciarRealtime()         // suscribe a postgres_changes en tabla operaciones
// Se actualiza también cuando el watcher escribe cada 10 minutos
```

### PSA Smart (Puntos Sin Asignar)
```
psaCargarDesdeSupabase()
  → consulta operaciones WHERE fecha_dia = hoy AND jornada = actual AND puntos_neto > 0
  → cruza con draft de asistencia del turno (localStorage)
  → perfiles con operador → asignados (verde)
  → perfiles sin operador → sin asignar (rojo) + dropdown de asignación manual
```

---

## 🔧 8. Comandos de Diagnóstico Rápido

### SQL Supabase

```sql
-- 1. Ver todos los perfiles de hoy con estado DELTA-SHIFT™
SELECT agencia, id_perfil, jornada,
  ROUND(puntos_baseline::numeric, 2) AS baseline,
  ROUND(puntos_total::numeric, 2)    AS total,
  ROUND(puntos_neto::numeric, 2)     AS neto,
  CASE WHEN puntos_neto > puntos_total * 0.60 THEN '🔴 BASELINE CORRUPTO' ELSE '✅ OK' END AS estado
FROM operaciones WHERE fecha_dia = CURRENT_DATE ORDER BY puntos_neto DESC;

-- 2. Sanitizar baselines corruptos (neto > 60% del total)
UPDATE operaciones
SET puntos_neto = ROUND((puntos_total * 0.03)::numeric, 2),
    puntos_baseline = ROUND((puntos_total * 0.97)::numeric, 2)
WHERE fecha_dia = CURRENT_DATE AND jornada = 'Mañana'
  AND puntos_total > 100 AND puntos_neto > puntos_total * 0.60;

-- 3. Recalcular todos los netos del turno con el baseline correcto
UPDATE operaciones
SET puntos_neto = GREATEST(0, puntos_total - puntos_baseline)
WHERE fecha_dia = CURRENT_DATE AND jornada = 'Mañana'
  AND puntos_baseline > 0 AND puntos_total > 0;

-- 4. Ver historial de un perfil específico
SELECT fecha_dia, jornada, puntos_baseline, puntos_total, puntos_neto
FROM operaciones WHERE id_perfil = '91733663' ORDER BY fecha_dia DESC, jornada;
```

### JS en consola del navegador (vista operador)

```javascript
// Ver estado OP-SESSION del operador logueado
console.table(_opRtPerfilesNeto);
console.log('Baseline:', _opRtBaseline, '| Neto:', _opRtPtosSesion, '| Total mes:', _opRtTotalMes);

// Forzar re-sync manual
_opRtSync(_opRtOpName);

// Ver baselines en memoria del módulo PSA
console.log('PSA Data:', _psaSmartData);
```

---

## 📁 9. Archivos del Proyecto

| Archivo | Descripción |
|---|---|
| `index.html` | SPA monolítica (+14,400 líneas) — toda la lógica frontend |
| `watcher.js` | Scraper de Datame — GitHub Actions — DELTA-SHIFT™ engine |
| `scraper.js` | Script de carga inicial de datos históricos (Excel → Supabase) |
| `update_operaciones_jornada.sql` | SQL de mantenimiento de emergencia (siempre actualizado) |
| `.agent/skills/agencia-dashboard/SKILL.md` | Este archivo — documentación técnica viva |

---

## ⚠️ 10. Errores Conocidos y sus Fixes

### Error: Baseline corrupto (como RENEE 24-Abr-2026)
**Síntoma**: Un perfil muestra neto > 90% de su total mensual (ej: 201.8 de 220.4 pts).  
**Causa**: El SQL de corrección manual asignó el `puntos_total` de otro perfil como baseline.  
**Fix**:
1. Identificar el perfil y su total real actual
2. `UPDATE operaciones SET puntos_baseline = total_real - neto_estimado, puntos_neto = neto_estimado WHERE id_perfil = X AND fecha_dia = hoy AND jornada = 'Mañana'`
3. El watcher leerá el `puntos_baseline` correcto en el próximo ciclo

### Error: ABRIL muestra valor inflado (218,230.7)
**Causa**: `renderOpDashboard` leía `getCortesOp` del localStorage con datos viejos.  
**Fix aplicado**: Ahora usa `_opRtTotalMes` (Supabase) con máxima prioridad. Filtro adicional: cortes localStorage > 50,000 pts se ignoran.

### Error: JS visible en el botón "+ Agregar" del modal
**Causa**: Código JS inline en template literal con conflicto de comillas.  
**Fix**: Se extrajo a función global `_agregarPerfilLogin()`.
