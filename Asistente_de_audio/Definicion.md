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
    *   *Fallback Pedagógico:* Para mantener la utilidad educativa sin IA, el sistema incluirá un set de **respuestas pre-compiladas (plantillas estáticas)** que cubren los diagnósticos más comunes del Fast-Rail con explicaciones detalladas pre-redactadas.
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

### 2.2. Arquitectura de Captura y Procesamiento (AudioWorklet + WASM)
El sistema adopta **AudioWorklet** como arquitectura definitiva de captura. La ingesta de audio se ejecuta en el hilo de audio isócrono, garantizando determinismo absoluto y cero pérdida de muestras. Esto es fundamental para la detección de transitorios de acople (AFE) ultra-rápidos.

*   **Captura (AudioWorklet):** El audio crudo se procesa en bloques secuenciales garantizados dentro del contexto isócrono del AudioWorklet, alimentando un binario WASM local para el cálculo de FFT.
*   **Transferencia (SharedArrayBuffer):** Los resultados del análisis se transfieren al hilo principal mediante `SharedArrayBuffer`, eliminando la sobrecarga de copias de datos entre hilos.
*   **Visualización (Main Thread):** El hilo principal se limita exclusivamente al renderizado visual (Canvas, UI Svelte) y a la lógica de negocio (Smart Toasts, RAG, LLM).

> *Nota: Esta arquitectura requiere que el servidor envíe las cabeceras HTTP `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` para habilitar `SharedArrayBuffer`. Ver Matriz de Compatibilidad en Sección 6.*

### 2.3. Motor de Extracción de Características Acústicas (Meyda.js)
Para nutrir el motor heurístico (Fast-Rail) y semántico (Semantic-Rail), el sistema integrará la librería **Meyda.js** como capa de abstracción para la extracción de características acústicas, procesando los *buffers* directamente dentro del contexto asíncrono del `AudioWorklet` o acoplado al hilo principal según la estrategia de captura seleccionada.

*   **Extracción Perceptual Pre-calculada:** En lugar de desarrollar algoritmos complejos sobre transformadas de Fourier crudas desde cero, el sistema aprovechará los descriptores nativos de Meyda, tales como Coeficientes Cepstrales en las Frecuencias de Mel (MFCC), *Spectral Flatness* (Planitud Espectral), *Spectral Roll-off* y *ZCR (Zero-Crossing Rate)*.

### 2.4. Estrategia de Despliegue Dual (Monorepo Web / Nativo)
El proyecto adopta una filosofía de *Single Codebase, Multiple Targets* mediante la integración de **Svelte 5** y **Tauri**. Esto permite desarrollar la aplicación en paralelo para dos plataformas distintas sin duplicar el código de la interfaz gráfica ni la lógica de negocio, resolviendo el dilema entre accesibilidad web universal y rendimiento de hardware crudo.

*   **Salida 1: Progressive Web App (PWA) Universal**
    *   *Objetivo:* Accesibilidad inmediata. Cualquier técnico puede abrir la herramienta en segundos desde un teléfono, tablet o laptop sin instalar nada, manteniendo soporte offline completo tras la primera carga.
    *   *Limitación Conocida:* Restringida por la seguridad del navegador (dependencia de Web Audio API y drivers de audio genéricos del sistema operativo).
*   **Salida 2: Ejecutable Nativo de Escritorio (Windows `.exe` / macOS)**
    *   *Objetivo:* Rendimiento de Grado Profesional. Enfocado en los ingenieros de sistemas.
    *   *Arquitectura:* Tauri empaqueta la UI web utilizando el motor nativo del OS (WebView2), pero inyecta un *backend en Rust* con acceso profundo al sistema operativo.
    *   *Desbloqueos Críticos:*
        1.  **Audio ASIO (Latencia Cero):** El backend en Rust se salta el navegador web y se comunica directamente con los drivers ASIO/CoreAudio, permitiendo ruteo multicanal simultáneo y latencia casi nula para el análisis FFT.
        2.  **Archivos Nativos:** Lectura y escritura invisible de archivos pesados (modelos GLL, *Snapshots*, *Payloads* de la sala) directo en el disco, sin ventanas emergentes de "Descarga".
        3.  **Hardware Libre:** El motor RAG y el LLM acceden a la VRAM y RAM sin las cuotas restrictivas que imponen navegadores como Chrome.

**Patrón de Abstracción de Hardware (HAL)**
Para lograr el desarrollo en paralelo sin dividir el código, el sistema implementará una capa de abstracción. Cuando la lógica central demande escuchar el micrófono, no llamará a una API específica, sino al HAL. El HAL evaluará el entorno: si corre en la web, invocará al `Web Audio API`; si corre dentro de Tauri, solicitará el *buffer* crudo de audio al backend en Rust. El motor de análisis matemático DSP recibe la misma información sin importarle el origen.

---

## 3. Arquitectura de Interfaz y Etapas Operativas
La interfaz de usuario adopta una filosofía de **"Herramienta Profesional Primero, Asistente Después"**. 

A nivel macro, la aplicación se divide en cuatro grandes áreas de trabajo. La navegación entre ellas es totalmente libre (ej. pestañas o menú lateral). A nivel micro (dentro de cada etapa), el operador tiene siempre **libertad manual para modificar** cualquier parámetro disponible. Los **Wizards (Asistentes Guiados) son estrictamente optativos**; actúan como utilidades bajo demanda a las que el usuario puede recurrir si requiere ayuda paso a paso para un proceso complejo.

### 3.1. Fase 1: Planificación (Declaración de Contexto)
Vista dedicada al diseño espacial. El usuario puede colocar y conectar libremente los equipos en el lienzo. Al iniciar un proyecto, el operador declara su **Contexto Administrativo**, el cual determina el "Nivel de Restricción" del Asistente (restringe las soluciones que la IA puede proponer, no al usuario):
*   **A. Diseño Estricto (LBD):** Hardware y posiciones inmutables. El Asistente IA tiene prohibido sugerir cambios físicos.
*   **B. Diseño Genérico (LBD):** Posiciones inmutables, hardware flexible. El Asistente IA puede sugerir reemplazos de equipos pero no reubicaciones.
*   **C. Diseño Propio:** Libertad total. El Asistente IA puede sugerir cualquier optimización física.

