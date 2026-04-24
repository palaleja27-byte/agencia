---
name: Editor Quirúrgico AgenciaRR (index.html)
description: Mapa y reglas para realizar cambios rápidos y precisos en la aplicación monolítica index.html sin analizar todo el código, ahorrando tokens y tiempo.
---

# 🛠️ Skill: Editor Quirúrgico AgenciaRR

Esta Skill ha sido creada para agilizar el mantenimiento del archivo `index.html` de AgenciaRR, el cual es una Single-Page Application (SPA) súper monolítica (+14,000 líneas). Ya que el código principal es estable y completamente funcional, nuestro objetivo con esta Skill es realizar agregados y pequeños cambios de manera eficiente ("quirúrgica").

### 📋 1. Reglas de Modificación
- **PROHIBIDO leer el archivo completo.** Esto agota el contexto.
- **Flujo de trabajo obligatorio**:
  1. Utiliza `grep_search` para buscar identificadores clave (ej. un `id`, una variable o un nombre de `function`).
  2. Si hay coincidencias, extrae la línea, y luego usa `view_file` con un `StartLine` y `EndLine` precisos (un radio de +/- 50 líneas) para ver solo la porción relevante.
  3. Ejecuta los cambios mediante herramientas de reemplazo de contenido delimitado (`replace_file_content` o `multi_replace_file_content`), asegurándote de no dañar el HTML, CSS o JS circundante.

---

### 🗺️ 2. Mapa Rápido del Monolito

- **`Líneas iniciales`**: Encabezados HTML, `<head>`, importación de librerías (Chart.js, XLSX, Supabase JS).
- **`Bloque <style>`**: Variables en `:root` y clases CSS. Todo el CSS está arriba.
- **`Bloque HTML (body)`**: Pantallas anidadas con `display: none` / `display: block`.
  - `#login-screen`: Inicio de sesión, teclado numérico (PIN), y selección de roles.
  - `#op-dashboard`: Interfaz principal para el rango Operador.
  - `#admin-panel` y otras vistas (modales de historial).
- **`Bloque <script>`**: Al final del archivo (~L6000 en adelante). Contiene toda la lógica reactiva en Vanilla JS.

---

### 🧠 3. Módulos JS Clave

| Módulo | Línea aprox. | Descripción |
|---|---|---|
| `renderOpDashboard` | L10823 | Renderiza la vista del operador logueado |
| `getPuntosHoy` | L7683 | Calcula pts de hoy desde localStorage |
| `renderCorteSection` | L7863 | Sección de corte diario del operador |
| `dpRenderGrid` | L13746 | Renderiza las cards de perfiles por panel (Datame) |
| `sincronizarDatamePaneles` | L13848 | Sincroniza con Supabase y actualiza `_dpPuntosData`, `_dpTurnosData`, `_dpHistorialData` |
| `dpMostrarWrap` | L13700 aprox | Muestra/oculta el bloque Datame según rol |
| `opRtActivar` | Final del script | Activa la suscripción Realtime de Supabase para el operador logueado |

---

### 🏗️ 4. Arquitectura del Sistema Datame

#### 4.1 Lógica de Puntos por Turno

Los turnos son de 8 horas. El turno **nuevo empieza en 0** pero se guarda historial permanente.

```
Turno NOCHE:   22:00 → 06:00
Turno MAÑANA:  06:00 → 14:00
Turno TARDE:   14:00 → 22:00
```

**Flujo correcto de datos:**

```
06:00 AM — Inicio turno MAÑANA
  watcher consulta Datame (rango: mes completo)
  Datame devuelve: total_acumulado_mes = 7,257.90
  → se guarda como puntos_baseline = 7,257.90 (NUNCA se sobreescribe en el turno)

08:00 AM — Primera lectura del turno
  Datame devuelve: 7,343.18
  neto_turno = 7,343.18 - 7,257.90 = 85.28 pts ✅ (real del turno)

14:00 — Cambio a TARDE
  watcher detecta nueva jornada → fija nuevo baseline para TARDE = 7,343.18
  neto_tarde reinicia en 0 para el nuevo operador ✅
```

#### 4.2 Columnas de la tabla `operaciones` (Supabase)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial | PK auto |
| `id_perfil` | text | ID del perfil en Datame |
| `agencia` | text | Nombre del panel/modelo |
| `puntos` | numeric | Legado — igual a puntos_total |
| `puntos_total` | numeric(12,2) | Total acumulado del mes (lo que trae Datame con rango mensual) |
| `puntos_baseline` | numeric(12,2) | Total al INICIO del turno (punto de referencia = 0 del operador) |
| `puntos_neto` | numeric(10,2) | Puntos hechos EN ESTE TURNO = puntos_total - puntos_baseline |
| `fecha_corte` | timestamptz | Timestamp de la última captura |
| `fecha_dia` | date | Fecha del día (zona Colombia) |
| `jornada` | text | 'Mañana' / 'Tarde' / 'Noche' / 'Auto' |

**Constraint único**: `UNIQUE(id_perfil, fecha_dia, jornada)` → nombre: `uq_perfil_dia_jornada`

