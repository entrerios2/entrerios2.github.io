# Plan de Implementación — Nuevas Funciones para Asistente de AV para asambleas

## Contexto

La aplicación actual es una SPA vanilla JS + PWA que gestiona equipos, cables y conexiones AV, respaldada por Google Sheets a través de Google Apps Script. El plan aborda 6 grandes funcionalidades nuevas.

---

## User Review Required

> [!NOTE]
> **Decisiones confirmadas por el usuario:**
> - **Configuraciones**: Una hoja separada por configuración (ej: `3_Conexiones`, `3_Conexiones_reunion`, `3_Conexiones_exterior`). Requiere `Code.gs` con lógica de crear/eliminar hojas dinámicamente.
> - **Contenedores**: Se modelan como equipos con flag `{"es_contenedor": true}` en metadatos.
> - **Préstamos**: Campo `destino` (no `a_quien`). Modelo confirmado.
> - **Puertos**: Se definen una sola vez por equipo/cable, almacenados en metadatos. No varían por configuración.
> - **Orden**: Puertos + Fichas → Formularios → Asistente conexiones → Contenedores → Préstamos → Configuraciones.

> [!WARNING]
> **Tamaño del cambio**: Este plan es grande (~6 features). Se implementará en **fases incrementales**, completando y verificando cada una antes de avanzar.

## Open Questions (Resueltas)

> Todas las preguntas iniciales fueron respondidas. La única pendiente:

1. **Conexión sin cable**: Se implementará como una conexión directa Origen→Destino sin nodo intermedio de cable. El asistente ofrecerá checkbox "Conexión directa (sin cable)".
2. **Configuraciones y estados**: Las configuraciones solo cambian las conexiones. Los estados/ubicaciones de equipos se mantienen independientes de la configuración activa.

---

## Mejora Preliminar — Seguridad Administrativa Básica

### Objetivo
Proteger el acceso al modo admin con una clave opcional. No es seguridad fuerte (el acceso al sitio ya requiere el SSID de la hoja), solo evita que un usuario entre por error a la sección administrativa.

### Flujo

```
Usuario hace click en "Admin" →

  ¿Hay clave_admin en 4_Configuracion?
    │
    ├── NO → Muestra advertencia actual (modal "¿Seguro?")
    │         → Si acepta → activa modo admin
    │
    └── SÍ → ¿Hay flag admin_auth en localStorage?
              │
              ├── SÍ → Activa modo admin directamente
              │
              └── NO → Muestra prompt de clave
                        → Si es correcta → guarda flag en localStorage → activa admin
                        → Si es incorrecta → muestra error, no activa
```

### Almacenamiento

En `4_Configuracion`:
```
ID_Configuracion: clave_admin
Valor: mi_clave_123
Metadatos: {}
```

En `localStorage`:
```javascript
localStorage.setItem('admin_auth', 'true');
// Se puede limpiar con un botón "Cerrar sesión admin" en el sidebar
```

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- Modificar `toggleAdminMode()` para verificar si existe `clave_admin` en `db.configuracion`
- Si existe clave: verificar `localStorage.admin_auth` → si no hay, mostrar prompt → validar contra el valor de `4_Configuracion`
- Si no existe clave: mantener comportamiento actual (advertencia modal)
- Nuevo botón "🔒 Cerrar sesión admin" en el sidebar cuando está en modo admin → limpia `localStorage.admin_auth`

> [!NOTE]
> Esta es seguridad básica intencional. La clave se almacena en texto plano en la hoja. El objetivo es solo evitar acceso accidental, no proteger contra un atacante determinado.

---

## Mejora Preliminar — Modo Claro / Oscuro

### Objetivo
Actualmente el sitio es solo oscuro. Agregar modo claro con detección automática del sistema y toggle manual.

### Comportamiento

1. **Primer ingreso**: detecta `prefers-color-scheme` del sistema → aplica modo correspondiente
2. **Toggle manual**: icono ☀️/🌙 en el sidebar o header → cambia entre modos
3. **Persistencia**: la preferencia manual se guarda en `localStorage.theme` y tiene prioridad sobre el sistema

### Proposed Changes

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

- Migrar todos los colores hardcoded a CSS custom properties (`--bg-primary`, `--text-primary`, `--accent`, etc.)
- Definir `:root` (oscuro por defecto) y `[data-theme="light"]` con la paleta clara
- `@media (prefers-color-scheme: light)` como detección automática

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-surface: #16213e;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #00d4ff;
  /* ... */
}

