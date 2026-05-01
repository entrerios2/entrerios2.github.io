# Requisitos del Mapa Topológico AV

Documento consolidado de todos los requerimientos del mapa extraídos de los Prompts 20–25.
Usa este documento como fuente de verdad para la implementación con AntV X6.

---

## 1. Estructura General y Modos

- El mapa es accesible como modo global `?mode=MAPA` (desde URL directa o menú lateral).
- Al activarse, **oculta** los paneles de Operación y Administración.
- El contenedor es **fullscreen**: `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1`.
- Los nodos que queden cerca del borde superior se ven bajo el Topbar translúcido (que tiene mayor z-index).
- El mapa es **solo lectura** — los nodos no se pueden arrastrar ni editar desde el mapa.
- **Zoom mínimo:** permite ver el mapa completo en pantalla (fit-to-content).
- **Zoom máximo:** permite ver el detalle a nivel de un nodo individual con sus puertos.
- Paneo con arrastre del fondo (blank area).

---

## 2. Nodos: Equipos

- **Forma:** Rectángulo con esquinas redondeadas.
- **Fondo:** Oscuro (`#161b22`).
- **Borde:** Color accent cyan (`#00f2ff`), grosor 1.5px.
- **Texto:** Solo el `Nombre` del equipo (nunca el ID). Color blanco. Font Outfit. Wrapping si es largo.
- **Tamaño dinámico:** El ancho base crece según la cantidad de conexiones del equipo (`ancho = max(120, base + conexiones * n)`).

### 2.1 Puertos Nativos en los Bordes del Nodo ⭐ REQUISITO CLAVE

Cada equipo debe mostrar sus puertos de entrada y salida como **indicadores de forma y color** en sus bordes físicos:

- **Puertos de entrada** → bordes **izquierdo** y **superior** del nodo.
  - **Forma: triángulo / flecha** apuntando hacia adentro del nodo.
- **Puertos de salida** → bordes **derecho** e **inferior** del nodo.
  - **Forma: círculo**.
- **Color de todos los puertos** (independientemente de la forma):
  - 🟢 **Verde** (`#3fb950`) si `Estado === 'Conectado'`.
  - 🔴 **Rojo** (`#f85149`) si el estado es cualquier otro valor.
- El color del puerto **solo indica estado de conexión** — nunca el tipo de señal.
- El label del puerto muestra el nombre del puerto (ej. `XLR1`, `OUT2`) en texto muy pequeño (7px) junto al indicador.
- Los puertos deben estar **distribuidos equitativamente** a lo largo del borde asignado.
- **Click en un puerto:** Abre la ficha/modal de la conexión asociada a ese puerto.

---

## 3. Nodos: Cables (todos los casos)

El comportamiento visual de un cable depende del **número de conexiones** que tiene:

| Conexiones | Representación | Descripción |
|---|---|---|
| **0** | Nodo elipse | Cable huérfano — sin ninguna conexión activa. Visible como nodo aislado. |
| **1** | Nodo elipse con una línea | Cable en un solo extremo (dead-end). Se dibuja como nodo con una sola línea saliendo. |
| **2** | ⭐ **Línea colapsada** | El cable desaparece como nodo y se convierte en una línea directa entre los dos equipos. |
| **3+** | Nodo hub con líneas | Cable multipunto/hub. Se dibuja como nodo, y sus conexiones se dibujan como líneas individuales hacia cada equipo. |

**Estilo del nodo cable (casos 0, 1 y 3+):**
- **Forma:** Elipse/círculo.
- **Color:** Determinado por el tipo de señal de sus conexiones (misma paleta de señales — ver sección 5.2). Si el cable tiene múltiples tipos de señal, usar el tipo más frecuente o el primero encontrado.
- Puede haber **20 o más tipos de señal distintos** — la paleta debe generar colores distinguibles dinámicamente.
- **Texto:** Solo el tipo de cable (ej. "XLR", "HDMI"). Tamaño de fuente 8px.
- **Click en el nodo cable:** Abre la **ficha del cable** (igual que al hacer click en un equipo desde la vista de operación).
- **Tooltip (hover):** Muestra Nombre/ID del cable, Largo y Categoría.

---

## 4. Edge Collapsing: Cables 1-a-1 → Líneas directas ⭐ REQUISITO CLAVE

Si un cable tiene **exactamente 2 conexiones** (una entrada y una salida), **NO se dibuja como nodo**.
En su lugar, se convierte en una **línea directa** entre los dos equipos conectados.

