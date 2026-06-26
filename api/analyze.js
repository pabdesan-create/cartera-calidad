const PROMPT = `Eres un analista de inversiones experto. Se te proporcionan 3 screenshots de Koyfin:
- Screenshot 1: Actuals & Consensus superior (Income Statement + Balance Sheet + Cash Flow)
- Screenshot 2: Actuals & Consensus inferior (Per Share Data + Margins & Ratios + Growth Rates)
- Screenshot 3: Returns (ROC, ROIC, ROE, Dividend Yield LTM/NTM, Buyback Yield, Shares Outstanding)

═══════════════════════════════════════════════════════
REGLA CRÍTICA 1: IDENTIFICAR AÑO BASE
═══════════════════════════════════════════════════════
- Fila "Calendar Years": columnas con "A" = años cerrados (CY2024A, CY2025A...)
- Fila "Report Date": fecha real (Jan-29-2026) = año cerrado // guión (-) = estimación
- AÑO BASE = columna MÁS RECIENTE que tenga "A" EN EL NOMBRE Y fecha real en Report Date
- IMPORTANTE: CY2025A con Report Date "Jan-29-2026" ES un año cerrado → úsalo como base
- NUNCA uses un año "E" como base aunque tenga datos parciales
- AÑO INICIO = primera columna visible con datos completos

═══════════════════════════════════════════════════════
REGLA CRÍTICA 2: CAGR HISTÓRICO
═══════════════════════════════════════════════════════
- Desde AÑO INICIO hasta AÑO BASE
- CAGR NI: (NI_base / NI_inicio)^(1/N) - 1 donde N = años entre ambos
- CAGR Revenue: igual con Revenue
- CAGR FCF: igual con FCF
- Si N=8 (2016→2024) usar exponente 1/8, si N=9 (2016→2025) usar 1/9, etc.
- NO limites el histórico a 5 años — usa todos los años disponibles

═══════════════════════════════════════════════════════
REGLA CRÍTICA 3: CAGR FORWARD (máximo 5 años "E")
═══════════════════════════════════════════════════════
- Usar MÁXIMO los 5 primeros años "E" desde el año base
- Si hay 6+ años "E" → ignorar el 6º y posteriores, calcular solo sobre 5
- Media geométrica: (valor_5E / base)^(1/5) - 1
- Si solo hay N<5 años "E" disponibles: (valor_NE / base)^(1/N) - 1
- Si FCF negativo en CUALQUIER año "E" → dcf_cagr_fcf = 0
- Si el FCF forward calculado resulta en CAGR NEGATIVO (FCF del último año E < FCF base) → dcf_cagr_fcf = 0 y añadir nota en dcf_fcf_note
- Si FCF CAGR forward > 15% → usar igualmente con nota en dcf_fcf_note
- Empresas financieras (bancos, aseguradoras): dcf_fcf_base = 0, dcf_cagr_fcf = 0

═══════════════════════════════════════════════════════
REGLA CRÍTICA 4: DIVIDENDOS DGI
═══════════════════════════════════════════════════════
- CAGR dividendo: desde primer DPS disponible hasta DPS del AÑO BASE
- RACHA: contar años consecutivos con DPS > año anterior hasta AÑO BASE
- Pase COVID: si congeló 2020-2021 y reanudó → anotar en dgi_notas, no romper racha
- PAYOUT FCF = (DPS_base × sharesOutstanding) / FCF_base × 100
- PAYOUT EPS = DPS_base / EPS_ajustado_base × 100

═══════════════════════════════════════════════════════
CRITERIOS QUALITY (7/7 para PILAR_PURO)
═══════════════════════════════════════════════════════
1. Margen neto >20% (o FCF margin >20% si NI distorsionado)
2. ROIC >12%
3. Crecimiento >10% CAGR historico
4. Market share >20% o lider indiscutible
5. Moat PERMANENTE (10+ años)
6. Presencia global
7. Directiva calidad + alineacion accionistas

CLASIFICACIONES: PILAR_PURO=90-100(7/7+permanente), PILAR_CICLICO=75-89(7/7+ciclico),
COMPLEMENTARIA_FUERTE=60-74(5-6/7), COMPLEMENTARIA_MEDIA=40-59(3-4/7),
COMPLEMENTARIA_DEBIL=30-39(<3/7), DESCARTADA<30

5 MATICES: 1)Margenes tendencia 2)Retribucion coherente con ROIC
3)Capex<3%=asset-light 4)Deuda<2x limite 5)Red flags

═══════════════════════════════════════════════════════
SCORING DGI (max 90pts, A+B+C sin incluir D)
═══════════════════════════════════════════════════════
A(35max): Chowder(yield+cagrDiv) >=16->10,>=12->7,>=10->4,<10->0
  cagrDiv >=15->10,>=10->7,>=7->4,<7->1
  racha >=25->10,>=15->7,>=10->5,>=7->3,<7->0
  yield 2-3.5->5,(1-2 o 3.5-4.5)->3,resto->1
B(30max): payFCF <40->12,<55->9,<70->5,>=70->0
  cagrFCF >=15->10,>=10->7,>=7->4,<7->1
  payEPS <40->8,<55->6,<65->3,>=65->0
C(25max): roic >=20->4,>=15->3,>=12->2,<12->0
  moatW amplio->6,estrecho->3,ninguno->0
  moatT monopolio_duopolio->7,red_clientes->6,costes_cambio->5,datos_propietarios->4,escala_marca->2,ninguna->0
  deuda <1.5->5,<2.5->3,<3.5->1,>=3.5->0
  rating AA+->3,A->3,BBB+->2,BBB->1,resto->0
DGI: PILAR>=70, COMPLEMENTARIA>=52, VIGILANCIA>=38, DESCARTABLE<38

═══════════════════════════════════════════════════════
DEVUELVE SOLO JSON VALIDO (sin backticks, sin texto extra):
═══════════════════════════════════════════════════════
{
  "ticker":"",
  "nombre":"",
  "pais":"",
  "sector":"",
  "marketCap":"",
  "precio":0,
  "peTrailing":0,
  "peForward":0,
  "anioBase":"CY202XA",
  "anioInicio":"CY201XA",
  "nAniosHistorico":0,

  "margenNeto":"string % (ej: '13.57')",
  "margenEBIT":"string %",
  "fcfMargin":"string % FCF/Revenue",
  "roic":"string %",
  "roc":"string %",
  "roe":"string %",
  "crecimientoCAGR":"string % CAGR NI historico (anioInicio→anioBase)",
  "cagrRevenue":"string % CAGR Revenue historico",
  "cagrFCF_historico":"string % CAGR FCF historico",
  "deudaEbitda":"string ratio (ej: '2.4')",
  "capexPct":"string % capex/revenue",
  "assetLight":true,
  "sharesOutstanding":0,
  "sharesTendencia":"BAJANDO|ESTABLE|SUBIENDO",
  "buybackYield":"string %",
  "tendenciaMargenes":"EXPANDIENDO|ESTABLE|COMPRIMIENDO",
  "deudaTendencia":"BAJANDO|ESTABLE|SUBIENDO",

  "moat":"permanente|duradero|temporal|ninguno",
  "tipoMoat":"descripcion tipo moat",
  "criteriosOk":0,
  "clasificacion":"PILAR_PURO|PILAR_CICLICO|COMPLEMENTARIA_FUERTE|COMPLEMENTARIA_MEDIA|COMPLEMENTARIA_DEBIL|DESCARTADA",
  "score":0,
  "accion":"COMPRAR_AHORA|COMPRAR|ESPERAR|MONITOREAR|DESCARTAR",
  "alocacion":"string (ej: '3-5')",
  "escenarioInflacion":"POSITIVO|NEUTRAL|NEGATIVO",
  "escenarioInflacionExpl":"una frase",
  "escenarioRecesion":"POSITIVO|NEUTRAL|NEGATIVO",
  "escenarioRecesionExpl":"una frase",
  "predictibilidad":"MUY_ALTA|ALTA|MEDIA|BAJA",
  "redFlag":"red flags separadas por punto o Ninguna",
  "fortalezas":["","",""],
  "debilidades":["",""],
  "descripcionNegocio":"2-3 frases modelo negocio",
  "notas":"resumen ejecutivo 4-5 frases",
  "analisisCompleto":"analisis detallado 400-500 palabras",

  "dcf_bn_base":0,
  "dcf_fcf_base":0,
  "dcf_cagr_bn":0,
  "dcf_cagr_fcf":0,
  "dcf_bn_year":"CY202XA",
  "dcf_fcf_year":"CY202XA",
  "dcf_n_anios_forward":5,
  "dcf_fcf_note":"nota si FCF especial o vacio",
  "dcf_mktCap":0,
  "dcf_divisa":"USD",

  "dgi_yieldActual":"string %",
  "dgi_yieldNTM":"string %",
  "dgi_cagrDiv":"string % CAGR dividendo historico",
  "dgi_rachaAnios":0,
  "dgi_aniosPagando":0,
  "dgi_dpsBase":0,
  "dgi_payoutEPS":"string %",
  "dgi_payoutFCF":"string %",
  "dgi_cagrFCF5Y":"string % CAGR FCF historico 5Y",
  "dgi_cagrBPA5Y":"string % CAGR EPS ajustado historico 5Y",
  "dgi_moat":"amplio|estrecho|ninguno",
  "dgi_tipoMoat":"monopolio_duopolio|red_clientes|costes_cambio|datos_propietarios|escala_marca|ninguna",
  "dgi_deudaEbitda":"string ratio",
  "dgi_rating":"rating o Sin rating",
  "dgi_yieldVsHistorico":"mayor|igual|menor",
  "dgi_perVsHistorico":"bajo|en_linea|alto",
  "dgi_sensRecesion":"muy_defensiva|defensiva|moderada|sensible|muy_sensible",
  "dgi_sensTipos":"beneficiada|neutral|leve|perjudicada",
  "dgi_notasMacro":"comportamiento historico en crisis 1-2 frases",
  "dgi_notas":"tesis DGI: racha, chowder, YoC estimado, por que entra o no",
  "dgi_scoreA":0,
  "dgi_scoreB":0,
  "dgi_scoreC":0,
  "dgi_scoreTotal":0,
  "dgi_clasificacion":"PILAR|COMPLEMENTARIA|VIGILANCIA|DESCARTABLE"
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
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

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
          content: [...imageContent, { type: 'text', text: PROMPT }]
        }]
      })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)

    const raw = data.content?.[0]?.text || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No se encontro JSON en la respuesta')
    const result = JSON.parse(match[0])

    res.status(200).json({ ok: true, result })
  } catch (err) {
    console.error('Error en /api/analyze:', err)
    res.status(500).json({ error: err.message || 'Error inesperado' })
  }
}