[data-theme="light"] {
  --bg-primary: #f5f5f5;
  --bg-surface: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #0088cc;
  /* ... */
}
```

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- Función `initTheme()` — lee `localStorage.theme` o detecta sistema, aplica `data-theme` al `<html>`
- Función `toggleTheme()` — cambia entre light/dark, guarda en `localStorage`
- Icono toggle en el sidebar

---

## Mejora Preliminar — Colores de Señal Consistentes

### Objetivo
Actualmente los colores por tipo de señal se generan aleatoriamente (hash del nombre). Esto produce colores inconsistentes y a veces ilegibles. Reemplazar con una paleta fija y curada.

### Paleta definida en CSS

Se definen 24 colores en CSS variables para cubrir una amplia variedad de tipos de señal sin repetir:

```css
:root {
  --signal-1: #4fc3f7;   /* azul claro */
  --signal-2: #ef5350;   /* rojo */
  --signal-3: #66bb6a;   /* verde */
  --signal-4: #ffa726;   /* naranja */
  --signal-5: #ab47bc;   /* púrpura */
  --signal-6: #26c6da;   /* cyan */
  --signal-7: #ffca28;   /* amarillo */
  --signal-8: #ec407a;   /* rosa */
  --signal-9: #8d6e63;   /* marrón */
  --signal-10: #78909c;  /* gris azulado */
  --signal-11: #9ccc65;  /* lima */
  --signal-12: #5c6bc0;  /* índigo */
  /* ... y 12 colores más para llegar a 24 ... */
}
```

### Asignación determinista

```javascript
function getSignalColor(tipoSenial) {
    // 1. Recopilar todos los tipos de señal únicos del dataset
    // 2. Ordenar alfabéticamente
    // 3. Asignar color por índice: señal N → --signal-(N % 24 + 1)
    // Resultado: siempre el mismo color para el mismo tipo de señal
}
```

- Los colores se asignan por **orden alfabético** de los tipos de señal existentes
- La paleta tiene variantes para modo claro y oscuro (mismos hues, ajuste de luminosidad)
- Reemplaza la función actual de generación por hash

---

## Fase 1 — Sistema de Puertos en Metadatos

### Objetivo
Definir puertos formales en los equipos y cables como fuente de verdad principal, pero permitiendo también la definición de puertos ad-hoc directamente desde las conexiones para mayor flexibilidad. Cada puerto formal tiene: nombre, dirección (entrada/salida/bidireccional), tipo de señal y tipo de conector.

### Situación actual vs. Nuevo Modelo Híbrido

> [!IMPORTANT]
> **Actualmente los puertos NO están definidos en los equipos**. Solo existen como texto libre en los campos `Puerto_Origen` y `Puerto_Destino` de la tabla `3_Conexiones`.
>
> **Nuevo Modelo Híbrido:**
> - **Metadatos del equipo (Primario)**: Catálogo oficial de puertos del equipo. Permite renderizar puertos libres (desconectados) en las fichas, y es la base para el Asistente de Conexionado (filtros por señal/conector).
> - **Conexiones (Secundario/Ad-hoc)**: Si una conexión define un puerto que no existe en los metadatos del equipo, el sistema igual lo renderizará como un puerto "ad-hoc". Esto da flexibilidad para cableados rápidos sin tener que editar primero la ficha del equipo.
>
> El motor de renderizado de la interfaz fusionará ambas fuentes al mostrar la ficha.

**Diferenciación Visual en la Ficha:**

Para que el usuario sepa qué puertos son reales (nativos) y cuáles provienen de conexiones heredadas/manuales, se diferencian visualmente en la ficha de operación:

```
Nativo:    ●──┤  [🔌] ◀ Input 1    Audio Analógico   │
Ad-hoc:   [⚡]──┤       ◀ Aux Out  (Sin especificar) │
```
Los puertos ad-hoc muestran un ícono diferente (ej: `⚡`), no tienen diagrama de conector, y su texto se muestra ligeramente atenuado/itálico.

**Migración Manual Controlada (en lugar de masiva):**

En lugar de hacer una migración automática y masiva que podría arrastrar datos basura, se opta por una limpieza progresiva:
1. Al abrir el formulario de edición de un equipo, la sección de puertos mostrará tanto los puertos nativos como los puertos ad-hoc detectados en sus conexiones actuales.
2. Los puertos ad-hoc tendrán un botón especial **[⚡ Migrar a puerto nativo]**.
3. Al pulsarlo, el puerto se convierte en una fila editable normal, permitiendo al usuario completar el conector, revisar la dirección y guardarlo formalmente en los metadatos del equipo.

### Modelo de datos (en campo `Metadatos` JSON)

```json
{
  "puertos": [
    {
      "nombre": "Input 1",
      "direccion": "entrada",
      "tipo_senial": "Audio Analógico",
      "conector": "XLR Hembra"
    },
    {
      "nombre": "MAIN L",
      "direccion": "salida",
      "tipo_senial": "Audio Analógico", 
      "conector": "XLR Macho"
    },
    {
      "nombre": "USB-B",
      "direccion": "bidireccional",
      "tipo_senial": "USB/Digital",
      "conector": "USB-B"
    }
  ]
}
```

Para cables, los puertos representan sus extremos:
```json
{
  "puertos": [
    { "nombre": "Extremo A", "direccion": "entrada", "tipo_senial": "Audio Analógico", "conector": "XLR Macho" },
    { "nombre": "Extremo B", "direccion": "salida", "tipo_senial": "Audio Analógico", "conector": "XLR Hembra" }
  ]
}
```

> [!NOTE]
> El campo `conector` quedará vacío en los puertos migrados (ya que las conexiones actuales no tienen esa info). Se podrá completar manualmente después desde el editor de puertos (Fase 5).

---

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

**Nuevo subsistema de edición de puertos en formularios:**

- Crear función `renderPortsEditor(form, ports)` que genera una sección visual dentro de los formularios de equipo y cable
- Cada fila de puerto tiene 4 campos: Nombre, Dirección (select: entrada/salida/bidireccional), Tipo de Señal (datalist), Conector (datalist)
- Botón "Añadir puerto" con el mismo patrón que `addManualRow()`
- `syncMetadataFromUI()` se extiende para serializar los puertos al JSON de metadatos
- `syncUIFromMetadata()` se extiende para poblar la UI de puertos desde JSON existente
- Actualizar `populateDatalists()` para incluir conectores y señales derivados de puertos

**Visualización de puertos en ficha de operación — REDISEÑO COMPLETO:**

Se rediseña la vista de árbol (tree) para representar equipos y cables como cajas con puertos conectados visualmente. Este rediseño reemplaza los `port-pill` y las columnas "Entradas/Salidas" actuales.

##### Principios del diseño

1. **Equipos** = cajas con puertos en el borde izquierdo. Los cables se "enchufan" al equipo.
2. **Cables** = etiquetas inline sobre la línea. La línea entra por arriba y sale por abajo (el cable ES el conductor).
3. **Conectores físicos** (`●`) entre cable y equipo representan el punto de enchufe.
4. **Ubicaciones** se representan como separadores/banners cuando cambia la localización en la cadena.
5. **Navegación de ramas** se controla clickeando puertos (reemplaza los dropdowns `renderPortSelect()`).

##### Representación visual — Equipo (nodo central)

```
           │  ┌─────────────────────────────────┐
           │  │  Consola XR12            [XR-01]│
           │  │  ───────────────────────────────│
           │  │  🏠 FOH  👤 Propio  📦 Rack 1  │
           │  │  Estado: [Guardado ▾]           │
           │  │  💬 notas...  📜 historial...   │
           │  │                                 │
           │  │  ═══ PUERTOS ══════════════     │
           │  │                                 │
           ●──┤  ◀ Input 1    Audio Analógico   │
              │    ← MIC-AT-1 via CBL-010       │
              │                                 │
              │  ◀ Input 2    Audio Analógico    │
              │    Sin conectar                 │
              │                                 │
              │  ◀▶ Ethernet   Red              │
              │    ↔ SWITCH-01                  │
              │                                 │
           ●──┤  ▶ MAIN L     Audio Analógico   │
           │  │    → BAF-PA-L via CBL-001       │
           │  │                                 │
           │  │  ▶ MAIN R     Audio Analógico   │
           │  │    → BAF-PA-R via CBL-002       │
           │  └─────────────────────────────────┘
           │
