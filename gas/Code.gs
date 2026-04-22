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
      case 'createUser':
        response = createUser(params.data);
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
 * Inicializa las hojas necesarias con la nueva estructura
 */
function initDB() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  if (!ss.getSheetByName("Usuarios")) {
    const sheet = ss.insertSheet("Usuarios");
    // Nueva Estructura: id, nombre, email, password_hash, estado, token, expiration
    sheet.appendRow(["ID", "Nombre", "Email", "Password_Hash", "Estado", "Token", "Expiration"]);
    // Insertar Usuario Predeterminado
    sheet.appendRow([
      "admin_01", 
      "Admin Sistema", 
      "hader189@gmail.com", 
      "PuYRxl+rpz8XbqI8EfaG91sHCYAlEQkPYcxT7HF6UjA=", // Hash de Excol123**
      "active",
      "",
      ""
    ]);
    sheet.getRange(1, 1, 1, 7).setBackground("#1a1f2e").setFontColor("#00e5ff").setFontWeight("bold");
  }

  if (!ss.getSheetByName("Historial")) {
    const sheet = ss.insertSheet("Historial");
    sheet.appendRow(["Fecha", "Mes", "Año", "Total_DIAN", "Total_Siesa", "Total_Faltantes", "Accuracy_Pct"]);
    sheet.getRange(1, 1, 1, 7).setBackground("#1a1f2e").setFontColor("#00e5ff").setFontWeight("bold");
  }

  return "Base de datos actualizada correctamente";
}

/**
 * Maneja el login con soporte para SHA-256
 */
function handleLogin(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Usuarios");
  const values = sheet.getDataRange().getValues();
  
  // Hashear el input para comparar
  const inputHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.pass));

  for (let i = 1; i < values.length; i++) {
    const dbUser = values[i][0]; // ID o Email
    const dbEmail = values[i][2];
    const dbPass = values[i][3];
    const dbStatus = values[i][4];

    if ((dbUser === data.user || dbEmail === data.user) && dbPass === inputHash) {
      if (dbStatus === "pending") throw new Error("CUENTA PENDIENTE DE ACTIVACIÓN");
      
      return {
        id: dbUser,
        name: values[i][1],
        email: dbEmail,
        status: dbStatus
      };
    }
  }
  throw new Error('Credenciales inválidas');
}

/**
 * SISTEMA DE INVITACIÓN POR CORREO
 */
function createUser(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Usuarios");
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][2] === data.email) return { success: false, error: "EL EMAIL YA ESTÁ REGISTRADO" };
  }

  const userId = "user_" + Math.random().toString(36).substr(2, 5);
  const token = Utilities.getUuid();
  const expiration = new Date().getTime() + (24 * 60 * 60 * 1000);

  sheet.appendRow([userId, data.name, data.email, "", "pending", token, expiration]);
  sendInvitationEmail(data.name, data.email, token);
  return { success: true, userId: userId };
}