La línea resultante hereda:
- `source`: `ID_Origen` de la conexión de entrada al cable.
- `target`: `ID_Destino` de la conexión de salida del cable.
- `portSrc`: `Puerto_Origen` de la primera conexión.
- `portDst`: `Puerto_Destino` de la segunda conexión.
- `signal`: `Tipo_Senial` (de cualquiera de las dos conexiones).
- `color`: resultado de `getSignalColor(signal)`.
- `status`: `Estado` de la conexión.
- `cableLabel`: `Tipo + Largo` del cable.

La línea **conecta el puerto correcto** del nodo origen con el puerto correcto del nodo destino.

---

## 5. Aristas (Líneas de Cable)

### 5.1 Ruteo Ortogonal ⭐ REQUISITO CLAVE
- Todas las líneas deben viajar en **ángulos rectos (90°)** — ruteo tipo "manhattan" u "orthogonal".
- No se admiten curvas bezier para la representación final.

### 5.2 Color por Tipo de Señal
- Cada línea tiene un color único según su `Tipo_Senial`, generado por una paleta fija:
  ```
  ['#00f2ff','#ff7b72','#79c0ff','#d2a8ff','#3fb950','#ffa657','#ff69b4','#ffff00']
  ```
- El mismo tipo de señal siempre tiene el mismo color.

### 5.3 Marcadores de Extremo

> ⚠️ **Separación de responsabilidades:**
> - El **color de la LÍNEA** comunica el *tipo de señal*.
> - El **color de los MARCADORES** en los extremos comunica el *estado de la conexión* (verde/rojo).
> - La **forma del puerto en el nodo** comunica la *dirección* (círculo = salida, triángulo = entrada).

- **Origen (source — extremo del equipo que envía):** Círculo pequeño.
  - Color: 🟢 verde si `Estado === 'Conectado'`, 🔴 rojo si no.
- **Destino (target — extremo del equipo que recibe):** Flecha triangular.
  - Color: 🟢 verde si `Estado === 'Conectado'`, 🔴 rojo si no.

### 5.5 Cables Paralelos (mismo par de equipos)
- Si dos equipos tienen múltiples cables entre sí, las líneas deben separarse visualmente (no superponerse).
- Solución: ligero offset o routing separado para que sean distinguibles.

### 5.6 Label de Señal sobre la línea
- Una "pastilla" (chip) pequeña en el centro de la línea muestra el tipo de señal.
- Fondo oscuro, borde del color de la señal, texto blanco 8px.

---

## 6. Compound Nodes: Agrupación por Ubicación

- Antes de iterar equipos, se recorren todas las `Ubicacion` únicas.
- Por cada ubicación, se crea un **nodo contenedor** (compound parent):
  - **Forma:** Rectángulo grande con borde punteado (`#444`).
  - **Fondo:** Transparente con opacidad mínima (0.05) del color asignado a la ubicación.
  - **Label:** Nombre de la ubicación, esquina superior, bold, `#aaa`.
- Los equipos y cables no colapsados con esa `Ubicacion` se asignan como hijos del contenedor.
- **Excepción:** Si el equipo tiene metadato `montado_en`, ese rack tiene prioridad sobre la ubicación.
- Los contenedores de Ubicación **nunca se superponen** entre sí (garantizado por ELK layout).

---

## 7. Auto-layout: Dagre o ELK

- El layout debe organizar el diagrama **de izquierda a derecha** (flujo de señal AV).
- Algoritmo preferido: **ELK layered** o **dagre** (ambos producen layouts jerárquicos similares).
- Parámetros de espaciado:
  - Padding interno de los contenedores: 80px top, 60px resto.
  - Espacio entre nodos: 70px mínimo.
  - Espacio entre capas (layers): 100px mínimo.
  - Espacio entre componentes: 120px mínimo.
- Los puertos deben estar restringidos a sus caras (`FIXED_SIDE`): entradas a la izquierda, salidas a la derecha.

---

## 8. Interactividad

### 8.1 Tooltip (Hover)
- Al pasar el mouse sobre un **nodo equipo**: muestra `Nombre` y `Ubicacion`.
- Al pasar el mouse sobre un **nodo cable multipar** (hub): muestra Nombre/ID del cable, Largo y Categoría.
- Al pasar el mouse sobre una **línea de cable colapsado**: muestra la conexión a nivel de puerto, tanto del equipo como del cable:
  - `NombreEquipoOrigen [PuertoEquipo] → NombreCable [PuertoCable]`
  - `NombreCable [PuertoCable] → NombreEquipoDestino [PuertoEquipo]`
  - Tipo de señal en negrita con su color.
  - Tipo y largo del cable (`ej. XLR 10m`).