```

- `●──┤` = conector activo (rama actual del árbol), color según estado (verde=conectado, rojo=pendiente)
- Sin símbolo = puerto con conexión pero no es la rama activa (clickeable para cambiar rama)
- Puerto sin conexión = atenuado, texto "Sin conectar"

##### Representación visual — Cable (simple, 2 puertos)

```
        ●                          ← conector: enchufe al equipo de arriba
           │
     ┌─────┼─────────────────────────────┐
     │     │       CBL-XLR-010           │
     │     │  XLR M-F │ 50m │ Propio     │
     │     │  Estado: [En Uso ▾]         │
     └─────┼─────────────────────────────┘
           │
        ●                          ← conector: enchufe al equipo de abajo
```

La línea **atraviesa** la ficha del cable (entra por arriba, sale por abajo) porque el cable ES la línea conductora. Los `●` fuera de la ficha representan los enchufes.

##### Representación visual — Cable multi-puerto (splitter, medusa)

```
        ●
           │
     ┌─────┼─────────────────────────────┐
     │     │       CBL-Y-001             │
     │     │  Splitter Y XLR │ Propio    │
     │     │                             │
     │     ├── ◀ Hembra   Audio Anal.    │
     │     │     ← MIC-AT-1             │
     │     │                             │
     │     ├── ▶ Macho 1  Audio Anal.    │  ← rama activa
     │     │     → XR-01 (Input 1)      │
     │     │                             │
     │     │   ▶ Macho 2  Audio Anal.    │  ← click → cambia rama
     │     │     → XR-01 (Input 2)      │
     └─────┼─────────────────────────────┘
           │
        ●
```

Para cables multi-puerto (splitters, medusas), se usa el mismo formato de puertos que los equipos, pero con la línea atravesando la ficha. Los puertos del cable se listan dentro con `├──` indicando por cuál sale la rama activa.

##### Separadores de ubicación

Cuando dos nodos consecutivos en el árbol están en ubicaciones distintas, se inserta un separador:

```
     ─────── 📍 Escenario ──────────────

           [ficha MIC-AT-1]

        ●
           │
     ┌─────┼── CBL-XLR-010 ─────────┐
     └─────┼─────────────────────────┘
           │
        ●

     ─ ─ ─ 📍 Escenario → FOH ─ ─ ─ ─

     ─────── 📍 FOH ────────────────────

           [ficha Consola XR12]
```

Reglas:
- Primer nodo: banner sólido con ubicación `── 📍 Escenario ──`
- Misma ubicación que el anterior: no se muestra nada
- Cambia ubicación: separador punteado de transición `─ ─ 📍 A → B ─ ─` + nuevo banner sólido
- El cable entre ubicaciones: opcionalmente muestra el largo del cable en el separador

##### Interacción y navegación

1. **Click en un puerto con conexión** → cambia la rama activa del árbol (actualiza `selectedBranches[]`), re-renderiza el árbol mostrando el nuevo camino
2. **Click en la info del equipo remoto** (texto "← MIC-AT-1") → navega al árbol centrado en ese equipo (como `renderResults()` actual)
3. **Click en el conector `●`** → abre el modal de conexión (como `showConnectionModal()` actual)
4. **Checkbox de estado** → toggle conectado/desconectado (como `togglePatch()` actual)

##### Modo legacy

Equipos/cables sin puertos definidos en metadatos siguen funcionando: se infieren los puertos de `db.conexiones` como antes, y se muestran con el mismo formato visual.

##### Diagramas de conectores

Cada puerto muestra un dibujo isométrico de línea del conector correspondiente, para identificación visual rápida.

```
           ●──┤  [🔌] ◀ Input 1    Audio Analógico   │
              │         ← MIC-AT-1 via CBL-010        │
```

El `[🔌]` se reemplaza por un SVG inline del conector (ej: dibujo isométrico de un XLR hembra).

Si la conexión actual tiene parámetros específicos (o hereda los base del equipo), se muestran debajo del puerto:

```
           ●──┤  [🔌] ◀ Input 1    Audio Analógico   │
              │         ← MIC-AT-1 via CBL-010        │
              │         ⚙️ Vol: 75% | Modo: Live      │
