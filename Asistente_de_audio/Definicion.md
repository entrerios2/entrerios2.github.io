# Documento de Definición del Sistema (DDS)
**Proyecto:** Plataforma Web de Asistencia Proactiva para Calibración A/V (Especializada en Voz Hablada e Instalaciones de Recintos)
**Arquitectura:** Progressive Web App (PWA) 100% Client-Side / Edge Computing

---

## 1. Visión General del Sistema

El sistema es una herramienta de ingeniería acústica integral, diseñada para asistir a operadores en el diseño espacial, configuración, calibración y monitoreo de audio para instalaciones audiovisuales en recintos y eventos en vivo. Funciona íntegramente en el navegador como una PWA. 

Su arquitectura se basa en la **ausencia total de servidores (Backend-less)**. Toda la captura de audio, el análisis matemático (DSP), el procesamiento de documentación técnica mediante RAG y el razonamiento semántico (IA) operan localmente en el hardware del usuario. El sistema actúa como un "Copiloto Acústico" proactivo que comprende el lenguaje humano, respeta las limitaciones del equipamiento físico, anticipa problemas acústicos y propone soluciones guiadas sin abandonar el dispositivo.

---

## 2. Arquitectura Tecnológica y Stack

El diseño prioriza la latencia cero, la privacidad de los datos y la resiliencia offline.

| Capa Lógica                  | Tecnología Principal               | Descripción Técnica                                                                                                                                                |
| :--------------------------- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interfaz de Usuario (UI)** | Svelte 5 + Canvas API              | Framework sin Virtual DOM, compilado a JS altamente optimizado. Excelente integración reactiva con Canvas 2D para renderizar el Stage Plot a 20-60 fps sin *Jank*. |
| **Capa de Aplicación**       | PWA (Service Workers)              | Caché de recursos y binarios. Instalación nativa y ejecución 100% offline.                                                                                         |
| **Persistencia y Estado**    | IndexedDB + File API               | Almacenamiento local e importación/exportación de estados en JSON.                                                                                                 |
| **Enrutamiento de Audio**    | Web Audio API + `AudioWorklet`     | Acceso crudo al micrófono. Aísla el procesamiento matemático del hilo UI.                                                                                          |
| **Motor DSP (Análisis)**     | Rust / C $\rightarrow$ WebAssembly | Ejecución de alto rendimiento para FFT, cálculo de fase y supresión de acoples.                                                                                    |
| **Motor Semántico (IA)**     | WebGPU + `Transformers.js`         | Modelos locales cuantizados para procesamiento de lenguaje natural in-browser.                                                                                     |
| **Búsqueda Vectorial (RAG)** | Orama / Voy (WASM)                 | Base de datos vectorial para consultas ultrarrápidas de literatura técnica.                                                                                        |

### 2.1 Arquitectura de Degradación por Niveles (Tiered Capability)
El sistema implementa una evaluación de hardware en tiempo de ejecución para garantizar disponibilidad en cualquier dispositivo, degradando las capacidades semánticas sin interrumpir la seguridad acústica (DSP).

*   **Tier 0 (Modo Determinístico - Fallback):**
    *   *Condición:* Sin soporte de WebGPU (`!navigator.gpu`) o RAM total < 4GB.
    *   *Habilitado:* Análisis DSP completo (WASM), Smart Toasts basados en reglas rígidas (Fast-Rail).
    *   *Deshabilitado:* RAG semántico, inferencia en lenguaje natural, explicaciones detalladas.
*   **Tier 1 (Modo CPU SLM - Intermedio):**
    *   *Condición:* Sin WebGPU, pero con RAM $\ge$ 4GB y soporte WASM SIMD/Threads.
    *   *Habilitado:* RAG por similitud de cosenos, inferencia con modelos ultra-ligeros (<200M parámetros) vía ONNX Runtime Web.
    *   *Deshabilitado:* Inferencia profunda con modelos >500M parámetros; mayor latencia aceptada.
*   **Tier 2 (Modo Acelerado - Full):**
    *   *Condición:* `navigator.gpu` disponible, VRAM $\ge$ 2GB, RAM total $\ge$ 8GB.
    *   *Habilitado:* Todas las funciones. Modelos cuantizados de ~0.5B parámetros (ej. Qwen2.5) renderizados vía `Transformers.js` con WebGPU a máxima velocidad.

```javascript
// Pseudocódigo de detección de capacidades (Boot sequence)
async function detectTier() {
    const memory = navigator.deviceMemory || 2;
    const hasSIMD = await wasmFeatureDetect.simd();
    
    if (navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter && memory >= 8) return "TIER_2";
        } catch (e) { /* Fallback */ }
    }
    
    return (memory >= 4 && hasSIMD) ? "TIER_1" : "TIER_0";
}
```

