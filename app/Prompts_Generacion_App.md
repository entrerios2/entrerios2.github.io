# Prompts para Generación de App de Conexiones (Arquitectura GAS + GitHub Pages)

Copia y pega los siguientes prompts en tu nuevo agente para generar el código sin gastar tu cuota actual. Te recomiendo hacerlo en dos pasos (primero el backend, luego el frontend) para evitar que la respuesta del agente se corte.

---

### PROMPT 1: Generación del Backend (Google Apps Script)
*Copiá este texto y envíaselo al agente para generar tu base de datos.*

> **Actúa como un desarrollador experto en Google Apps Script.**
> Necesito crear un script (`Code.gs`) para ser desplegado como Aplicación Web (Web App) pública que sirva como API REST para una base de datos de cableado de un evento audiovisual.
> 
> Mi planilla de Google Sheets tiene 3 solapas: "1_Equipos", "2_Cables" y "3_Conexiones".
> Las solapas 1 y 2 tienen columnas `Propietario`, `Lugar_Guardado_Final` y `Estado_Logistica` (En Uso, Guardado, Devuelto).
> La solapa 3 tiene: `ID_Patch`, `ID_Origen`, `Puerto_Origen`, `ID_Destino`, `Puerto_Destino`, `Tipo_Senial`, `Estado_Instalacion`.
> 
> **Requisitos del código:**
> 1. Crea la función `doGet(e)`: Debe leer los datos de LAS TRES solapas y devolverlos en un objeto JSON con 3 propiedades (equipos, cables, conexiones). Asegúrate de usar `ContentService.createTextOutput()` y retornar el MimeType correcto (CORS).
> 2. Crea la función `doPost(e)`: Debe recibir un JSON conteniendo una acción ("UPDATE_PATCH" o "UPDATE_LOGISTICA"). Si es UPDATE_PATCH, actualiza el `Estado_Instalacion` en la solapa "3_Conexiones" guiándose por el `ID_Patch`. Si es UPDATE_LOGISTICA, actualiza el `Estado_Logistica` guiándose por el ID del equipo o cable en la solapa correspondiente (1 o 2).
> 3. Implementa manejo básico de errores y devolvé un JSON de éxito/error.
> 4. Al final de tu respuesta, dame instrucciones de 3 pasos, muy breves, sobre cómo darle a "Nueva Implementación / Deploy" en Google Sheets asegurando configurar "Ejecutar como: Yo" y "Acceso: Cualquier persona".

---

### PROMPT 2: Generación del Frontend (GitHub Pages)
*Una vez que tengas la URL del script anterior, copiá este texto y envíaselo al agente para crear la web visual.*

> **Actúa como un desarrollador Frontend experto (HTML5, CSS3, Vanilla JS).**
> Necesito programar una Single Page Application (SPA) para GitHub Pages que sirva de herramienta de consulta para técnicos de montaje. La app consultará un backend vía `fetch()`.
> 
> **Requisitos Funcionales y de Diseño:**
> 1. Crea una interfaz responsiva, **Mobile-First**, con un diseño "Dark Mode" moderno, colores vibrantes y estéticos (pensada para técnicos que trabajan en entornos oscuros de escenario).
> 2. Deja una constante genérica `const API_URL = "PEGAR_AQUI_LA_URL_DE_GAS"` al principio del JS.
> 3. **Buscador Principal y Lector QR:** Un input grande donde el usuario escriba el ID de su equipo o cable. Agrega un botón de "Escanear QR" que utilice una librería liviana por CDN (como `html5-qrcode`) para abrir la cámara del celular. Al detectar un QR, debe insertar el texto escaneado en el buscador y disparar la búsqueda automáticamente.
> 4. Al buscar, hacé un `GET` a la API para obtener el listado, y buscá el input del usuario en los campos `ID_Origen` o `ID_Destino`.
> 5. **Tarjetas de Conexión (Ruta Completa):** La base de datos trata a los cables como Nodos (igual que a un equipo). Tu código Javascript debe implementar un algoritmo de búsqueda en grafo (Graph Traversal) hacia atrás y hacia adelante a partir del ID encontrado enlazando orígenes con destinos.
>    Ejemplo visual que debe mostrar la tarjeta: `[Consola XR12] ➔ [CBL-XLR-001] ➔ [CBL-XLR-002] ➔ **[El Nodo Buscado]** ➔ [Bafle]`. 
>    Resalta con un color vibrante exactamente el equipo o cable que el usuario buscó.
> 6. **Modo Desarme / Logística:** Agrega un "switch" o botón flotante en la UI para alternar entre "Modo Armado" y "Modo Desarme". Si está en Modo Desarme, al buscar un ID de equipo o cable, la tarjeta mostrará de quién es el equipo (`Propietario`). Si es propio, mostrará dónde se debe guardar (`Lugar_Guardado_Final`). Tendrá botones interactivos para marcar el ítem como "Devuelto" (si es ajeno) o "Guardado" (si es propio). Esto hará un POST con acción "UPDATE_LOGISTICA".
> 7. **Interacción de Ruteo:** En el Modo Armado, cada tarjeta mostrará el `Estado_Instalacion`. Si el estado es "Pendiente", debe tener un botón para "Marcar como Conectado" haciendo POST a la API (acción "UPDATE_PATCH").
> 8. **PWA y Modo Offline (Vital):** La app se usará en lugares sin señal. Al cargar con internet, guarda la base de datos en `localStorage`. Si se pierde la conexión, el buscador y el trazado de rutas deben seguir funcionando localmente. Si alguien presiona un botón de actualización (ej. "Conectado") estando offline, guarda esa acción en una cola local (`offline_queue`). Cuando vuelva el internet (`window.addEventListener('online')`), dispara un ciclo de sincronización enviando todos los POST encolados al backend.
> 9. Entrégame el código estructurado (idealmente con un `manifest.json` y un Service Worker básico para caché estático) para que sea instalable como PWA y alojable directamente en GitHub Pages. No uses React ni librerías pesadas externas.

---

### PROMPT 3: Agregar Modo Administración (Carga de Datos)
*Pasale este prompt al agente para que le agregue la funcionalidad de ingreso de datos al código que ya te generó.*

> **Actúa sobre el código de la SPA y el GAS que acabas de generar.**
> Necesito agregar un "Modo Administración" para poder crear Equipos, Cables y Conexiones directamente desde la App.
> 
> **Requisitos para el Backend (`Code.gs`):**
> 1. Modifica la función `doPost(e)` para aceptar 3 nuevas acciones: `ADD_EQUIPO`, `ADD_CABLE` y `ADD_CONEXION`.
> 2. Implementa un `switch` o condicionales que usen el método `sheet.appendRow([array_de_datos])` de Google Apps Script para insertar la nueva fila en "1_Equipos", "2_Cables" o "3_Conexiones" según corresponda.
> 3. Asegúrate de devolver un JSON de éxito.
> 
> **Requisitos para el Frontend (`index.html` y `app.js`):**
> 1. **Botón Admin:** Agrega un tercer botón al toggle de modos: "ARMADO" | "DESARME" | "ADMIN".
> 2. **Vistas de Formularios:** En el Modo ADMIN, oculta el buscador y muestra un panel con 3 pestañas o secciones: "Cargar Equipo", "Cargar Cable", "Cargar Ruteo".
> 3. **Autocompletado Inteligente:** El formulario de "Cargar Ruteo" NO debe tener inputs de texto libre para el `ID_Origen` y `ID_Destino`. Debe tener listas desplegables (`<select>`) que se autocompleten iterando `db.equipos` y `db.cables` (mostrando el ID). Esto evitará errores de tipeo al armar el grafo.
> 4. **Integración Offline:** Al darle "Guardar", empaqueta el JSON y hacé el `fetch` POST. Si el celular no tiene internet, reutiliza tu lógica de `offline_queue` para guardar este alta y mandarla cuando vuelva la conexión.
> 5. **Reactividad:** Actualiza el estado local (`db`) instantáneamente agregando el nuevo objeto al array que corresponda, para que el nuevo equipo o cable aparezca en el buscador sin necesidad de recargar la página completa.

