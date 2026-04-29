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