---

## 3. Especificación de Módulos Principales

### 3.1 Módulo de Planimetría y Setup Espacial (Stage Plot)
Asiste en el diseño físico y la validación acústica previa al evento mediante un lienzo interactivo.
*   **Recinto y PA:** Ingreso de dimensiones, temperatura, ubicación de PA principal y separación L/R.
*   **Mapeo de Escenario:** Ubicación visual de micrófonos y monitores. El sistema evalúa silenciosamente la geometría y alerta si se violan reglas físicas (ej. regla 3:1 o cápsulas de rechazo incorrectas).
*   **Arreglos de Delay:** Cálculo multicanal que entrega tiempos de retardo únicos para cada altavoz distribuido simétricamente desde el centro.
*   **Generador de Sweet Spots:** Indicación visual de los puntos matemáticamente ideales para medir.

### 3.2 Capa de Traducción de Hardware y Topología
Adapta las matemáticas ideales a las capacidades de la consola del recinto.
*   **Inventario:** Declaración del ecualizador disponible (Paramétrico, GEQ 31 bandas, Semiparamétrico).
*   **Topología:** Definición de independencia de buses (EQ Independiente vs. Global).
*   **Filtro Adaptativo:** Traduce el filtro quirúrgico a movimientos exactos en los faders disponibles.

### 3.3 Asistente Guiado de Calibración
Flujo iterativo para ajustar la respuesta de los parlantes (PA/Delays/Monitores).
*   **Ciclo:** Dicta punto $\rightarrow$ Mide ruido rosa $\rightarrow$ Compara vs Objetivo $\rightarrow$ Sugiere EQ $\rightarrow$ Verifica.

#### 3.3.1 Curva Objetivo de Referencia (Spoken Word)
El Asistente utiliza una curva diseñada para maximizar el Índice de Transmisión de la Voz (STI):
*   **Rango Vocal Central (250 Hz - 2 kHz):** Respuesta de magnitud plana ($0\text{ dB}$).
*   **Roll-off de Baja Frecuencia (HPF):** Atenuación de $-3\text{ dB/octava}$ por debajo de 150 Hz para mitigar efectos de sala y ruidos de manipulación.
*   **Roll-off de Alta Frecuencia (LPF):** Atenuación suave de $-1.5\text{ dB/octava}$ a partir de 4 kHz para minimizar fatiga y sibilancia.
*   **Tolerancia:** Planitud de $\pm 3\text{ dB}$ en el rango central; discrepancias menores no activan over-EQ. El usuario puede parametrizar el Tilt del Roll-off superior según la reverberación.

### 3.4 Ecualización Semántica para Voz Hablada
*   **Traducción:** El operador describe el problema (ej. "suena encajonado").
*   **Motor LLM Local:** Entrega instrucciones directas de EQ/Dinámica adaptadas al hardware.

### 3.5 Módulo de Gestión de Conocimiento (Local RAG)
Garantiza asistencia técnica basada en literatura acústica comprobada.
*   **Pre-compilación Offline:** Los textos se fragmentan/vectorizan generando un *Payload* estático.
*   **Inferencia en Vivo:** `Transformers.js` vectoriza la consulta y el motor WASM inyecta los fragmentos en el prompt del LLM.

