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

| Capa Lógica                  | Tecnología Principal       | Descripción Técnica                                                                                                                                                |
| :--------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interfaz de Usuario (UI)** | Svelte 5 + Canvas API      | Framework sin Virtual DOM, compilado a JS altamente optimizado. Excelente integración reactiva con Canvas 2D para renderizar el Stage Plot a 20-60 fps sin *Jank*. |
| **Capa de Aplicación**       | PWA (Service Workers)      | Caché de recursos y binarios. Instalación nativa y ejecución 100% offline.                                                                                         |
| **Persistencia y Estado**    | IndexedDB + File API       | Almacenamiento local e importación/exportación de estados completos (JSON payloads).                                                                               |
| **Enrutamiento de Audio**    | Web Audio API              | Acceso crudo al micrófono e interfaces de audio.                                                                                                                   |
| **Motor DSP (Análisis)**     | WebFFT / WASM              | Ejecución de alto rendimiento para FFT, cálculo de fase y supresión de acoples.                                                                                    |
| **Motor Semántico (IA)**     | WebGPU + `Transformers.js` | Modelos locales cuantizados para procesamiento de lenguaje natural in-browser.                                                                                     |
| **Búsqueda Vectorial (RAG)** | Orama / Voy (WASM)         | Base de datos vectorial para consultas ultrarrápidas de literatura técnica.                                                                                        |

### 2.1. Arquitectura de Degradación por Niveles (Tiered Capability)
El sistema implementa una evaluación de hardware en tiempo de ejecución para garantizar disponibilidad en cualquier dispositivo, degradando las capacidades semánticas sin interrumpir la seguridad acústica (DSP).

*   **Tier 0 (Modo Determinístico - Fallback):**
    *   *Condición:* Sin soporte de WebGPU (`!navigator.gpu`) o RAM total < 4GB.
    *   *Habilitado:* Análisis DSP completo (WASM/WebFFT), Smart Toasts basados en reglas rígidas (Fast-Rail).
    *   *Deshabilitado:* RAG semántico, inferencia en lenguaje natural, explicaciones detalladas.
*   **Tier 1 (Modo CPU SLM - Intermedio):**
    *   *Condición:* Sin WebGPU, pero con RAM $\ge$ 4GB y soporte WASM SIMD/Threads.
    *   *Habilitado:* RAG por similitud de cosenos, inferencia con modelos ultra-ligeros (<200M parámetros) vía ONNX Runtime Web.
    *   *Deshabilitado:* Inferencia profunda con modelos >500M parámetros; mayor latencia aceptada.
*   **Tier 2 (Modo Acelerado - Full):**
    *   *Condición:* `navigator.gpu` disponible, VRAM estimada $\ge$ 2GB, RAM total $\ge$ 8GB.
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

### 2.2. Estrategia de Procesamiento y Captura (AudioWorklet vs. Main Thread + WebFFT)
El sistema evaluará dos arquitecturas fundamentales para la ingesta y análisis matemático (FFT) de la señal de audio, considerando las limitaciones del entorno web:

*   **Estrategia A (AudioWorklet + WASM Dedicado):** La captura ocurre en el hilo de audio isócrono. El audio se procesa en bloques secuenciales garantizados sin pérdida de muestras, alimentando un binario WASM local.
    *   *Pro:* Determinismo absoluto. Cero muestras perdidas. Fundamental para detectar transitorios de acople (AFE) ultra-rápidos.
    *   *Contra:* Mayor complejidad de desarrollo por la comunicación asíncrona entre hilos.
*   **Estrategia B (Main Thread + AnalyserNode + WebFFT):** Se elimina el `AudioWorklet`. El hilo principal de JavaScript (donde corre la UI) extrae la forma de onda directamente de un `AnalyserNode` (vía `getFloatTimeDomainData`) y se la pasa a la librería *WebFFT* para el cálculo matemático dinámico.
    *   *Pro:* Arquitectura extremadamente simple. *WebFFT* elige automáticamente el mejor motor de aceleración matemática para el dispositivo (WebGL, WASM o JS plano).
    *   *Contra (Riesgo Crítico):* Falta de determinismo. Si el hilo principal se bloquea temporalmente, se pierden *buffers* enteros de audio, creando "puntos ciegos" para el algoritmo AFE.

