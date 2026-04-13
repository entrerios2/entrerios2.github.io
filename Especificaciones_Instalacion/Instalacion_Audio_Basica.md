# Instalación Básica de Audio (Sistema XR12 Multizona)

Este documento detalla el conexionado físico y el diagrama de flujo de señal para el evento, utilizando el equipamiento listado en el `inventario.md` y respetando la arquitectura del sistema Behringer XR12 descrita en las configuraciones previas.

## 1. Asignación de Entradas (Patch List)

| Canal | Fuente de Audio | Equipo / Micrófono | Cableado Sugerido |
|:---:|:---|:---|:---|
| **Ch 01** | Atril Principal (Condensador) | Sennheiser e965 | XLR M/H |
| **Ch 02** | Atril Secundario (Dinámico) | Sennheiser e835 | XLR M/H |
| **Ch 03** | Micrófono de Mano (Escenario)| Sennheiser e835 | XLR M/H |
| **Ch 04** | Micrófono de Mano (Escenario)| Behringer MX1800s | XLR M/H |
| **Ch 07/08**| Multimedia L / R | Salida de PC / Media Player | Cable 3.5mm a 1/4" TS (R/L) |

> [!TIP]
> **X-AIR Automix:** Los canales 01 y 02 (Atril) están asignados al grupo Automix (X) para suprimir ruidos de fondo cuando no se habla. Los demás micrófonos de escenario tienen el Automix desactivado para evitar cortes involuntarios.

## 2. Asignación de Salidas y Parlantes (Routing Multizona)

Aprovechando el ruteo avanzado de la XR12, utilizamos las 6 vías independientes de la siguiente forma:

| Salida en XR12 | Destino | Equipamiento Asignado (Del Stock) |
|:---|:---|:---|
| **MAIN L (XLR)** | PA Frontal | 2x DB Opera 710dx (Linkeados en serie vía XLR) |
| **MAIN R (XLR)** | Línea de Delay 1 | 1x RCF ART 310-A |
| **AUX 1 (TRS)** | Línea de Delay 2 | 1x RCF ART 310-A |
| **AUX 2 (TRS)** | Monitores de Escenario | 1x Wharfedale Titan 12 |
| **PHONES (L)** | Sala Auxiliar (Soporte Mayor) | 1x Wharfedale Titan 8 |
| **PHONES (R)** | Transmisión TV / Broadcast | Entrada Mic del Blackmagic ATEM Mini Pro |

> [!WARNING]
> La salida de auriculares (`PHONES`) es un puerto TRS Estéreo de 1/4". Se requiere un **cable insert (Y-Splitter)** que separe la punta (L - Bus 5) y el anillo (R - Bus 6) hacia dos conectores mono (TS) para alimentar la sala auxiliar y el switcher de video respectivamente.

## 3. Diagrama de Conexiones Mapeado

El siguiente diagrama muestra el flujo explícito de la señal desde los micrófonos, pasando por los nodos de procesamiento interno de la XR12, hasta finalizar en los altoparlantes:

```mermaid
graph TD
    classDef hardware fill:#2d3436,stroke:#74b9ff,stroke-width:2px,color:#fff;
    classDef mixer fill:#0984e3,stroke:#00cec9,stroke-width:2px,color:#fff;
    classDef outputs fill:#d63031,stroke:#ff7675,stroke-width:2px,color:#fff;

    subgraph Fuentes ["Fuentes y Micrófonos"]
        M1["🎙️ Atril (Sennheiser e965)"]:::hardware
        M2["🎤 Atril (Sennheiser e835)"]:::hardware
        M3["🎤 Escenario (e835/MX1800s)"]:::hardware
        PC["💻 PC / Media"]:::hardware
    end

    subgraph XR12Sys ["Behringer XR12 (Consola Central de Procesamiento)"]
        XR("Matriz & Routing Interno"):::mixer
        M1 -->|"Input 1"| XR
        M2 -->|"Input 2"| XR
        M3 -->|"Input 3 & 4"| XR
        PC -->|"Input 7/8"| XR
        
        XR -.->|"Bus 5 (EQ Fuerte)"| B5["Phones L"]
        XR -.->|"Bus 6 (Limitador Duro)"| B6["Phones R"]
        XR -->|"Bus 2 + FX1 Delay"| R["MAIN R"]
        XR -->|"Bus 3 + FX1 Delay"| A1["AUX 1"]
        XR -->|"Bus 1 MAIN"| L["MAIN L"]
        XR -->|"Bus 4 Monitores"| A2["AUX 2"]
    end

    subgraph Salidas ["Áreas de Amplificación"]
        L -->|"Cable XLR"| PA["🔊 PA Frontal<br>(2x DB Opera 710dx)"]:::outputs
        R -->|"Cable XLR"| D1["🔊 Delay Line 1<br>(1x RCF ART 310-A)"]:::outputs
        A1 -->|"Cable Jack a XLR"| D2["🔊 Delay Line 2<br>(1x RCF ART 310-A)"]:::outputs
        A2 -->|"Cable Jack a XLR"| MON["🔈 Monitores<br>(1x Wharf Titan 12)"]:::outputs
        B5 -->|"Cable Adaptador a XLR"| AUX["🔈 Foyer / Sala Aux.<br>Adultos Mayores<br>(1x Wharf Titan 8)"]:::outputs
        B6 -->|"Cable Adaptador a Jack 3.5"| TV["📡 Blackmagic ATEM<br>(Transmisión TV)"]:::outputs
    end
```

## 4. Notas de Procedimiento Logístico

1. **Cálculo de Delays:** Las medidas físicas (metros de distancia) para los *Delay Line 1* y *2* deben medirse en el salón en relación al PA. Dichos valores serán convertidos a Milisegundos e introducidos en la XR12 (Configuración Dual Pitch - FX1).
2. **Niveles de Operación Seguros:** El Bus 6 lleva un limitador duro de señal. Es necesario configurar la ganancia de entrada de micrófono del Blackmagic ATEM Mini al 50% y empujar los faders desde la XR12 para prevenir cualquier clip o distorsión remota.
3. **Logística de Cableado:** Hay 68 cables disponibles. Se recomienda reservar inmediatamente los dos cables XLR extra-largos de **50m** y los dos de **28m** exclusivamente para conectar la lejanía del PA Principal y el Front Delay Line 1 antes de usar cables empalmados.