```

**Almacenamiento:**

- Carpeta `assets/conectores/` con archivos SVG por tipo de conector
- Naming convention: slug del nombre del conector → `xlr_macho.svg`, `xlr_hembra.svg`, `rj45.svg`, `hdmi.svg`, `usb_b.svg`, `bnc.svg`, `jack_635.svg`, `jack_35.svg`, etc.
- Los SVGs son dibujos de línea isométricos, monocromáticos, ~24x24px viewBox
- Se cachean en el service worker (`sw.js`)

**Mapeo conector → archivo:**

```javascript
function getConnectorIcon(conector) {
    const slug = conector.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    // 1. Intentar assets/conectores/{slug}.svg
    // 2. Si no existe → assets/conectores/{slug}.png (transparente)
    // 3. Si no existe → fallback genérico según dirección
}
```

**Formatos soportados:**

- `.svg` — preferido, dibujos de línea isométricos, escalan sin perder calidad
- `.png` — alternativa, imágenes transparentes (ej: fotos recortadas o renders 3D)

**Fallback:**

| Situación | Icono |
|---|---|
| SVG del conector existe | Dibujo isométrico específico |
| No existe SVG + dirección entrada | `hembra_generica.svg` (receptáculo genérico) |
| No existe SVG + dirección salida | `macho_generico.svg` (pin genérico) |
| No existe SVG + bidireccional | `conector_generico.svg` |
| Sin conector definido | Sin icono (solo el badge de dirección ◀/▶/◀▶) |

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

**Puertos ad-hoc (Secundarios):**

- Función `detectAdHocPorts()` — detecta puertos en `db.conexiones` que no están en los metadatos del equipo, para mostrarlos en la UI de edición y permitir su migración manual.

**Editor de puertos en formularios admin:**

- Función `renderPortsEditor(form, ports)` que genera sección visual de edición de puertos
- Cada fila: Nombre, Dirección (select: entrada/salida/bidireccional), Tipo de Señal (datalist), Conector (datalist)
- Botón "Añadir puerto" con el mismo patrón que `addManualRow()`
- `syncMetadataFromUI()` se extiende para serializar puertos al JSON de metadatos
- `syncUIFromMetadata()` se extiende para poblar la UI de puertos desde JSON existente
- Actualizar `populateDatalists()` para incluir conectores y señales de puertos

**Rediseño del árbol de conexiones:**

- Refactorizar `renderTreeNode()`:
  - Eliminar `port-pill` (badges flotantes en bordes)
  - Reemplazar `port-list-container` de 2 columnas por lista unificada vertical de puertos
  - Fuente de datos: `metadatos.puertos` del equipo (con fallback a conexiones para legacy)
  - Para cada puerto: buscar conexión en `db.conexiones`, renderizar con/sin conexión
  - Renderizar conector `●──┤` en borde izquierdo para puertos de la rama activa
- Refactorizar `renderTreeConnection()`:
  - Diferenciar entre cables simples (línea atraviesa ficha inline) y cables multi-puerto (ficha con puertos)
  - Renderizar conectores `●` entre fichas de cable y equipo
- Nueva función `renderLocationSeparator(fromLoc, toLoc)`:
  - Genera banners de ubicación y separadores de transición
  - Se inserta en `renderTree()` entre nodos con ubicaciones diferentes
- Eliminar `renderPortSelect()` — reemplazado por click en puertos
- Actualizar lógica de `selectedBranches[]` para funcionar con clicks en puertos

#### [MODIFY] [index.html](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/index.html)

- Agregar datalists: `list_conectores_puerto`, `list_seniales_puerto`
- Agregar sección de puertos en `formEquipo` y `formCable` (dentro de `.metadata-section`)

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

**Nuevas clases para el rediseño del árbol:**

- `.tree-port-list` — contenedor de la lista unificada de puertos
- `.tree-port-entry` — fila de puerto individual
- `.tree-port-entry.active` — puerto que es parte de la rama activa (con conector visible)
- `.tree-port-entry.available` — puerto con conexión pero no es la rama activa (clickeable)
- `.tree-port-entry.empty` — puerto sin conexión (atenuado)
- `.tree-port-connector` — el símbolo `●──` del borde izquierdo (pseudo-element o element absoluto)
- `.tree-port-connector.connected` — color verde
- `.tree-port-connector.pending` — color rojo
- `.tree-port-direction` — badge de dirección (◀/▶/◀▶) con colores por dirección
- `.tree-cable-inline` — ficha de cable en modo inline (línea atraviesa, borde punteado)
- `.tree-cable-multiport` — ficha de cable con puertos (splitter/medusa)
- `.tree-plug` — conector `●` entre cable y equipo (fuera de la ficha)
- `.tree-plug.connected` — verde
- `.tree-plug.pending` — rojo
- `.tree-location-banner` — banner sólido de ubicación
- `.tree-location-transition` — separador punteado de transición entre ubicaciones
- `.port-editor-row` — fila de puerto en formularios de admin
- `.port-direction-badge` — pastilla coloreada por dirección (verde=entrada, naranja=salida, azul=bidireccional)

---

## Fase 2 — Formularios WYSIWYG + Editor Visual de Metadatos

### Objetivo
Los formularios de edición usan el **mismo diseño visual que las fichas** de operación, creando una experiencia WYSIWYG. El usuario edita algo que se ve igual a cómo se va a mostrar. Además, se reemplaza el editor JSON crudo por un editor visual de metadatos por capas.

### Concepto visual — Formulario como ficha editable

```
┌─────────────────────────────────────────┐
│  [_Nombre del equipo_______]     [ID___]│
│  ─────────────────────────────────────  │
│  🏠 [Ubicación ▾]  👤 [Propietario ▾]  │
│  📦 [Contenedor ▾]  📂 [Categoría ▾]   │
│  Estado: [Guardado ▾]                   │
│  💬 [Notas_________________________]   │
│                                         │
│  ═══ PARÁMETROS BASE ══════ [+ Añadir]  │
│  [Volumen__] : [75%______] [🗑]         │
│  [Modo_____] : [Live_____] [🗑]         │
│                                         │
│  ═══ PUERTOS ══════════════ [+ Añadir]  │
│                                         │
│  ◀ [Input 1___] [Audio Analog▾] [XLR▾] │ [🗑]
│                                         │
│  ◀ [Input 2___] [Audio Analog▾] [XLR▾] │ [🗑]
│                                         │
│  ▶ [MAIN L____] [Audio Analog▾] [XLR▾] │ [🗑]
│                                         │
│  ▶ [MAIN R____] [Audio Analog▾] [XLR▾] │ [🗑]
│                                         │
│  ═══ METADATOS CUSTOM ═══ [▾ expandir]  │
│  (editor JSON colapsado)                │
│                                         │
│  [💾 Guardar]  [🗑 Eliminar]  [✕ Cerrar]│
└─────────────────────────────────────────┘
```

### Principios

1. **Misma estructura visual**: La disposición de campos sigue la misma jerarquía que la ficha de operación (encabezado → info → puertos → acciones)
2. **Campos editables in-place**: Donde la ficha muestra texto estático, el formulario muestra inputs/selects con el mismo tamaño y posición
3. **Sección de puertos**: Usa el mismo layout de lista vertical con badges de dirección (`◀/▶/◀▶`), pero cada fila tiene:
   - Select de dirección (entrada/salida/bidireccional)
   - Input de nombre del puerto
   - Select/datalist de tipo de señal
   - Select/datalist de tipo de conector
   - Botón de conectar `🔗` — dispara el wizard de conexión (Fase 3) pre-filtrado para ese puerto
   - Botón de eliminar `🗑`
4. **Botón de conectar `🔗`**:
   - Puerto **sin conexión**: abre wizard con puerto pre-seleccionado, filtra equipos por señal compatible y dirección inversa, filtra cables por conector compatible
   - Puerto **con conexión existente**: abre wizard para editar/cambiar esa conexión (muestra equipo y cable actuales, permite cambiarlos)
   - Debajo del puerto se muestra la conexión activa si existe: `← MIC-AT-1 via CBL-010`
5. **Sección Parámetros Base**: Editor key-value simple para definir la configuración recomendada de fábrica (ej: Volumen: 75%). Se guarda en `Metadatos.parametros_base`.
6. **Añadir puertos**: Botón `[+ Añadir]` al final de la sección que agrega una fila vacía
7. **Editor JSON**: Colapsable debajo de los puertos, para metadatos custom que no tienen UI dedicada (manuales, historial, montado_en, etc.)
8. **Para cables**: Mismo diseño pero con campos de cable (Tipo conector, Largo, Categoría) y la sección de puertos pre-poblada con "Extremo A" / "Extremo B" para cables simples

### Sistema de plantillas

Permite crear equipos/cables nuevos desde una plantilla pre-definida, o guardar un item existente como plantilla.

**Flujo de uso:**

```
[+ Nuevo Equipo]
  ├── Desde cero (formulario vacío)
  └── Desde plantilla ▾
        ├── 📋 Consola digital (12ch, USB, XLR)
        ├── 📋 Parlante activo (1x XLR in, 1x Link out)
        ├── 📋 Micrófono dinámico (1x XLR out)
        └── 📋 Cable XLR M-F estándar