#### 3.5.1 Especificación del Corpus RAG
*   **Fuentes Primarias:** Extractos de "Sound Systems: Design and Optimization" (McCarthy), estándares IEC 60268-16 STI y fichas técnicas OEM de micrófonos (Shure MX, Sennheiser EW). *Se excluye* material de mezcla o producción musical.
*   **Estrategia y Tamaño:** Embeddings en inglés y español usando `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. Presupuesto máximo del payload: **15 MB**.

### 3.6 Prevención y Monitoreo de Acoples (AFE)
*   **Pitar la Sala:** Sugiere Notch Filters quirúrgicos durante el *soundcheck*.
*   **Modo Centinela:** Función de fondo que detecta crecimiento exponencial durante el evento.

#### 3.6.1 Algoritmo de Detección AFE
Sea $X(k, n)$ la magnitud del bin $k$ en el frame $n$. Se declara un precursor de feedback si se cumplen ambas condiciones por $M$ frames ($\sim 100\text{ ms}$):
1.  **Crecimiento Exponencial:** Tasa que supera un umbral $\theta_{growth}$ ($+3\text{ dB / }100\text{ ms}$).
    $$ \Delta X = X(k, n) - X(k, n-1) > \theta_{growth} $$
2.  **Tonalidad Aislada:** La energía supera el promedio de su vecindad espectral (ventana $W$).
    $$ X(k, n) > \frac{1}{2W+1} \sum_{i=k-W}^{k+W} X(i, n) + \theta_{prominence} $$

### 3.7 Diagnóstico Proactivo (El Copiloto Acústico)
*   **Optimización Visual:** La UI opera a 20 fps (con *peak hold*) evitando el *thermal throttling*, mientras el WASM DSP corre a velocidad nativa.

#### 3.7.1 Arquitectura Dual-Rail para Smart Toasts
*   **Carril Rápido (Fast-Rail):** Ejecutado 100% en JS interceptando datos WASM. Latencia < 200ms. No usa LLM. Reglas deterministas:
    1.  *Feedback Inminente:* Crecimiento > 3dB/100ms. `"⚠️ Acople inminente en {Hz}."`
    2.  *Saturación:* THD > 5% o señal > -0.5 dBFS. `"⚠️ Saturación detectada."`
    3.  *Pérdida de Proximidad:* Caída > 6dB en 100-250 Hz. `"💡 Orador alejado. Compense graves (+3dB en 150 Hz)."`
    4.  *Sibilancia Extrema:* Energía en 5-8 kHz supera a 1 kHz por > 12dB. `"💡 Exceso de sibilancia."`
    5.  *Efecto Caja:* Exceso sostenido (+6dB) en 300-500 Hz. `"💡 Voz encajonada. Corte -4dB en {Hz}."`
*   **Carril Semántico (Semantic-Rail):** Ejecutado por LLM local para diagnósticos complejos bajo demanda ("¿Por qué suena nasal al fondo?"). SLA latencia: < 4 segundos.

### 3.8 Portabilidad y Flujo Asimétrico
Separación de Diseño y Operación mediante payloads `.json`.

#### 3.8.1 Estructura y Versionado del Payload de Configuración
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AvSetupPayload",
  "type": "object",
  "properties": {
    "_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "metadata": { "type": "object", "properties": { "venueName": {"type": "string"} } },
    "stagePlot": { "type": "object", "properties": { "width_m": {"type": "number"}, "mics": {"type": "array"} } },
    "routingTopology": { "enum": ["PER_CHANNEL_EQ", "GLOBAL_STEREO"] },
    "eqInventory": { "enum": ["PEQ_PARAMETRIC", "GEQ_31BAND"] }
  },
  "required": ["_version", "routingTopology"]
}
```
*Política Backward Compatibility:* Soporte delta de 2 versiones *Minor* con *Upcasting* in-memory.

#### 3.8.2 Modo de Emergencia y Exportación Imprimible (Failover)
*   **Disparadores:** Batería < 10% desenchufada, desconexión de ADC, o botón "Panic Export".
*   **Formato:** PDF offline (`jsPDF`) y Código QR Base64.
*   **Contenido Mínimo:** Matriz de Delays (ms), valores absolutos de EQ aplicados y umbrales de ganancia riesgosos.

---

## 4. Flujo de Datos Híbrido

1.  **Ingesta:** Micrófono / Consola $\rightarrow$ `MediaDevices API`.
2.  **DSP:** `AudioWorklet` $\rightarrow$ WASM. Ejecución FFT y detección AFE.
3.  **Contexto:** JS intercepta anomalías, cruza con hardware (`IndexedDB`) y recupera teoría RAG.
4.  **Inferencia:** Se ensambla un *System Prompt* y se envía al modelo LLM.
5.  **Renderizado:** Svelte 5 actualiza la UI a 20 fps con *Smart Toasts*.

---

## 5. Requisitos No Funcionales (RNF)

*   **Autonomía Total (Offline-First):** Operatividad 100% sin internet garantizada por Service Workers y bases locales.
*   **Rendimiento Sostenido:** Soporte garantizado para sesiones de >8 horas sin estrangulamiento térmico.
*   **Privacidad Nativa:** Procesamiento de audio encapsulado; cero telemetría externa.
*   **Usabilidad Oscura:** Diseño minimalista y alto contraste para entornos de FOH.

---

## 6. Referencias y Repositorios Base

*   **Open Sound Meter (OSM) -** [psmokotnin/osm](https://github.com/psmokotnin/osm): Arquitectura base para cálculo de Función de Transferencia en C/Rust.
*   **AutoEq -** [jaakkopasanen/AutoEq](https://github.com/jaakkopasanen/AutoEq): Lógica matemática para cálculo de error, suavizado y derivación de filtros.