### 3.2. Fase 2: Instalación (Setup y Triage Físico)
Área de trabajo enfocada en el hardware y ruteo eléctrico. El usuario puede ver vúmetros y alterar ruteos manualmente.
*   *Asistencia Optativa:* **Checklist Pre-Vuelo**. Un botón de "Diagnosticar Hardware" que lanza un wizard para ayudar a encontrar cables rotos o ausencias de *phantom power*.

### 3.3. Fase 3: Calibración (Alineamiento DSP)
Área técnica que aloja las herramientas matemáticas. El operador avanzado puede utilizar el analizador de espectro (RTA) e inyectar filtros manualmente en total libertad.
*   *Asistencia Optativa:* **Wizard de Delay** (guiado para sincronizar vías) y **AutoEq** (medición automatizada y sugerencia de filtros).

### 3.4. Fase 4: Ejecución (El Copiloto en Vivo)
El "Dashboard" principal para operar durante el show. Es una interfaz limpia enfocada en el monitoreo. 
*   *Asistencia Optativa / Activa:* Monitoreo en segundo plano de Prevención de Acoples (AFE) a través de *Smart Toasts* que el usuario puede aceptar o descartar con un toque, y botones rápidos para aplicar compensaciones dinámicas según el orador.

---

## 4. Especificación de Módulos Principales

### 4.1. Módulo de Planimetría y Setup Espacial (Stage Plot)
Asiste en el diseño físico y la validación acústica previa al evento mediante un lienzo interactivo, actuando como un simulador predictivo offline.

* **Contexto Ambiental (Cálculo Predictivo RT60 y Modos de Sala):** Además del ancho y largo, el operador ingresa la altura del techo, los materiales predominantes (paredes, suelo) y la ocupación esperada. Mediante la ecuación de Sabine ($RT60 = \frac{0.161 \times V}{A}$), el hilo de JavaScript calcula el Tiempo de Reverberación estimado. Este valor parametriza la agresividad de las sugerencias del LLM en la fase de ecualización. Adicionalmente, el sistema utiliza las dimensiones del recinto para predecir las ondas estacionarias graves (Modos de Sala). Si un micrófono es posicionado en el lienzo sobre un "nodo de presión", el Asistente sugiere desplazarlo físicamente para evitar retumbes.
* **Definición de Altavoces (GLL vs Aproximación):** 
    * *Importación GLL:* El sistema prioriza importar archivos estandarizados (tipo GLL o equivalente JSON) con la respuesta y dispersión 3D exacta.
    * *Aproximación Paramétrica (Fallback):* Si no hay archivo oficial, el usuario puede ingresar la mayor cantidad de especificaciones manuales disponibles en el manual del equipo (ej. pulgadas del driver, frecuencia de cruce, dispersión nominal, rango de respuesta). El motor generará un globo de cobertura teórico optimizado en base a estos datos.
* **Zonificación de Alturas:** El usuario puede dibujar polígonos etiquetados como "Escenario" o "Audiencia", asignándoles alturas relativas (Eje Z). Esto permite que el simulador entienda la elevación real del público frente a la tarima.
* **Mapeo 2D de Cobertura SPL:** El lienzo proyecta isobáricas translúcidas frente a los altavoces, mostrando la caída de presión sonora. Simultáneamente, detecta zonas de "Comb Filtering" pintando de rojo las áreas de colisión si dos cajas se solapan destructivamente.
* **Parámetros Espaciales de Montaje:** Cada altavoz cuenta con variables de "Altura Z" y "Tilt" (Inclinación). Si un altavoz apunta por encima de la audiencia, el Asistente advierte que se excitará la reverberación de la pared trasera.
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

> **Faseado de Implementación del Stage Plot:** El MVP incluye: sala rectangular con dimensiones, posiciones XY de equipos, cálculo de Delays por temperatura, RT60 (Sabine), Modos de Sala y Reglas Geométricas. Las funcionalidades de alta complejidad (importación GLL, globos de cobertura, mapeo SPL con isobáricas, detección visual de Comb Filtering) se desarrollarán en una fase avanzada posterior.


### 4.2. Capa de Traducción de Hardware y Telemetría Bidireccional
Adapta las matemáticas ideales a las capacidades físicas y lógicas de la consola del recinto, incorporando control remoto opcional cuando hay consolas digitales compatibles.
*   **Integración de Protocolos:** La versión nativa (Tauri) utiliza **OSC** sobre la red local para comunicarse con consolas (ej. Behringer, Allen & Heath). La versión Web (PWA) utiliza **Web MIDI API** para conexiones USB. *La habilitación de estos protocolos es estrictamente opcional.*
*   **Gemelo Digital y Medidores (Meters):** El software se suscribe al estado de la consola y a su stream de medidores (Meters). El Asistente sabe en tiempo real qué canales están desmuteados, qué nivel de señal tienen y qué ecualización poseen, contextualizando sus diagnósticos (ej. entendiendo por qué faltan agudos si lee que el High-Cut de la consola está activado).
*   **Topología e Inventario Manual:** Si no hay telemetría de red, el sistema funciona en modo manual declarando el inventario (Paramétrico, GEQ 31 bandas) y la independencia de buses (EQ Independiente vs Global), guiando al operador para mover los faders físicos.
*   **Niveles de Autorización (Autopilot vs Copilot):** El sistema nunca altera la consola sin permiso. El usuario puede configurar el nivel de autonomía del sistema:
    *   *Modo Estricto (Por Defecto):* Requiere que el usuario presione el botón "Aplicar a Consola" para ejecutar cualquier sugerencia de ecualización o ruteo.
    *   *Modo Semiautomático (Bounded Auto-Pilot):* El usuario permite cambios automáticos pero bajo límites matemáticos. Por ejemplo: *"Permitir al Asistente inyectar filtros Notch automáticos si detecta un acople inminente, pero con un límite máximo de atenuación de -6dB, y requerir aprobación humana para cualquier aumento (boost) de ganancia."*