```

**Guardar como plantilla** desde un equipo existente:
```
[ficha del equipo] → menú ⋮ → "Guardar como plantilla"
  Nombre de plantilla: [Consola digital 12ch___]
  → Guarda: categoría, tipo, puertos, metadatos base (sin ID, ubicación, estado)
```

**Almacenamiento** en `4_Configuracion`:
```
ID_Configuracion: plantillas
Valor: -
Metadatos: {
  "equipos": [
    {
      "id": "tpl_consola_digital",
      "nombre": "Consola digital 12ch",
      "categoria": "Consola",
      "tipo": "Digital",
      "puertos": [...],
      "metadatos_base": {"manuales": [...]}
    }
  ],
  "cables": [
    {
      "id": "tpl_xlr_mf",
      "nombre": "Cable XLR M-F estándar",
      "categoria": "XLR",
      "puertos": [
        {"nombre": "Extremo A", "direccion": "entrada", "conector": "XLR Macho"},
        {"nombre": "Extremo B", "direccion": "salida", "conector": "XLR Hembra"}
      ]
    }
  ]
}
```

Al seleccionar una plantilla, se pre-rellenan todos los campos del formulario. El usuario solo completa lo específico de esa unidad: ID, ubicación, estado, propietario.

### Carga por lotes

Permite crear múltiples equipos o cables en una sola operación. Dos modos:

**Modo cantidad** — N unidades idénticas:
```
📋 Plantilla: Parlante activo
Cantidad: [4___]
Prefijo ID: [BAF-PA-___]

Preview:
  BAF-PA-01  │  Parlante activo  │  (sin ubicación)
  BAF-PA-02  │  Parlante activo  │  (sin ubicación)
  BAF-PA-03  │  Parlante activo  │  (sin ubicación)
  BAF-PA-04  │  Parlante activo  │  (sin ubicación)

[✓ Crear 4 equipos]
```

**Modo variante** — mismo tipo, un campo varía por unidad:
```
📋 Plantilla: Cable XLR M-F
Campo variable: [Largo ▾]
Valores (separados por coma): [50, 50, 50, 50, 16, 12, 12, 12, 10, 10, 10, 5, 5, 5]
Prefijo ID: [CBL-XLR-___]

Preview:
  CBL-XLR-01  │  XLR M-F  │  50m
  CBL-XLR-02  │  XLR M-F  │  50m
  ...
  CBL-XLR-14  │  XLR M-F  │  5m

[✓ Crear 14 cables]
```

IDs se auto-generan con el prefijo + número secuencial. El preview permite revisar antes de confirmar. Se combina naturalmente con plantillas para carga masiva eficiente.

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- Refactorizar `toggleAdminForm('equipos')` y `toggleAdminForm('cables')` para generar formularios que replican la estructura visual de `renderTreeNode()`
- Los campos del formulario se posicionan igual que los elementos de la ficha
- La sección de puertos reutiliza las mismas CSS classes del árbol (`.tree-port-entry`, `.tree-port-direction`) pero en modo editable
- Función `addPortRow(direction)` — agrega fila de puerto con campos vacíos
- Función `removePortRow(row)` — elimina fila con confirmación
- `syncMetadataFromUI()` se extiende para serializar puertos + metadatos visuales
- `syncUIFromMetadata()` se extiende para poblar puertos y campos dedicados desde JSON existente
- Al guardar: validación de que puertos parciales (solo nombre o solo conector) estén completos

**Editor visual de metadatos (3 capas):**

Reemplaza el editor JSON crudo con una UI por capas:

| Capa | Tipo de metadato | UI |
|------|-----------------|----|
| **1. Dedicada** | `puertos` | Editor de puertos (sección propia arriba) |
| **1. Dedicada** | `manuales` | Lista de links: `[nombre] [URL]` con añadir/eliminar |
| **1. Dedicada** | `montado_en` | Selector de equipo contenedor (filtrado por `es_contenedor`) |
| **1. Dedicada** | `es_contenedor` | Checkbox |
| **1. Dedicada** | `historial` | Timeline de entradas (read-only, se agrega automáticamente) |
| **1. Dedicada** | `prestamos` | Sección de préstamos (Fase 5) |
| **2. Genérica** | Campos custom | Editor key-value: filas `[clave] : [valor]` con añadir/eliminar |
| **3. Fallback** | Todo | Editor JSON crudo colapsable (para debugging) |

Al guardar, `syncMetadataFromUI()` ensambla el JSON final desde las 3 capas: campos dedicados + key-value custom + JSON manual (si se editó).

**Sistema de plantillas:**

- Función `loadTemplates()` — carga plantillas desde `4_Configuracion` (row `plantillas`)
- Función `applyTemplate(templateId, formType)` — pre-rellena formulario con datos de la plantilla
- Función `saveAsTemplate(itemId, name)` — extrae categoría, tipo, puertos y metadatos base de un item existente y lo guarda como plantilla
- Función `deleteTemplate(templateId)` — elimina una plantilla
- Selector de plantilla al inicio del formulario de creación: "Desde cero" o lista de plantillas disponibles
- Botón "📋 Guardar como plantilla" en la ficha de operación (menú ⋮) y en el formulario de edición

**Carga por lotes:**

- Función `openBatchCreate(type)` — abre modal de carga por lotes para equipos o cables
- Modo cantidad: campo de cantidad + prefijo ID → genera N items idénticos con IDs secuenciales
- Modo variante: selector de campo variable + valores separados por coma → genera un item por valor
- Función `generateBatchPreview(config)` — muestra tabla preview de los items que se van a crear
- Función `executeBatchCreate(items)` — crea todos los items secuencialmente via API
- Se integra con plantillas: seleccionar plantilla + modo lote = carga masiva eficiente

#### [MODIFY] [index.html](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/index.html)

- Template `portEditorRow` para filas de puerto editables
- Template `metaManualRow` para filas de manuales (nombre + URL)
- Template `metaKeyValueRow` para filas de campos custom (clave + valor)
- Reestructurar `formEquipo` y `formCable` para que repliquen el layout de la ficha

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

- `.form-as-ficha` — contenedor que replica el aspecto de card de la ficha
- `.form-as-ficha input, .form-as-ficha select` — inputs que se integran visualmente como texto inline
- `.port-editor-row` — fila de puerto editable, hereda de `.tree-port-entry`
- `.port-editor-row .port-actions` — botones de eliminar por fila
- `.port-add-btn` — botón de añadir puerto
- `.meta-section` — sección de metadatos visuales
- `.meta-manual-row` — fila de manual (nombre + URL)
- `.meta-kv-row` — fila de campo custom (clave + valor)
- `.meta-json-fallback` — editor JSON colapsable

---

## Fase 3 — Asistente de Conexionado

### Objetivo
Reemplazar el actual formulario de ruteo con un asistente guiado que, desde un equipo/puerto, permite elegir equipos destino filtrados por compatibilidad, y asignar cables con 3 modos: del stock, genérico (stub), o conexión directa.

### Flujo del asistente

```
1. Se abre desde:
   - Botón 🔗 en un puerto del formulario (Fase 2) → puerto pre-seleccionado
   - Botón hub en tabla admin → equipo pre-seleccionado, wizard muestra todos sus puertos
   - Menú de la ficha de operación

