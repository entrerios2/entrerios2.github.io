/**
 * API REST para Base de Datos de Cableado AV
 * Desarrollado por Antigravity (Expert Mode)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

/**
 * 1. Función doGet: Retorna los datos de las 3 solapas en formato JSON.
 */
function doGet(e) {
  try {
    const data = {
      equipos: getSheetDataJSON("1_Equipos"),
      cables: getSheetDataJSON("2_Cables"),
      conexiones: getSheetDataJSON("3_Conexiones")
    };

    return createJsonResponse(data);
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() }, 500);
  }
}

/**
 * 2. Función doPost: Procesa actualizaciones de conexiones o logística.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result = { status: "error", message: "Acción no reconocida" };

    if (action === "UPDATE_PATCH") {
      // Requisito: Actualizar Estado_Instalacion en 3_Conexiones por ID_Patch
      const updated = updateRowValue("3_Conexiones", "ID_Patch", body.id, "Estado_Instalacion", body.value);
      result = updated ? { status: "success", message: "Patch actualizado" } : { status: "error", message: "ID_Patch no encontrado" };
    } 
    else if (action === "UPDATE_LOGISTICA") {
      // Requisito: Actualizar Estado_Logistica en 1_Equipos o 2_Cables
      // Buscamos en ambas solapas usando sus respectivos IDs
      let updated = updateRowValue("1_Equipos", "ID_Equipo", body.id, "Estado_Logistica", body.value);
      if (!updated) {
        updated = updateRowValue("2_Cables", "ID_Cable", body.id, "Estado_Logistica", body.value);
      }
      result = updated ? { status: "success", message: "Logística actualizada" } : { status: "error", message: "ID no encontrado en Equipos ni Cables" };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() }, 400);
  }
}

// --- FUNCIONES AUXILIARES ---

/**
 * Convierte una solapa en un Array de Objetos usando los encabezados como llaves.
 */
function getSheetDataJSON(sheetName) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Primera fila como llaves
  
  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

/**
 * Busca un ID en una columna y actualiza el valor en otra columna de la misma fila.
 */
function updateRowValue(sheetName, idColumnName, idValue, targetColumnName, newValue) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumnName);
  const targetIndex = headers.indexOf(targetColumnName);

  if (idIndex === -1 || targetIndex === -1) return false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex].toString() === idValue.toString()) {
      sheet.getRange(i + 1, targetIndex + 1).setValue(newValue);
      return true;
    }
  }
  return false;
}

/**
 * Helper para construir la respuesta JSON estándar.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