#### 4.3 Variables JS de Estado (Datame Panel)

```javascript
_dpActivePanelId    // Panel activo (1,2,3,4)
_dpPuntosData       // { id_perfil: { puntos_total, puntos_baseline, puntos_neto, fecha_corte } }
_dpTurnosData       // { id_perfil: { 'Mañana': X, 'Tarde': Y, 'Noche': Z } }  ← neto por turno hoy
_dpHistorialData    // { id_perfil: [ { fecha_dia, jornada, neto_dia } ] }  ← historial de turnos
DP_PANELS_META      // [ { id, nombre, color } ]
DP_PERFILES_MAP     // { panel_id: [ { id, modelo } ] }
```

#### 4.4 Display en cards (`dpRenderGrid`)

```
┌──────────────────────────────────────┐
│  PABLO (ID: 95956014)                │
│  [CIFRA GRANDE] 1,371.3 pts ← puntos_total (total mes) │
│  $1,919,820 COP                      │
│  📅 24/4                             │
│────────────────────────────────────── │
│  🕐 HOY POR TURNO                    │
│  🌅 Mañana ●  4.9 pts  ← puntos_neto │
│  🌇 Tarde     0.0 pts               │
│  🌙 Noche     0.0 pts               │
│──────────────────────────────────────│
│  📆 HISTORIAL DE TURNOS              │
│  24/4 🌅  +4.9                       │
│  23/4 🌙  +182.1                     │
└──────────────────────────────────────┘
```

---

### 🤖 5. Watcher (GitHub Actions)

**Archivo**: `watcher.js`
**Estrategia**: Rango MENSUAL en Datame → obtiene total acumulado del mes → calcula neto por turno usando baseline.

```javascript
// LÓGICA BASELINE:
// 1. Al inicio de un turno nuevo: baseline = puntos_total_actual
// 2. En cada ciclo: neto = puntos_total_actual - baseline
// 3. Al cambiar de turno: nuevo baseline, neto reinicia en 0

// ON CONFLICT en Supabase:
// puntos_baseline = CASE WHEN existente = 0 THEN nuevo ELSE existente END
// → NUNCA sobreescribir el baseline original del turno
```

**Tablas Supabase usadas:**
- `datame_panels`: credenciales de cada panel (email, password, activo)
- `datame_perfiles`: perfiles por panel (id_datame, modelo, panel_id, activo)
- `operaciones`: datos capturados por turno

**Ciclo de vida:**
- GitHub Actions cron: cada 6 horas (reinicia el watcher)
- Watcher: dura 5.5h máximo por ejecución
- Ciclo interno: cada 10 minutos escanea todos los perfiles

---

### 🗃️ 6. Base de datos Supabase

**Otras tablas importantes:**
- `kv_store`: backup genérico clave-valor para sincronización
- `operaciones_v2`: alias/vista para datos enriquecidos (si existe)
- RLS: `CREATE POLICY "write_ops" ON operaciones FOR ALL USING (true)`
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE operaciones`

---

### ⚡ 7. Cómo inyectar nuevo código ("Add-ons")

- **Nuevas Funciones UI**: Localiza el final del bloque de HTML específico y añade los nuevos elementos.
- **Nuevos Estilos**: Añádelos justo antes de la etiqueta de cierre `</style>`.
- **Nueva Lógica JS**: Añadir cerca del final del `<script>` (antes de `</script>`), o ubicar el módulo semántico e inyectar cuidando de no colisionar con variables de scope global.

---

### 📌 8. Datos de Referencia — Corte Manual 24-Abr-2026 8:00 AM

El usuario hace cortes manuales cada 2 horas con esta estructura:
- **Comienza**: total acumulado al inicio del turno (= `puntos_baseline`)
- **En curso**: total acumulado en el momento del corte (= `puntos_total`)
- **Total/Diferencia**: puntos hechos en el turno hasta el corte (= `puntos_neto`)

Valores de referencia (turno Mañana 24-Abr): 
- Total 41 perfiles → 240.18 pts en 2 horas de turno
- Promedio: ~5.9 pts/perfil en 2 horas
- Un turno completo de 8h: ~300 pts por perfil activo (valor normal)

**El file `update_operaciones_jornada.sql` siempre contiene el último SQL de mantenimiento ejecutado.**

---

### 🔧 9. Comandos de Diagnóstico Rápido

```sql
-- Ver datos de hoy por turno
SELECT id_perfil, agencia, jornada, puntos_baseline, puntos_total, puntos_neto
FROM operaciones WHERE fecha_dia = CURRENT_DATE ORDER BY puntos_neto DESC;

-- Ver historial de un perfil
SELECT fecha_dia, jornada, puntos_baseline, puntos_total, puntos_neto
FROM operaciones WHERE id_perfil = '95956014' ORDER BY fecha_dia DESC, jornada;

-- Ver duplicados (debe ser 0)
SELECT id_perfil, fecha_dia, jornada, COUNT(*) FROM operaciones
GROUP BY id_perfil, fecha_dia, jornada HAVING COUNT(*) > 1;
```