2. Se muestran los puertos del equipo (definidos en metadatos)

3. Para cada puerto:
   a. Seleccionar equipo destino (filtrado por señal compatible y dirección inversa)
   b. Seleccionar puerto destino del equipo elegido
   c. Elegir modo de cable:

      ○ Cable del stock    → selector filtrado por conector compatible
      ○ Cable genérico     → definir requisitos (tipo, largo mín, señal)
      ○ Conexión directa   → sin cable (equipo a equipo)

   d. **(Nuevo) Ajustar parámetros**: Muestra los parámetros base del equipo destino y permite modificarlos para esta configuración específica. (Se guardan en los metadatos de la conexión).
   e. Vista previa de la cadena resultante
   f. Confirmar → genera las conexiones
```

### Tres modos de cable

#### 1. Cable del stock
Selecciona un cable específico del inventario, filtrado por conector compatible:
```
Cable: ● Del stock
       [🔍 CBL-XLR-010 - XLR M-F 50m ▾]
       Filtrado: conector compatible, señal compatible, no asignado en esta config
```
Genera 2 conexiones: `equipo_A → cable → equipo_B`

#### 2. Cable genérico (stub)
Define los requisitos sin asignar un cable real — para planificación:
```
Cable: ● Cable genérico
       Tipo: [XLR M-F ▾]
       Largo mínimo: [10m___]
       Señal: [Audio Analógico ▾]
```
Genera 2 conexiones con un cable virtual (`STUB_xxx`). Se guarda en metadatos de la conexión:
```json
{
  "stub": true,
  "requisitos": {
    "tipo_conector": "XLR M-F",
    "largo_minimo": 10,
    "tipo_senial": "Audio Analógico"
  }
}
```

Representación visual en el árbol — borde punteado con icono de advertencia:
```
     ┌ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
           │    ⚠ XLR M-F ≥10m
     │     │    Sin asignar             │
     └ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Asignación posterior**: click en un stub → muestra cables del stock que cumplen los requisitos → asignar.

#### 3. Conexión directa (sin cable)
Para equipos que se conectan directamente (ej: equipo montado encima de otro, conexión interna):
```
Cable: ● Conexión directa (sin cable)
```
Genera 1 sola conexión: `equipo_A → equipo_B`, sin nodo intermedio de cable. En el árbol no se muestra ficha de cable, solo la línea directa entre equipos.

### Equipos stub (genéricos)

Mismo concepto que cable stubs, pero para equipos. Un equipo stub es un placeholder que define qué tipo de equipo se necesita en una posición de la configuración sin asignar uno real del inventario.

```
Equipo destino: ● Del stock        [Seleccionar ▾]
                ○ Equipo genérico
                  Categoría: [Parlante ▾]
                  Tipo: [Activo ▾]
                  Notas: [≥300W, con entrada XLR]
```

Se guarda en `1_Equipos` con ID especial `STUB_EQ_xxx` y metadatos:
```json
{
  "stub": true,
  "requisitos": {
    "categoria": "Parlante",
    "tipo": "Activo",
    "notas": "≥300W, con entrada XLR",
    "puertos_necesarios": [
      {"direccion": "entrada", "tipo_senial": "Audio Analógico", "conector": "XLR Hembra"}
    ]
  }
}
```

Representación visual en el árbol — mismo estilo que cable stub (borde punteado, ⚠):
```
     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
       ⚠ Parlante Activo
     │ ≥300W, con entrada XLR           │
       Sin asignar
     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Asignación posterior**: click en un equipo stub → muestra equipos del stock que cumplen los requisitos → asignar.

### Vista de necesidades logísticas (cables + equipos)

Listado unificado que agrupa todos los stubs (cables y equipos) y compara con stock:

```
═══ NECESIDADES DE CONFIGURACIÓN ═══

📦 Equipos sin asignar:
  ⚠ 2x Parlante Activo ≥300W     — Stock disponible: 4
  ⚠ 1x Micrófono Dinámico        — Stock disponible: 8

🔌 Cables sin asignar:
  ⚠ 3x XLR M-F ≥10m             — Stock disponible: 5
  ⚠ 1x HDMI ≥5m                 — Stock disponible: 2
