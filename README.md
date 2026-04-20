# 📊 Comparador DIAN vs Siesa

Sistema para detectar facturas recibidas que están en la DIAN pero **no están registradas en Siesa**, desglosado por proveedor.

---

## ¿Qué hace?

1. Carga el reporte de la DIAN (facturas emitidas/recibidas)
2. Carga el reporte de Siesa (facturas registradas en el sistema contable)
3. Cruza ambos archivos por NIT del proveedor y número de factura
4. Genera un informe que muestra **qué facturas faltan en Siesa por proveedor**
5. Descarga un reporte Excel con el detalle completo
6. Usa la IA de Groq para generar un resumen narrativo del informe (opcional)

---

## Estructura del proyecto

```
factura-comparador/
├── backend/
│   ├── main.py              # Servidor FastAPI (API REST)
│   ├── comparador.py        # Lógica de comparación y normalización
│   ├── requirements.txt     # Dependencias Python
│   └── .env.example         # Variables de entorno de ejemplo
└── frontend/
    └── index.html           # Interfaz web (sin dependencias externas)
```

---

## Requisitos previos

- **Python 3.10 o superior** → https://www.python.org/downloads/
- **Git** (para clonar el repositorio) → https://git-scm.com/
- Una cuenta gratuita en **Groq** (opcional, para la narrativa IA) → https://console.groq.com/

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/factura-comparador.git
cd factura-comparador
```

### 2. Configurar el backend

```bash
cd backend

# Crear entorno virtual (recomendado)
python -m venv venv

# Activar entorno virtual
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tu editor de texto y llenar:
# GROQ_API_KEY=tu_api_key_aqui
```

**¿Cómo obtener la API Key de Groq?**
1. Ve a https://console.groq.com/
2. Crea una cuenta gratuita
3. Ve a "API Keys" → "Create API Key"
4. Copia la key y pégala en el archivo `.env`

> ⚠️ Si no configuras la API Key, el sistema igual funciona pero genera el informe de texto sin IA.

### 4. Correr el backend

```bash
# Asegúrate de estar en la carpeta backend/ con el entorno virtual activado
uvicorn main:app --reload --port 8000
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 5. Abrir el frontend

Simplemente abre el archivo `frontend/index.html` en tu navegador.

> En Chrome o Edge puedes hacer doble clic en el archivo o arrastrarlo al navegador.

---

## Uso del sistema

1. Abre `frontend/index.html` en el navegador
2. Sube el archivo Excel de la DIAN (columnas: Folio, Prefijo, NIT Emisor, Nombre Emisor)
3. Sube el archivo Excel de Siesa (columnas: Proveedor, Docto. proveedor, Razón social proveedor)
4. Haz clic en **"Comparar facturas"**
5. Revisa el informe en pantalla
6. Haz clic en **"Descargar reporte Excel"** para guardar el resultado

---

## Despliegue en la nube (opcional)

Para que varias personas puedan usarlo sin instalar nada localmente.

### Opción A: Railway (recomendado, gratuito)

1. Crea cuenta en https://railway.app/
2. Conecta tu repositorio de GitHub
3. Selecciona la carpeta `backend/` como raíz del proyecto
4. Railway detecta automáticamente que es Python
5. En las variables de entorno agrega `GROQ_API_KEY`
6. Railway te da una URL pública como `https://tu-app.railway.app`
7. En el `frontend/index.html`, cambia esta línea:
   ```js
   const API_URL = window.API_URL || "http://localhost:8000";
   ```
   por:
   ```js
   const API_URL = "https://tu-app.railway.app";
   ```
8. El frontend lo puedes subir a GitHub Pages o simplemente compartir el archivo HTML

### Opción B: Render (también gratuito)

1. Crea cuenta en https://render.com/
2. Nuevo servicio → Web Service → conecta tu repositorio
3. Build command: `pip install -r backend/requirements.txt`
4. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Agrega la variable de entorno `GROQ_API_KEY`

---

## Columnas requeridas por archivo

### Archivo DIAN
| Columna | Descripción |
|---|---|
| `Folio` | Número de la factura |
| `Prefijo` | Prefijo de la factura (ej: BOG, FE, FEMQ) |
| `NIT Emisor` | NIT del proveedor |
| `Nombre Emisor` | Nombre del proveedor |

### Archivo Siesa
| Columna | Descripción |
|---|---|
| `Proveedor` | NIT del proveedor |
| `Docto. proveedor` | Documento/factura (ej: FEMQ-00004465) |
| `Razón social proveedor` | Nombre del proveedor |

---

## Preguntas frecuentes

**¿Qué pasa con las facturas anuladas en Siesa?**
Se cuentan como presentes. Si aparece en Siesa con cualquier estado (Aprobada, Anulada), se considera que está registrada.

**¿Qué pasa si Siesa tiene formatos diferentes de folio?**
El sistema normaliza automáticamente: quita guiones, puntos, ceros a la izquierda. `FEMQ-00004465` y `FEMQ4465` se reconocen como la misma factura.

**¿Se guarda algún archivo en el servidor?**
No. Los archivos se procesan en memoria y no se almacenan. El reporte Excel se genera temporalmente y se elimina.

**¿Cuánto cuesta Groq?**
El plan gratuito de Groq incluye suficientes tokens para usar el sistema varias veces al mes sin costo.

---

## Soporte

Si el sistema no reconoce las columnas de algún archivo, verifica que los nombres coincidan exactamente con los indicados en la tabla de arriba (incluyendo tildes y espacios).