---

### PROMPT 4: Mejoras UX/UI y Menú de Navegación Avanzado
*Copiá este texto y pasáselo a tu agente para que reestructure la UI según lo que planificamos.*

> **Actúa sobre el código de la SPA (`index.html`, `app.js` y CSS asociado) que estamos desarrollando.**
> Necesito implementar las siguientes 5 mejoras de Interfaz de Usuario y Experiencia:
> 
> **1. Búsqueda con Coincidencias Múltiples:**
> Modifica `renderResults()` para usar `filter()` en lugar de `find()`. Si la búsqueda devuelve más de 1 coincidencia, no muestres la ruta directamente. En su lugar, muestra una lista de "tarjetas de solo texto" donde se resalte (ej: en amarillo o negrita) la parte del nombre o ID que coincidió con la búsqueda. Al hacer clic en una de estas tarjetas, debe ejecutar la vista detallada (ruta completa) para ese ítem específico.
> 
> **2. Tarjetas de Ruta Detallada:**
> En la vista del Modo Armado, dentro del ciclo que renderiza el grafo de la ruta, busca la información completa del nodo (Nombre, Propietario, Lugar, Estado) y muéstrala en texto más pequeño (como metadatos) debajo de cada ID en el recorrido.
> 
> **3. Nuevo Sistema de Navegación (Menú Hamburguesa):**
> Elimina por completo los botones inferiores estáticos de "Armado/Desarme/Admin". Crea un Navbar en la parte superior con un "Menú Hamburguesa". Al presionarlo, despliega un panel lateral o modal que contenga:
> - **Modos:** Armado, Desarme, Admin.
> - **Referencias (Diagramas):** Enlace que abra `https://github.com/entrerios2/entrerios2.github.io/tree/main/Especificaciones_Instalacion` en otra pestaña.
> - **Referencias (Manuales):** Enlace que abra `https://github.com/entrerios2/entrerios2.github.io/tree/main/Manuales` en otra pestaña.
> - **Compartir App:** Botón que intente usar `navigator.share()` (Web Share API) o copie al portapapeles la URL inyectando dinámicamente el parámetro `?gas_id=...` para que otras personas puedan entrar directo a la base actual.
> 
> **4. Comboboxes (Listas Desplegables Inteligentes) en Admin:**
> Usa etiquetas `<datalist>` de HTML5 en los campos de Categoría, Tipo de Conector, Propietario, Ubicación y Lugar de Guardado. Crea una función `populateDatalists()` en JS que extraiga valores únicos de la base de datos (usando `Set`) e inyecte `<option>`s en cada datalist. Esto permitirá escribir algo nuevo o autocompletar.
> 
> **5. Generación Automática de IDs Secuenciales:**
> Agrega un escuchador de eventos a los campos Categoría, Tipo y Nombre. Al escribir, extrae las primeras letras para armar una nomenclatura en mayúsculas (Ej: `CAT-TIP-ELE`). Busca en tu estado global (`db`) cuál es el mayor número registrado para ese prefijo exacto, súmale 1 y mételo automáticamente en el input `ID` (ej: `CAT-TIP-ELE-002`). Debe poder editarse manualmente si el usuario no lo quiere.

---

### PROMPT 5: Inventario por Defecto y Vista Nodo-Céntrica (Múltiples Puertos)
*Pasá este prompt a tu agente para solucionar el ruteo de los equipos con múltiples entradas y salidas.*

> **Actúa sobre el código de la SPA (`index.html`, `app.js` y `styles.css`).**
> Necesito realizar un rediseño del flujo principal de la App para soportar equipos complejos (como Consolas o Splitters) que tienen múltiples conexiones de entrada y salida simultáneas.
> 
> **1. Material Icons y Textos:**
> Cambia la etiqueta `<title>` y los encabezados principales (ej. `.nav-title`) a "Audio y Video Circuito ER2". Reemplaza todos los emojis de la interfaz por la librería Google Material Icons. Incluye la etiqueta `<link>` correspondiente en el `<head>` y usa las etiquetas `<span class="material-icons">` (ej: `inventory_2`, `route`, `settings`, `share`, `arrow_back`).
> 
> **2. Inventario General (Vista por Defecto):**
> En `app.js`, modifica la lógica del buscador. Cuando el input esté vacío, la pantalla no debe quedar en blanco. Implementa una función `renderInventory()` que dibuje listas o bloques iterando `db.equipos`, `db.cables` y `db.conexiones`. Cada elemento mostrado debe tener un `onclick` que ejecute la vista de detalle de ese ID en particular.
> 
> **3. Vista "Nodo-Céntrica" (Reemplazo del trazado lineal):**
> La función actual que traza la ruta lineal (1 -> 2 -> 3) no soporta ramas (ej: Consola sacando señal a Amp1, Amp2 y Amp3). Debes reescribir `renderDetailView(id)` para que funcione de manera "Nodo-Céntrica".
> El diseño de la tarjeta debe ser así:
> - **Encabezado:** Un botón de "Volver al Inventario" (`arrow_back`) que limpie el buscador y vuelva al inicio. A su lado, el ID y metadatos del Equipo (o Cable) central.
> - **Cuerpo (Grid/Flexbox):**
>   - **Columna Izquierda (ENTRADAS):** Busca en `db.conexiones` donde `ID_Destino === id`. Lista cada coincidencia mostrando: El `Puerto_Destino` del equipo central, el `Tipo_Senial`, y el `ID_Origen` que está conectado allí. El `ID_Origen` debe ser un botón clickeable para saltar hacia la ficha de ese equipo (Navegación en grafo).
>   - **Centro:** Información estética o ícono del equipo.
>   - **Columna Derecha (SALIDAS):** Busca en `db.conexiones` donde `ID_Origen === id`. Lista cada coincidencia mostrando: El `Puerto_Origen` de salida, el `Tipo_Senial`, y el `ID_Destino` (clickeable para saltar hacia allá).
> - De esta forma, el usuario verá al equipo en el centro, y a los lados todas sus ramas entrantes y salientes, pudiendo navegar por todo el diagrama paso a paso.

---

### PROMPT 6: Actualización de Backend (Modo Edición - CRUD)
*Pasale este prompt al agente para enseñarle a tu Google Apps Script a actualizar filas.*

> **Actúa como un experto en Google Apps Script.**
> Necesito actualizar el archivo `Code.gs` de mi API REST para permitir la edición de filas existentes, completando así las operaciones CRUD.
> 
> **Requisitos:**
> 1. Modifica la función `doPost(e)` para aceptar tres nuevas acciones: `EDIT_EQUIPO`, `EDIT_CABLE`, y `EDIT_CONEXION`.
> 2. Implementa una función de ayuda (helper) que busque en una solapa específica ("1_Equipos", "2_Cables" o "3_Conexiones") iterando las filas hasta encontrar el ID coincidente (usando la misma lógica robusta de comparación de strings que usamos en `UPDATE_LOGISTICA` limpiando espacios).
> 3. Una vez encontrada la fila del ID, debes sobrescribir toda esa fila (usando `getRange(row, 1, 1, data.length).setValues([data])`) con el array de datos nuevos recibidos en el JSON.
> 4. Devuelve un JSON de éxito o de error si el ID no se encontró.
> 
> Entrégame únicamente las modificaciones necesarias a `Code.gs`.