*   **Auto-descubrimiento de Consolas (mDNS/Bonjour):** En la versión Tauri, el sistema detecta automáticamente consolas compatibles en la red local vía mDNS (ej. servicios `_osc._udp`), mostrando al usuario las consolas disponibles sin necesidad de ingresar IPs manualmente.
*   **Undo/Rollback OSC (Snapshot de Canal):** Antes de enviar cualquier comando OSC a la consola, el sistema lee y almacena el estado previo del parámetro afectado. Un botón de "Deshacer Último Cambio" permite revertir al estado anterior, protegiendo contra errores en Modo Semiautomático.

### 4.3. Asistente Guiado de Calibración (Arquitectura Híbrida "Centauro")
El flujo de calibración utiliza un modelo de responsabilidad dividida, donde el cálculo matemático y la asistencia semántica operan en tándem para garantizar seguridad acústica y usabilidad.

* **Fase Determinista (Cálculo de Filtros - DSP/WASM):** * El motor compara la medición de la sala contra la Curva Objetivo (STI).
    * Utilizando algoritmos de derivación de filtros (basados en la lógica de *AutoEq*), el módulo WASM calcula matemáticamente el filtro inverso ideal (Ganancia, Frecuencia, Factor Q) necesario para aplanar el error. Este proceso es estricto y garantiza que nunca se sugieran ajustes destructivos.
* **Fase Semántica (Traducción LLM):** * El hilo principal intercepta el filtro matemático ideal y consulta el *Inventario de Hardware* del recinto.
    * El LLM local redacta la instrucción final, traduciendo los números fríos en directivas operativas específicas para la consola del usuario, explicando pedagógicamente el *porqué* del ajuste basándose en el corpus RAG.
* **Desplazamiento de Autoridad (Semantic Override):** Cuando se opera bajo la *Variante B (Micrófono Vocal Genérico)*, la autoridad del diagnóstico se desplaza del motor DSP determinista al motor Semántico (LLM). El sistema interceptará las matemáticas dudosas y solicitará validación humana antes de mostrar el *Trace Math* (Ej. *"La medición sugiere un corte severo en 4 kHz, pero los micrófonos vocales suelen inflar esa zona artificialmente. ¿Sientes la voz sibilante o dolorosa al oído, o suena natural?"*)

#### 4.3.1. Curva Objetivo de Referencia (Spoken Word)
El Asistente utiliza una curva diseñada para maximizar el Índice de Transmisión de la Voz (STI):
*   **Rango Vocal Central (250 Hz - 2 kHz):** Respuesta de magnitud plana ($0 \text{ dB}$).
*   **Roll-off de Baja Frecuencia (HPF):** Atenuación de $-3 \text{ dB/octava}$ por debajo de 150 Hz para mitigar efectos de sala y ruidos de manipulación.
*   **Roll-off de Alta Frecuencia (LPF):** Atenuación suave de $-1.5 \text{ dB/octava}$ a partir de 4 kHz para minimizar fatiga y sibilancia.
*   **Tolerancia:** Planitud de $\pm 3 \text{ dB}$ en el rango central; discrepancias menores no activan over-EQ. El usuario puede parametrizar el Tilt del Roll-off superior según la reverberación.
* **Relajación de Tolerancia Adaptativa:** Cuando el sistema opera en "Modo Agnóstico" debido a la falta de datos técnicos del hardware, la tolerancia de planitud objetivo en el rango vocal central se relaja automáticamente de ±3 dB a **±6 dB**.
  
#### 4.3.2. Protocolo Estándar de Calibración (Metodología de Referencia)
Para garantizar resultados predecibles y de grado profesional, el Asistente ofrece una metodología basada en el análisis acústico de doble canal (Transformada de Fourier - FFT). La arquitectura descarta flujos lineales bloqueantes en favor de **Mediciones Duales a Demanda**, permitiendo al usuario iterar manualmente.

1.  **Sincronización, Verificación y Benchmark (Log Sweep):**
    * *Acción a Demanda:* El usuario dispara un Sweep logarítmico corto ("peeeeew"). Este estímulo es inmune al ruido de la sala.
    * *Validación Interna:* El sistema extrae la Respuesta al Impulso (IR), el Tiempo de Vuelo absoluto para alinear ventanas de medición, y calcula un benchmark de **Índice de Transmisión de la Voz Estimado (STI-Est, desde IR)** guardando una "fotografía" (snapshot) de la respuesta en frecuencia de ese momento.
2.  **Ecualización Interactiva de Altavoces (Magnitud / Ruido Rosa Estacionario):**
    * *Acción a Demanda:* El usuario enciende el generador de Ruido Rosa para tener una lectura constante en el RTA. Puede mover los faders físicos en tiempo real comparando la respuesta de magnitud medida contra la "Curva Objetivo de Referencia" (Sección 4.3.1).
    * *Validación:* Si el usuario solicita el *AutoEq*, el sistema sugiere filtros paramétricos (PEQ) dando prioridad estricta a la atenuación (cortes) sobre la amplificación (boosts) para conservar el margen dinámico (headroom) y no sobrecargar los amplificadores.
3.  **Alineamiento Temporal Fino (Fase Desenrrollada Optativa):**
    * *Acción:* Al integrar altavoces de relevo o subgraves, el sistema permite superponer visualmente la gráfica de *Fase Desenrrollada (Unwrapped Phase)* de ambos sistemas.
    * *Validación:* El usuario cuenta con un control táctil para deslizar los milisegundos hasta que las dos curvas de fase se solapen perfectamente, asegurando suma constructiva real.
4.  **Auditoría Final (STI-Est vs Snapshot):**
    * *Acción:* Tras realizar los cortes de ecualización y nivelación general, el usuario dispara un Sweep final. El sistema audita el resultado comparando el STI Estimado final frente al inicial, junto con los *snapshots* de los gráficos de respuesta en frecuencia (Antes y Después), otorgando una validación objetiva del progreso de calibración.