### 2.3. Motor de Extracción de Características Acústicas (Meyda.js)
Para nutrir el motor heurístico (Fast-Rail) y semántico (Semantic-Rail), el sistema integrará la librería **Meyda.js** como capa de abstracción para la extracción de características acústicas, procesando los *buffers* directamente dentro del contexto asíncrono del `AudioWorklet` o acoplado al hilo principal según la estrategia de captura seleccionada.

*   **Extracción Perceptual Pre-calculada:** En lugar de desarrollar algoritmos complejos sobre transformadas de Fourier crudas desde cero, el sistema aprovechará los descriptores nativos de Meyda, tales como Coeficientes Cepstrales en las Frecuencias de Mel (MFCC), *Spectral Flatness* (Planitud Espectral), *Spectral Roll-off* y *ZCR (Zero-Crossing Rate)*.

---

## 3. Especificación de Módulos Principales

### 3.1. Módulo de Planimetría y Setup Espacial (Stage Plot)
Asiste en el diseño físico y la validación acústica previa al evento mediante un lienzo interactivo, actuando como un simulador predictivo offline.

* **Contexto Ambiental (Cálculo Predictivo RT60):** Además del ancho y largo, el operador ingresa la altura del techo, los materiales predominantes (paredes, suelo) y la ocupación esperada. Mediante la ecuación de Sabine ($RT60 = \frac{0.161 \times V}{A}$), el hilo de JavaScript calcula el Tiempo de Reverberación estimado. Este valor parametriza la agresividad de las sugerencias del LLM en la fase de ecualización.
* **Motor de Reglas Geométricas:** Al posicionar elementos en el lienzo 2D, el sistema cruza continuamente las coordenadas espaciales ($X, Y$) y los patrones polares declarados con las leyes acústicas del corpus RAG, lanzando advertencias proactivas *antes* del encendido del sistema:
    * *Regla 3:1:* Alerta de *Comb Filtering* si la distancia entre dos micrófonos abiertos no triplica la distancia al orador.
    * *Interacción Micrófono/Monitor:* Alerta de acople seguro si se coloca un monitor de piso en el lóbulo de captación trasero específico del micrófono (ej. advirtiendo que un Supercardioide requiere monitores a 120° y no a 180°).
    * *Ley de la Inversa del Cuadrado:* Alerta de pérdida de relación señal/ruido si la distancia a la última fila requiere cajas de relevo (*Delay Towers*).
* **Arreglos de Delay:** Cálculo multicanal que entrega tiempos de retardo únicos para cada altavoz distribuido, compensados por la temperatura ambiente ingresada.
*   **Perfiles de Hardware (Calibration Data):** Asignación de curvas de respuesta a micrófonos y altavoces para compensar la Función de Transferencia.
*   **Generador de Sweet Spots:** Indicación visual de los puntos matemáticamente ideales para medir.
*   **Perfiles Genéricos de Seguridad (Agnostic Mode):** Cuando el operador no dispone del archivo de calibración exacto (`.cal` o `.txt`) del micrófono, el sistema no abortará, sino que solicitará identificar la *familia* física del micrófono para aplicar heurísticas de seguridad:
    * *Variante A: Micrófono de Medición Genérico (Condensador Omnidireccional).* Se asume una respuesta relativamente plana pero con incertidumbre en los extremos. **Acción DSP:** Se mantiene la autoridad del cálculo matemático en el rango crítico (200 Hz - 8 kHz) con tolerancia de $\pm 3 \text{ dB}$, pero se aplica un fundido de ignorancia (*fade-out* de confianza) por debajo de 100 Hz y por encima de 10 kHz, restringiendo sugerencias de ecualización en esas zonas.
    * *Variante B: Micrófono Vocal Genérico (Dinámico Cardioide).* Se asume una fuerte coloración geométrica (efecto proximidad) y un pico de presencia (típico de cápsulas tipo SM58 o e835). **Acción DSP:** El sistema carga una "Curva Inversa de Vocal Dinámico Promedio" para pre-compensar la lectura antes del análisis de la sala. Se prohíben por completo las sugerencias de aumento de ganancia (Boosts) y la tolerancia de planitud se relaja a $\pm 6 \text{ dB}$.
    * *Altavoz Desconocido:* Se asume un margen dinámico limitado. El sistema restringe cualquier sugerencia de aumento de ganancia (Boost) a un máximo de +3 dB, permitiendo únicamente cortes (Notches/Atenuaciones) para resolver problemas.


