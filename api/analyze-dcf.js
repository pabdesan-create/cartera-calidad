const DCF_PROMPT = `Analiza este pantallazo de Koyfin "Actuals and Consensus".

REGLA CRÍTICA para identificar el año base:
- Las columnas con "A" en el nombre (CY2023A, CY2024A, CY2025A...) son años CERRADOS reales
- Las columnas con "E" en el nombre (CY2026E, CY2027E...) son ESTIMACIONES futuras
- La fila "Report Date" tiene una FECHA REAL en los años cerrados y un GUIÓN (-) en los estimados
- El año BASE debe ser el ÚLTIMO año con "A" en el nombre que tenga Report Date con fecha real (no guión)
- NUNCA uses un año "E" como base

Devuelve SOLO JSON válido sin markdown ni backticks:
{"ticker":"","price":0,"mktCap":0,"divisa":"","bn_year":"CY202XA","bn_base":0,"fcf_year":"CY202XA","fcf_base":0,"cagr_bn":0,"cagr_fcf":0,"fcf_note":""}

Reglas de cálculo:
- mktCap en millones (si aparece en B multiplicar x1000)
- bn_year y fcf_year = el año base elegido (debe terminar en A, ej: "CY2025A")
- cagr_bn = (ultimo_estimado_BN / bn_base)^(1/n) - 1 x 100, hasta 5 años E
- cagr_fcf = igual con FCF, o 0 si FCF negativo en algún año estimado
- fcf_note = descripción si hay algo especial (dip, negativo, etc.) o vacío`

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
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
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'Se necesita una imagen' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
            { type: 'text', text: DCF_PROMPT }
          ]
        }]
      })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

    const raw = data.content?.[0]?.text || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No se encontró JSON en la respuesta')
    const result = JSON.parse(match[0])

    res.status(200).json({ ok: true, result })
  } catch (err) {
    console.error('Error en /api/analyze-dcf:', err)
    res.status(500).json({ error: err.message || 'Error inesperado' })
  }
}