```

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

**Nuevo asistente `ConnectionWizard`:**

- Función `openConnectionWizard(equipoId, puertoId?)` — abre modal, opcionalmente pre-selecciona un puerto
- Para cada puerto del equipo, renderiza una tarjeta colapsable con:
  - Selector de equipo destino: del stock (filtrado) o equipo genérico (stub)
  - Selector de puerto destino en el equipo elegido
  - Radio buttons cable: del stock / genérico / conexión directa
  - Campos condicionales según la opción elegida
  - Vista previa de la cadena que se va a crear
- Función `getCompatibleEquipments(puerto)` — filtra por tipo de señal y dirección inversa
- Función `getCompatibleCables(puertoOrigen, puertoDestino)` — filtra por conector compatible y disponibilidad
- Función `getMatchingStockForStub(stub, type)` — busca items del stock que cumplen los requisitos de un stub (cable o equipo)
- Función `generateConnectionsFromWizard(wizardData)` — genera las filas de conexión según el modo elegido
- Función `assignToStub(stubId, realId)` — reemplaza un stub (cable o equipo) por un item real del stock
- El asistente reemplaza al `formRuteo` actual y al `openBatchPatch()`

**Vista de necesidades logísticas:**

- Nueva función `renderNecesidades()` — lista todos los stubs (equipos + cables) agrupados por tipo
- Compara con stock disponible: "Se necesitan 3x XLR M-F ≥10m — Disponibles: 5"
- Permite asignación individual o masiva desde esta vista

**Cambios en openBatchPatch / formulario de ruteo:**

- El botón `hub` de la tabla admin ahora abre `openConnectionWizard()` en lugar del form actual
- Se mantiene compatibilidad con conexiones existentes que no tengan puertos definidos

#### [MODIFY] [index.html](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/index.html)

- Template HTML para el wizard modal (cards de puertos, selectores filtrados, radio buttons de modo cable, preview de cadena)
- Template para la vista de necesidades logísticas

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

- `.wizard-modal`, `.wizard-port-card`, `.wizard-chain-preview`
- `.wizard-cable-mode` — radio buttons con estilo de tarjeta seleccionable
- `.wizard-stub-fields` — campos de requisitos para cable genérico
- `.tree-cable-stub` — ficha de cable stub en el árbol (borde punteado, icono ⚠)
- `.needs-list`, `.needs-item` — vista de necesidades logísticas
- Animaciones de transición entre pasos

---

## Fase 4 — Contenedores como Equipos

### Objetivo
Los contenedores (racks, cajas, baúles) se modelan como equipos reales con el flag `es_contenedor: true` en metadatos. Esto permite:
- Verlos en el mapa topológico
- Navegar desde un contenedor a su contenido
- Navegar desde un equipo a su contenedor

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- En `renderTreeNode()` para el nodo central, si el equipo tiene `montado_en` o `Contenedor` que coincida con un ID de equipo contenedor, mostrar un link clicable
- Nueva vista "Ver contenido" en la ficha de un equipo contenedor: lista todos los equipos con `Contenedor == ID_contenedor` o `montado_en == ID_contenedor`
- En `renderInventory()`, agrupar por contenedor muestra contenedores como nodos expandibles con su contenido
- En el formulario de edición de equipo, checkbox "Es contenedor" que setea `es_contenedor: true` en metadatos y cambia el icono
- El campo `Contenedor` pasa a ser un selector que filtra por equipos marcados como contenedor

#### [MODIFY] [topology.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/topology.js)

- Los equipos contenedores se renderizan como nodos grupo (compound nodes) con borde punteado
- Los equipos montados dentro se posicionan como hijos del contenedor en el layout ELK

---

## Fase 5 — Gestión de Préstamos

### Objetivo
Registrar préstamos de equipos y cables en los metadatos. Simplemente un historial con quién lo tiene, fecha de entrega, fecha de devolución esperada/real y notas.

### Modelo de datos (en Metadatos)

```json
{
  "prestamos": [
    {
      "destino": "Empresa X",
      "fecha_entrega": "2026-05-01",
      "fecha_devolucion_esperada": "2026-05-10",
      "fecha_devolucion_real": null,
      "notas": "Para evento en Club Y",
      "registrado_por": "Juan"
    }
  ],
  "prestado_actualmente": true
}
```

### Proposed Changes

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- Nueva sección en `renderTreeNode()` para el nodo central: indicador de préstamo activo con banner visual (muestra destino y fecha)
- Función `registrarPrestamo(id)` — modal con campos: Destino, Fecha entrega, Fecha devolución esperada, Notas
- Función `registrarDevolucion(id)` — marca fecha de devolución real, limpia flag `prestado_actualmente`
- En `renderInventory()`, nuevo agrupamiento disponible: "Préstamos" que muestra los equipos prestados con badge de alerta
- Filtro rápido en inventario: "Mostrar solo prestados"
- Botón en ficha de operación del equipo: "Registrar préstamo" / "Registrar devolución"

#### [MODIFY] [index.html](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/index.html)

- Modal de préstamo con campos de formulario

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

- `.loan-banner` — banner de alerta de préstamo activo
- `.loan-history-entry` — entrada en el historial de préstamos
- `.loan-badge` — pastilla en tablas de inventario

---

## Fase 6 — Configuraciones de Conexión

### Objetivo
Gestionar múltiples configuraciones de conexiones para diferentes eventos o escenarios. Cada configuración representa un set completo de conexiones (qué equipo se conecta con qué). Una configuración es la **vigente** y es la que los usuarios ven al ingresar al sitio.

### Arquitectura

**Una hoja por configuración:**

- La hoja base es `3_Conexiones` (configuración por defecto/principal)
- Cada configuración adicional crea una hoja nueva: `3_Conexiones_reunion`, `3_Conexiones_exterior`, etc.
- El sufijo es un slug sanitizado del nombre de la configuración

En `4_Configuracion`, un registro de control:
```
ID_Configuracion: configuraciones
Valor: <slug_config_activa>
Metadatos: {
  "configs": [
    {"id": "default", "nombre": "Principal", "hoja": "3_Conexiones", "creada": 1714..., "autor": "..."},
    {"id": "reunion", "nombre": "Reunión", "hoja": "3_Conexiones_reunion", "ubicaciones_override": {"MIC-01": "Escenario", "EQ-05": "FOH"}, ...},
    {"id": "exterior", "nombre": "Evento Exterior", "hoja": "3_Conexiones_exterior", ...}
  ]
}
```

### Panel de administración de configuraciones

Accesible desde la sección Admin. Permite:

```
═══ CONFIGURACIONES ═══════════════════

  ★ Principal              ← vigente
     23 conexiones │ Creada: 01/05/2026

     Reunión
     12 conexiones │ Creada: 03/05/2026
     [📋 Copiar] [✏️ Renombrar] [🗑 Eliminar]

     Evento Exterior
     18 conexiones │ Creada: 04/05/2026
     [📋 Copiar] [✏️ Renombrar] [🗑 Eliminar]

  [+ Nueva configuración]
  [📋 Copiar configuración vigente]
