const API_URL = "https://comparador-facturas.onrender.com";
const GAS_URL = "https://script.google.com/macros/s/AKfycbx6Xe7_4hogFKMZ05w5psnVOazWO-s-c59nEog00JDjL9VuoBMhLUcIWWqXbL01XovT/exec";
let archivoDian = null, archivoSiesa = null;
let currentUser = null;

function ahora() {
  const d = new Date();
  return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}]`;
}
function log(msg, tipo='msg') {
  const t = document.getElementById('terminal');
  if (!t) return;
  const line = document.createElement('span');
  line.className = 't-line';
  line.innerHTML = `<span class="t-time">${ahora()}</span><span class="t-${tipo}">${msg}</span>`;
  t.appendChild(line);
  t.scrollTop = t.scrollHeight;
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

function setupUpload(inputId, zonaId, nombreId, setter, label) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    setter(file);
    document.getElementById(nombreId).textContent = file.name;
    document.getElementById(zonaId).classList.add("cargado");
    log(`Archivo ${label} cargado: ${file.name}`, 'ok');
    validarBotones();
  });
}

setupUpload("input-dian","zona-dian","nombre-dian", f => archivoDian=f, "DIAN");
setupUpload("input-siesa","zona-siesa","nombre-siesa", f => archivoSiesa=f, "SIESA");

function validarBotones() {
  const listo = archivoDian && archivoSiesa;
  document.getElementById("btn-comparar").disabled = !listo;
  if (listo) {
    setBadge("READY", "status-ok");
    log("Ambos archivos listos. Sistema preparado.", 'ok');
  }
}

function setBadge(txt, cls) {
  const b = document.getElementById("badge-estado");
  if (!b) return;
  b.textContent = txt;
  b.className = "status-badge " + cls;
}

document.getElementById("btn-limpiar").addEventListener("click", () => {
  archivoDian = null; archivoSiesa = null;
  ["dian","siesa"].forEach(k => {
    document.getElementById(`input-${k}`).value = "";
    document.getElementById(`nombre-${k}`).textContent = "";
    document.getElementById(`zona-${k}`).classList.remove("cargado");
  });
  document.getElementById("seccion-resultado").style.display = "none";
  document.getElementById("alerta-carga").innerHTML = "";
  document.getElementById("pct-completitud").textContent = "—";
  setBadge("AWAITING INPUT","status-waiting");
  document.getElementById("btn-comparar").disabled = true;
  log("Sistema reiniciado.", 'msg');
});

document.getElementById("btn-comparar").addEventListener("click", async () => {
  const btn = document.getElementById("btn-comparar");
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-loader"></div> PROCESANDO...';
  setBadge("PROCESSING","status-processing");
  document.getElementById("alerta-carga").innerHTML = "";
  log("Iniciando comparación...", 'msg');
  log("Normalizando claves DIAN...", 'msg');
  log("Cruzando con registros Siesa...", 'msg');

  const form = new FormData();
  form.append("dian", archivoDian);
  form.append("siesa", archivoSiesa);

  try {
    const res = await fetch(`${API_URL}/comparar`, { method:"POST", body:form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error desconocido");
    mostrarResultado(data);
    const f = data.resumen_general.total_faltantes;
    log(`Proceso completo. ${f} factura(s) faltante(s) detectada(s).`, f > 0 ? 'warn' : 'ok');
    setBadge("COMPLETE","status-ok");
    agregarLog(archivoDian.name);
    
    // SINCRONIZAR CON GAS
    sincronizarConGAS(data.resumen_general);
  } catch(err) {
    document.getElementById("alerta-carga").innerHTML = `<div class="alerta alerta-error">ERROR // ${err.message}</div>`;
    log(`Error: ${err.message}`, 'err');
    setBadge("ERROR","status-error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg> COMPARAR FACTURAS`;
  }
});

