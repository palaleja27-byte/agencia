---
name: Editor Quirúrgico AgenciaRR (index.html)
description: Mapa y reglas para realizar cambios rápidos y precisos en la aplicación monolítica index.html. Incluye el algoritmo DELTA-SHIFT™ actualizado para usar puntos_total, y el estado del proyecto al 25-Abr-2026.
---

# 🛠️ Skill: Editor Quirúrgico AgenciaRR
## Proyecto base — Estado al 25-Abr-2026

Esta Skill es la documentación técnica viva del proyecto AgenciaRR. Contiene el mapa del código, el algoritmo oficial de puntos (sincronizado con Datame en tiempo real) y las reglas de edición quirúrgica.

---

## 📋 1. Reglas de Modificación Quirúrgica

- **PROHIBIDO leer el archivo completo.** El `index.html` tiene +14,700 líneas.
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
  Datame devuelve puntos_total = 1409.88
  → puntos_baseline = 1409.88  (SE FIJA UNA VEZ, NUNCA SE SOBREESCRIBE)
  → puntos_neto     = 0.0 pts   (operador empieza desde cero)

10:00 — Lectura del watcher
  Datame devuelve puntos_total = 1439.76
  → puntos_neto = 1439.76 - 1409.88 = 29.88 pts ✅

14:00 — Cambio a TARDE (nuevo operador logueado)
  Watcher detecta nueva jornada 'Tarde'
  → Nuevo registro: puntos_baseline = 1439.76
  → puntos_neto_tarde = 0.0 pts (nuevo operador empieza en 0)
  El historial de MAÑANA queda guardado permanentemente en la DB.
```

### Regla de Sanidad del Baseline
Si `puntos_neto > puntos_total * 0.60` → el baseline es corrupto.
- El watcher **limpia su memoria** y **corrige en DB** estableciendo un `baseline` del 97% del total (asumiendo que los puntos netos recientes fueron el 3%).
- **Causa típica**: un SQL de corrección manual asignó el baseline a 0 o al de otro perfil por error.

### Distribución Dinámica (Ranking)
Las tarjetas de Ranking se calculan de manera dinámica (Línea 5063 de index.html):
- Si el operador está **logueado** en este momento, se le suman los puntos de la `jornada actual` (sin importar si es su turno oficial).
- Si el operador **no está logueado**, se muestran los puntos acumulados de su turno oficial.

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
| `renderRanking` | L4998 | Dibuja las cards del ranking con puntos dinámicos |
| `renderOpDashboard` | L10964 | Vista principal del operador logueado |
| `psaCargarDesdeSupabase` | L7697 | PSA Smart: carga puntos del turno desde Supabase |
| `sincronizarDatamePaneles` | L13848 | Sync con Supabase + Realtime |
| `_opRtSync` | L14215 | Consulta Supabase y calcula DELTA-SHIFT™ del operador |

---

## 🗃️ 4. Base de Datos Supabase

### Tabla `operaciones` (principal — DELTA-SHIFT™)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial | PK auto |
| `id_perfil` | text | ID del perfil en Datame (7-10 dígitos) |
| `agencia` | text | Nombre del panel de extracción (PANEL-1, PANEL-2, etc) |
| `puntos` | numeric | Legado |
| `puntos_total` | numeric(12,2) | Total mensual acumulado (directo de Datame) |
| `puntos_baseline` | numeric(12,2) | Total al INICIO del turno (fijado 1 vez) |
| `puntos_neto` | numeric(10,2) | Producción del turno = `puntos_total - puntos_baseline` |
| `fecha_dia` | date | Fecha en zona Colombia |
| `jornada` | text | `'Mañana'` / `'Tarde'` / `'Noche'` |

**Constraint único**: `UNIQUE(id_perfil, fecha_dia, jornada)`

### Tabla `datame_panels` + `datame_perfiles`
- `datame_panels`: credenciales por panel (email, password, activo, nombre)
- `datame_perfiles`: mapeo id_datame → modelo → panel_id

---

## 🤖 5. Watcher (GitHub Actions)

**Archivo**: `watcher.js` y `scraper.js` ahora están unificados en lógica.
**Trigger**: GitHub Actions cron — cada 6 horas (`main.yml`) 
**Ciclo interno**: **Cada 5 minutos** (actualizado 25-Abr).

### Comportamiento clave
- Lee `puntos_total` de Datame.
- Busca un registro previo en Supabase para obtener el `puntos_baseline` (o lo fija si no existe).
- Hace UPSERT calculando `puntos_neto`.
- El botón de **↻ Sync** de la interfaz ahora puede invocar el GitHub Action usando la API y un PAT.

---

## ⚠️ 6. Errores Conocidos y sus Fixes

### Error: Puntos de la mañana en 0.0 pts y Baseline desplazado
**Causa**: Correr el "scraper" sin lógica `puntos_total` o ejecutar SQL de limpiezas agresivas que asignan `puntos_neto = 0` o `puntos_baseline = puntos_total`.
**Fix aplicado**: `scraper.js` y `watcher.js` ahora escriben `puntos_total` y `puntos_baseline`. Existe `update_operaciones_jornada.sql` para inyectar un Baseline manual con JOIN a `datame_perfiles` desde un Excel en caso de que ocurran fallas y se pierda la memoria del inicio de turno.

### Error: Dashboard (operador o Ranking) muestra 0.0 pts 
**Causa**: La fila en `operaciones` tiene `puntos_total = NULL` o `puntos_baseline = NULL`.
**Fix**: Ejecutar el watcher o scraper nuevamente.
