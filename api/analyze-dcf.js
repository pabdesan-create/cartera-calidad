const DCF_PROMPT = `Analiza este screenshot de Koyfin "Actuals and Consensus".

REGLAS CRÍTICAS:

AÑO BASE:
- Columnas "A" (CY2024A) = años cerrados con fecha real en Report Date
- Columnas "E" (CY2025E) = estimaciones con guión (-) en Report Date
- AÑO BASE = última columna "A" con fecha real (nunca un año "E")

CAGR FORWARD (máximo 5 años):
- Usar SOLO los 5 primeros años "E" desde el año base
- Si hay 6 o más años "E" → IGNORAR el 6º y posteriores
- Media geométrica: (valor_5E / base)^(1/5) - 1
- Si solo hay N < 5 años "E" → (valor_NE / base)^(1/N) - 1
- Si FCF negativo en CUALQUIER año "E" → cagr_fcf = 0
- Si FCF CAGR > 15% → usar igualmente con nota en fcf_note
- Empresas financieras (bancos, aseguradoras) → usar solo BN, fcf_base = 0

Devuelve SOLO JSON válido sin backticks ni texto adicional:
{"ticker":"","precio":0,"mktCap":0,"divisa":"USD","bn_year":"CY202XA","bn_base":0,"fcf_year":"CY202XA","fcf_base":0,"cagr_bn":0,"cagr_fcf":0,"n_anios_forward":5,"fcf_note":""}`

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
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

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
