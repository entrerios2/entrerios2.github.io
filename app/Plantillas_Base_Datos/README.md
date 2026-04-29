# Plantillas para Base de Datos (App de Ruteo)

Esta carpeta contiene la estructura relacional recomendada para documentar el evento. Puedes importar estos tres archivos `.csv` directamente en **Google Sheets**, Airtable o AppSheet.

### ¿Cómo usar esta base de datos?

1. **`1_Equipos.csv`**: Aquí registras **cada aparato físico** que va a ser instalado. A cada uno inventale un `ID_Equipo` único corto (ej. `XR-01`, `MIC-05`).
2. **`2_Cables.csv`**: Aquí está tu inventario físico de cables. La idea es que si usas una etiqueta de cinta de papel en las puntas de los cables físicos (ej. escribirle `C-01`), coincida con este ID. Así, si un cable falla, sabés exactamente cuál dar de baja en el sistema.
3. **`3_Conexiones.csv`**: ¡El corazón de la App! Nunca escribas nombres a mano, usa únicamente los `ID`. **Importante:** La arquitectura trata a los cables como Nodos (exactamente igual que a un equipo). Entonces, si un micrófono se conecta a la consola con un cable, requerirás DOS filas: una donde el Micrófono se conecta al Cable, y otra donde el Cable se conecta a la Consola. ¡Esto te permite empalmar todos los cables que quieras de forma ilimitada (Cable 1 -> Cable 2 -> Cable 3) simplemente declarando que el origen de uno es el destino del anterior! Además, gracias a la columna de **Estado_Instalacion**, los técnicos pueden filtrar por la palabra `Pendiente` en su celular y saber qué parches faltan tirar.
