Aquí tienes el Documento de Definición del Sistema (DDS) completo y unificado. Este documento integra todas las iteraciones arquitectónicas, estrategias de optimización y módulos funcionales que hemos diseñado, representando una aplicación web de grado profesional, autónoma y altamente especializada.

***

# Documento de Definición del Sistema (DDS)
**Proyecto:** Plataforma Web de Asistencia Proactiva para Calibración A/V (Especializada en Voz Hablada)
**Arquitectura:** Progressive Web App (PWA) 100% Client-Side / Edge Computing

---

## 1. Visión General del Sistema

El sistema es una herramienta de ingeniería acústica integral, diseñada para asistir a operadores y técnicos en el diseño espacial, configuración, calibración y monitoreo de audio para eventos en vivo (enfocado en conferencias y voz hablada). Funciona íntegramente en el navegador como una PWA. 

Su arquitectura se basa en la **ausencia total de servidores (Backend-less)**. Toda la captura de audio multicanal, el análisis matemático pesado (DSP), el almacenamiento de conocimientos (RAG) y el razonamiento semántico (IA) operan de manera local en el hardware del usuario. El sistema actúa como un "Copiloto Acústico" proactivo que comprende el lenguaje humano, conoce las limitaciones del equipamiento físico disponible, anticipa problemas acústicos y propone soluciones guiadas sin abandonar el dispositivo.

## 2. Arquitectura Tecnológica y Stack

El diseño prioriza la latencia cero, la privacidad absoluta de los datos acústicos y la resiliencia en entornos sin conexión a internet (Offline-First).

| Capa Lógica                  | Tecnología Principal                      | Descripción Técnica                                                                                            |
| :--------------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Interfaz de Usuario (UI)** | Framework *antigravity* + Canvas          | Renderizado responsivo y vistas de mapas espaciales en 2D. Tasa de actualización visual optimizada.            |
| **Capa de Aplicación**       | PWA (Service Workers)                     | Caché de todos los recursos, binarios y bases de datos. Permite instalación nativa y ejecución 100% offline.   |
| **Persistencia y Estado**    | IndexedDB + File API                      | Almacenamiento local persistente e importación/exportación de estados completos (JSON payloads).               |
| **Enrutamiento de Audio**    | Web Audio API + `AudioWorklet`            | Acceso crudo (*raw*) al micrófono. Aísla el procesamiento matemático del hilo principal de la interfaz visual. |
| **Motor DSP (Análisis)**     | Rust / C $\rightarrow$ WebAssembly (WASM) | Ejecución de alto rendimiento para FFT, cálculo de fase/coherencia y supresión de acoples (AFE).               |
| **Motor Semántico (IA)**     | WebGPU + `Transformers.js` / WebLLM       | Modelos Cuantizados ejecutados localmente para procesamiento de lenguaje natural y generación asistida.        |
| **Búsqueda Vectorial (RAG)** | Orama / Voy (WASM)                        | Base de datos vectorial *in-browser* para consultas ultrarrápidas de literatura técnica.                       |

---

## 3. Especificación de Módulos Principales

### 3.1. Módulo de Planimetría y Setup Espacial (Stage Plot)
Asiste en el diseño físico y la validación acústica previa al evento mediante un lienzo interactivo.
*   **Recinto y PA:** Ingreso de dimensiones (ancho, largo), temperatura ambiental, ubicación de PA principal y separación L/R.
*   **Mapeo de Escenario:** Ubicación visual de micrófonos y monitores de piso.
    *   *Auditoría Geométrica:* Alertas automáticas si se violan reglas físicas (ej. regla de distancia 3:1 entre micrófonos, o monitores apuntando a la cápsula de rechazo incorrecta).
*   **Arreglos de Delay Distribuidos:** Configuración de múltiples líneas de retardo. El sistema calcula y muestra tiempos de *delay* (ms) únicos para cada altavoz distribuido simétricamente desde el centro, compensados por temperatura.
*   **Perfiles de Hardware (Calibration Data):** Asignación de curvas de respuesta en frecuencia conocidas a micrófonos y altavoces para compensar el cálculo de la Función de Transferencia.
*   **Generador de Sweet Spots:** Indicación visual exacta de los puntos matemáticamente ideales para realizar las mediciones, evitando nodos de cancelación acústica.

### 3.2. Capa de Traducción de Hardware y Topología
Adapta las matemáticas ideales a las capacidades reales de la consola o procesador físico del recinto.
*   **Inventario de Procesamiento:** Declaración del tipo de ecualizador disponible (Paramétrico, Gráfico de 31 bandas, Semiparamétrico analógico).
*   **Topología de Ruteo:** Definición de la independencia de los buses (ej. EQ Independiente por canal vs. EQ Global L/R vinculado). Si las salidas están vinculadas, el algoritmo calcula promedios espaciales de compromiso.
*   **Filtro Adaptativo:** El sistema traduce un filtro quirúrgico ideal a las perillas o faders físicos disponibles, indicando los movimientos exactos para la consola del operador.

### 3.3. Asistente Guiado de Calibración
Flujo iterativo para ajustar la respuesta de los parlantes (PA/Delays/Monitores).
*   **Ciclo Cerrado:** Dicta el punto de medición $\rightarrow$ Analiza ruido rosa (restando la coloración del micrófono) $\rightarrow$ Compara contra curva objetivo $\rightarrow$ Sugiere EQ adaptado al hardware $\rightarrow$ Verifica cambios.