---

### PROMPT 7: Frontend - Árbol Interactivo, Tablas Admin y Desktop
*Copiá este texto y pasáselo a tu agente para rediseñar la UI, el modo Admin y el ruteo interactivo.*

> **Actúa sobre el código de la SPA (`index.html`, `app.js` y `styles.css`).**
> Necesito implementar una refactorización masiva en la Interfaz de Usuario para tener un Modo Admin tipo CRUD, diseño para monitores y un árbol de conexiones inteligente.
> 
> **1. Modo Admin Centralizado (Tablas y Edición):**
> En `index.html`, cambia las pestañas "Cargar..." por "Gestión de Equipos", "Gestión de Cables", "Gestión de Ruteo".
> Dentro de cada pestaña, el contenido principal debe ser una Tabla HTML con scroll horizontal (`overflow-x: auto`) que liste todos los elementos iterando tu variable global `db`.
> Haz que haciendo clic en el `<th>` de las columnas, los datos de la tabla se ordenen alfabéticamente.
> Encima de la tabla, pon un botón `[+ Nuevo Elemento]` que expanda el formulario de carga original.
> En la tabla, agrega una columna "Acciones" con un botón `[Editar]`. Al hacer clic, el formulario debe rellenarse con los datos de esa fila, el botón debe decir "Actualizar", y al enviarse debe hacer un `fetch` POST con la acción `EDIT_EQUIPO`, `EDIT_CABLE` o `EDIT_CONEXION` según corresponda. Actualiza el estado local (`db`) tras el éxito.
> 
> **2. Diseño Desktop y Material Icons:**
> En `styles.css`, envuelve el contenido principal en un contenedor de ancho máximo (ej. `max-width: 900px; margin: 0 auto;`) para que en Desktop (PC) la interfaz no se estire de borde a borde.
> Reemplaza los emojis del DOM por Google Material Icons: `speaker` para equipos, `cable` para cables, `route` para conexiones.
> 
> **3. Jerarquía Visual en la Ficha del Equipo:**
> Cuando un ítem esté seleccionado (centro de atención), su **Nombre o Descripción** debe ser el `<h2>` principal. Su ID será secundario (un badge pequeño). Muestra **Toda la información disponible** de la base de datos para ese ítem central (propietario, lugar, notas, etc.).
> 
> **4. Recuperación del Árbol Interactivo (Bifurcaciones):**
> Al buscar un elemento, traza la ruta completa hacia atrás y adelante. Dibújala como una línea vertical. En los nodos del árbol que NO son el central, muestra menos info: solo ID, Categoría, Ubicación y Estado.
> **Bifurcaciones:** Si el algoritmo detecta que un equipo tiene múltiples salidas o entradas (Ej: Consola hacia Amp 1 y Amp 2), no dibujes múltiples ramas en paralelo. Dibuja un `<select>` nativo en ese nodo del árbol que diga "Ruta por: [Amp 1 ▼]". Al cambiar el `<select>`, recalcula y redibuja dinámicamente la continuación del árbol.
> 
> **5. Semáforo y Botones de Conexión:**
> En cada salto (flecha de conexión) del árbol, muestra el Puerto de Origen, Destino y Tipo de Señal. 
> Agrega un botón "Conectar" / "Desconectar" que envíe un POST `UPDATE_PATCH`. 
> Si esa conexión está "Conectado", pinta el bloque o flecha de **Verde sólido**. Si es "Pendiente", de **Gris oscuro punteado**. Esto dará feedback visual instantáneo del progreso.

---

### PROMPT 8: Refinamiento de UI, Árbol Colapsable y Corrección de Bugs
*Copiá este texto y pasáselo a Gemini Flash para corregir el ancho de pantalla, el guardado de datos y perfeccionar la vista.*

> **Actúa sobre el código de la SPA (`index.html`, `app.js` y `styles.css`).**
> Necesito implementar una serie de refactorizaciones para corregir bugs recientes y mejorar dramáticamente la usabilidad de la interfaz:
> 
> **1. Corrección del Bug de Guardado (Mapeo de Campos):**
> En `app.js`, al crear/editar (en `handleAction`), estás guardando en `db` el objeto directo del `FormData` (ej. `nombre`, `ubicacion`). Pero la base de datos usa mayúsculas (`Nombre`, `Ubicacion_Uso`, `Categoria`).
> Por favor, crea un mapeador exacto dentro de `handleAction` para que las claves del formulario se conviertan a las claves reales que usamos en el backend antes de hacer `push` o actualizar el estado local `db` y antes de enviarlo al servidor.
> 
> **2. Expansión del Diseño Desktop:**
> En `styles.css`, modifica `.desktop-wrapper` para que su `max-width` sea mucho más amplio (ej. `1200px` o `1400px`). En pantallas grandes, las tablas de administración y el inventario deben ocupar casi todo el ancho disponible para ser navegables.
> 
> **3. Inventario Principal como Tablas:**
> En `app.js`, actualiza la función `renderInventory()` (la que se muestra cuando el buscador está vacío). En lugar de usar `.inventory-item` (tarjetas), debe renderizar la vista usando exactamente las mismas Tablas HTML (con `thead` y `tbody`) que usas en el modo Admin, permitiendo ordenar columnas y aprovechar el ancho.
> 
> **4. Recuperar Botones de Logística y Estado:**
> - En **Modo Desarme**, asegúrate de renderizar en el nodo central del árbol el botón de "Marcar Logística (Guardado/Devuelto)" que actualice el campo `Estado_Logistica` en la base.
> - En **Modo Armado**, asegúrate de que exista un botón claro en el equipo para marcar la conexión como "Conectado / Pendiente".
> 
> **5. Árbol de Conexiones Visual (Puertos en los bordes) y Colapsable:**
> Modifica `renderTree()` y tu CSS para que el árbol sea mucho más estético, parecido a equipos físicos conectados:
> - **Puertos en los bordes:** En lugar de mostrar la conexión flotando sola entre dos equipos, integra visualmente la información de los puertos en los bordes de la "caja" del equipo. Es decir, usando CSS (con position `relative` en el equipo y `absolute` en los puertos), coloca un pequeño bloque o pastilla en el borde superior del equipo central que indique su puerto de ENTRADA, y una pastilla en el borde inferior que indique su puerto de SALIDA.
> - **Múltiples Puertos como Dropdown:** Esta misma pastilla en el borde del equipo debe ser el `<select>` nativo si es que el equipo tiene múltiples salidas o entradas. Al cambiar el dropdown, redibuja la ruta.
> - **Colapsable:** Por defecto, dibuja solo **un (1) nivel hacia arriba** y **un (1) nivel hacia abajo** del equipo central. Agrega un botón tipo `[+ Expandir]` para cargar los siguientes niveles y no saturar.
> 
> **6. Prevención de Caché (Cache Busting):**
> En `index.html`, agrégale a las etiquetas link de `styles.css` y `app.js` un parámetro aleatorio o de versión (ej. `?v=3.0`) para evitar el cache de GitHub Pages al publicar.

---

### PROMPT 9: Evolución de Diseño, Listado de Puertos e Inventario Desarme
*Copiá este texto y pasáselo a Gemini Flash para implementar el listado avanzado de puertos, centrado del grafo y las vistas de Desarme.*

