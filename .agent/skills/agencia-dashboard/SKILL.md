---
name: Editor Quirúrgico AgenciaRR (index.html)
description: Mapa y reglas para realizar cambios rápidos y precisos en la aplicación monolítica index.html sin analizar todo el código, ahorrando tokens y tiempo.
---

# 🛠️ Skill: Editor Quirúrgico AgenciaRR

Esta "Skill" ha sido creada para agilizar el mantenimiento del archivo `index.html` de AgenciaRR, el cual es una Single-Page Application (SPA) súper monolítica (+13,000 líneas). Ya que el código principal es estable y completamente funcional, nuestro objetivo con esta Skill es realizar agregados y pequeños cambios de manera eficiente ("quirúrgica").

### 📋 1. Reglas de Modificación
- **PROHIBIDO leer el archivo completo.** Esto agota el contexto.
- **Flujo de trabajo obligatorio**:
  1. Utiliza `grep_search` para buscar identificadores clave (ej. un `id`, una variable o un nombre de `function`).
  2. Si hay coincidencias, extrae la línea, y luego usa `view_file` con un `StartLine` y `EndLine` precisos (un radio de +/- 50 líneas) para ver solo la porción relevante.
  3. Ejecuta los cambios mediante herramientas de reemplazo de contenido delimitado (`replace_file_content` o `multi_replace_file_content`), asegurándote de no dañar el HTML, CSS o JS circundante.

### 🗺️ 2. Mapa Rápido del Monolito
El archivo tiene aproximadamente la siguiente estructura:
- **`Líneas iniciales`**: Encabezados HTML, `<head>`, importación de librerías (Chart.js, XLSX, Supabase JS).
- **`Bloque <style>`**: Todas las variables en `:root` (colores principales, `--accent`, `--panel`), y clases Tailwind-like personalizadas. Diseño responsive y animaciones. Todo el CSS está arriba.
- **`Bloque HTML (body)`**: Pantallas anidadas con `display: none` / `display: block`.
  - `#login-screen`: Inicio de sesión, teclado numérico (PIN), y selección de roles.
  - `#op-dashboard`: Interfaz principal para el rango Operador.
  - `#admin-panel` y otras vistas (como modales de historial).
- **`Bloque <script>`**: Al final del archivo. Contiene toda la lógica reactiva en Vanilla JS.

### 🧠 3. Componentes y Lógica JS
- **Asistencia (Módulo ASI)**: Constantes como `ASI_KEY`, almacenamiento para turnos (mañana, tarde, noche), funciones `asiSetEstado()`, `asiRender()`. Exportación Excel implementada mediante XLXS (`XLSX.utils`).
- **Estados / Persistencia**: El "Cerebro" recae en persistencia híbrida. Primariamente guarda todo localmente a través de `localStorage` (`rr_prime_cortes`, `rr_prime_asistencia`, `rr_asi_horas_dia`).
- **Gráficos**: Uso extensivo de `Chart.js` para los dashboards.
- **Cyberpunk Bridge (Sincronizador Supabase - Laser Sync)**: La conexión principal a BD en la nube. Función vital `sincronizarDatameRelacional()`. Busca nuevos cortes históricos mediante un "ULTRA-MATCHER v15" para correlacionar los nombres de Base de Datos con los operadores locales. Usa respaldo `upsert` a la tabla `kv_store`.

### ⚡ 4. Cómo inyectar nuevo código ("Add-ons")
- **Nuevas Funciones UI**: Localiza el final del bloque de HTML específico (ej. antes de `<!-- MODAL HISTORIAL -->`) y añade los nuevos elementos.
- **Nuevos Estilos**: Añádelos justo antes de la etiqueta de cierre `</style>`.
- **Nueva Lógica JS**: Añadir cerca del final del `<script>`, o ubicar el módulo semántico (ej. debajo del bloque de asistencia o de reportes) e inyectar cuidando de no colisionar con variables de scope global.