function sendInvitationEmail(name, email, token) {
  const scriptUrl = ScriptApp.getService().getUrl();
  const invitationLink = `${scriptUrl}?token=${token}`;
  
  const htmlBody = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #2a3050; background-color: #0f1117; color: #c8d0e0;">
      <h2 style="color: #00e5ff;">Bienvenido al Sistema</h2>
      <p>Hola <strong>${name}</strong>, se ha creado una cuenta para ti.</p>
      <p>Haz clic abajo para configurar tu contraseña:</p>
      <a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #00e5ff; color: #0a0e1a; text-decoration: none; border-radius: 4px; font-weight: bold;">CONFIGURAR MI CONTRASEÑA</a>
      <p style="font-size:0.7rem; color:#5a6480; margin-top:20px;">Válido por 24 horas.</p>
    </div>`;

  GmailApp.sendEmail(email, "Activa tu cuenta - Comparador Facturas", "", { htmlBody: htmlBody });
}

function doGet(e) {
  const token = e.parameter.token;
  if (!token) return HtmlService.createHtmlOutput("<h1 style='background:#0f1117; color:white; height:100vh; display:flex; align-items:center; justify-content:center; margin:0;'>ACCESO DENEGADO</h1>");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Usuarios");
  const data = sheet.getDataRange().getValues();
  
  let userFound = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === token && new Date().getTime() < data[i][6]) {
      userFound = { name: data[i][1], token: token };
      break;
    }
  }

  if (!userFound) return HtmlService.createHtmlOutput("<body style='background:#0f1117; color:#ff5252; display:flex; align-items:center; justify-content:center; height:100vh;'><h2>El enlace ha expirado o no es válido.</h2></body>");

  const template = `
    <body style="background:#0f1117; color:#c8d0e0; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
      <style>
        .btn-loader { width: 14px; aspect-ratio: 1; display: grid; animation: l14 4s infinite; }
        .btn-loader::before, .btn-loader::after { content: ""; grid-area: 1/1; border: 2px solid; border-radius: 50%; border-color: #00e5ff #00e5ff #0000 #0000; animation: l14 1s infinite linear; }
        .btn-loader::after { border-color: #0000 #0000 #00e676 #00e676; animation-direction: reverse; }
        @keyframes l14{ 100%{transform: rotate(1turn)} }
      </style>
      <div style="background:#1a1f2e; padding:30px; border:1px solid #2a3050; border-radius:8px; width:320px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="color:#00e5ff; margin-top:0;">Hola ${userFound.name}</h3>
        <p style="font-size:0.85em; color:#8892aa;">Define tu contraseña para activar la cuenta</p>
        
        <div style="position:relative; margin-bottom:10px;">
          <input type="password" id="p1" placeholder="Nueva Contraseña" style="width:100%; box-sizing:border-box; padding:12px; background:#0a0d14; border:1px solid #2a3050; color:white; border-radius:4px;">
          <div onclick="t('p1')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:#5a6480;">👁</div>
        </div>

        <div style="position:relative; margin-bottom:20px;">
          <input type="password" id="p2" placeholder="Confirmar Contraseña" style="width:100%; box-sizing:border-box; padding:12px; background:#0a0d14; border:1px solid #2a3050; color:white; border-radius:4px;">
          <div onclick="t('p2')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:#5a6480;">👁</div>
        </div>

        <button id="btn-save" onclick="save()" style="width:100%; padding:12px; background:#00e5ff; color:#0a0e1a; border:none; border-radius:4px; font-weight:bold; cursor:pointer; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; justify-content:center; gap:8px;">ACTIVAR MI CUENTA</button>
        <p id="msg" style="font-size:0.75em; margin-top:15px; color:#ff5252; font-weight:bold;"></p>
      </div>
      <script>
        function t(id) {
          const x = document.getElementById(id);
          x.type = x.type === 'password' ? 'text' : 'password';
        }
        function save() {
          const p1 = document.getElementById('p1').value;
          const p2 = document.getElementById('p2').value;
          const btn = document.getElementById('btn-save');
          const msg = document.getElementById('msg');
          if(p1 !== p2) { msg.innerText = "LAS CONTRASEÑAS NO COINCIDEN"; return; }
          if(p1.length < 6) { msg.innerText = "MÍNIMO 6 CARACTERES"; return; }
          
          btn.disabled = true;
          btn.innerHTML = '<div class="btn-loader"></div> ACTIVANDO...';
          msg.style.color = "#00e5ff";
          msg.innerText = "";
          
          google.script.run.withSuccessHandler(() => {
            document.body.innerHTML = "<div style='text-align:center'><h2 style='color:#00e676'>¡CUENTA ACTIVADA!<br>🎉</h2><p style='color:#8892aa'>Ya puedes cerrar esta ventana y loguearte en el sistema.</p></div>";
          }).setPassword("${userFound.token}", p1);
        }
      </script>
    </body>`;
  return HtmlService.createHtmlOutput(template).setTitle("Activar Cuenta").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setPassword(token, password) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Usuarios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][5] === token) {
      const passHash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password));
      sheet.getRange(i + 1, 4, 1, 4).setValues([[passHash, "active", "", ""]]);
      return true;
    }
  }
  return false;
}

/**
 * Guarda el resumen de una comparación
 */
function saveSummary(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Historial");
  const now = new Date();
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  sheet.appendRow([now, meses[now.getMonth()], now.getFullYear(), data.total_dian, data.total_en_siesa, data.total_faltantes, data.porcentaje_completitud]);
  return "Resumen guardado";
}

/**
 * Obtiene datos históricos
 */
function getHistoricalData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Historial");
  const values = sheet.getDataRange().getValues();
  const data = values.slice(1).map(row => ({
    fecha: row[0], mes: row[1], anio: row[2], dian: row[3], siesa: row[4], faltantes: row[5], accuracy: row[6]
  }));
  return data.slice(-12);
}