> **Actúa sobre el código de la SPA (`index.html`, `app.js` y `styles.css`).**
> Debes aplicar las siguientes mejoras masivas a la interfaz y lógica visual:
>
> **1. Fluidez Total en Desktop:**
> En `styles.css`, la clase `.container` tiene un candado de `max-width: 600px;` que rompe todo el diseño en PC. Quita o cambia el max-width de `.container` a `100%` para que la clase superior (`.desktop-wrapper`) sea la que dictamine el ancho de pantalla. El diseño debe verse expansivo.
>
> **2. Tabla de Conexiones y Vistas de Desarme (`renderInventory`):**
> - Agrega una tercera sección a la función `renderInventory()` que dibuje la **Tabla de Conexiones** (iterando sobre `db.conexiones`), exactamente con el mismo formato que las de equipos y cables.
> - **Filtro de Desarme:** Si `currentMode === 'DESARME'`, el inventario no debe mostrar las tablas por defecto. Debe mostrar dos botones arriba: `[Ver Tablas]` y `[Ver por Contenedor]`. La vista de "Contenedor" debe agrupar los equipos y cables visualmente por su campo `Lugar_Guardado_Final`. Los que no tengan lugar asignado, colócalos en "Sin Asignar".
>
> **3. Rediseño Absoluto de la Ficha Central (`renderTreeNode`):**
> Transforma el HTML del nodo central:
> - Mueve el **Botón Volver Atrás** fuera (arriba) de la caja del equipo para que no quite espacio.
> - En el encabezado interior, coloca el **Nombre del Equipo** seguido inmediatamente a su derecha por la pastilla del **ID**.
> - Haz la sección de metadatos ultra-compacta, usando íconos de Material (`person`, `location_on`, `inventory`) con `title="..."` en vez de texto verboso ("Propietario:", "Ubicación:"). Reduce el espaciado y margin.
> - Elimina cualquier botón de "instrucciones".
> - **Listado de Puertos (2 Columnas):** Debajo de la info del equipo, crea dos columnas: Izquierda (ENTRADAS) y Derecha (SALIDAS). Lista todos los puertos usando el formato: `[Icono IN/OUT] NombrePuerto -> [Aparato al que conecta]`. 
> - Si el puerto está desconectado, que el texto/borde sea **Rojo (danger)**. Si está conectado, **Verde (success)**.
> - Agrega en cada línea de ese listado un pequeño control (checkbox o mini botón toggle) que dispare la conexión/desconexión directamente desde allí.
>
> **4. Grafo y Cableado (Semáforo y Centrado):**
> - En `styles.css` y `renderTreeConnection`: Asegúrate de que `.connection-jump` sea un flex-box perfectamente alineado al centro. La flecha debe cruzar por el medio sin desviarse.
> - El **Tipo de Señal** (`conn.Tipo_Senial`) debe mostrarse como una pequeña pastilla oscura (pill) superpuesta y centrada exactamente sobre el cable/flecha.
> - Reemplaza los colores "Gris/Verde" del semáforo. Lo que no está conectado es **Rojo**, lo que sí, es **Verde**. Aplica estos colores a los cables, flechas y los bordes de los puertos `IN/OUT`.
> - Reemplaza los enormes botones de texto `[+ Expandir Origen/Destino]` por simples y estéticos botones que contengan los iconos `keyboard_double_arrow_up` y `keyboard_double_arrow_down`.
> - En los puertos en los bordes de las cajas, agrega el icono `login` (para entradas) y `logout` (para salidas).

---

### PROMPT 10: TAREA EXHAUSTIVA DE UX, BUGS Y ESTILOS (¡NO OMITIR NADA!)
*Pasale este prompt a tu agente. Está redactado específicamente para obligarlo a no saltearse ninguna directiva.*

> **MUY IMPORTANTE:** He tenido problemas con omisiones en respuestas anteriores. Actúa como un desarrollador Senior Frontend sobre la SPA (`index.html`, `app.js` y `styles.css`). Te daré una lista de tareas exactas. Debes implementar **ABSOLUTAMENTE TODAS**, línea por línea.
>
> **TAREA 1: Terminología y Navegación Básica**
> - [ ] Reemplaza toda mención de "Lugar" y "Lugar Guardado" por **"Contenedor"** (en UI, placeholders y textos).
> - [ ] Menú lateral: El título (header) debe ser "Audio y video ER2". Los ítems deben ser "Armado", "Desarme", "Administración", "Compartir". Remueve la palabra "Modo".
> - [ ] Barra de Navegación: El título central dinámico dirá exactamente la vista en la que está (Armado, Desarme, Administración).
> - [ ] **Botón Atrás (Navegador):** Implementa `history.pushState` y escucha `window.onpopstate` para que tocar "Atrás" en el teléfono/PC vuelva a la vista del inventario anterior en lugar de sacar al usuario de la SPA.
> 
> **TAREA 2: Nueva Barra Superior y Feedback de Conexión**
> - [ ] Oculta por defecto el `<input>` de búsqueda. 
> - [ ] En la navbar pon un **icono de lupa** y el de código QR. Tocar la lupa debe desplegar el input de búsqueda fluídamente.
> - [ ] Elimina el banner fijo rojo de offline. En su lugar, agrega un ícono `cloud_off` súper estético incrustado en la navbar que aparezca solo si se corta la internet.
>
> **TAREA 3: Ficha Central y Checkboxes (UI Avanzada)**
> - [ ] Mueve el botón "X" o flecha para cerrar la ficha *adentro* de la tarjeta, en la esquina superior derecha (`position: absolute`).
> - [ ] Título de la Ficha: Muestra `[Icono altavoz o cable] Nombre del Equipo [Pastilla ID]`.
> - [ ] **Estado Logístico Interactivo:** Convierte el texto fijo de Estado en un `<select>` nativo con las opciones: `Guardado`, `Devuelto`, `Instalado`, `Preparado para instalar`, `Preparado para guardar`. Al cambiar el valor, que llame a la función de guardado en la base de datos.
> - [ ] Agrega `word-wrap: break-word` a los textos de los puertos `IN`/`OUT` para que no desborden la tarjeta.
> - [ ] **Checkboxes:** Estiliza el checkbox de conexión a nivel profesional. Al presionarlo, deshabilítalo temporalmente o aplícale un efecto visual de "Cargando..." (feedback de transacción) hasta que el backend (la función local de DB) termine y confirme.
> - [ ] En toda la app: Muestra skeletons o *placeholders* cuando carga data inicial de la DB, para evitar la pantalla congelada.
>
> **TAREA 4: Listados Colapsables y Selectores INDIVIDUALES**
> - [ ] Elimina los viejos botones "Ver Tablas" / "Ver Contenedor" de Desarme.
> - [ ] El inventario principal mostrará tres bloques colapsables base: **Equipos, Cables, Conexiones**.
> - [ ] **CRÍTICO:** *Dentro* de cada uno de esos tres bloques, agrega un `<select>` de Agrupación independiente:
>     - En Equipos: Categoría, Ubicación, Contenedor, Propietario, Estado.
>     - En Cables: Conector, Longitud, Propietario, Contenedor, Estado.
>     - En Conexiones: Origen, Destino, Tipo Señal, Estado.
> - [ ] Al elegir una agrupación, la UI dibuja `<details>` (acordeones) para cada grupo (ej. Contenedor Anvil 1), inicialmente colapsados.
> - [ ] **CRÍTICO 2:** Dentro de esos acordeones agrupados, los elementos *siempre* se renderizan como **Tabla HTML completa** con sus columnas, igual a como se ven normalmente.
>
> **TAREA 5: Mejora Premium de Admin y Fix de Mapeo**
> - [ ] En `editItem()` (Administración), soluciona el bug de los campos en blanco creando un diccionario **mapeador inverso** exhaustivo. Las DB keys usan mayúsculas (`Nombre`, `Categoria`) y los input names son minúsculas (`nombre`, `categoria`). Relaciona todo para que el form cargue todos los datos.
> - [ ] Esto solucionará el bug de que la pestaña "Ruteo" (conexiones) no abría la edición.
> - [ ] **Estilo de Formularios Admin:** Aplica CSS Premium a los formularios de carga y edición (inputs espaciados, bordes redondeados suaves, enfoque fluído) para que no se vean como HTML básico por defecto. Remueve "Gestión de " de las pestañas (solo Equipos, Cables, Ruteo).