#### 4.3.2a. Promediado Espacial Multi-punto (Medición Guiada)
Para evitar ecualizar anomalías específicas de un solo punto de escucha, el sistema guía activamente al usuario para realizar mediciones en múltiples posiciones representativas de la audiencia (3-6 puntos), indicando visualmente en el Stage Plot dónde colocar el micrófono en cada paso (ej. *"Medición 2 de 4: Coloque el micrófono en la primera fila izquierda"*). El motor DSP promedia las respuestas capturadas para generar una curva de compromiso espacial más representativa. El módulo de "Generador de Sweet Spots" (Sección 4.1) se integra directamente con este flujo.

#### 4.3.2b. Modo de Ensayo (Rehearsal Mode)
Durante la prueba de sonido previa al evento, el sistema puede entrar en un "Modo Ensayo" como parte del proceso de calibración:
*   Las sugerencias del Copiloto operan con agresividad total (sin restricciones de tolerancia).
*   Se permite experimentar con filtros más radicales que luego se suavizan para el evento real.
*   Se documenta automáticamente un **"Cheat Sheet" del recinto** (frecuencias problemáticas, delays óptimos, ganancia máxima antes de feedback) para referencia rápida durante el evento.


#### 4.3.3. Renderizado Predictivo Interactivo y AutoEq a Voluntad
Para dotar al operador de confianza visual antes de alterar la consola física, la UI implementa un lienzo de renderizado de "Matemática de Trazos Viva" (Trace Math Visualizer).
* **Sugerencia de AutoEq a Voluntad:** El motor de cálculo inverso no es intrusivo. Cuando el usuario congela una medición en pantalla, puede pulsar el botón **"Sugerir EQ"**. En ese momento, el motor WASM calcula el filtro inverso ideal.
* **Capas de Visualización:** El visualizador superpone entonces tres curvas simultáneas:
    1.  *Medición Cruda (Measured):* El espectro con anomalías capturado por el motor WASM.
    2.  *Filtro Inverso (EQ Target):* La sugerencia matemática generada a voluntad.
    3.  *Respuesta Prevista (Predicted):* Suma algebraica en decibelios ($R_{prevista} = R_{medida} + R_{filtro}$).
* **Interacción de Pre-aplicación:** El operador puede pre-visualizar el impacto de su ecualización. Si ajusta faders virtuales o altera la sugerencia manual, la *Respuesta Prevista* se recalcula instantáneamente, asegurando control predictivo total antes de tocar el hardware real.

### 4.4. Ecualización Semántica para Voz Hablada
*   **Traducción Lenguaje $\rightarrow$ DSP:** El operador describe el problema auditivo (ej. "suena encajonado").
*   **Motor LLM Local:** Entrega instrucciones directas de EQ o compresión dinámica adaptadas al hardware físico.

### 4.5. Módulo de Gestión de Conocimiento (Local RAG)
Garantiza asistencia técnica precisa, basada en literatura acústica comprobada.
*   **Pre-compilación Offline:** Los textos se fragmentan y vectorizan generando un *Payload de Conocimiento* estático.
*   **Inferencia en Vivo:** `Transformers.js` vectoriza la consulta y el motor de búsqueda vectorial recupera fragmentos clave para inyectarlos en el prompt del LLM.

