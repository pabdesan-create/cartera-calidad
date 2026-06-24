import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

const CLASIFICACIONES = [
  { id: 'PILAR_PURO',           label: 'PILAR PURO',           dot: '🟢', color: '#15803d', bg: '#f0fdf4', border: '#86efac', grupo: 'PILARES'         },
  { id: 'PILAR_CICLICO',        label: 'PILAR CÍCLICO',        dot: '🔵', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', grupo: 'PILARES'         },
  { id: 'COMPLEMENTARIA_FUERTE',label: 'COMPL. FUERTE',         dot: '🟡', color: '#b45309', bg: '#fffbeb', border: '#fcd34d', grupo: 'COMPLEMENTARIAS' },
  { id: 'COMPLEMENTARIA_MEDIA', label: 'COMPL. MEDIA',          dot: '🟠', color: '#c2410c', bg: '#fff7ed', border: '#fdba74', grupo: 'COMPLEMENTARIAS' },
  { id: 'COMPLEMENTARIA_DEBIL', label: 'COMPL. DÉBIL',          dot: '🔴', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', grupo: 'COMPLEMENTARIAS' },
  { id: 'DESCARTADA',           label: 'DESCARTADA',            dot: '⚫', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', grupo: 'DESCARTADAS'    },
]

const GRUPOS = ['PILARES', 'COMPLEMENTARIAS', 'DESCARTADAS']

const GRUPO_META = {
  PILARES:        { color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '🏆' },
  COMPLEMENTARIAS:{ color: '#b45309', bg: '#fffbeb', border: '#fcd34d', icon: '📋' },
  DESCARTADAS:    { color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', icon: '🚫' },
}

const ACCION_LABEL = {
  COMPRAR_AHORA: '🟢 COMPRAR AHORA',
  COMPRAR:       '✅ COMPRAR',
  ESPERAR:       '⏳ ESPERAR',
  MONITOREAR:    '👁️ MONITOREAR',
  DESCARTAR:     '🚫 DESCARTAR',
}

const ESCENARIO_STYLE = {
  POSITIVO: { color: '#15803d', bg: '#f0fdf4', label: '✅ POSITIVO' },
  NEUTRAL:  { color: '#b45309', bg: '#fffbeb', label: '➡️ NEUTRAL'  },
  NEGATIVO: { color: '#dc2626', bg: '#fef2f2', label: '❌ NEGATIVO' },
}

const PRED_STYLE = {
  MUY_ALTA: { color: '#15803d', bg: '#f0fdf4' },
  ALTA:     { color: '#1d4ed8', bg: '#eff6ff' },
  MEDIA:    { color: '#b45309', bg: '#fffbeb' },
  BAJA:     { color: '#dc2626', bg: '#fef2f2' },
}

const SCREENSHOTS_INFO = [
  { n: 1, label: 'Income Statement', hint: 'Cuenta de Resultados (gráfico + márgenes)' },
  { n: 2, label: 'Balance Sheet', hint: 'Activos, pasivos, deuda, ratio Deuda/EBITDA' },
  { n: 3, label: 'Cash Flow', hint: 'CFO, FCF, Capex, buybacks, dividendos' },
  { n: 4, label: 'Returns', hint: 'ROC, ROIC, ROE históricos + yields' },
  { n: 5, label: 'Actuals & Consensus (Income)', hint: 'Histórico 5 años + proyecciones ingresos' },
  { n: 6, label: 'Actuals & Consensus (Balance)', hint: 'Histórico deuda + FCF proyecciones' },
]

const SEED = [
  {
    id: 'v-seed', ticker: 'V', nombre: 'Visa Inc.', pais: 'USA', sector: 'Pagos Digitales',
    marketCap: '$622B', margenNeto: '55', roic: '41.19', crecimientoCAGR: '10',
    deudaEbitda: '0.04', capexPct: '2.8', fcfMargin: '50', pe: '28.8', peForward: '23.7',
    moat: 'permanente', tipoMoat: 'Network effects bilateral + Switching costs + Escala global',
    tendenciaMargenes: 'ESTABLE', deudaTendencia: 'BAJANDO', assetLight: true,
    criteriosOk: 7, clasificacion: 'PILAR_PURO', score: 95,
    accion: 'COMPRAR', alocacion: '5-8',
    escenarioInflacion: 'POSITIVO', escenarioInflacionExpl: 'Cobra % sobre valores → inflación sube el ticket medio y aumenta revenue sin esfuerzo',
    escenarioRecesion: 'NEUTRAL', escenarioRecesionExpl: 'Los pagos siguen ocurriendo en recesión; volumen baja levemente pero no colapsa',
    predictibilidad: 'MUY_ALTA',
    redFlag: 'Antitrust DOJ 2024 (riesgo regulatorio en fees)',
    fortalezas: ['Moat de red irremplazable en 200+ países', 'Margen neto 55% con expansión constante', 'Deuda trivial 0.04x EBITDA'],
    debilidades: ['Riesgo regulatorio interchange fees', 'Crecimiento más lento que Mastercard'],
    descripcionNegocio: 'Visa opera la mayor red de pagos del mundo (200+ países, 4.400M tarjetas). No presta dinero: cobra comisión por autorizar y procesar transacciones. Modelo asset-light con márgenes extraordinarios.',
    notas: 'PILAR PURO 7/7. Infraestructura financiera esencial: los pagos ocurren en cualquier crisis. Margen neto 55%, ROIC 41%, deuda trivial. Defensivo absoluto e inflación-positivo. Precio justo a 23.7x forward P/E vs histórico 30-40x.',
    analisisCompleto: 'Visa es la red de pagos más grande del mundo con presencia en 200+ países y 4.400 millones de tarjetas activas. Su moat es de tipo network effect bilateral y permanente: cuantos más comerciantes aceptan Visa, más valiosa es para los consumidores, y viceversa. Este flywheel lleva 65+ años fortaleciéndose.\n\nFinancieramente, los números son extraordinarios: margen neto del 55%, ROIC del 41.19% y FCF margin del ~50%. La deuda neta es prácticamente cero (0.04x EBITDA). Capex de apenas 2.8% sobre revenues, confirmando el modelo ultra asset-light. Los márgenes se mantienen estables en rango alto (no comprimen).\n\nEn inflación, Visa se beneficia directamente: cobra un porcentaje sobre el valor de cada transacción, así que si los precios suben, el revenue sube sin que Visa haga nada. En recesión, los pagos son más defensivos de lo que parece: la gente sigue pagando comida, gasolina y servicios básicos con tarjeta.\n\nLa directiva (Ryan McInerney, ex-McKinsey + JPMorgan) es sólida y gestiona con visión de largo plazo. Los buybacks son coherentes con el ROIC: con 41% de retorno sobre el capital, devolver dinero a accionistas tiene sentido cuando no hay mejor inversión disponible.\n\nÚnico riesgo real: la acción antimonopolio del DOJ de 2024 sobre los fees de interchange. Históricamente Visa ha sobrevivido estos escrutinios adaptándose. Riesgo gestionable.',
    fecha: '2026-06-18',
  },
  {
    id: 'ma-seed', ticker: 'MA', nombre: 'Mastercard Incorporated', pais: 'USA', sector: 'Pagos Digitales',
    marketCap: '$432B', margenNeto: '45.9', roic: '61.66', crecimientoCAGR: '16.5',
    deudaEbitda: '0.5', capexPct: '1.4', fcfMargin: '52.4', pe: '28.3', peForward: '24.2',
    moat: 'permanente', tipoMoat: 'Network effects bilateral + Switching costs + 210 países',
    tendenciaMargenes: 'EXPANDIENDO', deudaTendencia: 'BAJANDO', assetLight: true,
    criteriosOk: 7, clasificacion: 'PILAR_PURO', score: 95,
    accion: 'COMPRAR', alocacion: '5-8',
    escenarioInflacion: 'POSITIVO', escenarioInflacionExpl: 'Igual que Visa: cobra % sobre valores → inflación aumenta el ticket y el revenue directamente',
    escenarioRecesion: 'NEUTRAL', escenarioRecesionExpl: 'Negocio defensivo: el pago con tarjeta no se cancela en recesión aunque el volumen baje',
    predictibilidad: 'MUY_ALTA',
    redFlag: 'Regulación interchange fees EU/USA. Ausencia en China (UnionPay domina)',
    fortalezas: ['EBIT margin expandiéndose 5 años seguidos (53→59%)', 'ROIC 61.66% superior a Visa', 'Crece más rápido (16.5% CAGR) por mayor exposición internacional'],
    debilidades: ['Margen neto absoluto inferior a Visa (45% vs 55%)', 'Regulación interchange fees recurrente'],
    descripcionNegocio: 'Mastercard opera la segunda red de pagos global (210+ países, 2.800M+ tarjetas). Modelo idéntico a Visa: cobra comisión por transacción sin riesgo de crédito. Creciente diversificación hacia servicios de datos y analytics (Mastercard Analytics).',
    notas: 'PILAR PURO 7/7. EBIT margin expandiéndose consecutivamente 5 años (señal definitiva de moat fortísimo). ROIC 61% supera a Visa. Crece 16.5% CAGR vs Visa 10% por más exposición a emergentes. A 24.2x P/E forward: barato vs histórico 35-45x.',
    analisisCompleto: 'Mastercard es el complemento perfecto de Visa en cartera. Opera la segunda mayor red de pagos del mundo con un modelo prácticamente idéntico pero con dos diferencias clave: crece más rápido (16.5% CAGR vs Visa ~10%) y tiene mayor exposición internacional.\n\nEl dato financiero más llamativo es la expansión consistente de márgenes EBIT: de 53.3% en 2020 a 59.6% en LTM 2026, mejorando cada año sin excepción. Eso es la señal definitiva de un moat que se fortalece con el tiempo y un operating leverage excepcional.\n\nEl ROIC del 61.66% supera al de Visa (41.19%), lo que indica una mayor eficiencia en el uso del capital. El capex es de apenas 1.4% sobre revenues, uno de los ratios más bajos de cualquier empresa cotizada global.\n\nLa mayor exposición internacional de Mastercard (65% ingresos fuera de USA vs ~45% de Visa) la convierte en la gran beneficiaria de la digitalización de pagos en mercados emergentes: India, Africa, SE Asia y Latinoamérica todavía tienen un 60-70% de transacciones en efectivo.\n\nEscenarios: igual que Visa, la inflación le beneficia directamente (cobra % sobre valores más altos). En recesión, el negocio es defensivo aunque el volumen baja levemente.\n\nEl buyback agresivo ($13.4B/año) sobre un FCF de $17.8B (91% del FCF) es coherente: el modelo asset-light no requiere reinversión masiva, y devolver capital a accionistas tiene sentido. Las adquisiciones estratégicas ($2.5B) en fintech y datos completan la asignación de capital.',
    fecha: '2026-06-18',
  },
  {
    id: 'csu-seed', ticker: 'CSU', nombre: 'Constellation Software Inc.', pais: 'Canadá', sector: 'Software / VMS Serial Acquirer',
    marketCap: 'C$58B', margenNeto: '22.5 FCF', roic: '15.99', crecimientoCAGR: '19.73',
    deudaEbitda: '1.0', capexPct: '0.6', fcfMargin: '22.5', pe: '17.2 fwd', peForward: '17.2',
    moat: 'permanente', tipoMoat: 'Switching costs extremos en 800+ VMS + Escala + Modelo único irreplicable',
    tendenciaMargenes: 'ESTABLE', deudaTendencia: 'BAJANDO', assetLight: true,
    criteriosOk: 7, clasificacion: 'PILAR_PURO', score: 92,
    accion: 'COMPRAR', alocacion: '5-8',
    escenarioInflacion: 'NEUTRAL', escenarioInflacionExpl: 'Puede subir precios de mantenimiento anual (contratos incluyen ajuste CPI), pero costes salariales también suben',
    escenarioRecesion: 'POSITIVO', escenarioRecesionExpl: 'Anti-cíclico: ingresos de mantenimiento resilientes + adquisiciones se abaratan en recesión (oportunidad)',
    predictibilidad: 'MUY_ALTA',
    redFlag: 'Key man risk (Mark Leonard). Escasez dealflow si VMS se encarecen. Net Income GAAP distorsionado por amortización (usar FCF)',
    fortalezas: ['Moat permanente: switching costs extremos en 800+ empresas de nicho', 'FCF margin 22.5% (NI deprimido por amortización)', 'Anti-cíclico: en recesión adquiere barato'],
    debilidades: ['Key man risk (Mark Leonard es insustituible)', 'Net Income GAAP confuso (amortización masiva)', 'Escala hace más difícil encontrar adquisiciones que muevan la aguja'],
    descripcionNegocio: 'Constellation Software es una holding que adquiere y opera 800+ empresas de software de mercados verticales (VMS). Nunca vende las adquiridas. Modelo de Mark Leonard: comprar VMS a valoraciones bajas, cuyos clientes (funerarias, municipios, veterinarias...) no pueden cambiar de software sin destruir su negocio.',
    notas: 'PILAR PURO especial: el Net Income GAAP (6%) está distorsionado por amortización de adquisiciones (~C$1.4B/año). El dato real es el FCF margin del 22.5%. ROIC en nuevas adquisiciones 25-30%+. Anti-cíclico y único modelo en el mundo a esta escala. A 21x FCF: precio razonable.',
    analisisCompleto: 'Constellation Software es una de las empresas más singulares del mercado. Mark Leonard construyó desde 1995 el mayor acquirer de software de mercados verticales (VMS) del mundo: 800+ empresas de software en nichos tan específicos como gestión de cementerios, software para funerarias o sistemas de bibliotecas municipales.\n\nEl moat es de tipo switching costs extremo y permanente: los clientes de VMS no pueden cambiar de software sin interrumpir su operación durante meses y perder décadas de datos históricos. Una vez implantado, el software VMS es prácticamente irremplazable. Con 800+ empresas en nichos distintos, la diversificación es extraordinaria y ninguna representa más del 2-3% del grupo.\n\nCRUCIAL para entender el análisis financiero: el Net Income GAAP del 6% es artificialmente bajo por ~C$1.4B de amortización anual de intangibles de adquisiciones. No es cash real. El dato correcto es el FCF margin del 22.5%, que sí cumple el criterio >20%.\n\nEl ROIC consolidado del 15.99% subestima el retorno real: el IRR en nuevas adquisiciones es del 25-30%+. El capital histórico acumulado tiene menor rendimiento por antigüedad.\n\nEscenario recesión: POSITIVO. Los ingresos de mantenimiento (~75% del total) son prácticamente inamovibles. Y en recesión, los propietarios de empresas VMS están más dispuestos a vender a precios atractivos. Las mejores adquisiciones de CSU fueron en 2009 y 2020.\n\nRiesgo principal: Mark Leonard. Es el arquitecto del modelo, el mejor capital allocator que existe en este nicho. Su eventual retirada crea incertidumbre. Mitigación: la estructura descentralizada y la cultura están muy arraigadas.',
    fecha: '2026-06-18',
  },
  {
    id: 'mco-seed', ticker: 'MCO', nombre: "Moody's Corporation", pais: 'USA', sector: "Agencia de Rating / Financial Analytics",
    marketCap: '$78.7B', margenNeto: '31.8', roic: '25.58', crecimientoCAGR: '7.5',
    deudaEbitda: '1.5', capexPct: '4.3', fcfMargin: '34.8', pe: '32.3', peForward: '26.4',
    moat: 'permanente', tipoMoat: 'Regulatorio (NRSRO) + Network effects bilateral + Brand 100+ años',
    tendenciaMargenes: 'EXPANDIENDO', deudaTendencia: 'BAJANDO', assetLight: true,
    criteriosOk: 6, clasificacion: 'PILAR_CICLICO', score: 83,
    accion: 'COMPRAR', alocacion: '3-5',
    escenarioInflacion: 'NEGATIVO', escenarioInflacionExpl: 'Inflación alta → tipos altos → menos emisión de bonos → MIS revenue cae. 2022 lo demostró: revenue -12%',
    escenarioRecesion: 'NEUTRAL', escenarioRecesionExpl: 'Recesión ≠ tipos altos: en recesión los gobiernos emiten deuda masivamente (positivo). Solo malo si hay credit freeze',
    predictibilidad: 'MEDIA',
    redFlag: 'Cíclico a tipos de interés (2022: revenue -12%, EBIT -11pp). Crecimiento 7.5% CAGR < 10% requerido. MIS (~55% revenue) es transaccional e impredecible',
    fortalezas: ['Duopolio regulado con S&P: sin Moody\'s el mercado de bonos global no funciona', 'Márgenes extraordinarios EBIT 44.91%, ROIC 25.58%', 'Viento de cola secular: gobiernos emiten cada vez más deuda (USA 120%+ PIB)'],
    debilidades: ['Cíclico a tipos: 2022 mostró -12% revenue en ciclo de subidas', 'Crecimiento 7.5% CAGR < 10% requerido', 'MIS transaccional = 55% ingresos impredecibles'],
    descripcionNegocio: "Moody's es una de las tres grandes agencias de calificación crediticia (con S&P y Fitch). Opera en dos segmentos: MIS (ratings de bonos, ~55% revenue, transaccional y cíclico) y MA (analytics y datos, ~45%, recurrente por suscripción). Berkshire Hathaway posee el ~13%.",
    notas: 'PILAR CÍCLICO (83/100). Moat regulatorio permanente pero crecimiento 7.5% < 10% y ciclicidad clara a tipos demostrada en 2022. Estrategia contrarian: COMPRAR cuando tipos suben y MCO cae (como -40% en 2022). Viento de cola secular: los gobiernos emiten cada vez más deuda globalmente.',
    analisisCompleto: "Moody's es un duopolio regulado con S&P que controla el ~80% del mercado global de ratings crediticios. Su moat es extraordinario: la designación NRSRO (SEC) es prácticamente un monopolio regulatorio. Sin Moody's o S&P, el mercado de bonos global no funciona: fondos de pensiones y aseguradoras tienen mandatos que les obligan a invertir solo en bonos con ratings NRSRO reconocidos.\n\nLos números financieros son excelentes: EBIT margin del 44.91%, ROIC del 25.58%, FCF margin del 34.8%. Berkshire Hathaway tiene el 13%, validación suficiente de calidad.\n\nSin embargo, hay dos razones para clasificarlo como PILAR CÍCLICO y no PURO:\n\n1. CRECIMIENTO: El CAGR de 5 años es del 7.5%, por debajo del 10% requerido. Forward projections de 6-9% anual. El mercado de ratings crece estructuralmente al 6-8%, no al 10%+.\n\n2. CICLICIDAD A TIPOS: 2022 lo demostró sin ambigüedad. Cuando la Fed subió tipos agresivamente, la emisión de bonos colapsó, MIS revenue cayó y el EBIT margin bajó de 45% a 34% (-11pp) en un solo año.\n\nVIENTO DE COLA CLAVE: Los gobiernos emiten cada vez más deuda. USA tiene deuda/PIB del 120%+ y sigue subiendo. Alemania abandonó su 'freno de deuda'. Japón en 260% PIB. Cada bono nuevo necesita un rating. Esta es una tendencia secular de décadas.\n\nESTRATEGIA CONTRARIAN: El mejor momento para comprar MCO es cuando los tipos suben y el mercado vende. En 2022 cayó -40%, y en 2023-24 subió +80% desde mínimos. Los que compraron en el miedo ganaron mucho.",
    fecha: '2026-06-18',
  },
  {
    id: 'hca-seed', ticker: 'HCA', nombre: 'HCA Healthcare Inc.', pais: 'USA', sector: 'Healthcare / Operador Hospitalario',
    marketCap: '$83.7B', margenNeto: '8.14', roic: '21.54', crecimientoCAGR: '7.3',
    deudaEbitda: '2.9', capexPct: '6.9', fcfMargin: '8', pe: '13.0', peForward: '12.2',
    moat: 'duradero', tipoMoat: 'Posición geográfica local + Switching costs moderados + Reputación',
    tendenciaMargenes: 'ESTABLE', deudaTendencia: 'ESTABLE', assetLight: false,
    criteriosOk: 3, clasificacion: 'COMPLEMENTARIA_MEDIA', score: 45,
    accion: 'ESPERAR', alocacion: '0-2',
    escenarioInflacion: 'NEGATIVO', escenarioInflacionExpl: 'Costes (salarios médicos, equipamiento) suben con inflación pero pricing power limitado por Medicare/Medicaid',
    escenarioRecesion: 'NEUTRAL', escenarioRecesionExpl: 'Healthcare es defensivo en demanda pero márgenes se comprimen levemente (pacientes aplazan procedimientos opcionales)',
    predictibilidad: 'MEDIA',
    redFlag: 'Deuda 2.9x EBITDA (>2x límite). Margen neto 8% (<20% requerido). Capex $4.87B creciente (6.9% revenues). Buyback agresivo ($9.1B) mientras deuda alta = incoherente. Telemedicina amenaza modelo largo plazo',
    fortalezas: ['ROIC 21.54% excelente (aunque inflado por apalancamiento)', 'FCF conversion 99%: excelente generación de caja', 'Defensivo en demanda: healthcare inelástico'],
    debilidades: ['Margen neto 8% vs 20% requerido: falla criterio crítico', 'Deuda 2.9x EBITDA > límite de 2.0x', 'Asset-heavy: Capex $4.87B/año creciente comprime FCF libre', 'Crecimiento 7.3% < 10% requerido'],
    descripcionNegocio: 'HCA Healthcare es el mayor operador hospitalario privado de USA (186 hospitales en 20 estados). Presta servicios médicos de inpatient y outpatient. Modelo asset-heavy que requiere Capex masivo continuo en equipamiento médico e infraestructura.',
    notas: 'COMPLEMENTARIA MEDIA (45/100). No es descartada porque ROIC excelente (21.54%) e ingresos crecen. Pero falla en criterios clave: margen 8% vs 20%, crecimiento 7.3% vs 10%, deuda 2.9x vs <2x. NO comprar ahora. Entrar si P/E <11x Y deuda baja <2.5x. Descartar si deuda >3.5x O márgenes <7% O ingresos caen.',
    analisisCompleto: "HCA Healthcare genera mucho cash (FCF $5.68B, conversión 99%) y tiene un ROIC excelente del 21.54%. Pero ese ROIC está inflado por el apalancamiento masivo (deuda $49.84B, ratio 2.9x EBITDA), no por un moat estructural.\n\nEl modelo de hospitales es intrínsecamente asset-heavy: Capex de $4.87B/año (6.9% revenues) y creciendo. A diferencia de Visa o Mastercard, que generan el mismo o más cash con menos inversión cada año, HCA necesita invertir masivamente solo para mantener su posición.\n\nLos márgenes del 8.14% neto son estructuralmente bajos por la naturaleza del negocio hospitalario: salarios médicos altos, equipamiento caro, y pricing power limitado porque Medicare/Medicaid (40%+ de ingresos) tienen tarifas reguladas.\n\nEl buyback agresivo ($9.1B/año, 84% de earnings) mientras la deuda sigue en 2.9x EBITDA es incoherente. Con ese nivel de deuda, prioridad debería ser reducirla.\n\nEl moat es 'duradero' pero no permanente: posición geográfica local defensible, pero la telemedicina, cirugía outpatient y hospitales públicos presionan estructuralmente.\n\nNO es descartada porque: ingresos crecen (+8.67% YoY), ROIC sólido, deuda 2.9x aún por debajo del límite de descarte (3.5x), sin red flags de dirección.\n\nDecisión: ESPERAR. Solo entrar si P/E cae por debajo de 11x con evidencia de mejora en deuda y márgenes. Hay opciones claramente mejores en cartera.",
    fecha: '2026-06-18',
  },
]

const STORAGE_KEY = 'cartera-calidad-v1'

// ─── UTILS ─────────────────────────────────────────────────────────────────────

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function persistPortfolio(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function getClasif(id) {
  return CLASIFICACIONES.find(c => c.id === id) || CLASIFICACIONES[0]
}

function generatePDFHtml(co) {
  const cl = getClasif(co.clasificacion)
  const scoreColor = cl.color
  const escBadge = (v) => {
    const s = ESCENARIO_STYLE[v] || ESCENARIO_STYLE.NEUTRAL
    return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:12px;font-weight:700;font-size:12px">${s.label}</span>`
  }
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${co.ticker} — Análisis Inversión</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; padding: 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 900; color: #0f2246; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  .header { background: #f0f4f8; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .score { text-align: center; }
  .score .num { font-size: 42px; font-weight: 900; color: ${scoreColor}; line-height: 1; }
  .score .sub { font-size: 11px; color: #94a3b8; }
  .badge { display: inline-block; background: ${cl.bg}; border: 1px solid ${cl.border}; color: ${cl.color}; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .box .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .box .val { font-size: 18px; font-weight: 800; }
  .green { color: #15803d; } .red { color: #dc2626; } .blue { color: #1d4ed8; } .gray { color: #475569; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .row strong { color: #1e293b; }
  .info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; color: #1e40af; font-size: 12px; }
  .warn { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; color: #dc2626; font-size: 12px; }
  .analysis { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 12px; white-space: pre-wrap; line-height: 1.7; color: #334155; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  ul { padding-left: 16px; } li { margin-bottom: 3px; font-size: 12px; }
  @media print {
    body { padding: 16px; }
    @page { margin: 1cm; }
  }
</style>
</head>
<body>
<div class="header">
  <div style="flex:1">
    <h1>${co.nombre} <span style="color:#94a3b8;font-size:15px;font-weight:400">(${co.ticker})</span></h1>
    <span class="badge">${cl.dot} ${cl.label}</span><br/>
    <span style="font-size:12px;color:#64748b">${co.pais} · ${co.sector} · ${co.marketCap || ''}</span><br/>
    <span style="font-size:12px;font-weight:700;color:${scoreColor}">${ACCION_LABEL[co.accion] || co.accion} · ${co.alocacion || '—'}% cartera</span>
  </div>
  <div class="score">
    <div class="num">${co.score}</div>
    <div class="sub">/100</div>
    <div style="font-size:10px;color:#94a3b8;margin-top:2px">${co.criteriosOk || '?'}/7 criterios</div>
  </div>
</div>

<h2>📊 Métricas Financieras (LTM)</h2>
<div class="grid3">
  <div class="box"><div class="label">Margen Neto</div><div class="val ${parseFloat(co.margenNeto) >= 20 ? 'green' : 'red'}">${co.margenNeto}%</div></div>
  <div class="box"><div class="label">ROIC</div><div class="val ${parseFloat(co.roic) >= 12 ? 'green' : 'red'}">${co.roic}%</div></div>
  <div class="box"><div class="label">CAGR 5Y</div><div class="val ${parseFloat(co.crecimientoCAGR) >= 10 ? 'green' : 'red'}">${co.crecimientoCAGR}%</div></div>
  <div class="box"><div class="label">Deuda/EBITDA</div><div class="val ${parseFloat(co.deudaEbitda) <= 2 ? 'green' : 'red'}">${co.deudaEbitda}x</div></div>
  <div class="box"><div class="label">FCF Margin</div><div class="val ${parseFloat(co.fcfMargin) >= 20 ? 'green' : 'gray'}">${co.fcfMargin || '—'}%</div></div>
  <div class="box"><div class="label">P/E Forward</div><div class="val gray">${co.peForward}x</div></div>
</div>
<div class="grid">
  <div>
    <div class="row"><span>Tendencia márgenes</span><strong>${co.tendenciaMargenes || '—'}</strong></div>
    <div class="row"><span>Tendencia deuda</span><strong>${co.deudaTendencia || '—'}</strong></div>
    <div class="row"><span>Asset-light</span><strong>${co.assetLight ? '✓ Sí' : '✗ No'}</strong></div>
  </div>
  <div>
    <div class="row"><span>Capex/Revenues</span><strong>${co.capexPct || '—'}%</strong></div>
    <div class="row"><span>P/E Trailing</span><strong>${co.pe}x</strong></div>
    <div class="row"><span>Market Cap</span><strong>${co.marketCap || '—'}</strong></div>
  </div>
</div>

<h2>🏢 Descripción del Negocio</h2>
<div class="info">${co.descripcionNegocio || '—'}</div>

<h2>🛡️ Moat & Ventaja Competitiva</h2>
<div class="row"><span>Tipo moat</span><strong>${co.moat?.toUpperCase()}</strong></div>
<div class="row"><span>Descripción</span><strong>${co.tipoMoat || '—'}</strong></div>

<h2>🌍 Escenarios Económicos · Predictibilidad</h2>
<div class="grid3">
  <div class="box">
    <div class="label">Inflación Alta</div>
    ${escBadge(co.escenarioInflacion)}
    <div style="font-size:11px;color:#64748b;margin-top:4px">${co.escenarioInflacionExpl || ''}</div>
  </div>
  <div class="box">
    <div class="label">Recesión</div>
    ${escBadge(co.escenarioRecesion)}
    <div style="font-size:11px;color:#64748b;margin-top:4px">${co.escenarioRecesionExpl || ''}</div>
  </div>
  <div class="box">
    <div class="label">Predictibilidad</div>
    <div style="font-weight:800;color:#1d4ed8;font-size:14px;margin-top:4px">${co.predictibilidad || '—'}</div>
  </div>
</div>

${co.fortalezas?.length ? `<h2>✅ Fortalezas</h2><ul>${co.fortalezas.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
${co.debilidades?.length ? `<h2>⚠️ Debilidades</h2><ul>${co.debilidades.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
${co.redFlag && co.redFlag !== 'Ninguna' ? `<h2>🚨 Red Flags</h2><div class="warn">${co.redFlag}</div>` : ''}

<h2>📝 Resumen Ejecutivo</h2>
<div class="info">${co.notas || '—'}</div>

${co.analisisCompleto ? `<h2>📄 Análisis Completo</h2><div class="analysis">${co.analisisCompleto}</div>` : ''}

<div class="footer">
  Análisis generado con Claude Sonnet 4.6 · Datos: Koyfin · Fecha: ${co.fecha || new Date().toISOString().slice(0,10)}
</div>
</body>
</html>`
}

function PDFButton({ co }) {
  const exportPDF = (e) => {
    e.stopPropagation()
    const html = generatePDFHtml(co)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }
  return (
    <button onClick={exportPDF}
      style={{
        background: '#fef2f2', border: '1px solid #fca5a5',
        color: '#dc2626', borderRadius: 8, padding: '6px 12px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
      }}>
      📄 Exportar PDF
    </button>
  )
}

function generateMarkdown(co) {
  const cl = getClasif(co.clasificacion)
  const line = '═══════════════════════════════════════════════════════════════════════════════'
  return `${line}
ANÁLISIS DE INVERSIÓN - CARTERA A LARGO PLAZO
Fecha: ${co.fecha || new Date().toISOString().slice(0,10)} | Datos: Koyfin
${line}

TICKER: ${co.ticker} (${co.pais})

${line}
📊 DATOS GENERALES
${line}

├─ Empresa: ${co.nombre}
├─ Sector: ${co.sector}
├─ País: ${co.pais}
├─ Market Cap: ${co.marketCap || '—'}
├─ Clasificación: ${cl.label} (Score: ${co.score}/100)
└─ Modelo negocio: ${co.assetLight ? 'ASSET-LIGHT ✓' : 'ASSET-HEAVY'}

${line}
🏢 DESCRIPCIÓN DEL NEGOCIO
${line}

${co.descripcionNegocio || '—'}

${line}
💰 MÉTRICAS FINANCIERAS (LTM)
${line}

├─ Margen Neto:        ${co.margenNeto}%  ${parseFloat(co.margenNeto) >= 20 ? '✓✓' : '✗'}
├─ ROIC:               ${co.roic}%  ${parseFloat(co.roic) >= 12 ? '✓✓' : '✗'}
├─ Crecimiento CAGR:   ${co.crecimientoCAGR}%  ${parseFloat(co.crecimientoCAGR) >= 10 ? '✓✓' : '✗'}
├─ FCF Margin:         ${co.fcfMargin || '—'}%
├─ Deuda/EBITDA:       ${co.deudaEbitda}x  ${parseFloat(co.deudaEbitda) <= 2 ? '✓' : '✗'}
├─ Capex/Revenues:     ${co.capexPct || '—'}%
├─ P/E Trailing:       ${co.pe}x
├─ P/E Forward:        ${co.peForward}x
├─ Tendencia márgenes: ${co.tendenciaMargenes || '—'}
└─ Tendencia deuda:    ${co.deudaTendencia || '—'}

${line}
🛡️ MOAT & VENTAJA COMPETITIVA
${line}

├─ Tipo moat:          ${co.moat?.toUpperCase()}
├─ Descripción:        ${co.tipoMoat || '—'}
└─ Criterios PILAR:    ${co.criteriosOk || '—'}/7

${line}
🌍 ESCENARIOS ECONÓMICOS
${line}

INFLACIÓN ALTA: ${co.escenarioInflacion || '—'}
└─ ${co.escenarioInflacionExpl || '—'}

RECESIÓN: ${co.escenarioRecesion || '—'}
└─ ${co.escenarioRecesionExpl || '—'}

PREDICTIBILIDAD INGRESOS: ${co.predictibilidad || '—'}

${line}
✅ FORTALEZAS
${line}

${co.fortalezas?.map(f => `├─ ${f}`).join('\n') || '—'}

${line}
⚠️ DEBILIDADES & RED FLAGS
${line}

DEBILIDADES:
${co.debilidades?.map(d => `├─ ${d}`).join('\n') || '—'}

RED FLAGS A VIGILAR:
└─ ${co.redFlag || 'Ninguna'}

${line}
🎯 CHECKLIST CRITERIOS PILAR (${co.criteriosOk || '?'}/7)
${line}

☑ Margen neto >20%:     ${parseFloat(co.margenNeto) >= 20 ? 'CUMPLE ✓' : 'NO CUMPLE ✗'}
☑ ROIC >12%:            ${parseFloat(co.roic) >= 12 ? 'CUMPLE ✓' : 'NO CUMPLE ✗'}
☑ Crecimiento >10%:     ${parseFloat(co.crecimientoCAGR) >= 10 ? 'CUMPLE ✓' : 'NO CUMPLE ✗'}
☑ Moat PERMANENTE:      ${co.moat === 'permanente' ? 'CUMPLE ✓' : 'NO CUMPLE ✗'}
☑ Presencia global:     —
☑ Directiva calidad:    —
☑ Market share >20%:    —

${line}
📝 RESUMEN EJECUTIVO
${line}

CLASIFICACIÓN: ${cl.label} (Score ${co.score}/100)
ACCIÓN: ${ACCION_LABEL[co.accion] || co.accion}
ALOCACIÓN SUGERIDA: ${co.alocacion || '—'}% de cartera

${co.notas || '—'}

${line}
📄 ANÁLISIS COMPLETO
${line}

${co.analisisCompleto || '—'}

${line}

DATOS FUENTE: Koyfin + Claude Sonnet 4.6
FECHA ANÁLISIS: ${co.fecha || '—'}
ARCHIVO: ${co.ticker}-${co.nombre.replace(/\s+/g,'_').toUpperCase()}_ANALISIS_${co.fecha || new Date().toISOString().slice(0,10)}.md
`
}

function DownloadButton({ co }) {
  const download = (e) => {
    e.stopPropagation()
    const content = generateMarkdown(co)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${co.ticker}-ANALISIS-${co.fecha || new Date().toISOString().slice(0,10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  return (
    <button onClick={download}
      style={{
        background: '#f0fdf4', border: '1px solid #86efac',
        color: '#15803d', borderRadius: 8, padding: '6px 12px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
      }}>
      ⬇️ Descargar .md
    </button>
  )
}

function generateClaudeText(co) {
  const cl = getClasif(co.clasificacion)
  return `ANÁLISIS EMPRESA — ${co.nombre} (${co.ticker})
Score: ${co.score}/100 | ${cl.label}
Fecha análisis: ${co.fecha || '—'}

MÉTRICAS FINANCIERAS:
• Margen Neto: ${co.margenNeto}%
• ROIC: ${co.roic}%
• Crecimiento CAGR 5Y: ${co.crecimientoCAGR}%
• Deuda/EBITDA: ${co.deudaEbitda}x
• FCF Margin: ${co.fcfMargin || '—'}%
• P/E Trailing: ${co.pe}x | P/E Forward: ${co.peForward}x
• Market Cap: ${co.marketCap || '—'}
• Capex/Revenues: ${co.capexPct || '—'}%

CALIDAD:
• Moat: ${co.moat} — ${co.tipoMoat || '—'}
• Tendencia márgenes: ${co.tendenciaMargenes || '—'}
• Tendencia deuda: ${co.deudaTendencia || '—'}
• Asset-light: ${co.assetLight ? 'Sí' : 'No'}
• Criterios PILAR: ${co.criteriosOk || '—'}/7

ACCIÓN RECOMENDADA: ${ACCION_LABEL[co.accion] || co.accion}
Alocación sugerida: ${co.alocacion || '—'}% de cartera

ESCENARIOS ECONÓMICOS:
• Inflación alta: ${co.escenarioInflacion || '—'} — ${co.escenarioInflacionExpl || ''}
• Recesión: ${co.escenarioRecesion || '—'} — ${co.escenarioRecesionExpl || ''}
• Predictibilidad ingresos: ${co.predictibilidad || '—'}

FORTALEZAS:
${co.fortalezas?.map(f => `• ${f}`).join('\n') || '—'}

DEBILIDADES:
${co.debilidades?.map(d => `• ${d}`).join('\n') || '—'}

RED FLAGS A VIGILAR:
${co.redFlag || 'Ninguna'}

DESCRIPCIÓN DEL NEGOCIO:
${co.descripcionNegocio || '—'}

NOTAS / RESUMEN EJECUTIVO:
${co.notas || '—'}

ANÁLISIS COMPLETO:
${co.analisisCompleto || '—'}

─────────────────────────────────────
Quiero profundizar en: [escribe aquí tu pregunta]`
}

function CopyButton({ co }) {
  const [copied, setCopied] = useState(false)
  const copy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(generateClaudeText(co))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('No se pudo copiar. Prueba desde Chrome/Safari.')
    }
  }
  return (
    <button onClick={copy}
      style={{
        background: copied ? '#f0fdf4' : '#eff6ff',
        border: `1px solid ${copied ? '#86efac' : '#93c5fd'}`,
        color: copied ? '#15803d' : '#1d4ed8',
        borderRadius: 8, padding: '6px 12px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}>
      {copied ? '✅ Copiado!' : '📋 Copiar para Claude'}
    </button>
  )
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── COMPONENTES PEQUEÑOS ──────────────────────────────────────────────────────

function Ring({ score, clasificId, size = 90 }) {
  const cl = getClasif(clasificId)
  const r = size * 0.38, circ = 2 * Math.PI * r
  const dash = Math.min(Math.max(score, 0), 100) / 100 * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size*0.09}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cl.color} strokeWidth={size*0.09}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.4s ease' }}/>
      <text x={size/2} y={size/2 - size*0.04} textAnchor="middle"
        fontSize={size*0.22} fontWeight="900" fill={cl.color}>{score}</text>
      <text x={size/2} y={size/2 + size*0.13} textAnchor="middle"
        fontSize={size*0.09} fill="#94a3b8">/100</text>
    </svg>
  )
}

function Pill({ label, value, good, neutral }) {
  const color = good === true ? '#15803d' : good === false && !neutral ? '#dc2626' : '#475569'
  return (
    <div style={{ textAlign: 'center', minWidth: 54 }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 1 }}>{value}</div>
    </div>
  )
}

function Badge({ cl, small }) {
  return (
    <span style={{
      background: cl.bg, border: `1px solid ${cl.border}`, color: cl.color,
      borderRadius: 20, padding: small ? '2px 8px' : '3px 10px',
      fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap'
    }}>{cl.dot} {cl.label}</span>
  )
}

function MoatBadge({ moat }) {
  const styles = {
    permanente: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', label: '✓ Permanente' },
    duradero:   { bg: '#fffbeb', border: '#fcd34d', color: '#b45309', label: '~ Duradero' },
    temporal:   { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', label: '✗ Temporal' },
    ninguno:    { bg: '#f8fafc', border: '#cbd5e1', color: '#64748b', label: '— Sin moat' },
  }
  const s = styles[moat] || styles.ninguno
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
                  padding: '3px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Moat</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginTop: 1 }}>{s.label}</div>
    </div>
  )
}

// ─── CARD DE EMPRESA ──────────────────────────────────────────────────────────

function CompanyCard({ co, expanded, onToggle, onDelete }) {
  const cl = getClasif(co.clasificacion)
  const isOpen = expanded

  return (
    <div style={{
      background: 'white', borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${isOpen ? cl.border : '#e2e8f0'}`,
      boxShadow: isOpen ? `0 0 0 2px ${cl.border}` : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 0.15s'
    }}>
      {/* ROW PRINCIPAL */}
      <div onClick={onToggle} style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center',
        gap: 12, cursor: 'pointer', flexWrap: 'wrap'
      }}>
        <Ring score={+co.score || 0} clasificId={co.clasificacion}/>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 15 }}>{co.nombre}</span>
            <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>{co.ticker}</span>
            <Badge cl={cl} small/>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{co.pais} · {co.sector}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label="Margen" value={`${co.margenNeto}%`} good={parseFloat(co.margenNeto) >= 20}/>
          <Pill label="ROIC"   value={`${co.roic}%`}        good={parseFloat(co.roic) >= 12}/>
          <Pill label="CAGR"   value={`${co.crecimientoCAGR}%`} good={parseFloat(co.crecimientoCAGR) >= 10}/>
          <Pill label="D/EBITDA" value={`${co.deudaEbitda}x`} good={parseFloat(co.deudaEbitda) <= 2}/>
          <Pill label="P/E fwd"  value={`${co.peForward}x`} neutral/>
          <MoatBadge moat={co.moat}/>
          {co.accion && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0',
                          borderRadius: 8, padding: '3px 10px',
                          fontSize: 11, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
              {ACCION_LABEL[co.accion] || co.accion}
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar empresa?')) onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, opacity: 0.5 }}>🗑️</button>
          <span style={{ color: '#cbd5e1', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* DETALLE EXPANDIDO */}
      {isOpen && (
        <div style={{ background: '#fafafa', padding: 16, borderTop: `1px solid ${cl.border}` }}>
          {/* Fila 1: métricas + moat + escenarios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 12 }}>
            <div>
              <SectionTitle>📊 Financieras</SectionTitle>
              {[
                ['Margen Neto', `${co.margenNeto}%`, parseFloat(co.margenNeto) >= 20],
                ['ROIC',        `${co.roic}%`,        parseFloat(co.roic) >= 12],
                ['Crec. CAGR',  `${co.crecimientoCAGR}%`, parseFloat(co.crecimientoCAGR) >= 10],
                ['D/EBITDA',    `${co.deudaEbitda}x`,  parseFloat(co.deudaEbitda) <= 2],
                ['FCF Margin',  `${co.fcfMargin}%`,    parseFloat(co.fcfMargin) >= 20],
                ['P/E Trailing',`${co.pe}x`, null],
                ['P/E Forward', `${co.peForward}x`, null],
                ['Market Cap',  co.marketCap || '—', null],
              ].map(([l, v, ok]) => (
                <KV key={l} label={l} value={v} ok={ok}/>
              ))}
            </div>
            <div>
              <SectionTitle>🛡️ Calidad</SectionTitle>
              {[
                ['Tipo Moat', co.tipoMoat || co.moat],
                ['Márgenes', co.tendenciaMargenes || '—'],
                ['Deuda tendencia', co.deudaTendencia || '—'],
                ['Asset-light', co.assetLight ? '✓ Sí' : '✗ No'],
                ['Criterios PILAR', `${co.criteriosOk || '?'}/7`],
                ['Alocación', co.alocacion ? `${co.alocacion}% cartera` : '—'],
                ['Fecha análisis', co.fecha || '—'],
              ].map(([l, v]) => <KV key={l} label={l} value={v}/>)}
            </div>
            <div>
              <SectionTitle>🌍 Escenarios</SectionTitle>
              {co.escenarioInflacion && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>INFLACIÓN ALTA</div>
                  <EscenarioBadge val={co.escenarioInflacion}/>
                  {co.escenarioInflacionExpl && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{co.escenarioInflacionExpl}</div>
                  )}
                </div>
              )}
              {co.escenarioRecesion && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>RECESIÓN</div>
                  <EscenarioBadge val={co.escenarioRecesion}/>
                  {co.escenarioRecesionExpl && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{co.escenarioRecesionExpl}</div>
                  )}
                </div>
              )}
              {co.predictibilidad && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>PREDICTIBILIDAD</div>
                  <PredBadge val={co.predictibilidad}/>
                </div>
              )}
            </div>
          </div>

          {/* Descripción negocio */}
          {co.descripcionNegocio && (
            <InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="🏢">
              {co.descripcionNegocio}
            </InfoBox>
          )}

          {/* Fortalezas / Debilidades */}
          {(co.fortalezas || co.debilidades) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              {co.fortalezas?.length > 0 && (
                <InfoBox color="#15803d" bg="#f0fdf4" border="#86efac" icon="✅" title="Fortalezas">
                  <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                    {co.fortalezas.map((f, i) => <li key={i} style={{ fontSize: 11, marginBottom: 3 }}>{f}</li>)}
                  </ul>
                </InfoBox>
              )}
              {co.debilidades?.length > 0 && (
                <InfoBox color="#dc2626" bg="#fef2f2" border="#fca5a5" icon="⚠️" title="Debilidades">
                  <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                    {co.debilidades.map((d, i) => <li key={i} style={{ fontSize: 11, marginBottom: 3 }}>{d}</li>)}
                  </ul>
                </InfoBox>
              )}
            </div>
          )}

          {/* Red flags */}
          {co.redFlag && co.redFlag !== 'Ninguna' && (
            <InfoBox color="#dc2626" bg="#fef2f2" border="#fca5a5" icon="🚨" style={{ marginTop: 10 }}>
              {co.redFlag}
            </InfoBox>
          )}

          {/* Notas resumen */}
          {co.notas && (
            <InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="📝" style={{ marginTop: 10 }}>
              {co.notas}
            </InfoBox>
          )}

          {/* Análisis completo */}
          {co.analisisCompleto && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700,
                               color: '#475569', userSelect: 'none', padding: '6px 0' }}>
                📄 Análisis completo (expandir)
              </summary>
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#f8fafc',
                           border: '1px solid #e2e8f0', borderRadius: 8,
                           fontSize: 12, color: '#334155', lineHeight: 1.65,
                           whiteSpace: 'pre-wrap' }}>
                {co.analisisCompleto}
              </div>
            </details>
          )}
          {/* Copiar para Claude + Descargar + PDF */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <CopyButton co={co}/>
            <DownloadButton co={co}/>
            <PDFButton co={co}/>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Copia · Descarga .md · Exporta PDF
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 8 }}>{children}</div>
  )
}

function KV({ label, value, ok }) {
  const color = ok === true ? '#15803d' : ok === false ? '#dc2626' : '#1e293b'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  color: '#475569', marginBottom: 4 }}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function EscenarioBadge({ val }) {
  const s = ESCENARIO_STYLE[val] || ESCENARIO_STYLE.NEUTRAL
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 12,
                   padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function PredBadge({ val }) {
  const s = PRED_STYLE[val] || {}
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 12,
                   padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {val?.replace('_', ' ')}
    </span>
  )
}

function InfoBox({ color, bg, border, icon, title, children, style = {} }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8,
                  padding: '8px 12px', fontSize: 12, color, lineHeight: 1.55, ...style }}>
      {title && <strong style={{ display: 'block', marginBottom: 4 }}>{icon} {title}</strong>}
      {!title && icon && <span>{icon} </span>}
      {children}
    </div>
  )
}