---

### PROMPT 11: UNIFICACIÓN OPERATIVA, TRAZABILIDAD Y REDISEÑO DE ADMIN
*Pásale este prompt a tu agente de IA asegurándote de exigir la mayor rigurosidad posible.*

> **REGLAS ESTRICTAS PARA ESTA ITERACIÓN:**
> 1. NO borres ni simplifiques funciones que ya funcionan (como la búsqueda de grafos o los select de agrupación) a menos que se indique explícitamente.
> 2. Cada vez que edites index.html, debes **obligatoriamente** aumentar la versión en los <link> y <script> (ej. ?v=4.0) para evitar la caché de GitHub Pages.
> 3. Debes proveer el código completo de las funciones modificadas, no "recortes" incompletos.
> 
> **TAREA 1: Unificación a "Operación" e Identidad**
> - Elimina las referencias a los modos "Armado" y "Desarme". Combínalos en un único modo llamado **"Operación"**.
> - El menú lateral debe tener: Operación, Administración y Compartir.
> - En startApp(), verifica si existe 	ech_name en localStorage. Si no existe, muestra un prompt() o modal obligatorio que diga "Ingrese su nombre para registrar los cambios". Guárdalo en localStorage.
> 
> **TAREA 2: Trazabilidad y Metadatos JSON (Inmutables)**
> - Se asume una nueva columna en la base de datos llamada Metadatos. Este campo almacena un JSON stringificado con el esquema: { historial: [{timestamp: Number, nombre: String, detalle: String}], notas: [...] }.
> - Crea una función helper logActivity(item, tipo, detalle) que tome el elemento, lea su JSON Metadatos (o lo inicialice), haga un .push() al array correspondiente (historial o 
otas) usando Date.now(), el nombre local del técnico, y el detalle.
> - Al realizar cualquier cambio de estado (ej. de Guardado a Instalado) o al parchear una conexión, inyecta automáticamente un registro en el historial.
> - Las Notas **no se sobreescriben ni se borran**. Cuando el usuario guarda una nota desde la UI, simplemente hace un push al array 
otas.
> 
> **TAREA 3: Ficha Central y Visualización de Trazabilidad**
> - Debajo de los datos fijos en la ficha del nodo, muestra dos líneas de **resumen visual** usando íconos de Material Design:
>   - <span class="material-icons">chat</span> Última nota: [Solo Fecha/Hora] [Detalle corto]
>   - <span class="material-icons">history</span> Último mov: [Solo Fecha/Hora] [Detalle corto]
>   *(Usa formato condicional de fecha: si es de hoy, muestra solo la hora, sino muestra dd/mm).*
> - Muestra dos <details> colapsables:
>   - **Historial de Movimientos:** Lista todos los registros de historial mostrando [Fecha/Hora] [Nombre]: [Detalle].
>   - **Notas de Mantenimiento:** Lista todas las notas. Agrega allí mismo un <textarea> minimalista y un botón para "Agregar Nota".
> 
> **TAREA 4: Salto desde la Tabla de Conexiones**
> - In el listado agrupado del inventario de "Operación", si el usuario hace clic sobre una fila de la tabla de **Conexiones**, invoca `renderResults()` pasándole el ID_Origen de esa conexión (o el destino), para que el usuario sea transportado al árbol de ruteo y pueda visualizar el contexto de lo que clickeó.
> 
> **TAREA 5: Rediseño Absoluto de Administración (Modo Espejo)**
> - La interfaz de "Administración" debe ser un **espejo** de la interfaz de "Operación". Usa exactamente los mismos 3 bloques colapsables (Equipos, Cables, Conexiones), permitiendo agruparlos con los <select>.
> - Al hacer clic en un elemento de estas tablas en Administración, se debe abrir el **Formulario de Edición** correspondiente (no la ficha de Operación).
> - **Estilos de Formularios Premium:** Aplica CSS de alta gama a los formularios. Usa display: grid, inputs amplios con bordes redondeados suaves (border-radius: 8px), padding generoso, outline vibrante al hacer focus, y haz que se adapten fluidamente (1 columna en móvil, 2 columnas en desktop).

---

### PROMPT 12: Feedback Visual de Carga (Spinners) Globales

**Contexto:** Actualmente, las acciones que modifican el estado en la base de datos (Google Sheets a través de Apps Script) funcionan en segundo plano (asíncronamente). Debido a que el backend puede tardar un par de segundos en procesar, el usuario no tiene certeza visual inmediata de que el guardado está en proceso.

**Objetivo:** Implementar indicadores de carga (spinners) estéticos y universales en la UI para cada interacción que invoque un llamado asíncrono.

**Instrucciones para el Agente:**

1. **Creación del Componente Spinner (CSS)**
   - En `styles.css`, agrega una clase `.spinner` minimalista y moderna. Usa un anillo semi-transparente con un borde superior de color acentuado (acorde a la paleta actual) y una animación `spin` fluida.
   - Crea variaciones de tamaño (ej. `.spinner-sm` para botones o checkboxes, y `.spinner-btn` para alineación interna en botones).

2. **Feedback en los Checkboxes de Conexión (Patch)**
   - In la función `togglePatch` (en `app.js`), inmediatamente después de desactivar el checkbox (`checkboxEl.disabled = true;`), inyecta visualmente el `.spinner` al lado del input o reemplaza transitoriamente el `.checkmark`.
   - Una vez que la promesa de `handleAction('UPDATE_PATCH')` y `logActivity` se resuelvan (o fallen en el `catch`), asegúrate de que el spinner desaparezca. Si `renderTree` se encarga de rehacer el DOM, está bien, pero el `catch` debe limpiar la UI en caso de error.

3. **Feedback en los Formularios de Administración**
   - In la función `handleFormSubmit()`:
     - Antes del `await handleAction()`, deshabilita el botón de `submit` del formulario correspondiente.
     - Cambia el texto/contenido del botón a algo como `<span class="spinner spinner-sm"></span> Guardando...`.
     - Si la acción falla o termina, restaura el estado original del botón.

4. **Feedback en Modificación Logística y Notas**
   - In `handleUpdateLogistica()` (cambios desde los selects de logística), deshabilita el `select` y muéstrale el spinner al lado hasta que el `await` se resuelva.
   - In la función que guarda las notas (dentro de la lógica de Mantenimiento), deshabilita el botón de enviar y muestra el spinner.

5. **Actualización de Caché Estricta**
   - Incrementa las variables de cache-busting en `index.html` para el script y estilos (por ejemplo, pasá a `?v=23.0`) para forzar la actualización en GitHub Pages.

**Regla de Oro:** Garantizar siempre un bloque `try...finally` o lógica en los `catch` para que los botones NUNCA se queden deshabilitados perpetuamente si ocurre un error de red.

---

### PROMPT 13: Impresión de Etiquetas QR para Equipos y Cables

**Contexto:** La aplicación gestiona un inventario de equipos y cables AV. Se necesita poder imprimir etiquetas físicas con códigos QR para identificar cada elemento. Las etiquetas tienen dos formatos distintos: rectangular para equipos y bandera (flag) para cables. Los QR se escanean luego con el lector integrado de la app para buscar el elemento.