- El tooltip sigue al cursor (posición fija relativa al mouse).
- **Nunca** mostrar IDs internos en el tooltip.

### 8.2 Click en Nodo → Ficha
- Al hacer click en un nodo (equipo o cable multipar):
  - Se oculta el mapa.
  - Se muestra la vista de Operación **sin llamar a `renderInventory()`** (para no bloquear la UI).
  - Se ejecuta `renderResults(id)` directamente → la ficha se abre **instantáneamente**.

### 8.3 Ficha → Ver en el Mapa
- En `renderResults(id)`, hay un **ícono discreto** `my_location` (sin texto).
- Al hacer click: se abre el modo MAPA y la cámara **anima hacia el nodo** seleccionado (centrado, zoom x1.5).

### 8.4 Paneo
- Arrastrar el fondo (blank area) mueve el canvas.
- También puede panearse sobre el fondo de los contenedores de Ubicación.

---

## 9. Panel de Filtros

- Botón flotante `filter_alt` en la esquina superior derecha del mapa (`position: fixed; top: 80px; right: 16px; z-index: 1001`).
- Al hacer click, despliega un panel con 3 filtros en cascada:
  1. **Señal** (`Tipo_Senial`): selector dropdown con todas las señales únicas de `db.conexiones`.
  2. **Ubicación**: selector dropdown con todas las ubicaciones únicas.
  3. **Categoría**: selector dropdown con todas las categorías únicas de equipos/cables.
- Al cambiar cualquier filtro, se vuelve a renderizar el mapa mostrando solo los elementos que cumplen los filtros.
- Botón "Limpiar filtros" restaura la vista completa.

---

## 10. Estilo Visual General

- Fondo del canvas: `#0d1117` (negro GitHub).
- Fuente: `Outfit` (Google Fonts).
- Paleta de colores de señal: rotativa, siempre coherente entre renders.
- El diseño debe integrarse visualmente con el resto de la app (variables CSS: `--bg-color`, `--accent-cyan`, etc.).

---

## 11. Verificación de Compatibilidad: AntV X6 v2

| Requisito | AntV X6 v2 | Notas |
|---|---|---|
| Puertos nativos izq/der con círculos de color | ✅ | `ports.groups` con `position: 'left'/'right'` y markup SVG |
| Ruteo ortogonal / manhattan | ✅ | `router: { name: 'orth' }` o `'er'` |
| Compound nodes (grupos padre) | ✅ | Soporta nodos hijos con `.parent` |
| Edge desde/hacia puertos específicos | ✅ | `source: { cell, port }`, `target: { cell, port }` |
| Label sobre aristas | ✅ | `labels` con markup personalizado |
| Marcadores de flecha y círculo | ✅ | `connector.attrs.line.sourceMarker/targetMarker` |
| Líneas punteadas por estado | ✅ | `strokeDasharray` en attrs |
| Paleta de colores dinámica | ✅ | Calculada en JS, aplicada en edge attrs |
| Layout Dagre (jerarquico L→R) | ✅ | `@antv/layout` dagre, disponible en CDN |
| Pan y Zoom con límites | ✅ | `graph.scroller` o config nativa |
| Tooltip hover | ✅ | Eventos `node:mouseenter/mouseleave` |
| Click → navegar a ficha | ✅ | Evento `node:click` |
| CDN sin dependencias | ✅ | Un solo script `x6.js` sin jQuery/Backbone |
| Licencia gratuita | ✅ | MIT License |

> [!IMPORTANT]
> AntV X6 cubre **todos los requisitos**. La API de puertos y routing es incluso más limpia que la de JointJS v4.

---

## 12. CDN de Referencia para AntV X6

```html
<!-- AntV X6 v2 (MIT) -->
<script src="https://cdn.jsdelivr.net/npm/@antv/x6@2.18.1/dist/x6.js"></script>

<!-- Layout Dagre para auto-organización jerárquica -->
<script src="https://cdn.jsdelivr.net/npm/@antv/layout@0.3.24/dist/layout.min.js"></script>

<!-- Opcional: ELK via elkjs (si se prefiere ELK sobre dagre) -->
<script src="https://cdn.jsdelivr.net/npm/elkjs@0.8.2/lib/elk.bundled.js"></script>
```

> [!NOTE]
> X6 v2 **no requiere** jQuery, Lodash ni Backbone. Es un bundle autocontenido.
