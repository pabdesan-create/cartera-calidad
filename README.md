# 📊 Cartera Calidad — Quality Compounders Tracker

Herramienta personal para analizar y trackear empresas quality compounders para cartera a largo plazo.

## ✨ Qué hace

- **Mi Cartera**: lista de empresas analizadas con score, clasificación (PILAR PURO / PILAR CÍCLICO / COMPLEMENTARIA / DESCARTADA), métricas clave y análisis expandible
- **Analizar con Claude**: sube hasta 6 screenshots de Koyfin → Claude Sonnet 4.6 analiza la empresa → resultado se guarda automáticamente en la cartera
- **Persistencia**: los datos se guardan en tu navegador (localStorage)

## 🚀 Despliegue en Vercel (5 minutos)

### Paso 1: Obtén tu API key de Anthropic
Ve a [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create key

### Paso 2: Sube el código a GitHub
1. Crea cuenta en [github.com](https://github.com)
2. Crea repositorio nuevo llamado `cartera-calidad`
3. Sube todos los archivos de este proyecto

### Paso 3: Despliega en Vercel
1. Ve a [vercel.com](https://vercel.com) → Sign up con tu cuenta de GitHub
2. "Add New Project" → selecciona el repo `cartera-calidad`
3. En **Environment Variables** añade:
   ```
   ANTHROPIC_API_KEY = sk-ant-tu_clave_aqui
   ```
4. Click en **Deploy**

✅ En 2 minutos tendrás una URL como `https://cartera-calidad-xxxx.vercel.app`

## 💻 Desarrollo local

```bash
# Instalar dependencias
npm install

# Instalar Vercel CLI (para poder usar las API functions en local)
npm install -g vercel

# Crear archivo .env.local con tu API key
echo "ANTHROPIC_API_KEY=sk-ant-tu_clave" > .env.local

# Levantar en local (frontend + API functions)
vercel dev
```

## 📁 Estructura del proyecto

```
cartera-calidad/
├── api/
│   └── analyze.js          # Función serverless: llama a Claude API
├── src/
│   ├── main.jsx            # Entry point React
│   └── App.jsx             # App completa (cartera + analizar)
├── index.html              # HTML base
├── package.json            # Dependencias
├── vite.config.js          # Config build
├── vercel.json             # Config despliegue
└── .env.example            # Ejemplo variables de entorno
```

## 💰 Coste estimado

Con Claude Sonnet 4.6 ($3/$15 por millón de tokens):
- ~$0.08-0.12 por análisis (6 imágenes + respuesta completa)
- 50 análisis/mes ≈ $5
- 200 análisis/mes ≈ $20

## 🔒 Seguridad

La API key de Anthropic **nunca sale del servidor** (Vercel). El browser solo llama a `/api/analyze`, que actúa como proxy seguro. La clave está en las variables de entorno de Vercel, no en el código.

## 📸 Screenshots de Koyfin recomendados

Para el mejor análisis, sube estos 6:
1. **Income Statement** — Cuenta de Resultados con gráfico y márgenes
2. **Balance Sheet** — Activos, pasivos, deuda, ratio Deuda/EBITDA
3. **Cash Flow** — CFO, FCF, Capex, buybacks, dividendos
4. **Returns** — ROC, ROIC, ROE históricos + dividend/buyback yield
5. **Actuals & Consensus (Income)** — Histórico 5 años + proyecciones ingresos
6. **Actuals & Consensus (Balance/CF)** — Histórico deuda + FCF proyecciones

Con menos imágenes también funciona, pero el análisis tendrá menos datos.
