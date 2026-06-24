const ANALYSIS_PROMPT = `Eres un analista de inversiones experto en quality compounders para cartera de largo plazo.

Se te proporcionan hasta 6 screenshots de Koyfin de una empresa (Income Statement, Balance Sheet, Cash Flow, Returns, Actuals & Consensus Income, Actuals & Consensus Balance/CF).

CRITERIOS PILAR (7/7 para ser PILAR_PURO):
1. Margen neto >20% (o FCF margin >20% si el NI está distorsionado por amortización de adquisiciones)
2. ROIC >12% consistente
3. Crecimiento >10% anual (CAGR 5 años)
4. Market share >20% o líder indiscutible en su nicho
5. Moat PERMANENTE (10+ años): network effects, regulatorio, switching costs extremos
6. Presencia global o diversificación geográfica relevante
7. Directiva de calidad + alineación con accionistas

CLASIFICACIONES:
- PILAR_PURO: 7/7 + moat permanente + resiliente a shocks → score 90-100
- PILAR_CICLICO: 7/7 pero sensible a ciclos de tipos/economía → score 75-89
- COMPLEMENTARIA_FUERTE: 5-6/7 → score 60-74
- COMPLEMENTARIA_MEDIA: 3-4/7 → score 40-59
- COMPLEMENTARIA_DEBIL: menos de 3/7 → score 30-39
- DESCARTADA: falla criterios básicos o tiene red flags graves → score <30

5 MATICES CRÍTICOS:
1. MÁRGENES: tendencia creciente=excelente, estable=ok, decreciente=RED FLAG
2. RETRIBUCIÓN: ROIC>15% → mejor reinvertir; buyback agresivo con deuda alta = incoherente
3. CAPITAL: Asset-light (Capex <3% revenues) mejor que asset-heavy
4. DEUDA: límite duro <2.0x Deuda Neta/EBITDA. >3x = zona roja grave
5. RED FLAGS: ingresos bajando YoY, márgenes comprimiendo tendencialmente, dilución accionaria acelerada

Responde ÚNICAMENTE con JSON válido sin backticks ni texto adicional:
{
  "ticker": "símbolo bursátil",
  "nombre": "nombre completo de la empresa",
  "pais": "país de sede",
  "sector": "sector y subsector específico",
  "marketCap": "market cap (ej: '$432B')",
  "margenNeto": "porcentaje string (ej: '45.9' o '22.5 FCF')",
  "roic": "porcentaje string",
  "crecimientoCAGR": "CAGR 5 años string",
  "deudaEbitda": "ratio string",
  "capexPct": "capex como % revenues string",
  "fcfMargin": "FCF margin % string",
  "pe": "P/E trailing string",
  "peForward": "P/E forward string",
  "moat": "permanente|duradero|temporal|ninguno",
  "tipoMoat": "descripción breve del tipo de moat",
  "tendenciaMargenes": "EXPANDIENDO|ESTABLE|COMPRIMIENDO",
  "deudaTendencia": "BAJANDO|ESTABLE|SUBIENDO",
  "assetLight": true,
  "criteriosOk": 7,
  "clasificacion": "PILAR_PURO|PILAR_CICLICO|COMPLEMENTARIA_FUERTE|COMPLEMENTARIA_MEDIA|COMPLEMENTARIA_DEBIL|DESCARTADA",
  "score": 95,
  "accion": "COMPRAR_AHORA|COMPRAR|ESPERAR|MONITOREAR|DESCARTAR",
  "alocacion": "5-8",
  "escenarioInflacion": "POSITIVO|NEUTRAL|NEGATIVO",
  "escenarioInflacionExpl": "una frase explicando por qué",
  "escenarioRecesion": "POSITIVO|NEUTRAL|NEGATIVO",
  "escenarioRecesionExpl": "una frase explicando por qué",
  "predictibilidad": "MUY_ALTA|ALTA|MEDIA|BAJA",
  "redFlag": "red flags separadas por punto, o 'Ninguna' si no hay",
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "debilidades": ["debilidad 1", "debilidad 2"],
  "descripcionNegocio": "2-3 frases explicando qué hace la empresa y su modelo de negocio",
  "notas": "resumen ejecutivo en 4-5 frases: tesis, por qué entra o no, riesgos clave",
  "analisisCompleto": "análisis detallado de 400-500 palabras: moat y durabilidad, métricas con tendencias, retribución al accionista, escenarios económicos, predictibilidad de ingresos, vientos de cola estructurales y veredicto final"
}`

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' })

  try {
    const { images } = req.body
    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'Se necesitan screenshots de Koyfin' })
    }

    const imageContent = images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.data }
    }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: ANALYSIS_PROMPT }
          ]
        }]
      })
    })

    const data = await response.json()

    if (data.error) throw new Error(data.error.message)

    const raw = data.content?.[0]?.text || ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    res.status(200).json({ ok: true, result })
  } catch (err) {
    console.error('Error en /api/analyze:', err)
    res.status(500).json({ error: err.message || 'Error inesperado en el análisis' })
  }
}