### 3.4. Ecualización Semántica para Voz Hablada (Spoken Word)
Traducción de lenguaje natural subjetivo a parámetros técnicos exactos.
*   **Traducción Lenguaje $\rightarrow$ DSP:** El operador describe el problema auditivo (ej. "suena encajonado", "le falta cuerpo", "habla muy despacio").
*   **Motor LLM Local:** Procesa la intención del usuario y entrega instrucciones directas de ecualización o compresión dinámica adaptadas al inventario de hardware.

### 3.5. Módulo de Gestión de Conocimiento (Local RAG)
Garantiza que la IA brinde asistencia técnica precisa, basada en literatura acústica comprobada y no en alucinaciones.
*   **Pre-compilación Offline:** Libros y manuales técnicos se fragmentan y vectorizan en la máquina de desarrollo, generando un *Payload de Conocimiento* estático.
*   **Inferencia en Vivo:** Ante una consulta, `Transformers.js` vectoriza la pregunta instantáneamente y el motor vectorial recupera fragmentos clave del libro para inyectarlos en el prompt del LLM, fundamentando su respuesta.

### 3.6. Prevención y Monitoreo de Acoples (AFE - Ringing Out)
Sistema defensivo y preventivo contra la retroalimentación.
*   **Pitar la Sala (Pre-evento):** Escucha proactiva durante la subida de ganancia inicial, detectando el anillo de resonancia y sugiriendo Filtros de Muesca (Notch) quirúrgicos antes del acople.
*   **Monitoreo Centinela:** Función activa durante todo el evento alertando de frecuencias persistentes de crecimiento exponencial en segundo plano.

### 3.7. Diagnóstico Proactivo (El Copiloto Acústico)
Auditoría continua y no intrusiva del evento en vivo.
*   **Optimización de Rendimiento (20 fps):** El motor visual y de muestreo estadístico del hilo principal opera a 20 fps (con retención de picos y decaimiento suave) para evitar el sobrecalentamiento del equipo, mientras el núcleo DSP en WASM corre a la velocidad del reloj de audio.
*   **Evaluación Tonal Continua:** Análisis de promedios móviles para detectar deficiencias sostenidas (ej. pérdida de graves por alejamiento del micrófono).
*   **Smart Toasts (Alertas Accionables):** Generación de notificaciones efímeras con un diagnóstico y una acción concreta. (Ej. *"💡 Noto pérdida prolongada de presencia. Sugiero +3dB en 2.5 kHz. `[ Lo hice ]` `[ Ignorar ]`"*).
*   **Lógica de Backoff:** Si el operador pulsa `[ Ignorar ]`, el sistema silencia esa alerta específica por un tiempo prolongado para prevenir fatiga visual. Si pulsa `[ Lo hice ]`, el sistema verifica la mejora.

### 3.8. Módulo de Portabilidad y Flujo Asimétrico
Separación de la responsabilidad de "Diseño" y "Operación" mediante la gestión del estado.
*   **Exportación de Configuración (State Serialization):** Todo el entorno de los Módulos 3.1 y 3.2 (Plano, distancias, temperaturas, inventario EQ, perfiles mic/bafle, topología) se compila en un archivo `.json`.
*   **Flujo Técnico $\rightarrow$ Operador:** El Ingeniero diseña el archivo de configuración con antelación y se lo envía al Operador local. El Operador simplemente carga el JSON en la PWA offline, hidratando todo el estado de la aplicación instantáneamente y comenzando directamente en la fase de medición guiada.

---

## 4. Flujo de Datos Híbrido (Data Pipeline)

El ciclo de información opera en bucle cerrado local, garantizando privacidad y velocidad:

1.  **Ingesta Física:** Micrófono de Medición $\rightarrow$ Interfaz Hardware $\rightarrow$ `MediaDevices API` (Audio en crudo).
2.  **Análisis DSP:** El `AudioWorklet` transfiere el buffer al módulo **WASM**. Se ejecutan las FFT, compensación de perfiles y detección AFE.
3.  **Inyección de Contexto:** El hilo de JavaScript intercepta datos anómalos del WASM (a 20fps), los cruza con el Perfil de Hardware (`IndexedDB`) y recupera teoría técnica del motor vectorial (Local RAG).
4.  **Inferencia Semántica:** Se ensambla un *System Prompt* oculto y se envía al modelo **LLM en WebGPU** local.
5.  **Renderizado UI:** La interfaz recibe el JSON de salida de la IA y actualiza el *Smart Toast* o los controles visuales de la aplicación.

## 5. Requisitos No Funcionales (RNF)

*   **Autonomía Total (Offline-First):** Una vez que los Service Workers guardan en caché los *assets* de la PWA y los *Payloads de Conocimiento*, la aplicación debe operar indefinidamente sin conexión a internet.
*   **Rendimiento Sostenido (Thermal Management):** La división de procesamiento asíncrono y la reducción de renderizado visual a 20 fps deben garantizar que la app pueda ejecutarse en monitoreo "Centinela" durante más de 8 horas sin causar *thermal throttling* en el dispositivo del usuario.
*   **Privacidad Nativa:** Ninguna señal de audio capturada, transcripción, configuración de recinto o interacción de texto debe ser enviada a redes externas o APIs en la nube.
*   **Usabilidad en Baja Iluminación:** La interfaz debe ser minimalista, utilizar temas oscuros de alto contraste y evitar flujos de trabajo de múltiples clics durante el modo de evento en vivo para minimizar la carga cognitiva del operador.