function agregarLog(nombre) {
  const panel = document.getElementById('panel-logs');
  const placeholder = document.getElementById('log-placeholder');
  if (placeholder) placeholder.remove();
  const now = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<div class="log-dot ok"></div><div><div class="log-name">${nombre.replace(/\.[^/.]+$/,"")}</div><div class="log-date">${now}</div></div>`;
  panel.insertBefore(item, panel.firstChild);
}

function mostrarResultado(data) {
  const r = data.resumen_general;
  document.getElementById("seccion-resultado").style.display = "block";
  document.getElementById("m-proveedores").textContent = r.total_proveedores;
  document.getElementById("m-dian").textContent = r.total_dian.toLocaleString("es-CO");
  document.getElementById("m-siesa").textContent = r.total_en_siesa.toLocaleString("es-CO");
  document.getElementById("m-faltantes").textContent = r.total_faltantes.toLocaleString("es-CO");
  const pct = r.porcentaje_completitud;
  document.getElementById("pct-completitud").textContent = pct + "%";
  document.getElementById("pct-barra").textContent = pct + "%";
  const barra = document.getElementById("barra-fill");
  const color = pct >= 95 ? "var(--green)" : pct >= 75 ? "var(--yellow)" : "var(--red)";
  barra.style.width = pct + "%";
  barra.style.background = color;
  barra.style.boxShadow = `0 0 8px ${color}`;
  document.getElementById("narrativa-texto").textContent = data.narrativa || "Sin narrativa generada.";

  const lista = document.getElementById("lista-proveedores");
  lista.innerHTML = "";
  data.proveedores.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "proveedor-card";
    const badgeFaltante = p.total_faltantes > 0
      ? `<span class="badge badge-faltante">⚠ ${p.total_faltantes} FALTANTES</span>`
      : `<span class="badge badge-ok">✔ COMPLETO</span>`;
    card.innerHTML = `
      <div class="proveedor-header" onclick="toggleDetalle(${i})">
        <div>
          <div class="proveedor-nombre">${p.nombre}</div>
          <div class="proveedor-nit">NIT: ${p.nit}</div>
        </div>
        <div class="proveedor-badges">
          <span class="badge badge-dian">DIAN: ${p.total_dian}</span>
          <span class="badge badge-siesa">SIESA: ${p.total_en_siesa}</span>
          ${badgeFaltante}
          <span class="chevron" id="chevron-${i}">▼</span>
        </div>
      </div>
      <div class="proveedor-detalle" id="detalle-${i}">
        ${p.faltantes.length > 0 ? `
          <div class="seccion-label">// FACTURAS FALTANTES EN SIESA</div>
          <div class="facturas-grid">
            ${p.faltantes.map(f=>`
              <span class="factura-tag factura-faltante" title="Fecha: ${f.fecha}">
                ${f.factura}
                <span class="factura-fecha">${f.fecha && f.fecha!=='Sin fecha' ? f.fecha : ''}</span>
              </span>`).join("")}
          </div>` : ""}
        ${p.encontradas.length > 0 ? `
          <div class="seccion-label">// FACTURAS ENCONTRADAS EN SIESA</div>
          <div class="facturas-grid">
            ${p.encontradas.map(f=>`<span class="factura-tag factura-ok">${f}</span>`).join("")}
          </div>` : ""}
      </div>`;
    if (p.total_faltantes > 0) {
      setTimeout(() => {
        card.querySelector(`#detalle-${i}`)?.classList.add("visible");
        card.querySelector(`#chevron-${i}`)?.classList.add("abierto");
      }, 100);
    }
    lista.appendChild(card);
  });
  document.getElementById("seccion-resultado").scrollIntoView({ behavior:"smooth" });
}

window.toggleDetalle = function(i) {
  document.getElementById(`detalle-${i}`).classList.toggle("visible");
  document.getElementById(`chevron-${i}`).classList.toggle("abierto");
};

document.getElementById("btn-descargar").addEventListener("click", async () => {
  const btn = document.getElementById("btn-descargar");
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-loader"></div> GENERANDO...';
  log("Generando reporte Excel...", 'msg');
  const form = new FormData();
  form.append("dian", archivoDian);
  form.append("siesa", archivoSiesa);
  try {
    const res = await fetch(`${API_URL}/descargar-reporte`, { method:"POST", body:form });
    if (!res.ok) throw new Error("Error generando el reporte");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "reporte_comparacion_facturas.xlsx"; a.click();
    URL.revokeObjectURL(url);
    log("Reporte Excel descargado correctamente.", 'ok');
  } catch(err) {
    log(`Error: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> EXPORTAR EXCEL`;
  }
});

/* --- GAS INTEGRATION & VIEW MANAGEMENT --- */

async function callGASRobust(action, data = {}) {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data })
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("No se pudo parsear JSON de GAS:", text);
      return { success: false, error: "Respuesta inválida del servidor" };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