### 3.2. Capa de Traducción de Hardware y Topología
Adapta las matemáticas ideales a las capacidades de la consola del recinto.
*   **Inventario:** Declaración del ecualizador disponible (Paramétrico, GEQ 31 bandas, Semiparamétrico).
*   **Topología:** Definición de independencia de buses (EQ Independiente vs. Global). Si las salidas están vinculadas, se calculan promedios espaciales de compromiso.
*   **Filtro Adaptativo:** Traduce el filtro quirúrgico a movimientos exactos en los faders disponibles.

### 3.3. Asistente Guiado de Calibración (Arquitectura Híbrida "Centauro")
El flujo de calibración utiliza un modelo de responsabilidad dividida, donde el cálculo matemático y la asistencia semántica operan en tándem para garantizar seguridad acústica y usabilidad.

* **Fase Determinista (Cálculo de Filtros - DSP/WASM):** * El motor compara la medición de la sala contra la Curva Objetivo (STI).
    * Utilizando algoritmos de derivación de filtros (basados en la lógica de *AutoEq*), el módulo WASM calcula matemáticamente el filtro inverso ideal (Ganancia, Frecuencia, Factor Q) necesario para aplanar el error. Este proceso es estricto y garantiza que nunca se sugieran ajustes destructivos.
* **Fase Semántica (Traducción LLM):** * El hilo principal intercepta el filtro matemático ideal y consulta el *Inventario de Hardware* del recinto.
    * El LLM local redacta la instrucción final, traduciendo los números fríos en directivas operativas específicas para la consola del usuario, explicando pedagógicamente el *porqué* del ajuste basándose en el corpus RAG.
* **Desplazamiento de Autoridad (Semantic Override):** Cuando se opera bajo la *Variante B (Micrófono Vocal Genérico)*, la autoridad del diagnóstico se desplaza del motor DSP determinista al motor Semántico (LLM). El sistema interceptará las matemáticas dudosas y solicitará validación humana antes de mostrar el *Trace Math* (Ej. *"La medición sugiere un corte severo en 4 kHz, pero los micrófonos vocales suelen inflar esa zona artificialmente. ¿Sientes la voz sibilante o dolorosa al oído, o suena natural?"*)

#### 3.3.1. Curva Objetivo de Referencia (Spoken Word)
El Asistente utiliza una curva diseñada para maximizar el Índice de Transmisión de la Voz (STI):
*   **Rango Vocal Central (250 Hz - 2 kHz):** Respuesta de magnitud plana ($0 \text{ dB}$).
*   **Roll-off de Baja Frecuencia (HPF):** Atenuación de $-3 \text{ dB/octava}$ por debajo de 150 Hz para mitigar efectos de sala y ruidos de manipulación.
*   **Roll-off de Alta Frecuencia (LPF):** Atenuación suave de $-1.5 \text{ dB/octava}$ a partir de 4 kHz para minimizar fatiga y sibilancia.
*   **Tolerancia:** Planitud de $\pm 3 \text{ dB}$ en el rango central; discrepancias menores no activan over-EQ. El usuario puede parametrizar el Tilt del Roll-off superior según la reverberación.
* **Relajación de Tolerancia Adaptativa:** Cuando el sistema opera en "Modo Agnóstico" debido a la falta de datos técnicos del hardware, la tolerancia de planitud objetivo en el rango vocal central se relaja automáticamente de ±3 dB a **±6 dB**.
  