// ─── DROPZONE DE IMÁGENES ─────────────────────────────────────────────────────

function ImageDropzone({ images, setImages }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const addFiles = (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => {
      const combined = [...prev, ...imgs].slice(0, 6)
      return combined
    })
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <div>
      {/* Zona drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#3b82f6' : '#93c5fd'}`,
          borderRadius: 12, padding: '24px 20px', textAlign: 'center',
          cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.15s', marginBottom: 16
        }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          Arrastra aquí los 6 screenshots de Koyfin
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          o haz click para seleccionarlos · {images.length}/6 cargados
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple
          style={{ display: 'none' }} onChange={e => addFiles(e.target.files)}/>
      </div>

      {/* Lista de screenshots esperados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {SCREENSHOTS_INFO.map(({ n, label, hint }) => {
          const img = images[n - 1]
          return (
            <div key={n} style={{
              border: `1px solid ${img ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 10, padding: 10, background: img ? '#f0fdf4' : 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{img ? '✅' : `${n}️⃣`}</span>
                <strong style={{ fontSize: 12, color: '#1e293b' }}>{label}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{hint}</div>
              {img && (
                <div style={{ fontSize: 11, color: '#15803d', marginTop: 4, fontWeight: 600 }}>
                  ✓ {img.name?.slice(0, 25) || 'Cargado'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {images.length > 0 && (
        <button onClick={() => setImages([])}
          style={{ marginTop: 10, background: 'none', border: '1px solid #fca5a5',
                   borderRadius: 8, padding: '6px 14px', color: '#dc2626',
                   fontSize: 12, cursor: 'pointer' }}>
          🗑️ Limpiar imágenes
        </button>
      )}
    </div>
  )
}

// ─── RESULTADO DEL ANÁLISIS ───────────────────────────────────────────────────

function AnalysisResult({ result, onSave, onBack }) {
  const cl = getClasif(result.clasificacion)
  return (
    <div>
      <div style={{ background: cl.bg, border: `2px solid ${cl.border}`,
                    borderRadius: 14, padding: 20, marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring score={+result.score || 0} clasificId={result.clasificacion} size={100}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 4 }}>
            {result.nombre}
            <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
              {result.ticker}
            </span>
          </div>
          <Badge cl={cl}/>
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            {result.pais} · {result.sector} · {result.marketCap}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: cl.color, fontWeight: 700 }}>
            {ACCION_LABEL[result.accion] || result.accion} · {result.alocacion}% cartera
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { l: 'Margen Neto', v: `${result.margenNeto}%`, ok: parseFloat(result.margenNeto) >= 20 },
          { l: 'ROIC',        v: `${result.roic}%`,        ok: parseFloat(result.roic) >= 12 },
          { l: 'CAGR 5Y',     v: `${result.crecimientoCAGR}%`, ok: parseFloat(result.crecimientoCAGR) >= 10 },
          { l: 'D/EBITDA',    v: `${result.deudaEbitda}x`,  ok: parseFloat(result.deudaEbitda) <= 2 },
          { l: 'FCF Margin',  v: `${result.fcfMargin}%`,    ok: parseFloat(result.fcfMargin) >= 20 },
          { l: 'P/E Forward', v: `${result.peForward}x`,    ok: null },
        ].map(({ l, v, ok }) => (
          <div key={l} style={{ background: 'white', border: '1px solid #e2e8f0',
                                borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 800,
                          color: ok === true ? '#15803d' : ok === false ? '#dc2626' : '#475569' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Descripción */}
      {result.descripcionNegocio && (
        <InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="🏢" style={{ marginBottom: 10 }}>
          {result.descripcionNegocio}
        </InfoBox>
      )}

      {/* Escenarios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { l: '📈 Inflación', v: result.escenarioInflacion, expl: result.escenarioInflacionExpl },
          { l: '📉 Recesión',  v: result.escenarioRecesion,  expl: result.escenarioRecesionExpl },
          { l: '🔮 Predictibilidad', v: null, pred: result.predictibilidad },
        ].map(({ l, v, expl, pred }) => (
          <div key={l} style={{ background: 'white', border: '1px solid #e2e8f0',
                                borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>{l}</div>
            {v && <EscenarioBadge val={v}/>}
            {pred && <PredBadge val={pred}/>}
            {expl && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{expl}</div>}
          </div>
        ))}
      </div>

      {/* Notas */}
      {result.notas && (
        <InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="📝" style={{ marginBottom: 10 }}>
          {result.notas}
        </InfoBox>
      )}

      {/* Análisis completo */}
      {result.analisisCompleto && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569',
                           padding: '6px 0', userSelect: 'none' }}>
            📄 Análisis completo (expandir)
          </summary>
          <div style={{ marginTop: 8, padding: '12px 16px', background: '#f8fafc',
                       border: '1px solid #e2e8f0', borderRadius: 8,
                       fontSize: 13, color: '#334155', lineHeight: 1.7,
                       whiteSpace: 'pre-wrap' }}>
            {result.analisisCompleto}
          </div>
        </details>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onSave}
          style={{ flex: 1, background: '#15803d', color: 'white', border: 'none',
                   borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 700,
                   cursor: 'pointer' }}>
          ✅ Guardar en Mi Cartera
        </button>
        <CopyButton co={result}/>
        <DownloadButton co={result}/>
        <PDFButton co={result}/>
        <button onClick={onBack}
          style={{ padding: '14px 20px', background: 'white', border: '1px solid #e2e8f0',
                   borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
          ← Volver
        </button>
      </div>
    </div>
  )
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

export default function App() {
  const [portfolio, setPortfolio] = useState([])
  const [tab, setTab] = useState('cartera')
  const [expanded, setExpanded] = useState(null)
  const [filterGrupo, setFilterGrupo] = useState('TODOS')
  const [filterClasif, setFilterClasif] = useState('TODAS')

  // Analizar tab
  const [images, setImages] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [saved, setSaved] = useState(false)

  // ── Cargar cartera ──
  useEffect(() => {
    const existing = loadPortfolio()
    if (existing) {
      const ids = new Set(existing.map(p => p.id))
      const toAdd = SEED.filter(s => !ids.has(s.id))
      const merged = [...existing, ...toAdd]
      setPortfolio(merged)
      persistPortfolio(merged)
    } else {
      setPortfolio(SEED)
      persistPortfolio(SEED)
    }
  }, [])

  const saveCompany = useCallback((co) => {
    setPortfolio(prev => {
      const next = prev.filter(p => p.id !== co.id).concat(co)
      persistPortfolio(next)
      return next
    })
  }, [])

  const deleteCompany = useCallback((id) => {
    setPortfolio(prev => {
      const next = prev.filter(p => p.id !== id)
      persistPortfolio(next)
      return next
    })
  }, [])

  // ── Análisis con Claude ──
  const runAnalysis = async () => {
    if (images.length === 0) { setAnalyzeError('Sube al menos 1 screenshot de Koyfin'); return }
    setAnalyzing(true); setAnalyzeError(null); setAnalysisResult(null)
    try {
      const imageData = await Promise.all(images.map(async (f) => ({
        data: await fileToBase64(f),
        mediaType: f.type || 'image/png'
      })))

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageData })
      })

      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error en el análisis')
      setAnalysisResult(json.result)
    } catch (e) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const saveResult = () => {
    if (!analysisResult) return
    const co = {
      ...analysisResult,
      id: `${analysisResult.ticker?.toLowerCase()}-${Date.now()}`,
      fecha: new Date().toISOString().slice(0, 10)
    }
    saveCompany(co)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setTab('cartera')
    setImages([])
    setAnalysisResult(null)
  }

  // ── Stats ──
  const pilares       = portfolio.filter(c => getClasif(c.clasificacion).grupo === 'PILARES')
  const complementarias = portfolio.filter(c => getClasif(c.clasificacion).grupo === 'COMPLEMENTARIAS')
  const avgScore      = portfolio.length
    ? Math.round(portfolio.reduce((s, c) => s + (+c.score || 0), 0) / portfolio.length)
    : 0

  // ── Filtrado ──
  const filtered = portfolio.filter(c => {
    if (filterGrupo !== 'TODOS' && getClasif(c.clasificacion).grupo !== filterGrupo) return false
    if (filterClasif !== 'TODAS' && c.clasificacion !== filterClasif) return false
    return true
  }).sort((a, b) => (+b.score || 0) - (+a.score || 0))

  const byGrupo = {}
  GRUPOS.forEach(g => {
    const items = filtered.filter(c => getClasif(c.clasificacion).grupo === g)
    if (items.length) byGrupo[g] = items
  })

  // ── Render ──
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8',
                  fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: '#0f2246', color: 'white', padding: '14px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Quality Compounders
            </div>
            <div style={{ fontSize: 11, color: '#7eb3e8', marginTop: 1 }}>
              Cartera Largo Plazo · Análisis con Claude AI
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Empresas', value: portfolio.length, color: 'white' },
              { label: 'Pilares',  value: pilares.length,   color: '#86efac' },
              { label: 'Score medio', value: avgScore,       color: '#93c5fd' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#7eb3e8' }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          {[
            { id: 'cartera', label: `💼 Mi Cartera (${portfolio.length})` },
            { id: 'analizar', label: '🔍 Analizar con Claude' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setAnalysisResult(null); setImages([]) }}
              style={{
                padding: '13px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                color: tab === t.id ? '#3b82f6' : '#64748b',
                transition: 'all 0.15s'
              }}>
              {t.label}
            </button>
          ))}
          {saved && (
            <div style={{ marginLeft: 'auto', marginRight: 16, background: '#f0fdf4',
                          border: '1px solid #86efac', color: '#15803d',
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              ✅ Guardado en cartera
            </div>
          )}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* ═══ TAB: MI CARTERA ═══ */}
        {tab === 'cartera' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
              {[
                { label: '🏆 Pilares',         value: pilares.length,          sub: 'PURO + CÍCLICO',  color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                { label: '📋 Complementarias', value: complementarias.length,   sub: 'Fuerte/Media/Débil', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
                { label: '⭐ Score Medio',      value: avgScore,                sub: 'Todas las empresas', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
                { label: '📊 Total Analizadas', value: portfolio.length,        sub: 'En cartera',      color: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
              ].map(({ label, value, sub, color, bg, border }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`,
                                         borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>GRUPO:</span>
              {['TODOS', ...GRUPOS].map(g => (
                <button key={g} onClick={() => setFilterGrupo(g)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    border: filterGrupo === g ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    background: filterGrupo === g ? '#eff6ff' : 'white',
                    color: filterGrupo === g ? '#1d4ed8' : '#64748b'
                  }}>
                  {g === 'TODOS' ? `Todos (${portfolio.length})` : `${GRUPO_META[g]?.icon} ${g} (${portfolio.filter(c => getClasif(c.clasificacion).grupo === g).length})`}
                </button>
              ))}
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginLeft: 8 }}>CLASE:</span>
              <select value={filterClasif} onChange={e => setFilterClasif(e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px',
                         fontSize: 12, background: 'white', color: '#475569' }}>
                <option value="TODAS">Todas</option>
                {CLASIFICACIONES.map(c => (
                  <option key={c.id} value={c.id}>{c.dot} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Lista por grupos */}
            {Object.keys(byGrupo).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div>No hay empresas con ese filtro</div>
              </div>
            ) : (
              GRUPOS.map(grupo => {
                const items = byGrupo[grupo]
                if (!items) return null
                const gm = GRUPO_META[grupo]
                return (
                  <div key={grupo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ background: gm.bg, border: `1px solid ${gm.border}`,
                                    borderRadius: 8, padding: '3px 12px',
                                    color: gm.color, fontWeight: 800, fontSize: 12 }}>
                        {gm.icon} {grupo}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {items.length} empresa{items.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {items.map(co => (
                        <CompanyCard
                          key={co.id} co={co}
                          expanded={expanded === co.id}
                          onToggle={() => setExpanded(expanded === co.id ? null : co.id)}
                          onDelete={() => deleteCompany(co.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            )}

            <button onClick={() => setTab('analizar')}
              style={{ width: '100%', border: '2px dashed #93c5fd', background: 'transparent',
                       color: '#3b82f6', borderRadius: 12, padding: 14, fontSize: 13,
                       cursor: 'pointer', fontWeight: 600 }}>
              🔍 Analizar nueva empresa con Claude
            </button>
          </div>
        )}

        {/* ═══ TAB: ANALIZAR ═══ */}
        {tab === 'analizar' && (
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {!analysisResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0',
                              borderRadius: 14, padding: 20 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                    🔍 Analizar empresa con Claude
                  </h2>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Sube hasta 6 screenshots de Koyfin. Claude analizará la empresa y la guardará en tu cartera automáticamente.
                  </p>
                  <ImageDropzone images={images} setImages={setImages}/>
                </div>

                {analyzeError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5',
                                borderRadius: 10, padding: 12, color: '#dc2626', fontSize: 13 }}>
                    ❌ {analyzeError}
                  </div>
                )}

                <button
                  onClick={runAnalysis}
                  disabled={analyzing || images.length === 0}
                  style={{
                    width: '100%', background: analyzing ? '#94a3b8' : '#0f2246',
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '16px', fontSize: 15, fontWeight: 700,
                    cursor: analyzing || images.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: images.length === 0 ? 0.5 : 1
                  }}>
                  {analyzing
                    ? '⏳ Analizando con Claude Sonnet 4.6… (30-60 segundos)'
                    : `🚀 Analizar ${images.length > 0 ? `${images.length} imagen${images.length > 1 ? 'es' : ''}` : 'empresa'} con Claude`
                  }
                </button>

                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d',
                              borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#b45309' }}>
                  <strong>💡 Tip:</strong> Para mejores resultados sube los 6 screenshots (Income Statement, Balance Sheet, Cash Flow, Returns, Actuals & Consensus Income, Actuals & Consensus Balance/CF). Con menos imágenes el análisis tendrá menos datos.
                </div>
              </div>
            ) : (
              <AnalysisResult
                result={analysisResult}
                onSave={saveResult}
                onBack={() => { setAnalysisResult(null) }}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        button:focus { outline: none; }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  )
}