document.getElementById("btn-login-submit").addEventListener("click", async () => {
  const user = document.getElementById("login-user").value;
  const pass = document.getElementById("login-pass").value;
  const errorDiv = document.getElementById("login-error");
  
  if (!user || !pass) {
    errorDiv.textContent = "INGRESE CREDENCIALES";
    return;
  }

  errorDiv.textContent = "";
  const btn = document.getElementById("btn-login-submit");
  btn.disabled = true;
  btn.innerHTML = '<div class="btn-loader"></div> AUTENTICANDO...';
  
  const res = await callGASRobust("login", { user, pass });
  
  if (res.success) {
    currentUser = res.data;
    localStorage.setItem("factura_user", JSON.stringify(currentUser));
    
    document.getElementById("user-name").textContent = currentUser.name.toUpperCase();
    document.getElementById("user-display").style.display = "block";
    
    document.getElementById("login-overlay").style.transition = "opacity 0.5s";
    document.getElementById("login-overlay").style.opacity = "0";
    setTimeout(() => {
      document.getElementById("login-overlay").style.display = "none";
      document.getElementById("btn-login-submit").disabled = false;
      document.getElementById("btn-login-submit").innerHTML = "INGRESAR AL SISTEMA";
    }, 500);
    
    log(`Usuario ${currentUser.name} conectado.`, 'ok');
    switchView('dashboard');
  } else {
    document.getElementById("btn-login-submit").disabled = false;
    document.getElementById("btn-login-submit").innerHTML = "INGRESAR AL SISTEMA";
    errorDiv.textContent = "ACCESO DENEGADO: " + (res.error || "Error de red");
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  if (confirm("¿Cerrar sesión del sistema?")) {
    localStorage.removeItem("factura_user");
    location.reload(); 
  }
});

function checkSession() {
  const saved = localStorage.getItem("factura_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById("user-name").textContent = currentUser.name.toUpperCase();
    document.getElementById("user-display").style.display = "block";
    document.getElementById("login-overlay").style.display = "none";
    log(`Sesión restaurada: ${currentUser.name}`, 'ok');
    switchView('dashboard');
  }
}
checkSession();

/* --- GESTIÓN DE USUARIOS --- */
document.getElementById("btn-create-user").addEventListener("click", async () => {
  const name = document.getElementById("new-user-name").value;
  const email = document.getElementById("new-user-email").value;
  const msgDiv = document.getElementById("new-user-msg");

  if (!name || !email) {
    msgDiv.innerHTML = '<span class="t-err">COMPLETE TODOS LOS CAMPOS</span>';
    return;
  }

  msgDiv.innerHTML = "";
  document.getElementById("btn-create-user").disabled = true;
  document.getElementById("btn-create-user").innerHTML = '<div class="btn-loader"></div> GENERANDO INVITACIÓN...';
  const res = await callGASRobust("createUser", { name, email });

  document.getElementById("btn-create-user").disabled = false;
  document.getElementById("btn-create-user").innerHTML = "ENVIAR INVITACIÓN POR CORREO";

  if (res.success) {
    msgDiv.innerHTML = '<span class="t-ok">INVITACIÓN ENVIADA CORRECTAMENTE A ' + email + '</span>';
    document.getElementById("new-user-name").value = "";
    document.getElementById("new-user-email").value = "";
    log(`Invitación enviada: ${email}`, 'ok');
  } else {
    msgDiv.innerHTML = `<span class="t-err">ERROR: ${res.error}</span>`;
  }
});

async function sincronizarConGAS(resumen) {
  log("Sincronizando con Google Sheets...", 'msg');
  const res = await callGASRobust("saveSummary", resumen);
  if (res.success) {
    log("Sincronización exitosa.", 'ok');
  } else {
    log("Fallo al sincronizar: " + res.error, 'err');
  }
}

function switchView(view) {
  document.getElementById("view-comparisons").style.display = view === 'comparisons' ? 'block' : 'none';
  document.getElementById("view-dashboard").style.display = view === 'dashboard' ? 'block' : 'none';
  document.getElementById("view-logs").style.display = view === 'logs' ? 'block' : 'none';
  document.getElementById("view-users").style.display = view === 'users' ? 'block' : 'none';
  
  document.getElementById("nav-comparisons").classList.toggle("active", view === 'comparisons');
  document.getElementById("nav-dashboard").classList.toggle("active", view === 'dashboard');
  document.getElementById("nav-logs").classList.toggle("active", view === 'logs');
  document.getElementById("nav-users").classList.toggle("active", view === 'users');

  let title = 'SISTEMA';
  if (view === 'comparisons') title = 'PROCESAMIENTO DE ARCHIVOS';
  if (view === 'dashboard') title = 'TABLERO DE CONTROL';
  if (view === 'logs') title = 'REGISTROS DEL SISTEMA';
  if (view === 'users') title = 'GESTIÓN DE USUARIOS';
  
  document.querySelector(".topbar-title").textContent = title;
  
  if (view === 'dashboard') cargarStats();
}

document.getElementById("nav-dashboard").addEventListener("click", () => switchView('dashboard'));
document.getElementById("nav-comparisons").addEventListener("click", () => switchView('comparisons'));
document.getElementById("nav-logs").addEventListener("click", () => switchView('logs'));
document.getElementById("nav-users").addEventListener("click", () => switchView('users'));

let chartHistorico = null, chartAccuracy = null;

async function cargarStats() {
  log("Solicitando datos históricos a GAS...", 'msg');
  const res = await callGASRobust("getStats");
  if (res.success) {
    const data = res.data;
    log(`Datos recibidos: ${data.length} registros encontrados.`, 'ok');
    
    if (data.length === 0) {
      log("No hay registros históricos suficientes para graficar.", 'warn');
      return;
    }

    renderCharts(data);
    
    // Actualizar métricas
    document.getElementById("d-total-meses").textContent = data.length;
    const avgAcc = data.reduce((acc, curr) => acc + curr.accuracy, 0) / (data.length || 1);
    document.getElementById("d-promedio-accuracy").textContent = avgAcc.toFixed(1) + "%";
    document.getElementById("d-total-encontradas").textContent = data.reduce((acc, curr) => acc + curr.siesa, 0).toLocaleString();
    document.getElementById("d-total-faltantes").textContent = data.reduce((acc, curr) => acc + curr.faltantes, 0).toLocaleString();

    // Actualizar tabla histórica
    const tbody = document.getElementById("tabla-historico-body");
    tbody.innerHTML = "";
    [...data].reverse().forEach(row => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      tr.innerHTML = `
        <td style="padding:0.75rem;">${new Date(row.fecha).toLocaleDateString()}</td>
        <td style="padding:0.75rem; color:var(--cyan);">${row.mes} ${row.anio}</td>
        <td style="padding:0.75rem; text-align:right;">${row.dian}</td>
        <td style="padding:0.75rem; text-align:right;">${row.siesa}</td>
        <td style="padding:0.75rem; text-align:right; color:var(--red);">${row.faltantes}</td>
        <td style="padding:0.75rem; text-align:right; font-weight:700;">${row.accuracy.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    log("Error al cargar estadísticas: " + res.error, 'err');
  }
}

function renderCharts(data) {
  const labels = data.map(d => `${d.mes} ${d.anio}`);
  const dianData = data.map(d => d.dian);
  const siesaData = data.map(d => d.siesa);
  const accuracyData = data.map(d => d.accuracy);

  if (chartHistorico) chartHistorico.destroy();
  if (chartAccuracy) chartAccuracy.destroy();

  const ctxH = document.getElementById('chart-historico').getContext('2d');
  chartHistorico = new Chart(ctxH, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { 
          label: 'DIAN (REPORTADO)', 
          data: dianData, 
          backgroundColor: 'rgba(0, 229, 255, 0.4)', 
          borderColor: '#00e5ff', 
          borderWidth: 1,
          borderRadius: 2
        },
        { 
          label: 'SIESA (ENCONTRADO)', 
          data: siesaData, 
          backgroundColor: 'rgba(0, 230, 118, 0.4)', 
          borderColor: '#00e676', 
          borderWidth: 1,
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8892aa', font: { family: 'Share Tech Mono' } } } },
      scales: {
        y: { grid: { color: '#2a3050' }, ticks: { color: '#8892aa' } },
        x: { grid: { display: false }, ticks: { color: '#8892aa' } }
      }
    }
  });

  const ctxA = document.getElementById('chart-accuracy').getContext('2d');
  chartAccuracy = new Chart(ctxA, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '% Accuracy',
        data: accuracyData,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, grid: { color: '#2a3050' }, ticks: { color: '#8892aa' } },
        x: { grid: { display: false }, ticks: { color: '#8892aa' } }
      }
    }
  });
}