#### 3.3.2. Protocolo Estándar de Calibración (Metodología de Referencia)
Para garantizar resultados predecibles y de grado profesional, el Asistente Guiado codifica un flujo de trabajo lineal basado en el análisis acústico de doble canal (Transformada de Fourier - FFT), tomando como referencia las metodologías de Bob McCarthy y el análisis de función de transferencia (Magnitud, Fase y Coherencia). 

El sistema obligará al operador a seguir un orden de operaciones no destructivo, bloqueando pasos posteriores si no se cumplen las condiciones previas:

1.  **Sincronización y Verificación (Delay Finder / Impulso):** * *Acción:* El sistema emite ruido rosa y calcula la Respuesta al Impulso (IR) para determinar el tiempo de vuelo exacto entre el altavoz y el micrófono de medición. 
    * *Validación:* Se sincronizan las ventanas de análisis y se verifica la polaridad absoluta de los componentes.
2.  **Ecualización de Altavoces (Magnitud):**
    * *Acción:* Comparación de la respuesta de magnitud medida contra la "Curva Objetivo de Referencia" (Sección 3.3.1).
    * *Validación:* El sistema sugiere filtros paramétricos (PEQ) dando prioridad a la atenuación (cortes) sobre la amplificación (boosts) para conservar el margen dinámico (headroom) y no sobrecargar los amplificadores.
3.  **Alineamiento Temporal y de Fase (Crossover Espacial):**
    * *Acción:* Al integrar altavoces de relevo (*Delay Towers*, *Front Fills*) o subgraves con el PA principal, el sistema guía al usuario a posicionar el micrófono en la zona de solapamiento equitativo.
    * *Validación:* El sistema superpone las trazas de fase de ambos elementos y calcula el retardo (delay en milisegundos) necesario para alinear las pendientes de fase, garantizando una suma acústica constructiva y evitando el filtrado de peine (*Comb Filtering*).
4.  **Nivelación y Sombreado (Level & Shading):**
    * *Acción:* Ajuste final de la ganancia general de cada subsistema para lograr una varianza de Nivel de Presión Sonora (SPL) inferior a $\pm 3 \text{ dB}$ en toda el área de audiencia.


#### 3.3.3. Renderizado Predictivo Interactivo (Trace Math Visualizer)
Para dotar al operador de confianza visual antes de alterar la consola física, la UI implementa un lienzo de renderizado (Canvas API) que muestra la matemática de trazos en tiempo real.
* **Capas de Visualización:** El visualizador superpone tres curvas simultáneas:
    1.  *Medición Cruda (Measured):* El espectro con anomalías capturado por el motor WASM.
    2.  *Filtro Inverso (EQ Target):* La curva del ecualizador calculada por el algoritmo.
    3.  *Respuesta Prevista (Predicted):* Suma algebraica en decibelios ($R_{prevista} = R_{medida} + R_{filtro}$).
* **Interacción de Pre-aplicación:** El operador puede ajustar los faders virtuales o controles paramétricos en la pantalla táctil. La *Respuesta Prevista* se recalcula y dibuja a 20 fps, permitiendo al usuario validar visualmente el resultado de la ecualización antes de tocar el hardware real.

### 3.4. Ecualización Semántica para Voz Hablada
*   **Traducción Lenguaje $\rightarrow$ DSP:** El operador describe el problema auditivo (ej. "suena encajonado").
*   **Motor LLM Local:** Entrega instrucciones directas de EQ o compresión dinámica adaptadas al hardware físico.

### 3.5. Módulo de Gestión de Conocimiento (Local RAG)
Garantiza asistencia técnica precisa, basada en literatura acústica comprobada.
*   **Pre-compilación Offline:** Los textos se fragmentan y vectorizan generando un *Payload de Conocimiento* estático.
*   **Inferencia en Vivo:** `Transformers.js` vectoriza la consulta y el motor de búsqueda vectorial recupera fragmentos clave para inyectarlos en el prompt del LLM.