**Objetivo:** Implementar un sistema completo de generación e impresión de etiquetas QR desde la sección de Administración.

**Instrucciones para el Agente:**

> **REGLA CRÍTICA:** No omitas ninguna directiva. Al finalizar, recorré cada punto de este prompt y verificá que esté implementado. Incrementá la versión de cache-busting en `index.html` para JS y CSS.

**TAREA 1: Agregar librería QR**
- Incluí en `index.html` la librería `qrcode.min.js` via CDN: `https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js`
- El QR debe codificar **solo el texto del ID** del elemento (ej: `XR-01`), NO una URL.
- Configurar con nivel de corrección de error **L** (Low) para minimizar la cantidad de módulos y maximizar legibilidad en tamaño muy pequeño.

**TAREA 2: Formato de Etiqueta de Equipo**
- Dimensiones fijas: **30mm × 20mm**
- Layout horizontal: QR a la izquierda (ocupa el alto completo), datos a la derecha.
- Tipografía: Usar una **fuente narrow/condensed** (ej: `Inter Tight`, `Roboto Condensed`, o similar de Google Fonts) para maximizar el texto que entre en el espacio reducido.
- Datos a mostrar (usar **Material Icons** idénticos a los de la app, NO emojis):
  - **Nombre/Modelo** — texto destacado, bold, mayor tamaño que el resto
  - `category` → Categoría
  - `location_on` → Ubicación de Uso
  - `home` → Contenedor
  - `person` → Propietario
- El ID se muestra debajo del QR en texto legible.
- Esquema visual:
```
┌────────────────────────────┐
│ ┌─────┐  NOMBRE DESTACADO  │
│ │ QR  │  category Cat.     │
│ │     │  location_on Ubic. │
│ └─────┘  home Cont.        │
│  ID-EQ   person Prop.      │
└────────────────────────────┘
```

**TAREA 3: Formato de Etiqueta de Cable (Bandera/Flag)**
- Dimensiones fijas totales: **120mm × 12mm** (esto se compone de 3 zonas)
- La etiqueta se dobla y pega consigo misma alrededor del cable formando una bandera legible desde ambos lados.
- **Estructura de la tira:**
  - **Zona visible A** (40mm): Datos del cable + QR miniatura
  - **Zona de pegado** (20mm central): Se envuelve alrededor del cable. Marcar con **líneas punteadas** en ambos bordes indicando "doblar aquí". Esta zona puede estar en blanco o con el ID repetido.
  - **Zona visible B** (40mm): **Datos idénticos** a la Zona A (repetidos, NO espejados — al doblar quedan legibles desde ambas caras de la bandera)
- Datos a mostrar en cada zona visible (Material Icons):
  - QR miniatura del ID
  - ID del cable en bold
  - `cable` → Tipo de Conector
  - `straighten` → Longitud
  - `home` → Contenedor
  - `person` → Propietario
- Misma fuente narrow/condensed que la etiqueta de equipo.
- Esquema visual:
```
┌──── visible A (40mm) ─────┬── pegado (20mm) ──┬──── visible B (40mm) ─────┐
│ ┌──┐                      │                   │ ┌──┐                      │
│ │QR│ ID cable T. 📏 Long  │  ┄┄ doblar ┄┄    │ │QR│ ID cable T. 📏 Long  │
│ └──┘    home C.  👤 Prop  │                   │ └──┘    home C.  👤 Prop  │
└───────────────────────────┴───────────────────┴───────────────────────────┘
```

**TAREA 4: CSS de Impresión**
- Todas las dimensiones de etiquetas deben estar en **`mm`** (unidades absolutas CSS) para que se impriman siempre al mismo tamaño sin importar el papel.
- Definir `@media print` que:
  - Oculte **toda** la UI de la app (navbar, sidebar, modales, contenido) excepto `#printArea`
  - Aplique las dimensiones fijas a cada tipo de etiqueta
  - Use `@page { margin: 5mm; }`
  - Todo en **blanco y negro** (sin colores de la paleta de la app)
  - Material Icons deben renderizarse correctamente en impresión (verificar que la fuente se cargue)
- Para impresión por lote: disponer las etiquetas en grilla (varias por fila) para aprovechar el papel.

**TAREA 5: Funciones JavaScript**
- `generateEquipoLabel(id)` → Genera el HTML de una etiqueta de equipo a partir de su ID en `db.equipos`
- `generateCableLabel(id)` → Genera el HTML de una etiqueta de cable a partir de su ID en `db.cables`
- `printLabels(type)` → Recibe `'equipos'` o `'cables'`, genera las etiquetas de todos los elementos visibles (respetando filtros/agrupación activos), las inyecta en `#printArea`, y llama a `window.print()`. Limpia `#printArea` después del evento `afterprint`.
- Crear un `<div id="printArea" style="display:none"></div>` en `index.html` para el área de impresión.

**TAREA 6: UI — Botón en Administración**
- En la sección de **Administración**, dentro del header de las secciones colapsables de **Equipos** y **Cables** (junto al botón/cápsula de agrupar), agregar un botón con el ícono `print` de Material Icons.
- Al hacer clic, debe mostrar un **modal de vista previa** antes de imprimir:
  - Muestra las etiquetas generadas a escala visual (pueden ser escaladas para preview pero se imprimen a tamaño real)
  - Nota visible: "Asegurate de imprimir a escala 100%"
  - Botón "Imprimir" que ejecuta la impresión
  - Botón "Cerrar" para cancelar
- NO agregar el botón de impresión en la sección de Operación, solo en Administración.

**TAREA 7: Cache-busting**
- Incrementá las versiones `?v=` de CSS y JS en `index.html`.

**Verificación final:** Antes de terminar, repasá cada tarea (1-7) y confirmá que está implementada. Verificá que:
- [ ] La librería QR está incluida via CDN
- [ ] Las etiquetas de equipo miden 30×20mm en impresión
- [ ] Las etiquetas de cable miden 120×12mm con 3 zonas (40+20+40)
- [ ] Los QR codifican solo el texto del ID
- [ ] Se usa fuente narrow/condensed
- [ ] Se usan Material Icons, no emojis
- [ ] El botón de imprimir aparece solo en Administración
- [ ] Hay modal de vista previa antes de imprimir
- [ ] `@media print` oculta toda la UI excepto las etiquetas
- [ ] Versiones de cache-busting actualizadas

---

### PROMPT 14: Corrección Crítica de Impresión de Etiquetas (CSS Roto)

**Contexto:** La impresión de etiquetas no funciona. Al imprimir, la salida muestra una captura de la página completa (con scrollbar, navbar, y toda la UI visible) en vez de solo las etiquetas. Las etiquetas no se muestran con el formato correcto.

**Causa raíz diagnosticada:** Hay un **error de sintaxis CSS** en `styles.css`. En la línea que contiene `.premium-select-wrapper .premium-select {`, la llave de cierre `}` de esa regla **nunca se escribió**. Todo el bloque de CSS de impresión (`@media print`, `.label-equipo`, `.label-cable`, `#printArea`, etc.) quedó **anidado dentro** de esa regla, lo cual invalida completamente todas las reglas de impresión.

El error está así:
```css
.premium-select-wrapper .premium-select {
  padding: 8px 30px 8px 12px;
  width: 100%;/* Print & Label Styles */   ← ¡FALTA } antes de este comentario!
#printArea { display: none; }
@media print { ... }
.label-base { ... }
...
}  ← Esta llave cierra .premium-select-wrapper, NO el bloque de preview
```

**Instrucciones para el Agente:**

