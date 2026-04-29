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
    else if (action === "ADD_EQUIPO") {
      const sheet = SS.getSheetByName("1_Equipos");
      if (sheet) {
        sheet.appendRow([
          body.id, body.nombre, body.categoria, body.ubicacion, 
          body.propietario, body.lugar, body.estado, body.notas
        ]);
        result = { status: "success", message: "Equipo agregado" };
      }
    }
    else if (action === "ADD_CABLE") {
      const sheet = SS.getSheetByName("2_Cables");
      if (sheet) {
        sheet.appendRow([
          body.id, body.tipo, body.longitud, body.propietario, 
          body.lugar, body.estado, body.notas
        ]);
        result = { status: "success", message: "Cable agregado" };
      }
    }
    else if (action === "ADD_CONEXION") {
      const sheet = SS.getSheetByName("3_Conexiones");
      if (sheet) {
        sheet.appendRow([
          body.id_patch, body.id_origen, body.puerto_origen, 
          body.id_destino, body.puerto_destino, body.tipo_senial, body.estado
        ]);
        result = { status: "success", message: "Conexión agregada" };
      }
    }
    else if (action === "UPDATE_LOGISTICA") {
      let updated = updateRowValue("1_Equipos", "ID_Equipo", body.id, "Estado_Logistica", body.value);
      if (!updated) {
        updated = updateRowValue("2_Cables", "ID_Cable", body.id, "Estado_Logistica", body.value);
      }
      result = updated ? { status: "success", message: "Logística actualizada" } : { status: "error", message: "ID no encontrado en Equipos ni Cables" };
    }
    else if (action === "EDIT_EQUIPO") {
      const rowData = [
        body.id, body.nombre, body.categoria, body.ubicacion, 
        body.propietario, body.lugar, body.estado, body.notas
      ];
      const success = findAndReplaceRow("1_Equipos", "ID_Equipo", body.id, rowData);
      result = success ? { status: "success", message: "Equipo editado" } : { status: "error", message: "ID no encontrado" };
    }
    else if (action === "EDIT_CABLE") {
      const rowData = [
        body.id, body.tipo, body.longitud, body.propietario, 
        body.lugar, body.estado, body.notas
      ];
      const success = findAndReplaceRow("2_Cables", "ID_Cable", body.id, rowData);
      result = success ? { status: "success", message: "Cable editado" } : { status: "error", message: "ID no encontrado" };
    }
    else if (action === "EDIT_CONEXION") {
      const rowData = [
        body.id_patch, body.id_origen, body.puerto_origen, 
        body.id_destino, body.puerto_destino, body.tipo_senial, body.estado
      ];
      const success = findAndReplaceRow("3_Conexiones", "ID_Patch", body.id_patch, rowData);
      result = success ? { status: "success", message: "Conexión editada" } : { status: "error", message: "ID no encontrado" };
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
 * Versión robusta: tolerante a espacios, mayúsculas/minúsculas y tipos (001 vs 1).
 */
function updateRowValue(sheetName, idColumnName, idValue, targetColumnName, newValue) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumnName);
  const targetIndex = headers.indexOf(targetColumnName);

  if (idIndex === -1 || targetIndex === -1) return false;

  const searchStr = String(idValue).trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rawCellValue = data[i][idIndex];
    const cellStr = String(rawCellValue).trim().toLowerCase();
    
    // Comparación 1: Texto normalizado (ej: "CBL-01" === "cbl-01")
    if (cellStr === searchStr) {
      sheet.getRange(i + 1, targetIndex + 1).setValue(newValue);
      return true;
    }

    // Comparación 2: Equivalencia numérica (ej: 1 === "001")
    if (rawCellValue !== "" && idValue !== "" && !isNaN(rawCellValue) && !isNaN(idValue)) {
      if (Number(rawCellValue) === Number(idValue)) {
        sheet.getRange(i + 1, targetIndex + 1).setValue(newValue);
        return true;
      }
    }
  }
  return false;
}

/**
 * Busca un ID y reemplaza toda la fila con nuevos datos.
 * Utiliza la misma lógica robusta de comparación que updateRowValue.
 */
function findAndReplaceRow(sheetName, idColumnName, idValue, newRowData) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumnName);

  if (idIndex === -1) return false;

  const searchStr = String(idValue).trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rawCellValue = data[i][idIndex];
    const cellStr = String(rawCellValue).trim().toLowerCase();
    
    let match = (cellStr === searchStr);
    if (!match && rawCellValue !== "" && idValue !== "" && !isNaN(rawCellValue) && !isNaN(idValue)) {
      match = (Number(rawCellValue) === Number(idValue));
    }

    if (match) {
      // Reemplazamos la fila completa (i+1 porque es 1-indexed en la hoja)
      sheet.getRange(i + 1, 1, 1, newRowData.length).setValues([newRowData]);
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