#### 3.5.1. Especificación del Corpus RAG
*   **Fuentes Primarias:** Extractos de "Sound Systems: Design and Optimization" (McCarthy), estándares IEC 60268-16 STI y fichas técnicas OEM de micrófonos (Shure MX, Sennheiser EW). *Se excluye categóricamente* todo material relacionado con técnicas de mezcla musical.
*   **Estrategia y Tamaño:** Embeddings en inglés y español usando `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. Presupuesto máximo del payload vectorial: **15 MB**.

### 3.6. Prevención y Monitoreo de Acoples (AFE)
Sistema defensivo contra la retroalimentación.
*   **Pitar la Sala (Pre-evento):** Sugiere Notch Filters quirúrgicos durante el proceso de ganancia inicial.
*   **Modo Centinela:** Función activa durante todo el evento alertando de frecuencias persistentes.

#### 3.6.1. Algoritmo de Detección AFE (Automatic Feedback Elimination)
Sea $X(k, n)$ la magnitud del bin $k$ en el frame $n$. Se declara un precursor de feedback si se cumplen ambas condiciones por $M$ frames (Ventana temporal $\sim 100 \text{ ms}$):
1.  **Crecimiento Exponencial:** Tasa que supera un umbral $\theta_{growth}$ (por defecto: $+3 \text{ dB / } 100 \text{ ms}$).
    $$ \Delta X = X(k, n) - X(k, n-1) > \theta_{growth} $$
2.  **Tonalidad Aislada:** La energía supera el promedio de su vecindad espectral (ancho de ventana $W$).
    $$ X(k, n) > \frac{1}{2W+1} \sum_{i=k-W}^{k+W} X(i, n) + \theta_{prominence} $$

### 3.7. Diagnóstico Proactivo (El Copiloto Acústico)
Auditoría continua y no intrusiva del evento en vivo.
*   **Optimización de Rendimiento:** El motor visual del hilo principal opera a 20 fps (con retención de picos y decaimiento suave) para evitar el sobrecalentamiento del equipo.

#### 3.7.1. Arquitectura Dual-Rail para Smart Toasts
*   **Carril Rápido (Fast-Rail):** Ejecutado 100% en JS. Latencia máxima SLA: < 200ms. Evalúa heurísticas predefinidas y descriptores de **Meyda.js**:
    1.  *Feedback Inminente:* Crecimiento > 3dB/100ms en banda estrecha. `Texto: "⚠️ Acople inminente en {Hz}. Aplique Notch {Q}."`
    2.  *Saturación (Clipping):* THD > 5% o señal > -0.5 dBFS sostenida por 500ms. `Texto: "⚠️ Saturación detectada. Reduzca ganancia de entrada."`
    3.  *Pérdida de Proximidad:* Caída > 6dB en 100-250 Hz. `Texto: "💡 Orador alejado. Sugerencia: Compense graves (+3dB en 150 Hz)."`
    4.  *Sibilancia Extrema:* Energía en 5-8 kHz supera a 1 kHz por > 12dB. `Texto: "💡 Exceso de sibilancia. Sugerencia: Corte paramétrico en {Hz}."`
    5.  *Efecto Caja:* Desbalance en los primeros coeficientes MFCC (Exceso en 300-500 Hz). `Texto: "💡 Voz encajonada. Sugerencia: Corte paramétrico de -4dB en {Hz}."`
*   **Carril Semántico (Semantic-Rail):** Ejecutado por el LLM local para diagnósticos complejos bajo demanda ("¿Por qué la voz se escucha nasal solo al fondo?"). SLA de latencia: < 4 segundos.

#### 3.7.2. Triage y Troubleshooting de Hardware Básico (Pre-Vuelo)
Un problema común es que usuarios novatos intentan diagnosticar problemas físicos obvios con ecualización. Antes de sugerir ajustes de DSP, el sistema ejecuta un diagnóstico híbrido (físico/algorítmico) para descartar fallas eléctricas o de ruteo.
*   **Auto-detección mediante análisis:** Si el motor DSP detecta anomalías matemáticas extremas que no corresponden a acústica de sala, bloquea temporalmente el flujo de ecualización y lanza una alerta de hardware. Por ejemplo:
    ```javascript
    // Auto-detectar anomalías mediante análisis
    if (THD > 10% && signalLevel < -10dBFS) {
      toast("⚠️ Distorsión con señal baja = problema de cable o phantom power.\n → Revisar checklist de hardware");
    }
    ```
*   **Checklist Interactivo Pre-vuelo:** Un árbol de diagnóstico ("Hardware Wizard") que guía al usuario paso a paso para resolver el problema físico:
    *   *Sin sonido en micrófono:* "✓ ¿Cable conectado en ambos extremos?", "✓ ¿Phantom power activado? (48V, LED debe estar encendido)", "✓ ¿Ganancia de canal subida? (empezar en -20dB)", "✓ ¿Fader del canal abierto? (0dB o U marca)", "✓ ¿Mute apagado? (botón rojo debe estar apagado)".
    *   *Zumbido/ruido constante:* "✓ ¿Cable balanceado? (XLR mejor que plug)", "✓ ¿Loops de tierra? Desconectar otras fuentes", "✓ ¿Luces dimmer cerca? Alejar cables".
    *   *Distorsión:* "✓ LED de clip encendido? → Baje ganancia 6dB", "✓ ¿Pad activado si es voz muy fuerte?", "✓ ¿Phantom power en un micro dinámico? → Apagar".

### 3.8. Portabilidad y Flujo Asimétrico
Separación de la responsabilidad de "Diseño" y "Operación" mediante la gestión del estado.

**3.8.1. Estructura y Versionado del Payload de Configuración**
La exportación del estado (`.json`) validará contra un JSON Schema formal (draft-07), encapsulando no solo la electrónica, sino el modelo físico de la sala.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AvSetupPayload",
  "type": "object",
  "properties": {
    "_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "metadata": { "type": "object", "properties": { "venueName": {"type": "string"} } },
    "environmentalContext": { 
        "type": "object", 
        "properties": { 
            "volume_m3": {"type": "number"}, 
            "materials": {"type": "array"},
            "estimatedRT60": {"type": "number"} 
        } 
    },
    "stagePlot": { "type": "object", "properties": { "mics": {"type": "array"}, "speakers": {"type": "array"} } },
    "routingTopology": { "enum": ["PER_CHANNEL_EQ", "GLOBAL_STEREO"] },
    "eqInventory": { "enum": ["PEQ_PARAMETRIC", "GEQ_31BAND"] }
  },
  "required": ["_version", "environmentalContext", "routingTopology"]
}
```
*Política Backward Compatibility:* El importador soporta un delta de 2 versiones *Minor* hacia atrás mediante *Upcasting* in-memory (añadiendo valores predeterminados para claves nuevas).

