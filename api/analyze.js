const PROMPT = `Eres un analista de inversiones experto. Se te proporcionan 3 screenshots de Koyfin:
- Screenshot 1: Actuals & Consensus superior (Income Statement + Balance Sheet + Cash Flow)
- Screenshot 2: Actuals & Consensus inferior (Per Share Data + Margins & Ratios + Growth Rates)
- Screenshot 3: Returns (ROC, ROIC, ROE, Dividend Yield LTM/NTM, Buyback Yield, Shares Outstanding)

REGLAS CRÍTICAS DE CÁLCULO:

IDENTIFICAR AÑO BASE:
- Columnas "A" (CY2024A) = años cerrados reales con Report Date con fecha
- Columnas "E" (CY2025E) = estimaciones con guión (-) en Report Date
- AÑO BASE = última columna "A" con fecha real en Report Date
- AÑO INICIO = primera columna visible con datos

CAGR HISTÓRICO (NI, Revenue, FCF):
- Desde PRIMERA columna visible hasta AÑO BASE
- Fórmula: (valor_base / valor_inicio)^(1/N) - 1 donde N = años entre ambos
- Siempre desde primer año disponible al último cerrado sin importar cuántos años

CAGR FORWARD (para DCF, máximo 5 años):
- Usar MÁXIMO 5 columnas "E" desde AÑO BASE
- Si hay 6 o más años "E" → IGNORAR el 6º y posteriores, usar solo los 5 primeros
- Media geométrica siempre sobre N años usados (N no puede superar 5)
- Fórmula: (valor_5E / base)^(1/5) - 1
- Si FCF negativo en CUALQUIER año "E" → dcf_cagr_fcf = 0
- Si cagr_fcf > 15% → usar igualmente con nota "FCF CAGR >15%"
- Empresas financieras (bancos, aseguradoras) → usar solo BN, dcf_fcf_base = 0

CAGR DIVIDENDO DGI:
- Calcular CAGR desde primer DPS disponible hasta DPS del AÑO BASE
- RACHA: años consecutivos con DPS mayor que año anterior
- Pase COVID: si congeló 2020-2021 y reanudó → anotar en dgi_notas sin romper racha
- PAYOUT FCF = (DPS × sharesOutstanding) / FCF_base × 100
- PAYOUT EPS = DPS / EPS_ajustado × 100

CRITERIOS QUALITY (7/7 para PILAR_PURO):
1. Margen neto >20% (o FCF margin >20% si NI distorsionado por amortización)
2. ROIC >12%
3. Crecimiento >10% CAGR historico NI o Revenue
4. Market share >20% o lider indiscutible
5. Moat PERMANENTE (10+ años)
6. Presencia global
7. Directiva calidad + alineacion accionistas

CLASIFICACIONES Quality:
PILAR_PURO=90-100 (7/7+permanente), PILAR_CICLICO=75-89 (7/7+ciclico),
COMPLEMENTARIA_FUERTE=60-74 (5-6/7), COMPLEMENTARIA_MEDIA=40-59 (3-4/7),
COMPLEMENTARIA_DEBIL=30-39 (<3/7), DESCARTADA<30

SCORING DGI (max 90pts, NO incluir Bloque D en el total):
Bloque A (35max): Chowder(yield+cagrDiv) >=16->10,>=12->7,>=10->4,<10->0 |
  cagrDiv >=15->10,>=10->7,>=7->4,<7->1 | racha >=25->10,>=15->7,>=10->5,>=7->3,<7->0 |
  yield 2-3.5->5,(1-2 o 3.5-4.5)->3,resto->1
Bloque B (30max): payoutFCF <40->12,<55->9,<70->5,>=70->0 |
  cagrFCF >=15->10,>=10->7,>=7->4,<7->1 | payoutEPS <40->8,<55->6,<65->3,>=65->0
Bloque C (25max): roic >=20->4,>=15->3,>=12->2,<12->0 |
  moatAncho amplio->6,estrecho->3,ninguno->0 |
  moatTipo monopolio_duopolio->7,red_clientes->6,costes_cambio->5,datos_propietarios->4,escala_marca->2,ninguna->0 |
  deuda <1.5->5,<2.5->3,<3.5->1,>=3.5->0 | rating AA+->3,A->3,BBB+->2,BBB->1,resto->0
TOTAL DGI = A + B + C (sin D)
PILAR>=70, COMPLEMENTARIA>=52, VIGILANCIA>=38, DESCARTABLE<38

Devuelve UNICAMENTE JSON valido sin backticks ni texto adicional:
{
  "ticker":"","nombre":"","pais":"","sector":"","marketCap":"","precio":0,"peTrailing":0,"peForward":0,
  "anioBase":"CY202XA","anioInicio":"CY201XA","nAniosHistorico":0,
  "margenNeto":"","margenEBIT":"","margenFCF":"","roic":"","roc":"","roe":"",
  "cagrNI_historico":"","cagrRevenue_historico":"","cagrFCF_historico":"",
  "deudaEbitda":"","capexPct":"","assetLight":true,
  "sharesOutstanding":0,"sharesTendencia":"BAJANDO|ESTABLE|SUBIENDO","buybackYield":"",
  "tendenciaMargenes":"EXPANDIENDO|ESTABLE|COMPRIMIENDO","deudaTendencia":"BAJANDO|ESTABLE|SUBIENDO",
  "moat":"permanente|duradero|temporal|ninguno","tipoMoat":"",
  "criteriosOk":0,"clasificacion":"PILAR_PURO|PILAR_CICLICO|COMPLEMENTARIA_FUERTE|COMPLEMENTARIA_MEDIA|COMPLEMENTARIA_DEBIL|DESCARTADA",
  "score":0,"accion":"COMPRAR_AHORA|COMPRAR|ESPERAR|MONITOREAR|DESCARTAR","alocacion":"",
  "escenarioInflacion":"POSITIVO|NEUTRAL|NEGATIVO","escenarioInflacionExpl":"",
  "escenarioRecesion":"POSITIVO|NEUTRAL|NEGATIVO","escenarioRecesionExpl":"",
  "predictibilidad":"MUY_ALTA|ALTA|MEDIA|BAJA",
  "redFlag":"","fortalezas":["","",""],"debilidades":["",""],
  "descripcionNegocio":"","notas":"","analisisCompleto":"",
  "dcf_bn_base":0,"dcf_fcf_base":0,"dcf_cagr_bn":0,"dcf_cagr_fcf":0,
  "dcf_bn_year":"CY202XA","dcf_fcf_year":"CY202XA","dcf_n_anios_forward":5,
  "dcf_fcf_note":"","dcf_mktCap":0,"dcf_divisa":"USD",
  "dgi_yieldActual":"","dgi_yieldNTM":"","dgi_cagrDiv":"",
  "dgi_rachaAnios":0,"dgi_aniosPagando":0,"dgi_dpsBase":0,
  "dgi_payoutEPS":"","dgi_payoutFCF":"","dgi_cagrFCF5Y":"","dgi_cagrBPA5Y":"",
  "dgi_moat":"amplio|estrecho|ninguno",
  "dgi_tipoMoat":"monopolio_duopolio|red_clientes|costes_cambio|datos_propietarios|escala_marca|ninguna",
  "dgi_deudaEbitda":"","dgi_rating":"",
  "dgi_yieldVsHistorico":"mayor|igual|menor","dgi_perVsHistorico":"bajo|en_linea|alto",
  "dgi_sensRecesion":"muy_defensiva|defensiva|moderada|sensible|muy_sensible",
  "dgi_sensTipos":"beneficiada|neutral|leve|perjudicada",
  "dgi_notasMacro":"","dgi_notas":"",
  "dgi_scoreA":0,"dgi_scoreB":0,"dgi_scoreC":0,"dgi_scoreTotal":0,
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
    if (!match) throw new Error('No se encontró JSON en la respuesta')
    const result = JSON.parse(match[0])

    res.status(200).json({ ok: true, result })
  } catch (err) {
    console.error('Error en /api/analyze:', err)
    res.status(500).json({ error: err.message || 'Error inesperado' })
  }
}