> **REGLA CRÍTICA:** Este prompt corrige un bug de sintaxis. NO cambies la lógica JavaScript ni el HTML. Solo corregí el CSS. No omitas ningún paso. Incrementá cache-busting.

**TAREA 1: Corregir la sintaxis CSS**
- En `styles.css`, buscá la regla `.premium-select-wrapper .premium-select {`. 
- Inmediatamente después de `width: 100%;`, cerrá la regla con `}`.
- Asegurate de que el comentario `/* Print & Label Styles */` y todo lo que sigue (`#printArea`, `@media print`, `.label-base`, `.label-equipo`, `.label-cable`, `#previewContainer`) queden como **reglas CSS de nivel raíz**, NO anidadas dentro de ningún otro selector.
- Verificá que la `}` que estaba en la línea del `#previewContainer .label-container` (que era la que cerraba erróneamente `.premium-select-wrapper`) se elimine o se reubique correctamente.

**TAREA 2: Verificar la estructura `@media print`**
- La regla `@media print` debe:
  - Ocultar `body > *:not(#printArea)` con `display: none !important`
  - Mostrar `#printArea` con `display: flex !important`
  - Aplicar `@page { margin: 5mm; }`
  - Quitar scrollbars: `html, body { overflow: hidden !important; }`
  - Fondo blanco: `html, body { background: #fff !important; }`
- Estas reglas deben estar a **nivel raíz del CSS**, NO dentro de ningún otro selector.

**TAREA 3: Verificar dimensiones de etiquetas**
- `.label-equipo` debe tener `width: 30mm; height: 20mm;` a nivel raíz
- `.label-cable` debe tener `width: 120mm; height: 12mm;` a nivel raíz
- Verificar que `.label-base`, `.label-equipo .qr-side`, `.label-cable .zone`, `.label-cable .pegado` y todas las sub-reglas estén a nivel raíz

**TAREA 4: Verificar que el QR se renderice dentro de las etiquetas**
- Los elementos `.qr-canvas` dentro de las etiquetas deben tener `overflow: hidden` y dimensiones que restrinjan el canvas generado por `qrcode.js` al tamaño de la etiqueta
- El canvas/imagen generado por `QRCode()` debe escalarse con CSS: `.qr-canvas img, .qr-canvas canvas { width: 100% !important; height: 100% !important; }`

**TAREA 5: Cache-busting**
- Incrementá las versiones `?v=` de CSS y JS en `index.html`.

**Verificación final:** Abrí las DevTools del navegador, pestaña Console, y verificá que no haya errores de parseo CSS. Luego hacé clic en "Imprimir" desde la vista previa y verificá en la ventana de impresión del navegador que:
- [ ] Solo se ven las etiquetas, no la UI de la app
- [ ] No se ve scrollbar
- [ ] Las etiquetas tienen borde y dimensiones correctas
- [ ] Los QR se ven dentro de las etiquetas
- [ ] Los Material Icons se muestran, no texto de fallback

---

### PROMPT 15: Ajustes de Formato en Etiquetas Impresas

**Contexto:** Las etiquetas se imprimen pero necesitan ajustes de formato para ser funcionales en producción. Este prompt corrige el espaciado, bordes, dimensiones de las etiquetas de cable y un ícono incorrecto.

**Instrucciones para el Agente:**

> **REGLA CRÍTICA:** Aplicá TODOS los cambios listados. Al finalizar, recorré cada tarea y verificá que esté implementada. Incrementá cache-busting en `index.html`.

**TAREA 1: Eliminar espacio entre etiquetas**
- En `styles.css`, las etiquetas deben imprimirse **sin espacio** entre ellas (gap: 0, margin: 0 en `.label-container` y en `#printArea`). De esta forma, al imprimir una hoja completa, el usuario puede recortarlas de una sola vez con una guillotina o tijera sin desperdiciar papel.
- Tanto en `@media print` como en la vista normal, los `.label-container` deben tener `margin: 0` y el `#printArea` debe tener `gap: 0`.

**TAREA 2: Borde exterior punteado**
- El borde de `.label-base` debe ser **punteado** (`border: 0.2mm dashed #000`), no sólido. Esto sirve como guía de corte visual.
- Aplicar tanto en pantalla como en `@media print`.

**TAREA 3: Corregir dimensiones de etiqueta de cable**
- La estructura actual es incorrecta. La etiqueta de cable debe tener **3 zonas con dimensiones simétricas**:
  - **Zona A** (izquierda visible): **40mm** — datos + QR alineado a la izquierda
  - **Zona de pegado** (centro): **20mm** — se envuelve alrededor del cable, con líneas punteadas a ambos lados
  - **Zona B** (derecha visible): **40mm** (= 40mm de datos) — los mismos datos repetidos, pero con el QR alineado **a la derecha** (al extremo derecho de la zona)
- **Total: 40 + 20 + 40 = 100mm** (el ancho total no cambia)
- La razón de la asimetría: cuando se dobla la bandera, la Zona B tiene 20mm extra que se superponen sobre la zona de pegado para adherirse. Al doblar, ambas zonas visibles quedan del mismo largo (40mm) y la bandera es simétrica visualmente.
- En el CSS:
  - `.label-cable .zone:first-child` → `width: 40mm` (QR a la izquierda, datos a la derecha del QR)
  - `.label-cable .pegado` → `width: 20mm`
  - `.label-cable .zone:last-child` → `width: 40mm` (datos a la izquierda, QR fijado a la derecha con `margin-left: auto` o `justify-content: flex-end`)
- En el HTML generado por `generateCableLabel()` en `app.js`, la Zona B debe tener el layout invertido: datos primero, QR al final (derecha).

**TAREA 4: Corregir ícono de contenedor**
- En `app.js`, en las funciones `generateEquipoLabel()` y `generateCableLabel()`, el ícono del campo Contenedor/Lugar de Guardado debe ser `inventory_2`, NO `home`.
- Buscar todas las ocurrencias de `<span class="material-icons">home</span>` dentro de estas dos funciones y reemplazarlas por `<span class="material-icons">inventory_2</span>`.

**TAREA 5: Cache-busting**
- Incrementá las versiones `?v=` de CSS y JS en `index.html`.

**Verificación final:**
- [ ] Las etiquetas se imprimen sin espacio entre ellas (borde contra borde)
- [ ] Los bordes son punteados (dashed), no sólidos
- [ ] La etiqueta de cable mide 100mm total: zona A (40mm) + pegado (20mm) + zona B (40mm)
- [ ] En la zona B del cable, el QR está alineado al extremo derecho
- [ ] El ícono de contenedor es `inventory_2` en ambos tipos de etiqueta
- [ ] Versiones de cache-busting actualizadas

---

### PROMPT 16: Migración Estructural de Base de Datos y Tabla de Configuración

**Contexto:** Se rediseñó la estructura de las hojas de cálculo para unificar la nomenclatura de campos, agregar campos faltantes y sacar valores *hardcodeados* del código hacia una nueva tabla de configuración. Se asume que el usuario ya modificó los encabezados manualmente en Google Sheets.

**Instrucciones para el Agente:**

> **REGLA CRÍTICA:** Revisá exhaustivamente todo el frontend (`app.js`, `index.html`) y backend (`Code.gs`) para reemplazar las viejas claves de objeto por las nuevas. Incrementá cache-busting.

**TAREA 1: Adaptación de Claves (Frontend)**
- Las propiedades devueltas por Google Sheets cambiarán sus nombres. Reemplazar TODAS las referencias en el código:
  - `Ubicacion_Uso` ➔ `Ubicacion`
  - `Lugar_Guardado_Final` ➔ `Contenedor`
  - `Estado_Logistica` y `Estado_Instalacion` ➔ `Estado`
  - `Tipo_Conector` ➔ `Tipo`
  - `Longitud_m` ➔ `Largo`