#### 3.8.2. Modo de Emergencia y Exportación Imprimible (Failover)
Ante fallas inminentes de hardware del dispositivo anfitrión, el sistema provee salidas estáticas para garantizar la continuidad.
*   **Disparadores:** Nivel de batería < 10% desconectada, desconexión del ADC, o botón manual "Panic Export".
*   **Formato de Salida:** Generación de PDF offline (`jsPDF`) y Código QR codificando una cadena Base64.
*   **Contenido Mínimo:** Matriz de Delays (distancia y ms), valores absolutos de EQ activos y umbrales de ganancia riesgosos.

### 3.9. UX Adaptativa y Soporte Educativo Integrado
El sistema está diseñado para ser operado tanto por personas sin background técnico ni de audio profesional, como por técnicos experimentados (sin convertirse en un obstáculo para estos últimos).

*   **Nivel Técnico del Usuario:** La plataforma determina explícitamente (mediante selección del usuario o evaluación de interacciones) el nivel de competencia (Básico, Intermedio, Avanzado).
*   **Sistema de Sugerencias Adaptadas (Tiered Prompts):** Las respuestas y directivas se moldean dinámicamente según el nivel técnico:
    *   *Nivel Avanzado/Técnico:* El sistema dicta solamente los cambios técnicos o datos crudos (Ej. *"⚠️ CLIP CH1. Input: -0.5 dBFS. THD: 8%. Sugerencia: Notch Q=10, -5dB"*).
    *   *Nivel Básico:* El sistema asume un rol formativo, explicando el paso a paso y la ubicación espacial de los controles (Ej. *"El micrófono está saturando. Ve a la consola, busca la perilla 'Gain' en la parte superior y gírala hacia la izquierda hasta que la luz roja se apague"*).
