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