#### 4.5.1. Especificación del Corpus RAG
*   **Fuentes Primarias:** Extractos de "Sound Systems: Design and Optimization" (McCarthy), estándares IEC 60268-16 STI y fichas técnicas OEM de micrófonos (Shure MX, Sennheiser EW). *Se excluye categóricamente* todo material relacionado con técnicas de mezcla musical.
*   **Estrategia y Tamaño:** Embeddings en inglés y español usando `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. Presupuesto máximo del payload vectorial: **15 MB**.

### 4.6. Prevención y Monitoreo de Acoples (AFE)
Sistema defensivo contra la retroalimentación.
*   **Pitar la Sala (Pre-evento):** Sugiere Notch Filters quirúrgicos durante el proceso de ganancia inicial.
*   **Modo Centinela:** Función activa durante todo el evento alertando de frecuencias persistentes.

#### 4.6.1. Algoritmo de Detección AFE (Automatic Feedback Elimination)
Sea $X(k, n)$ la magnitud del bin $k$ en el frame $n$. Se declara un precursor de feedback si se cumplen ambas condiciones por $M$ frames (Ventana temporal $\sim 100 \text{ ms}$):
1.  **Crecimiento Exponencial:** Tasa que supera un umbral $\theta_{growth}$ (por defecto: $+3 \text{ dB / } 100 \text{ ms}$).
    $$ \Delta X = X(k, n) - X(k, n-1) > \theta_{growth} $$
2.  **Tonalidad Aislada:** La energía supera el promedio de su vecindad espectral (ancho de ventana $W$).
    $$ X(k, n) > \frac{1}{2W+1} \sum_{i=k-W}^{k+W} X(i, n) + \theta_{prominence} $$

#### 4.6.2. Monitoreo Dinámico y Auditoría Dirigida (Telemetría de Solo)
En eventos de voz hablada (conferencias, paneles, corporativos), no se realiza un monitoreo intrusivo constante. El "Modo Centinela" optimiza el uso del bus de monitoreo de la consola trabajando en dos etapas:
*   **Monitoreo Pasivo (Main Mix):** El sistema escucha pasivamente la salida principal (Main LR) a través de la interfaz de la PC. Mientras la mezcla esté limpia, el Asistente no interfiere ni utiliza el bus de *Solo/PFL*, dejándolo libre para el operador.
*   **Triage Dirigido (Interrogación Activa):** Si el motor DSP detecta una anomalía en la salida principal (ej. un acople latente o zumbido), el Asistente entra en acción:
    1.  Lee por OSC el estado de los canales (Mutes y Faders) para identificar cuáles están "abiertos" en ese instante.
    2.  Toma control temporal del bus de *Solo* (PFL/AFL).
    3.  Recorre a alta velocidad *únicamente* los canales sospechosos o abiertos, aislando su huella acústica.
    4.  Una vez identificado el origen exacto del problema (ej. el Micrófono 3 del panel de invitados), libera el bus de Solo y lanza el *Smart Toast* al operador con la solución sugerida.

### 4.7. Diagnóstico Proactivo (El Copiloto Acústico)
Auditoría continua y no intrusiva del evento en vivo.
*   **Optimización de Rendimiento:** El motor visual del hilo principal opera a 20 fps (con retención de picos y decaimiento suave) para evitar el sobrecalentamiento del equipo.

#### 4.7.1. Arquitectura Dual-Rail y Muros de Seguridad DSP para Smart Toasts
*   **Gráfico de Coherencia (El "Semáforo"):** Se inyecta una regla estricta de validación. Si la métrica de *Coherencia* de la Transformada de Fourier cae por debajo del 50% en una frecuencia particular, el Asistente bloquea temporalmente la sugerencia de *AutoEq* para esa zona, advirtiendo al operador que está intentando ecualizar un rebote acústico de la sala en lugar de sonido directo, lo cual es inútil y destructivo.
*   **Espectrograma de Cascada (Waterfall Plot):** Herramienta diagnóstica primaria para el decaimiento. Se degrada desde un modelo 3D interactivo en Tier 2 a un mapa de calor 2D en Tier 0. Permite observar qué frecuencias tardan mucho en desaparecer en la sala, advirtiendo de acoples latentes antes de que el micrófono empiece a pitar.
*   **Carril Rápido (Fast-Rail):** Ejecutado 100% en JS. Latencia máxima SLA: < 200ms. Evalúa heurísticas predefinidas y descriptores de **Meyda.js**:
    1.  *Feedback Inminente:* Crecimiento > 3dB/100ms en banda estrecha. `Texto: "⚠️ Acople inminente en {Hz}. Aplique Notch {Q}."`
    2.  *Saturación (Clipping):* THD > 5% o señal > -0.5 dBFS sostenida por 500ms. `Texto: "⚠️ Saturación detectada. Reduzca ganancia de entrada."`
    3.  *Pérdida de Proximidad:* Caída > 6dB en 100-250 Hz. `Texto: "💡 Orador alejado. Sugerencia: Compense graves (+3dB en 150 Hz)."`
    4.  *Sibilancia Extrema:* Energía en 5-8 kHz supera a 1 kHz por > 12dB. `Texto: "💡 Exceso de sibilancia. Sugerencia: Corte paramétrico en {Hz}."`
    5.  *Efecto Caja:* Desbalance en los primeros coeficientes MFCC (Exceso en 300-500 Hz). `Texto: "💡 Voz encajonada. Sugerencia: Corte paramétrico de -4dB en {Hz}."`
*   **Carril Semántico (Semantic-Rail):** Ejecutado por el LLM local para diagnósticos complejos bajo demanda ("¿Por qué la voz se escucha nasal solo al fondo?"). SLA de latencia: < 4 segundos. *Nota: Las sugerencias emitidas aquí son filtradas por el Nivel de Restricción Administrativo declarado en la Fase de Planificación.*
*   **Indicador de Confianza:** Todo Smart Toast incluye un indicador visual de confianza (🟢 Alta / 🟡 Media / 🔴 Baja) basado en: coherencia de la medición, calidad de la calibración del micrófono (archivo `.cal` vs Modo Agnóstico), nivel de señal (SNR) y si se utilizó promediado espacial o medición de punto único. El nivel de confianza también **modula el tono lingüístico** del mensaje, reforzando la percepción del operador:
    *   *🟢 Alta — Tono Directivo:* `"⚠️ Acople en 2.5 kHz. Active Notch Q=10, -6dB."`
    *   *🟡 Media — Tono Sugestivo:* `"💡 Posible acople en ~2.5 kHz. Tal vez ayude un Notch suave."`
    *   *🔴 Baja — Tono Informativo:* `"ℹ️ Se observa actividad persistente cerca de 2.5 kHz. Verificar manualmente."`
*   **Puntaje de Salud del Sistema (Health Score):** Un indicador numérico global del **1 al 10**, siempre visible en el dashboard de la Fase 4 (Ejecución), que sintetiza el estado general del sistema. Se calcula cruzando: nivel de señal promedio, THD, coherencia, relación señal-ruido, cantidad de alertas activas del Fast-Rail y estado de canales según la Guía de A/V. Visualmente distinto del semáforo de confianza de las sugerencias individuales.
*   **Monitoreo Opcional de Nivel SPL:** Si el usuario lo habilita, el micrófono de medición funciona como sonómetro básico permanente durante el evento. Si la presión sonora supera los 85 dB SPL sostenidos, el sistema advierte al operador. Las quejas del público sobre volumen se canalizan como cualquier otra consulta al Copiloto LLM, que puede apoyarse en los datos de SPL disponibles para contextualizar su respuesta.

#### 4.7.2. Triage y Asistente de Ruteo Físico (Pre-Vuelo)
Un problema común es que usuarios novatos intentan diagnosticar problemas físicos obvios con ecualización, o se frustran por limitaciones de hardware (falta de placas de sonido dedicadas). Antes de sugerir ajustes de DSP, el sistema ejecuta un diagnóstico híbrido (físico/algorítmico) y un "Onboarding" de hardware para descartar fallas eléctricas o de ruteo:

*   **Asistente de Ruteo Físico (Hardware Workarounds):** El sistema consulta qué equipamiento físico posee el usuario para la medición y lo guía paso a paso con esquemas de conexión:
    *   *Escenario A (Solo PC + Consola):* El Asistente enseña el "Workaround de Consola": Guía al usuario a conectar el micrófono de medición a un canal de la consola física (para usar su *Phantom Power*), enviar esa señal a un *Auxiliar*, y conectar el *Auxiliar* a la entrada de micrófono de la PC. Le instruirá explícitamente usar el volumen del Auxiliar como atenuador para evitar distorsiones en la placa de la PC.
    *   *Alerta de Feedback de Ruteo:* Al usar el escenario A, el sistema advierte proactivamente al usuario de no rutear la entrada de la PC (Ruido Rosa) hacia el mismo bus Auxiliar de captura para evitar un bucle de retroalimentación eléctrico masivo.
*   **Test de Bucle de Hardware (Loopback Calibration):** Para asegurar la integridad de la medición frente a alteraciones del Sistema Operativo (ej. "Mejoras de Audio" de Windows) o de la consola, el sistema solicita un test de bucle físico. El usuario conecta la salida directamente a la entrada. Si el motor detecta que la respuesta de magnitud excede una varianza de $\pm 1 \text{ dB}$, diagnostica "Coloración del Sistema" y detiene la calibración hasta que se desactiven los efectos.
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
*   **Asistente de Estructura de Ganancia (Gain Staging Wizard):** Un wizard optativo que guía al operador paso a paso para establecer la cadena de ganancia correcta en cada canal, evitando el error clásico de saturar en un punto y compensar en otro.
    *   *Con Telemetría OSC:* El sistema lee los medidores de la consola y guía en tiempo real: *"Suba la ganancia del canal 1 lentamente hasta que el medidor llegue a la zona amarilla (-18 dBFS)... Ahora suba el fader hasta la marca U (0 dB)..."*.
    *   *Sin Telemetría:* Instrucciones visuales paso a paso con referencias a las marcas físicas de la consola.
    *   *Validación:* Al final del wizard, el sistema verifica que no haya saturación ni niveles excesivamente bajos.

### 4.8. Portabilidad y Flujo Asimétrico
Separación de la responsabilidad de "Diseño" y "Operación" mediante la gestión del estado.

**4.8.1. Estructura y Versionado del Payload de Configuración**
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

#### 4.8.2. Modo de Emergencia y Exportación Imprimible (Failover)
Ante fallas inminentes de hardware del dispositivo anfitrión, el sistema provee salidas estáticas para garantizar la continuidad.
*   **Disparadores:** Nivel de batería < 10% desconectada, desconexión del ADC, o botón manual "Panic Export".
*   **Formato de Salida:** Generación de PDF offline (`jsPDF`) y Código QR codificando una cadena Base64.
*   **Contenido Mínimo:** Matriz de Delays (distancia y ms), valores absolutos de EQ activos y umbrales de ganancia riesgosos.
*   **Protocolo de Emergencia Acústica (Botón de Pánico):** Un botón rojo prominente en la interfaz de ejecución que activa un protocolo de recuperación ante situaciones de caos acústico (acople masivo, zumbido incontrolable).
    *   *Con OSC:* Mutea todos los canales de la consola instantáneamente vía comando OSC.
    *   *Sin OSC:* Muestra en pantalla completa la instrucción: *"BAJE EL MASTER FADER A CERO"*.
    *   *Recuperación Guiada:* Tras el silencio, el sistema guía al operador a desmutear un canal a la vez para identificar el origen del problema: *"Desmutee solo el Canal 1... ¿Suena limpio? → [Sí] [No] → Siguiente..."*.

#### 4.8.3. Reporte Post-Evento Automático
Al finalizar el evento, el sistema genera automáticamente un resumen técnico del evento.
*   **Contenido:** Duración total del evento, cantidad y frecuencia de acoples detectados, filtros aplicados, incidentes de saturación, alertas de SPL, y comparación STI-Est antes/después de la calibración.
*   **Formato:** Exportable como PDF offline (reutilizando `jsPDF`) o como JSON para alimentar la Memoria de Recinto (4.12).
*   **Beneficio:** La organización que contrató al operador recibe evidencia objetiva de la calidad técnica, y el próximo evento en el mismo lugar arranca con datos históricos.

### 4.9. UX Adaptativa y Soporte Educativo Integrado
El sistema está diseñado para ser operado tanto por personas sin background técnico ni de audio profesional, como por técnicos experimentados (sin convertirse en un obstáculo para estos últimos).

*   **Nivel Técnico del Usuario:** La plataforma determina explícitamente (mediante selección del usuario o evaluación de interacciones) el nivel de competencia (Básico, Intermedio, Avanzado).
*   **Sistema de Sugerencias Adaptadas (Tiered Prompts):** Las respuestas y directivas se moldean dinámicamente según el nivel técnico:
    *   *Nivel Avanzado/Técnico:* El sistema dicta solamente los cambios técnicos o datos crudos (Ej. *"⚠️ CLIP CH1. Input: -0.5 dBFS. THD: 8%. Sugerencia: Notch Q=10, -5dB"*).
    *   *Nivel Básico:* El sistema asume un rol formativo, explicando el paso a paso y la ubicación espacial de los controles (Ej. *"El micrófono está saturando. Ve a la consola, busca la perilla 'Gain' en la parte superior y gírala hacia la izquierda hasta que la luz roja se apague"*).
*   **Glosario Contextual Siempre Disponible:** Términos técnicos de la interfaz gráfica están vinculados al motor RAG local. Al interactuar con ellos, se despliega una definición rápida y pedagógica, permitiendo al usuario aprender sobre la marcha sin abandonar el flujo de trabajo.
*   **Tutoriales Integrados:** Para niveles básicos, la interfaz incluye micro-tutoriales visuales o guías paso a paso durante el proceso de conexión y calibración.
*   **Tutorial Introductorio de Sonido en Vivo y Manejo de Consolas:** Un módulo educativo integrado orientado a personas que nunca operaron una consola de audio, enseñando conceptos universales en lugar de modelos específicos.
    *   *Contenido:* Anatomía de una consola genérica (qué es la ganancia, el fader, un auxiliar, el Phantom Power, el botón Mute, el ecualizador), principios básicos de sonido en vivo (por qué se produce un acople, qué es la retroalimentación, por qué importa la distancia micrófono-orador), y buenas prácticas esenciales (no tapar la cápsula, hablar de frente al micrófono, no apuntar altavoces hacia micrófonos).
    *   *Formato:* Micro-lecciones interactivas accesibles desde el menú de ayuda, con ilustraciones esquemáticas y explicaciones en lenguaje coloquial.
    *   *Activación:* Se sugiere automáticamente al usuario que seleccionó nivel "Básico", pero está disponible para todos.

### 4.10. Gestión de Contextos Específicos de Voz Hablada
*   **Gestor de Múltiples Oradores (Pre-sets Dinámicos):** Al no ser viable tener una base de características exactas de cada orador previo al evento, el sistema implementa "Macro-Perfiles Generales" predefinidos (Ej. *Voz Masculina Grave*, *Voz Femenina Sibilante*, *Voz Débil/Lejana*). Esto permite aplicar compensaciones relativas inmediatas mediante botones rápidos (One-Tap) cuando hay un cambio repentino de orador en el escenario, adaptando los umbrales de seguridad y ecualización al vuelo.
*   **Detector de Técnica de Micrófono (Conciencia Espacial):** El motor DSP diferencia acústicamente el uso del micrófono (ej. Micrófono en jirafa/atril frente a Micrófono de mano) mediante la variabilidad de bajas frecuencias (efecto proximidad), caídas temporales de agudos (fuera de eje) o incrementos nasales (orador tapando la cápsula).
    *   *Resolución de Técnica Deficiente:* Si el sistema advierte una mala técnica y resulta imposible ajustar la posición física (orador inmanejable), proveerá al usuario de un modo alternativo ("Workarounds"). Por ejemplo, si es un orador de atril muy alejado, sugerirá abandonar la "búsqueda de ecualización plana" y pasará a sugerir el uso de una Puerta de Ruido / Expansor, compresión con ratio suave para compensar la caída de señal, y un filtro pasa-altos mucho más agresivo para maximizar la inteligibilidad sacrificando calidad natural.

### 4.11. Guía de Audio y Video
Para optimizar el rol del Asistente durante el evento en vivo, el sistema permite cargar el programa detallado. Al cruzar el itinerario temporal con la telemetría de la consola, el Asistente adquiere "conciencia" de lo que debería estar ocurriendo, actuando como un apuntador inteligente y un monitor de seguridad preventivo.

*   **Ingesta de Datos y Estructura JSON:** El sistema incluirá una interfaz de carga nativa donde el usuario puede construir el itinerario. Los datos se persisten en un formato JSON estructurado que desglosa el evento en bloques y secciones específicas:
    ```json
    {
      "_version": "1.0.0",
      "orden": 1,
      "titulo": "Apertura",
      "orador": "Juan Perez",
      "hora": "10:00",
      "duracion_m": 20,
      "secciones": [
        { "tipo": "hablado", "mics": ["atril"], "duracion_m": 5 },
        { "tipo": "video", "duracion_m": 2 },
        { "tipo": "entrevista", "mics": ["atril-mano", "derecha-mano"], "duracion_m": 13 }
      ]
    }
    ```
*   **Navegación e Interfaz de Operación:** Durante el evento, la interfaz se comporta como un programa de seguimiento. Presenta una línea de tiempo (*Timeline*) con un cronómetro que marca el tiempo desarrollado de la parte actual y visualiza claramente lo que sigue en el programa, avisando cuando se acerca una nueva sección.
    *   *Avance Manual:* Aunque el reloj muestre el progreso, el usuario tiene la capacidad de navegar la guía manualmente (mediante un botón de "Siguiente Parte") para sincronizarse si el evento real sufre variaciones respecto al cronograma teórico.
*   **Reglas de Intervención Proactiva:**
    *   **Alertas de Ruteo/Muteo:** Si la guía marca que la sección actual es "hablado" usando el micrófono "atril", pero el Asistente lee por telemetría que dicho canal recibe audio acústico y está *Muteado* en la consola (o viceversa, si micrófonos de mano están desmuteados innecesariamente), el sistema lanza una advertencia visual para corregir el error.
    *   **Suspensión Inteligente del AFE:** Cuando la guía marca una sección tipo `"video"`, el sistema asume la entrada de energía acústica musical/efectos y suspende temporalmente los algoritmos de Prevención de Acoples (AFE) para evitar falsas alarmas de retroalimentación.
    *   **Aplicación Opcional de Perfiles de Voz:** Si en la carga del programa se definió de antemano el perfil del orador, el sistema mostrará la sugerencia de cargar ese EQ. Adicionalmente, el sistema ofrecerá una configuración donde la **aplicación automática de este perfil de voz queda a criterio y autorización explícita del usuario** (pudiendo permitir que el Asistente lo inyecte por sí solo al avanzar de sección).

### 4.12. Memoria de Recinto (Venue Memory)
El sistema almacena un historial de calibraciones indexado por recinto. Cuando el usuario regresa a un lugar previamente calibrado:
*   **Punto de Partida:** Carga la calibración anterior (delays, filtros EQ, ganancia) como configuración inicial, acelerando significativamente el proceso.
*   **Detección de Degradación:** Compara la respuesta de frecuencia actual contra la histórica. Una caída notable en agudos podría indicar un driver dañado; un cambio en el RT60 podría indicar modificaciones en el recinto.
*   **Tendencias Recurrentes:** Identifica patrones repetitivos (ej. *"En las últimas 3 visitas a este recinto, siempre se detectó acople en 2.5 kHz. Considere un Notch permanente."*).

---

## 5. Flujo de Datos Híbrido (Data Pipeline)
** Inferencia y Traducción Híbrida:** El motor WASM arroja los parámetros matemáticos del filtro (AutoEq). JS ensambla un *System Prompt* oculto que incluye este filtro ideal y el hardware disponible. El **LLM en WebGPU** lo procesa y devuelve el *Smart Toast* con las instrucciones físicas para el operador.

1.  **Ingesta Física:** Señal cruda $\rightarrow$ `MediaDevices API`.
2.  **Análisis de Señal:** Extracción de espectro y descriptores psicoacústicos (Meyda.js / WebFFT / WASM).
3.  **Inyección de Contexto:** Intercepción de anomalías cruzadas con el Perfil de Hardware (`IndexedDB`) y fragmentos RAG.
4.  **Inferencia:** Ensamblado del prompt y envío al **LLM en WebGPU**.
5.  **Renderizado UI:** Svelte 5 actualiza los controles visuales y despliega notificaciones efímeras (Toasts).

---

## 6. Requisitos No Funcionales (RNF)

*   **Autonomía Total (Offline-First):** Una vez guardados en caché los *assets* y *Payloads*, la app opera indefinidamente sin internet.
*   **Rendimiento Sostenido (Thermal Management):** La división de procesamiento asíncrono y la reducción de renderizado visual a 20 fps deben garantizar operación continua (>8 horas) sin *thermal throttling*.
*   **Privacidad Nativa:** Cero telemétrica. Ningún audio o texto abandona el dispositivo.
*   **Interfaz de Alto Contraste:** Interfaz legible con colores contrastantes, targets táctiles razonables y tipografía clara.

### 6.1. Matriz de Compatibilidad de Navegadores

| Funcionalidad | Chrome/Edge | Firefox | Safari (iOS/macOS) |
|:-------------|:-----------:|:-------:|:------------------:|
| AudioWorklet | ✅ | ✅ | ✅ (desde v15.4) |
| SharedArrayBuffer | ✅ (requiere COOP/COEP) | ✅ (requiere COOP/COEP) | ✅ (requiere COOP/COEP) |
| WebGPU (Tier 2) | ✅ | ⚠️ Experimental | ⚠️ Parcial |
| `navigator.deviceMemory` | ✅ | ❌ (fallback a 2GB) | ❌ (fallback a 2GB) |
| Web MIDI API | ✅ | ❌ | ❌ |
| `AudioContext` auto-start | ✅ | ✅ | ❌ (requiere gesto de usuario) |

> *Nota: La versión Tauri (Nativa) utiliza WebView2 (Chromium) en Windows y WebKit en macOS, por lo que la compatibilidad se alinea con Chrome/Edge y Safari respectivamente.*

---

## 7. Referencias y Repositorios Base (Open Source)

*   **Open Sound Meter (OSM) -** [https://github.com/psmokotnin/osm](https://github.com/psmokotnin/osm): Arquitectura de referencia para el cálculo de Función de Transferencia (Magnitud, Fase y Coherencia) y alineamiento de retardo.
*   **AutoEq -** [https://github.com/jaakkopasanen/AutoEq](https://github.com/jaakkopasanen/AutoEq): Base teórica para el cálculo de error entre medición y curva objetivo, y derivación de parámetros paramétricos.

---

## 8. Estrategia de Verificación y Validación
Para los módulos críticos de seguridad acústica, el proyecto implementará una estrategia formal de testing:
*   **Motor AFE (Prevención de Acoples):** Validación contra datasets de audio con acoples conocidos. Se medirá la tasa de detección correcta y la tasa de falsos positivos.
*   **Motor AutoEq (Derivación de Filtros):** Tests unitarios que verifiquen que los filtros sugeridos nunca excedan los límites de seguridad (ganancia máxima, cantidad máxima de boost) bajo ninguna combinación de entrada.
*   **Comandos OSC (Telemetría):** Tests de integración que validen la correcta traducción de parámetros internos a la sintaxis OSC específica de cada consola soportada, incluyendo la verificación del mecanismo de Undo/Snapshot.

---

## 9. Integración Futura con el Sistema de Gestión Audiovisual (AV Management SPA)

Si bien la Plataforma Web de Asistencia Proactiva se concibe inicialmente como una herramienta independiente (*standalone*) enfocada puramente en el DSP y la calibración in-situ, su arquitectura de datos permite una integración natural y profunda con el **Sistema de Gestión de Inventario Audiovisual (AV Management SPA)** existente. 

Esta convergencia transformará ambas plataformas en un ecosistema unificado que cubrirá desde la logística de almacén hasta la optimización acústica del evento.

### 8.1. Sincronización de Inventario y Perfiles de Hardware
En la fase integrada, el asistente dejará de depender de la entrada manual del inventario o del "Modo Agnóstico" forzado.
*   **Lectura de Base de Datos:** El Asistente de Audio consumirá directamente la base de datos de equipos de la SPA (vía IndexedDB compartido o API local), importando automáticamente las especificaciones técnicas, patrones polares y curvas de respuesta de los micrófonos y altavoces asignados al evento.
*   **Validación Logística:** Antes de sugerir un filtro o ruteo, el Asistente verificará si el hardware necesario (ej. un ecualizador gráfico adicional o un procesador de delay) está realmente disponible en el almacén o ya está asignado a ese evento específico.

### 8.2. Convergencia de Topología (AntV X6 $\leftrightarrow$ Stage Plot)
El módulo de *Stage Plot* del asistente y el mapa de *Topología de Red* (AntV X6) de la SPA compartirán el mismo modelo de datos subyacente.
*   **Diseño Bidireccional:** Un operador podrá esbozar el ruteo de señal en la vista de topología de la SPA en el almacén. Al llegar al recinto, el técnico abrirá el Asistente de Audio y verá exactamente ese mismo ruteo pre-cargado, listo para la fase de medición acústica.
*   **Persistencia de Calibración:** Los valores resultantes de la calibración (tiempos de delay precisos, filtros EQ aplicados, niveles de ganancia) se inyectarán como metadatos (`AvSetupPayload`) directamente en los nodos de los equipos dentro de la base de datos de la SPA, documentando el "estado final (*as-built*)" del evento para futuras referencias.

### 8.3. Flujo de Trabajo Unificado (Warehouse to Stage)
La integración permitirá un flujo de trabajo continuo y sin fricciones:
1.  **Pre-Producción (SPA):** El productor reserva los equipos y diseña el diagrama de bloques (patching) en la oficina.
2.  **Despliegue (SPA $\rightarrow$ Asistente):** El técnico de sala abre el evento en su tablet. La PWA lanza el *Asistente de Audio*, el cual auto-configura su contexto ambiental y perfiles de dispositivos en base a la reserva logística.
3.  **Calibración (Asistente):** Se ejecuta el flujo guiado interactuando con el hardware físico y el entorno acústico.
4.  **Cierre (Asistente $\rightarrow$ SPA):** Finalizado el show, el Asistente exporta el reporte de estado acústico e incidentes (ej. alertas de *feedback* recurrentes) de vuelta a la ficha del evento en la SPA, permitiendo auditorías de calidad técnica y documentando ajustes para futuros eventos en el mismo recinto.