*   **Glosario Contextual Siempre Disponible:** Términos técnicos de la interfaz gráfica están vinculados al motor RAG local. Al interactuar con ellos, se despliega una definición rápida y pedagógica, permitiendo al usuario aprender sobre la marcha sin abandonar el flujo de trabajo.
*   **Tutoriales Integrados:** Para niveles básicos, la interfaz incluye micro-tutoriales visuales o guías paso a paso durante el proceso de conexión y calibración.

### 3.10. Gestión de Contextos Específicos de Voz Hablada
*   **Gestor de Múltiples Oradores (Pre-sets Dinámicos):** Al no ser viable tener una base de características exactas de cada orador previo al evento, el sistema implementa "Macro-Perfiles Generales" predefinidos (Ej. *Voz Masculina Grave*, *Voz Femenina Sibilante*, *Voz Débil/Lejana*). Esto permite aplicar compensaciones relativas inmediatas mediante botones rápidos (One-Tap) cuando hay un cambio repentino de orador en el escenario, adaptando los umbrales de seguridad y ecualización al vuelo.
*   **Detector de Técnica de Micrófono (Conciencia Espacial):** El motor DSP diferencia acústicamente el uso del micrófono (ej. Micrófono en jirafa/atril frente a Micrófono de mano) mediante la variabilidad de bajas frecuencias (efecto proximidad), caídas temporales de agudos (fuera de eje) o incrementos nasales (orador tapando la cápsula).
    *   *Resolución de Técnica Deficiente:* Si el sistema advierte una mala técnica y resulta imposible ajustar la posición física (orador inmanejable), proveerá al usuario de un modo alternativo ("Workarounds"). Por ejemplo, si es un orador de atril muy alejado, sugerirá abandonar la "búsqueda de ecualización plana" y pasará a sugerir el uso de una Puerta de Ruido / Expansor, compresión con ratio suave para compensar la caída de señal, y un filtro pasa-altos mucho más agresivo para maximizar la inteligibilidad sacrificando calidad natural.

---

## 4. Flujo de Datos Híbrido (Data Pipeline)
** Inferencia y Traducción Híbrida:** El motor WASM arroja los parámetros matemáticos del filtro (AutoEq). JS ensambla un *System Prompt* oculto que incluye este filtro ideal y el hardware disponible. El **LLM en WebGPU** lo procesa y devuelve el *Smart Toast* con las instrucciones físicas para el operador.

1.  **Ingesta Física:** Señal cruda $\rightarrow$ `MediaDevices API`.
2.  **Análisis de Señal:** Extracción de espectro y descriptores psicoacústicos (Meyda.js / WebFFT / WASM).
3.  **Inyección de Contexto:** Intercepción de anomalías cruzadas con el Perfil de Hardware (`IndexedDB`) y fragmentos RAG.
4.  **Inferencia:** Ensamblado del prompt y envío al **LLM en WebGPU**.
5.  **Renderizado UI:** Svelte 5 actualiza los controles visuales y despliega notificaciones efímeras (Toasts).

---

## 5. Requisitos No Funcionales (RNF)

*   **Autonomía Total (Offline-First):** Una vez guardados en caché los *assets* y *Payloads*, la app opera indefinidamente sin internet.
*   **Rendimiento Sostenido (Thermal Management):** La división de procesamiento asíncrono y la reducción de renderizado visual a 20 fps deben garantizar operación continua (>8 horas) sin *thermal throttling*.
*   **Privacidad Nativa:** Cero telemétrica. Ningún audio o texto abandona el dispositivo.
*   **Usabilidad en Baja Iluminación:** Interfaz minimalista de alto contraste optimizada para Front of House (FOH).