- Actualizar los listados de filtros/agrupación en `app.js` (`groups`) para usar estos nuevos nombres en lugar de los viejos.
- Actualizar los mapeos de la función de búsqueda de búsqueda universal para incluir estas claves nuevas.
- Actualizar el renderizado de tablas en el modo de Administración para usar las nuevas claves de los objetos.

**TAREA 2: Modificación de Formularios y Fichas (Frontend)**
- **Equipos:** Renderizar ficha y formulario con los nuevos nombres de variable.
- **Cables:**
  - Agregar inputs para `Ubicacion` y `Categoria` en el formulario (`[name="ubicacion"]` y `[name="categoria"]`).
  - Agregar visualización de `Ubicacion` y `Categoria` en las tarjetas (fichas) que se abren, manteniendo el mismo formato e iconos que en equipos.
- **Conexiones:**
  - Agregar un `<textarea name="notas">` en el modal de edición de conexiones.
  - IMPORTANTE: Las `Notas` de una conexión deben mostrarse SOLO dentro de su modal de edición/vista detallada, NO en la vista general de la lista del árbol.
- Actualizar las funciones generadoras de etiquetas (`generateEquipoLabel`, `generateCableLabel`) para usar los nuevos nombres de variable. En el caso del cable, sumar la información nueva (Categoria y Ubicación).

**TAREA 3: Integrar Tabla de Configuración (Frontend)**
- La nueva tabla proveerá datos en `db.configuracion`, que tendrán un `ID_Configuracion`, `Valor` y `Metadatos` (JSON).
- Buscar el elemento del menú/título (donde dice "Audio y Video ER2") y reemplazarlo dinámicamente con el `Valor` del registro donde `ID_Configuracion === "titulo"`.
- En el menú lateral (sidebar), las entradas de referencia (ej. "Manuales", "Diagramas") deben generarse dinámicamente iterando sobre el objeto parseado de `Metadatos` del registro donde `ID_Configuracion === "referencias"`.

**TAREA 4: Refactorización Backend (`Code.gs`)**
- En `doGet()`, agregar la lectura de la hoja `"4_Configuracion"` y devolverla dentro del objeto JSON como `configuracion: readSheet("4_Configuracion")`.
- En `UPDATE_LOGISTICA`, cambiar la columna objetivo `"Estado_Logistica"` por `"Estado"`.
- En todas las funciones `ADD_` y `EDIT_`, el array de inserción de fila debe coincidir ESTRICTAMENTE con este nuevo orden de columnas en las hojas de Google Sheets:
  - **Equipos:** `[body.id, body.nombre, body.ubicacion, body.categoria, body.propietario, body.contenedor, body.estado, body.notas, body.metadatos || "{}"]`
  - **Cables:** `[body.id, body.tipo, body.largo, body.ubicacion, body.categoria, body.propietario, body.contenedor, body.estado, body.notas, body.metadatos || "{}"]`
  - **Conexiones:** `[body.id_patch, body.id_origen, body.puerto_origen, body.id_destino, body.puerto_destino, body.tipo_senial, body.estado, body.notas, body.metadatos || "{}"]`

**TAREA 5: Cache-busting**
- Incrementá las versiones `?v=` de CSS y JS en `index.html`.

**Verificación final:**
- [ ] Backend: `Code.gs` envía `configuracion` e inserta los datos en el nuevo orden de columnas estricto.
- [ ] Frontend: `Ubicacion_Uso`, `Lugar_Guardado_Final`, `Estado_Logistica`, `Tipo_Conector`, `Longitud_m` fueron eliminados de `app.js` y reemplazados por sus versiones acortadas.
- [ ] Frontend: El título principal de la app se extrae de `db.configuracion`.
- [ ] Frontend: Los enlaces del menú se generan iterando los metadatos de configuración.
- [ ] Frontend: Modal de conexión soporta `Notas` pero el árbol NO las renderiza.
- [ ] Frontend: Fichas y etiquetas QR reflejan los nuevos nombres de propiedades.

---

### PROMPT 17: Corrección de Puertos en Árbol de Conexiones (Fixed Ports)

**Contexto:** En la visualización del árbol de conexiones (fichas), si un nodo padre o hijo tiene múltiples conexiones, `renderTreeNode` renderiza un `<select>` que a menudo no coincide con la conexión real por la cual se trazó el camino. Hay que fijar la visualización del puerto para la conexión que enlaza al nodo con la cadena.

**TAREA 1: Actualizar firma de `renderTreeNode`**
- En `app.js`, buscar `function renderTreeNode(id, isCentral)` y cambiarla a:
  `function renderTreeNode(id, isCentral, fixedInputConn = null, fixedOutputConn = null)`

**TAREA 2: Modificar renderizado de "port-pill" en `renderTreeNode`**
- Para las entradas (inputs), reemplazar la lógica actual de inserción del texto/select por:
  ```javascript
  if (fixedInputConn) {
      pill.innerHTML += fixedInputConn.Puerto_Destino;
  } else if (inputs.length === 1) {
      pill.innerHTML += inputs[0].Puerto_Destino;
  } else {
      pill.appendChild(renderPortSelect(id, inputs, 'back'));
  }
  ```
- Para las salidas (outputs), reemplazar la lógica por:
  ```javascript
  if (fixedOutputConn) {
      pill.innerHTML += fixedOutputConn.Puerto_Origen;
  } else if (outputs.length === 1) {
      pill.innerHTML += outputs[0].Puerto_Origen;
  } else {
      pill.appendChild(renderPortSelect(id, outputs, 'forward'));
  }
  ```

**TAREA 3: Pasar los enlaces fijos desde `renderTree`**
- En la función `renderTree(centralId, shouldScroll = true)`:
- En el bloque que iterar sobre los padres (`parents.reverse().forEach((p, index, arr) => { ... })`), calcular `fixedInput` y `fixedOutput` e inyectarlos:
  ```javascript
  parents.reverse().forEach((p, index, arr) => {
      const fixedOutput = p.conn;
      const fixedInput = (index > 0) ? arr[index - 1].conn : null;
      container.appendChild(renderTreeNode(p.id, false, fixedInput, fixedOutput));
      container.appendChild(renderTreeConnection(p.conn, 'down'));
  });
  ```
- Actualizar el llamado del nodo central para pasar nulos explícitamente:
  `container.appendChild(renderTreeNode(centralId, true, null, null));`
- En el bloque de hijos (`children.forEach((c, index, arr) => { ... })`):
  ```javascript
  children.forEach((c, index, arr) => {
      const fixedInput = c.conn;
      const fixedOutput = (index < arr.length - 1) ? arr[index + 1].conn : null;
      container.appendChild(renderTreeConnection(c.conn, 'down'));
      container.appendChild(renderTreeNode(c.id, false, fixedInput, fixedOutput));
  });
  ```

**TAREA 4: Asegurar estado inicial en `renderPortSelect`**
- En `renderPortSelect`, asegurarse que la opción por defecto concuerde con lo que elige `tracePath`. Reemplazar la asignación de `targetId === currentChoice` por:
  ```javascript
  const actualChoice = currentChoice || (direction === 'forward' ? conns[0].ID_Destino : conns[0].ID_Origen);
  // ...
  return `<option value="${targetId}" ${targetId === actualChoice ? 'selected' : ''}>${port} → ${targetId}</option>`;
  ```

**TAREA 5: Incrementar cache busting**
- En `index.html` subir versión `?v=XX.0`.