```

**Acciones:**

| Acción | Descripción |
|---|---|
| **Crear nueva** | Crea hoja vacía `3_Conexiones_<slug>`, agrega a la lista |
| **Copiar existente** | Duplica la hoja de una configuración con nuevo nombre |
| **Eliminar** | Borra la hoja y el registro (protegida: no se puede eliminar la vigente) |
| **Renombrar** | Cambia nombre visible, slug se mantiene |
| **Establecer vigente** | Cambia `Valor` en el registro de control |

### Navegación por configuración

**Acceso por defecto** — sin parámetro URL, carga la configuración vigente:
```
https://sitio.com/              → carga config vigente (★ Principal)
```

**Acceso a configuración específica** — con parámetro `?config=slug`:
```
https://sitio.com/?config=reunion    → carga config "Reunión"
https://sitio.com/?config=exterior   → carga config "Evento Exterior"
```

**Banner visual** cuando se está viendo una configuración que NO es la vigente:

```
┌──────────────────────────────────────────────────┐
│  📋 Reunión  (no es la configuración vigente)    │
│  [← Ir a la vigente]                             │
└──────────────────────────────────────────────────┘
```

- Banner fijo (sticky top), color distintivo
- Muestra solo el nombre de la configuración y aclara que no es la vigente
- Botón para volver a la configuración vigente (recarga sin parámetro URL)

**Indicador en sidebar** — siempre visible, debajo del título del sitio:
```
┌──────────────────────┐
│  Audio y video ER2   │
│  📋 Reunión          │  ← nombre de la config actual
│  ─────────────────── │
│  🔍 Buscar...        │
│  ...                 │
```
Si es la vigente no se muestra nada (o se muestra con ★). Si es otra configuración, se muestra el nombre con estilo distintivo.

### Proposed Changes

#### [MODIFY] [Code.gs](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app/Code.gs)

- `doGet()` acepta parámetro `?config=slug` para leer de la hoja correspondiente
- Si no se pasa `config`, lee de la hoja de la configuración vigente (leída de `4_Configuracion`)
- Nuevas acciones POST:
  - `CREATE_CONFIG` — crea hoja nueva vacía con estructura de columnas de `3_Conexiones`
  - `COPY_CONFIG` — duplica hoja existente con nuevo slug
  - `DELETE_CONFIG` — elimina hoja y registro (rechaza si es la vigente)
  - `RENAME_CONFIG` — actualiza nombre en el registro de metadatos
  - `SET_ACTIVE_CONFIG` — cambia el `Valor` del registro `configuraciones`

#### [MODIFY] [app.js](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/app.js)

- `fetchData()` lee parámetro URL `config` y lo pasa a `doGet()`. Sin parámetro → config vigente
- **Override de Ubicaciones:** Nueva función `getUbicacionEfectiva(equipoId)` que retorna el override de la configuración activa (si existe en `4_Configuracion`) o la ubicación de almacenaje base (`1_Equipos`). Reemplazar lecturas directas de `equipo.Ubicacion` por esta función en la UI y topología.
- Al editar la ubicación de un equipo bajo una configuración cargada, guardar en `ubicaciones_override` de esa configuración para no ensuciar el inventario.
- `db.configActual` almacena el slug de la configuración cargada
- `db.configVigente` almacena el slug de la configuración vigente (del registro de control)
- Si `configActual !== configVigente` → muestra banner de configuración no vigente
- Panel admin "Configuraciones" con funciones: `createConfig()`, `copyConfig()`, `deleteConfig()`, `renameConfig()`, `setActiveConfig()`
- `switchConfig(slug)` → recarga con `?config=slug` en la URL
- Todas las operaciones de escritura de conexiones usan la hoja de la configuración actual

#### [MODIFY] [index.html](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/index.html)

- Panel de gestión de configuraciones en la sección admin
- Banner sticky para configuración no vigente (`#config-banner`)
- Indicador de configuración actual en el header

#### [MODIFY] [styles.css](file:///c:/Users/Abel/Documents/circuito/entrerios2.github.io/styles.css)

- `.config-banner` — banner sticky top, color de acento, con botones de acción
- `.config-list-item` — item de configuración en el panel admin
- `.config-active-badge` — indicador ★ para la configuración vigente

---

## Resumen de Orden de Implementación

| Fase | Feature | Dependencias | Complejidad |
|------|---------|-------------|-------------|
| 1 | Puertos + Rediseño fichas | Ninguna | ⭐⭐⭐ Alta |
| 2 | Formularios WYSIWYG + Editor metadatos | Fase 1 (misma visual) | ⭐⭐⭐ Alta |
| 3 | Asistente de conexiones | Fases 1-2 (puertos editables) | ⭐⭐⭐ Alta |
| 4 | Contenedores como equipo | Fase 2 (formulario con checkbox) | ⭐⭐ Media |
| 5 | Préstamos | Fase 2 (editor metadatos) | ⭐ Baja |
| 6 | Configuraciones | Ninguna (paralelo) | ⭐⭐⭐ Alta |

> [!TIP]
> El orden **1 → 2 → 3 → 4 → 5 → 6** es secuencial y lógico: primero se definen los puertos y se rediseñan las fichas, luego los formularios replican ese diseño, después el asistente usa los puertos formales, y finalmente las features independientes.

---

## Verification Plan

### Automated Tests
- Cada fase se verifica manualmente abriendo el sitio en un browser local
- Ejecutar `http-server` o abrir `index.html` directamente
- Verificar que la PWA sigue funcionando (cache versioning bump en `sw.js`)

### Manual Verification
- Fase 1: Migrar puertos, verificar fichas rediseñadas con puertos, ubicaciones, conectores
- Fase 2: Editar equipo con formulario WYSIWYG, verificar puertos y metadatos visuales
- Fase 3: Usar el asistente para crear conexiones, verificar que se reflejan en el mapa y la vista de árbol
- Fase 4: Crear equipo contenedor, asignar equipos dentro, verificar en mapa
- Fase 5: Registrar préstamo, verificar banner en ficha, registrar devolución
- Fase 6: Crear/copiar/cambiar configuraciones, verificar que el cambio se refleja al recargar

### Backend (Code.gs)
- Los cambios al backend se verifican desplegando una nueva versión del Apps Script
- Probar las nuevas acciones POST con el API directamente antes de integrar