---

## 6. Referencias y Repositorios Base (Open Source)

*   **Open Sound Meter (OSM) -** [https://github.com/psmokotnin/osm](https://github.com/psmokotnin/osm): Arquitectura de referencia para el cálculo de Función de Transferencia (Magnitud, Fase y Coherencia) y alineamiento de retardo.
*   **AutoEq -** [https://github.com/jaakkopasanen/AutoEq](https://github.com/jaakkopasanen/AutoEq): Base teórica para el cálculo de error entre medición y curva objetivo, y derivación de parámetros paramétricos.

---

## 7. Integración Futura con el Sistema de Gestión Audiovisual (AV Management SPA)

Si bien la Plataforma Web de Asistencia Proactiva se concibe inicialmente como una herramienta independiente (*standalone*) enfocada puramente en el DSP y la calibración in-situ, su arquitectura de datos permite una integración natural y profunda con el **Sistema de Gestión de Inventario Audiovisual (AV Management SPA)** existente. 

Esta convergencia transformará ambas plataformas en un ecosistema unificado que cubrirá desde la logística de almacén hasta la optimización acústica del evento.

### 7.1. Sincronización de Inventario y Perfiles de Hardware
En la fase integrada, el asistente dejará de depender de la entrada manual del inventario o del "Modo Agnóstico" forzado.
*   **Lectura de Base de Datos:** El Asistente de Audio consumirá directamente la base de datos de equipos de la SPA (vía IndexedDB compartido o API local), importando automáticamente las especificaciones técnicas, patrones polares y curvas de respuesta de los micrófonos y altavoces asignados al evento.
*   **Validación Logística:** Antes de sugerir un filtro o ruteo, el Asistente verificará si el hardware necesario (ej. un ecualizador gráfico adicional o un procesador de delay) está realmente disponible en el almacén o ya está asignado a ese evento específico.

### 7.2. Convergencia de Topología (AntV X6 $\leftrightarrow$ Stage Plot)
El módulo de *Stage Plot* del asistente y el mapa de *Topología de Red* (AntV X6) de la SPA compartirán el mismo modelo de datos subyacente.
*   **Diseño Bidireccional:** Un operador podrá esbozar el ruteo de señal en la vista de topología de la SPA en el almacén. Al llegar al recinto, el técnico abrirá el Asistente de Audio y verá exactamente ese mismo ruteo pre-cargado, listo para la fase de medición acústica.
*   **Persistencia de Calibración:** Los valores resultantes de la calibración (tiempos de delay precisos, filtros EQ aplicados, niveles de ganancia) se inyectarán como metadatos (`AvSetupPayload`) directamente en los nodos de los equipos dentro de la base de datos de la SPA, documentando el "estado final (*as-built*)" del evento para futuras referencias.

### 7.3. Flujo de Trabajo Unificado (Warehouse to Stage)
La integración permitirá un flujo de trabajo continuo y sin fricciones:
1.  **Pre-Producción (SPA):** El productor reserva los equipos y diseña el diagrama de bloques (patching) en la oficina.
2.  **Despliegue (SPA $\rightarrow$ Asistente):** El técnico de sala abre el evento en su tablet. La PWA lanza el *Asistente de Audio*, el cual auto-configura su contexto ambiental y perfiles de dispositivos en base a la reserva logística.
3.  **Calibración (Asistente):** Se ejecuta el flujo guiado interactuando con el hardware físico y el entorno acústico.
4.  **Cierre (Asistente $\rightarrow$ SPA):** Finalizado el show, el Asistente exporta el reporte de estado acústico e incidentes (ej. alertas de *feedback* recurrentes) de vuelta a la ficha del evento en la SPA, permitiendo auditorías de calidad técnica y documentando ajustes para futuros eventos en el mismo recinto.