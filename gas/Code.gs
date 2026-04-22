/**
 * ID de la hoja de cálculo y configuración
 */
const SPREADSHEET_ID = "1lyykmDHqr35nQ_1ZGVKqX60jdQukUNScsDMwzmWx_jM";

/**
 * Función principal para recibir peticiones POST
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let response;

    switch (action) {
      case 'init':
        response = initDB();
        break;
      case 'login':
        response = handleLogin(params.data);
        break;
      case 'saveSummary':
        response = saveSummary(params.data);
        break;
      case 'getStats':
        response = getHistoricalData();
        break;
      default:
        throw new Error('Acción no reconocida');
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: response }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Inicializa las hojas necesarias si no existen
 */
function initDB() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Hoja de Usuarios
  if (!ss.getSheetByName("Usuarios")) {
    const sheet = ss.insertSheet("Usuarios");
    sheet.appendRow(["Usuario", "Password", "Rol", "Nombre"]);
    sheet.appendRow(["admin", "admin123", "Administrador", "Admin Sistema"]);
    sheet.getRange(1, 1, 1, 4).setBackground("#1a1f2e").setFontColor("#00e5ff").setFontWeight("bold");
  }

  // Hoja de Historial
  if (!ss.getSheetByName("Historial")) {
    const sheet = ss.insertSheet("Historial");
    sheet.appendRow(["Fecha", "Mes", "Año", "Total_DIAN", "Total_Siesa", "Total_Faltantes", "Accuracy_Pct"]);
    sheet.getRange(1, 1, 1, 7).setBackground("#1a1f2e").setFontColor("#00e5ff").setFontWeight("bold");
  }

  return "Base de datos inicializada correctamente";
}

/**
 * Maneja el login de usuarios
 */
function handleLogin(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Usuarios");
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.user && values[i][1] === data.pass) {
      return {
        user: values[i][0],
        role: values[i][2],
        name: values[i][3]
      };
    }
  }
  throw new Error('Credenciales inválidas');
}

/**
 * Guarda el resumen de una comparación
 */
function saveSummary(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Historial");
  
  const now = new Date();
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  sheet.appendRow([
    now,
    meses[now.getMonth()],
    now.getFullYear(),
    data.total_dian,
    data.total_en_siesa,
    data.total_faltantes,
    data.porcentaje_completitud
  ]);
  
  return "Resumen guardado";
}

/**
 * Obtiene datos históricos para el dashboard
 */
function getHistoricalData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Historial");
  const values = sheet.getDataRange().getValues();
  
  // Omitir encabezados y devolver últimos 12 registros
  const data = values.slice(1).map(row => ({
    fecha: row[0],
    mes: row[1],
    anio: row[2],
    dian: row[3],
    siesa: row[4],
    faltantes: row[5],
    accuracy: row[6]
  }));
  
  return data.slice(-12);
}
