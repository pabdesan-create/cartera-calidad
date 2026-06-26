import { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ═══════════════════════════════════════════════════════════════
// ANALYSIS PROMPT (llamada directa a Anthropic, sin proxy Vercel)
// ═══════════════════════════════════════════════════════════════
const ANALYSIS_PROMPT=`Eres un analista de inversiones experto. Se te proporcionan 3 screenshots de Koyfin:
- Screenshot 1: Actuals & Consensus superior (Income Statement + Balance Sheet + Cash Flow)
- Screenshot 2: Actuals & Consensus inferior (Per Share Data + Margins & Ratios + Growth Rates)
- Screenshot 3: Returns (ROC, ROIC, ROE, Dividend Yield LTM/NTM, Buyback Yield, Shares Outstanding)

══════════════════════════════════════════════
REGLA 0 — FORMATO DE VALORES NUMÉRICOS (CRÍTICO)
══════════════════════════════════════════════
TODOS los valores numéricos en el JSON deben seguir estas normas:
- CAGR y porcentajes: devolver como NÚMERO PORCENTUAL, NO como decimal. CORRECTO: 17.8 INCORRECTO: 0.178
- Márgenes: devolver solo el número. CORRECTO: "26.03" INCORRECTO: "26.03%" INCORRECTO: "~26%"
- Ratios y valores monetarios: solo el número sin texto adicional
- NUNCA incluir descripción de años o texto en campos numéricos. CORRECTO: "10.5" INCORRECTO: "~10.5% (Revenue CAGR 2016-2024)"
- dcf_cagr_bn y dcf_cagr_fcf: SIEMPRE como porcentaje. Si calculas (14453/7444)^(1/5)-1 = 0.141 → devuelve 14.1 no 0.141
PASO OBLIGATORIO antes de leer cualquier valor:
1. Lee la fila "Report Date" de DERECHA a IZQUIERDA
2. Encuentra la primera celda que tiene una fecha real (ej: Feb-19-2026, Jan-29-2026)
3. Las celdas con GUIÓN (-) son estimaciones → ignorar para año base
4. Esa columna con fecha real más reciente = AÑO BASE
5. Los valores de dcf_bn_base y dcf_fcf_base DEBEN venir de esa columna, no de la anterior

VERIFICACIÓN: Si dcf_bn_year dice "CY2025A", entonces dcf_bn_base debe ser el valor de Net Income de la columna CY2025A, no de CY2024A.
AÑO INICIO = primera columna visible con datos.

══════════════════════════════════════════════
REGLA 2 — CAGR HISTÓRICO
══════════════════════════════════════════════
Calcular desde AÑO INICIO hasta AÑO BASE usando todos los años disponibles.
Fórmula: (valor_base / valor_inicio)^(1/N) - 1 donde N = años entre ambos.
NUNCA uses solo 5 años si hay más datos disponibles.

══════════════════════════════════════════════
REGLA 3 — CAGR FORWARD para DCF (máx 5 años E)
══════════════════════════════════════════════
- Tomar máximo 5 columnas con guión (-) en Report Date desde el año base
- Si hay 6+ columnas E → ignorar la 6ª y posteriores
- Fórmula: (valor_5E / valor_base)^(1/5) - 1
- Si FCF es negativo en CUALQUIER año E → dcf_cagr_fcf = 0
- Si FCF CAGR resultante es negativo (FCF forward < FCF base) → dcf_cagr_fcf = 0
- dcf_bn_base y dcf_fcf_base = valores del AÑO BASE (no de estimaciones)

══════════════════════════════════════════════
REGLA 4 — DIVIDENDOS DGI
══════════════════════════════════════════════
- CAGR DPS: desde primer DPS > 0 disponible hasta DPS del AÑO BASE
- RACHA: años consecutivos con DPS mayor que el año anterior (hasta AÑO BASE)
- Si empresa empezó dividendo recientemente, racha = años pagando con incremento
- PAYOUT FCF = (DPS_base × shares) / FCF_base × 100
- PAYOUT EPS = DPS_base / EPS_ajustado_base × 100

══════════════════════════════════════════════
CRITERIOS QUALITY (7/7=PILAR_PURO)
══════════════════════════════════════════════
1)MargenNeto>20% 2)ROIC>12% 3)CAGR historico>10% 4)MarketShare>20% 5)MoatPermanente 6)Presencia global 7)Directiva calidad
CLASIFICACIONES: PILAR_PURO=90-100, PILAR_CICLICO=75-89, COMPLEMENTARIA_FUERTE=60-74, COMPLEMENTARIA_MEDIA=40-59, COMPLEMENTARIA_DEBIL=30-39, DESCARTADA<30

══════════════════════════════════════════════
DGI SCORING (max 90 = A+B+C)
══════════════════════════════════════════════
A(35)=Chowder(yield+cagrDiv >=16->10,>=12->7,>=10->4,<10->0)+cagrDiv(>=15->10,>=10->7,>=7->4,<7->1)+racha(>=25->10,>=15->7,>=10->5,>=7->3,<7->0)+yield(2-3.5->5,(1-2 o 3.5-4.5)->3,resto->1)
B(30)=payFCF(<40->12,<55->9,<70->5,>=70->0)+cagrFCF(>=15->10,>=10->7,>=7->4,<7->1)+payEPS(<40->8,<55->6,<65->3,>=65->0)
C(25)=roic(>=20->4,>=15->3,>=12->2,<12->0)+moatW(amplio->6,estrecho->3)+moatT(monopolio_duopolio->7,red_clientes->6,costes_cambio->5,datos_propietarios->4,escala_marca->2)+deuda(<1.5->5,<2.5->3,<3.5->1,>=3.5->0)+rating(AA->3,A->3,BBB+->2,BBB->1)
DGI: PILAR>=70, COMPLEMENTARIA>=52, VIGILANCIA>=38, DESCARTABLE<38

Devuelve SOLO JSON válido sin backticks ni texto adicional:
{"ticker":"","nombre":"","pais":"","sector":"","marketCap":"","precio":0,"peTrailing":0,"peForward":0,"anioBase":"","anioInicio":"","nAniosHistorico":0,"margenNeto":"","margenEBIT":"","fcfMargin":"","roic":"","roc":"","roe":"","crecimientoCAGR":"","cagrRevenue":"","cagrFCF_historico":"","deudaEbitda":"","capexPct":"","assetLight":true,"sharesOutstanding":0,"sharesTendencia":"BAJANDO","buybackYield":"","tendenciaMargenes":"ESTABLE","deudaTendencia":"BAJANDO","moat":"permanente","tipoMoat":"","criteriosOk":0,"clasificacion":"COMPLEMENTARIA_MEDIA","score":0,"accion":"ESPERAR","alocacion":"","escenarioInflacion":"NEUTRAL","escenarioInflacionExpl":"","escenarioRecesion":"NEUTRAL","escenarioRecesionExpl":"","predictibilidad":"MEDIA","redFlag":"","fortalezas":["","",""],"debilidades":["",""],"descripcionNegocio":"","notas":"","analisisCompleto":"","dcf_bn_base":0,"dcf_fcf_base":0,"dcf_cagr_bn":0,"dcf_cagr_fcf":0,"dcf_bn_year":"","dcf_fcf_year":"","dcf_n_anios_forward":5,"dcf_fcf_note":"","dcf_mktCap":0,"dcf_divisa":"USD","dgi_yieldActual":"","dgi_yieldNTM":"","dgi_cagrDiv":"","dgi_rachaAnios":0,"dgi_aniosPagando":0,"dgi_dpsBase":0,"dgi_payoutEPS":"","dgi_payoutFCF":"","dgi_cagrFCF5Y":"","dgi_cagrBPA5Y":"","dgi_moat":"amplio","dgi_tipoMoat":"ninguna","dgi_deudaEbitda":"","dgi_rating":"","dgi_yieldVsHistorico":"igual","dgi_perVsHistorico":"en_linea","dgi_sensRecesion":"moderada","dgi_sensTipos":"neutral","dgi_notasMacro":"","dgi_notas":"","dgi_scoreA":0,"dgi_scoreB":0,"dgi_scoreC":0,"dgi_scoreTotal":0,"dgi_clasificacion":"VIGILANCIA"}`

// ═══════════════════════════════════════════════════════════════
// DCF ENGINE
// ═══════════════════════════════════════════════════════════════
function dcfFair(base,cagr,mktCap,price){const k=cagr<=0.10?0.09:0.10;const g2=Math.max(cagr/2,0.025);const cf=Array(11).fill(0);cf[1]=base*(1+cagr);for(let i=2;i<=5;i++)cf[i]=cf[i-1]*(1+cagr);for(let i=6;i<=10;i++)cf[i]=cf[i-1]*(1+g2);const tv=cf[10]*1.025/(k-0.025);let s=0;for(let i=1;i<=10;i++)s+=cf[i]/Math.pow(1+k,i);s+=tv/Math.pow(1+k,10);return s*price/mktCap}
function calcRow(f){const bn=parseFloat(f.bn)||0,fcf=parseFloat(f.fcf)||0,cBn=parseFloat(f.cagrBn)||0,cFcf=parseFloat(f.cagrFcf),mc=parseFloat(f.mktCap)||1,p=parseFloat(f.price)||1;const poBn=dcfFair(bn,cBn/100,mc,p);const hasFcf=fcf>0&&f.cagrFcf!==""&&!isNaN(cFcf);const poFcf=hasFcf?dcfFair(fcf,cFcf/100,mc,p):null;const poMed=poFcf!=null?(poBn+poFcf)/2:poBn;const dif=v=>(v-p)/p*100;return{poBn,poFcf,poMed,difBn:dif(poBn),difFcf:poFcf!=null?dif(poFcf):null,difMed:dif(poMed)}}
const f2=n=>n==null?"—":n.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})
const pct=n=>n==null?"—":(n>=0?"+":"")+n.toFixed(1)+"%"
const today=()=>new Date().toLocaleDateString("es-ES")
function mkRow(f){return{ticker:(f.ticker||"").toUpperCase(),bn:parseFloat(f.bn)||0,fcf:parseFloat(f.fcf)||0,cagrBn:parseFloat(f.cagrBn)||0,cagrFcf:f.cagrFcf!==""?parseFloat(f.cagrFcf):null,mktCap:parseFloat(f.mktCap)||0,price:parseFloat(f.price)||0,clasificacion:f.clasificacion||"",note:f.note||"",date:today(),...calcRow(f)}}

// ═══════════════════════════════════════════════════════════════
// DCF CONSTANTS
// ═══════════════════════════════════════════════════════════════
const C={bg:"#0B0F1A",surf:"#121828",brd:"#1E2A3B",acc:"#3B82F6",accD:"#1D3557",gold:"#F59E0B",grn:"#10B981",red:"#EF4444",mut:"#4B5E78",txt:"#E2E8F0",dim:"#8BA3BF"}
const difColor=d=>d==null?C.mut:d>=20?C.grn:d>=0?"#86EFAC":d>=-15?C.gold:C.red
const difBg=d=>d==null?"transparent":d>=0?"#052e16":"#1c0a0a"
const CLASES_DCF=[{value:"",label:"Sin clasificar",bg:"transparent",color:C.mut,border:C.brd},{value:"PILAR",label:"⭐ PILAR",bg:"#1a2e1a",color:C.grn,border:C.grn},{value:"COMPLEMENTARIA",label:"🔵 COMPLEMENTARIA",bg:"#0d1e35",color:C.acc,border:C.acc},{value:"VIGILANCIA",label:"🟡 VIGILANCIA",bg:"#2a1f00",color:C.gold,border:C.gold},{value:"DESCARTADA",label:"🔴 DESCARTADA",bg:"#1c0a0a",color:C.red,border:C.red}]
const claseStyle=val=>CLASES_DCF.find(c=>c.value===val)||CLASES_DCF[0]
const SORT_COLS=[{key:"clasificacion",label:"Clase",get:r=>r.clasificacion||"ZZZ",align:"left"},{key:"ticker",label:"Ticker",get:r=>r.ticker,align:"left"},{key:"price",label:"P. Act.",get:r=>r.price,align:"right"},{key:"cagrBn",label:"CAGR BN",get:r=>r.cagrBn,align:"right"},{key:"cagrFcf",label:"CAGR FCF",get:r=>r.cagrFcf??-Infinity,align:"right"},{key:"poBn",label:"PO BN",get:r=>r.poBn,align:"right"},{key:"poFcf",label:"PO FCF",get:r=>r.poFcf??-Infinity,align:"right"},{key:"poMed",label:"PO Media",get:r=>r.poMed,align:"right"},{key:"difBn",label:"Dif% BN",get:r=>r.difBn,align:"center"},{key:"difFcf",label:"Dif% FCF",get:r=>r.difFcf??-Infinity,align:"center"},{key:"difMed",label:"Dif% Media",get:r=>r.difMed,align:"center",sep:true},{key:"note",label:"Nota",get:r=>r.note,align:"left"}]
const RAW_SEED=[{ticker:"MA",bn:15415,fcf:16433,cagrBn:12.25,cagrFcf:"11.71",mktCap:432770,price:484.09,clasificacion:"PILAR",note:"FCF 3Y"},{ticker:"V",bn:22542,fcf:21577,cagrBn:9.84,cagrFcf:"11.75",mktCap:616490,price:326.60,clasificacion:"PILAR",note:"BN+FCF 5Y"},{ticker:"META",bn:76388,fcf:43585,cagrBn:14.64,cagrFcf:"12.35",mktCap:1465230,price:563.85,clasificacion:"",note:"FCF capex AI"},{ticker:"AMZN",bn:77670,fcf:11194,cagrBn:21.52,cagrFcf:"0",mktCap:2628930,price:232.79,clasificacion:"",note:"FCF neg"},{ticker:"GOOGL",bn:132170,fcf:73266,cagrBn:17.69,cagrFcf:"20.68",mktCap:4487900,price:349.68,clasificacion:"",note:"FCF CAGR>15%"},{ticker:"MSFT",bn:101832,fcf:71611,cagrBn:18.18,cagrFcf:"20.40",mktCap:2818350,price:367.34,clasificacion:"PILAR",note:"FCF CAGR>15%"},{ticker:"BRKB",bn:44486,fcf:25042,cagrBn:1.65,cagrFcf:"",mktCap:1054720,price:488.69,clasificacion:"",note:"Solo BN"},{ticker:"AAPL",bn:112010,fcf:98767,cagrBn:10.89,cagrFcf:"14.21",mktCap:4362290,price:297.01,clasificacion:"COMPLEMENTARIA",note:"BN+FCF 5Y"},{ticker:"TSM",bn:54406,fcf:31752,cagrBn:32.67,cagrFcf:"29.86",mktCap:2054550,price:467.67,clasificacion:"",note:"ADR"},{ticker:"RACE",bn:1600,fcf:1409,cagrBn:6.91,cagrFcf:"8.36",mktCap:53910,price:306.20,clasificacion:"",note:"EUR"},{ticker:"ASML",bn:9393,fcf:11085,cagrBn:19.29,cagrFcf:"14.50",mktCap:637160,price:1655.80,clasificacion:"",note:"EUR"},{ticker:"AXP",bn:10701,fcf:0,cagrBn:8.89,cagrFcf:"",mktCap:230670,price:338.07,clasificacion:"COMPLEMENTARIA",note:"Solo BN"},{ticker:"MCO",bn:2687,fcf:2575,cagrBn:8.61,cagrFcf:"10.20",mktCap:78140,price:447.33,clasificacion:"PILAR",note:"BN+FCF 5Y"},{ticker:"COST",bn:8099,fcf:7807,cagrBn:9.33,cagrFcf:"0.92",mktCap:421940,price:951.35,clasificacion:"COMPLEMENTARIA",note:"FCF 4Y"},{ticker:"RMS",bn:4524,fcf:4213,cagrBn:10.62,cagrFcf:"7.12",mktCap:169950,price:1620.00,clasificacion:"",note:"EUR"}]
const SEED_DCF=RAW_SEED.map(r=>mkRow(r))
const EMPTY_DCF={ticker:"",bn:"",fcf:"",cagrBn:"",cagrFcf:"",mktCap:"",price:"",clasificacion:"",note:""}


// ═══════════════════════════════════════════════════════════════
// QUALITY CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CLASIFICACIONES=[{id:'PILAR_PURO',label:'PILAR PURO',dot:'🟢',color:'#15803d',bg:'#f0fdf4',border:'#86efac',grupo:'PILARES'},{id:'PILAR_CICLICO',label:'PILAR CÍCLICO',dot:'🔵',color:'#1d4ed8',bg:'#eff6ff',border:'#93c5fd',grupo:'PILARES'},{id:'COMPLEMENTARIA_FUERTE',label:'COMPL. FUERTE',dot:'🟡',color:'#b45309',bg:'#fffbeb',border:'#fcd34d',grupo:'COMPLEMENTARIAS'},{id:'COMPLEMENTARIA_MEDIA',label:'COMPL. MEDIA',dot:'🟠',color:'#c2410c',bg:'#fff7ed',border:'#fdba74',grupo:'COMPLEMENTARIAS'},{id:'COMPLEMENTARIA_DEBIL',label:'COMPL. DÉBIL',dot:'🔴',color:'#dc2626',bg:'#fef2f2',border:'#fca5a5',grupo:'COMPLEMENTARIAS'},{id:'DESCARTADA',label:'DESCARTADA',dot:'⚫',color:'#64748b',bg:'#f8fafc',border:'#cbd5e1',grupo:'DESCARTADAS'}]
const GRUPOS=['PILARES','COMPLEMENTARIAS','DESCARTADAS']
const GRUPO_META={PILARES:{color:'#15803d',bg:'#f0fdf4',border:'#86efac',icon:'🏆'},COMPLEMENTARIAS:{color:'#b45309',bg:'#fffbeb',border:'#fcd34d',icon:'📋'},DESCARTADAS:{color:'#64748b',bg:'#f8fafc',border:'#cbd5e1',icon:'🚫'}}
const ACCION_LABEL={COMPRAR_AHORA:'🟢 COMPRAR AHORA',COMPRAR:'✅ COMPRAR',ESPERAR:'⏳ ESPERAR',MONITOREAR:'👁️ MONITOREAR',DESCARTAR:'🚫 DESCARTAR'}
const ESCENARIO_STYLE={POSITIVO:{color:'#15803d',bg:'#f0fdf4',label:'✅ POSITIVO'},NEUTRAL:{color:'#b45309',bg:'#fffbeb',label:'➡️ NEUTRAL'},NEGATIVO:{color:'#dc2626',bg:'#fef2f2',label:'❌ NEGATIVO'}}
const SCREENSHOTS_INFO=[{n:1,label:'Actuals Superior',hint:'Income Statement + Balance Sheet + Cash Flow'},{n:2,label:'Actuals Inferior',hint:'Per Share (DPS, EPS) + Márgenes + Growth Rates'},{n:3,label:'Returns',hint:'ROIC, ROE, Div Yield, Buyback Yield, Shares Outstanding'}]
const SEED_CARTERA=[{id:'v-seed',ticker:'V',nombre:'Visa Inc.',pais:'USA',sector:'Pagos Digitales',marketCap:'$622B',margenNeto:'55',roic:'41.19',crecimientoCAGR:'10',deudaEbitda:'0.04',capexPct:'2.8',fcfMargin:'50',pe:'28.8',peForward:'23.7',moat:'permanente',tipoMoat:'Network effects bilateral + Switching costs',tendenciaMargenes:'ESTABLE',deudaTendencia:'BAJANDO',assetLight:true,criteriosOk:7,clasificacion:'PILAR_PURO',score:95,accion:'COMPRAR',alocacion:'5-8',escenarioInflacion:'POSITIVO',escenarioInflacionExpl:'Cobra % sobre valores → inflación = más revenue automático',escenarioRecesion:'NEUTRAL',escenarioRecesionExpl:'Pagos siguen en recesión; volumen baja levemente pero no colapsa',predictibilidad:'MUY_ALTA',redFlag:'Antitrust DOJ 2024 (riesgo regulatorio en fees)',fortalezas:['Moat red irremplazable 200+ países','Margen neto 55% estable','Deuda trivial 0.04x EBITDA'],debilidades:['Riesgo regulatorio interchange fees','Crece más lento que Mastercard'],descripcionNegocio:'Visa opera la mayor red de pagos del mundo (200+ países, 4.400M tarjetas). No presta dinero: cobra comisión por autorizar transacciones. Modelo ultra asset-light con márgenes extraordinarios.',notas:'PILAR PURO 7/7. Infraestructura financiera esencial. Margen 55%, ROIC 41%, deuda trivial. Defensivo absoluto, inflación-positivo. Precio justo a 23.7x forward P/E vs histórico 30-40x.',analisisCompleto:'Visa: red de pagos más grande del mundo. Moat permanente por network effects bilaterales (200+ países, 4.400M tarjetas, 100M+ comerciantes). ROIC 41.19%, margen neto 55%, capex 2.8% revenues. Defensivo en recesión, se beneficia de inflación. Riesgo principal: antitrust DOJ 2024.',fecha:'2026-06-18'},{id:'ma-seed',ticker:'MA',nombre:'Mastercard Incorporated',pais:'USA',sector:'Pagos Digitales',marketCap:'$432B',margenNeto:'45.9',roic:'61.66',crecimientoCAGR:'16.5',deudaEbitda:'0.5',capexPct:'1.4',fcfMargin:'52.4',pe:'28.3',peForward:'24.2',moat:'permanente',tipoMoat:'Network effects bilateral + 210 países',tendenciaMargenes:'EXPANDIENDO',deudaTendencia:'BAJANDO',assetLight:true,criteriosOk:7,clasificacion:'PILAR_PURO',score:95,accion:'COMPRAR',alocacion:'5-8',escenarioInflacion:'POSITIVO',escenarioInflacionExpl:'Cobra % sobre valores más altos → inflación = más revenue',escenarioRecesion:'NEUTRAL',escenarioRecesionExpl:'Defensivo: pago con tarjeta no se cancela en recesión',predictibilidad:'MUY_ALTA',redFlag:'Regulación interchange fees EU/USA. Ausencia en China',fortalezas:['EBIT margin expandiéndose 5 años (53→59%)','ROIC 61.66% superior a Visa','Crece más rápido (16.5% CAGR) por exposición internacional'],debilidades:['Margen neto inferior a Visa (45% vs 55%)','Regulación interchange fees'],descripcionNegocio:'Mastercard opera la segunda red de pagos global (210+ países). Modelo idéntico a Visa sin riesgo de crédito. Diversificando hacia analytics y datos.',notas:'PILAR PURO 7/7. EBIT margin expandiéndose 5 años consecutivos. ROIC 61% supera a Visa. Crece 16.5% CAGR por más exposición a emergentes. A 24.2x P/E forward: barato vs histórico 35-45x.',analisisCompleto:'Mastercard: segunda red de pagos mundial, en 210+ países. EBIT margin expandiéndose consecutivamente (53→59% en 5 años). ROIC 61.66% superior a Visa. Capex 1.4% revenues. Mayor exposición internacional = beneficiaria de digitalización en emergentes. Anti-inflación. Buyback $13.4B/año coherente con modelo asset-light.',fecha:'2026-06-18'},{id:'csu-seed',ticker:'CSU',nombre:'Constellation Software',pais:'Canadá',sector:'Software / VMS Serial Acquirer',marketCap:'C$58B',margenNeto:'22.5 FCF',roic:'15.99',crecimientoCAGR:'19.73',deudaEbitda:'1.0',capexPct:'0.6',fcfMargin:'22.5',pe:'17.2 fwd',peForward:'17.2',moat:'permanente',tipoMoat:'Switching costs extremos en 800+ VMS + Modelo único',tendenciaMargenes:'ESTABLE',deudaTendencia:'BAJANDO',assetLight:true,criteriosOk:7,clasificacion:'PILAR_PURO',score:92,accion:'COMPRAR',alocacion:'5-8',escenarioInflacion:'NEUTRAL',escenarioInflacionExpl:'Puede subir precios de mantenimiento (contratos con ajuste CPI)',escenarioRecesion:'POSITIVO',escenarioRecesionExpl:'Anti-cíclico: ingresos resilientes + adquisiciones se abaratan en recesión',predictibilidad:'MUY_ALTA',redFlag:'Key man risk (Mark Leonard). NI GAAP distorsionado por amortización (usar FCF)',fortalezas:['Switching costs extremos en 800+ nichos VMS','FCF margin 22.5% real','Anti-cíclico en recesión'],debilidades:['Key man risk (Mark Leonard)','Escala dificulta adquisiciones grandes'],descripcionNegocio:'Constellation Software adquiere y opera 800+ empresas de software de mercados verticales (VMS). Nunca vende las adquiridas. Mark Leonard: mejor capital allocator de su nicho.',notas:'PILAR PURO especial. NI GAAP 6% distorsionado por amortización (~C$1.4B/año). FCF margin real 22.5%. ROIC en nuevas adquisiciones 25-30%+. Anti-cíclico único. A 21x FCF: precio razonable.',analisisCompleto:'CSU: holding de 800+ VMS. Moat permanente: switching costs extremos (clientes no pueden cambiar sin destruir operación). FCF real 22.5% margin (NI GAAP bajo por amortización adquisiciones). ROIC blended 15.99% pero IRR nuevas adquisiciones 25-30%+. En recesión: ingresos resilientes + adquisiciones más baratas. Riesgo: Mark Leonard.',fecha:'2026-06-18'},{id:'mco-seed',ticker:'MCO',nombre:"Moody's Corporation",pais:'USA',sector:'Agencia Rating / Analytics',marketCap:'$78.7B',margenNeto:'31.8',roic:'25.58',crecimientoCAGR:'7.5',deudaEbitda:'1.5',capexPct:'4.3',fcfMargin:'34.8',pe:'32.3',peForward:'26.4',moat:'permanente',tipoMoat:'Regulatorio (NRSRO) + Network effects + Brand 100 años',tendenciaMargenes:'EXPANDIENDO',deudaTendencia:'BAJANDO',assetLight:true,criteriosOk:6,clasificacion:'PILAR_CICLICO',score:83,accion:'COMPRAR',alocacion:'3-5',escenarioInflacion:'NEGATIVO',escenarioInflacionExpl:'Tipos altos → menos emisión bonos → MIS revenue cae (2022: -12%)',escenarioRecesion:'NEUTRAL',escenarioRecesionExpl:'Recesión ≠ tipos altos: gobiernos emiten deuda en recesión (positivo)',predictibilidad:'MEDIA',redFlag:'Cíclico a tipos (2022: -12% revenue). Crecimiento 7.5% < 10%',fortalezas:['Duopolio regulado: sin MCO el mercado de bonos no funciona','EBIT 44.91%, ROIC 25.58%','Viento cola: gobiernos emiten cada vez más deuda'],debilidades:['Cíclico a tipos de interés','Crecimiento 7.5% < 10%'],descripcionNegocio:"Moody's: una de las tres grandes agencias de rating (con S&P y Fitch). MIS (ratings, ~55%, transaccional) + MA Analytics (~45%, recurrente). Berkshire ~13%.",notas:'PILAR CÍCLICO (83/100). Moat regulatorio permanente pero cíclico a tipos y crecimiento 7.5%. Estrategia contrarian: comprar cuando tipos suben y MCO cae.',analisisCompleto:"Moody's: duopolio regulado con S&P. NRSRO = monopolio regulatorio. EBIT 44.91%, ROIC 25.58%. Viento de cola secular: gobiernos emiten cada vez más deuda (USA 120%+ PIB). Cíclico a tipos (2022: -12% revenue, -11pp EBIT). Estrategia contrarian: comprar en subidas de tipos (-40% en 2022 → +80% en 2023-24).",fecha:'2026-06-18'},{id:'hca-seed',ticker:'HCA',nombre:'HCA Healthcare',pais:'USA',sector:'Healthcare / Hospitales',marketCap:'$83.7B',margenNeto:'8.14',roic:'21.54',crecimientoCAGR:'7.3',deudaEbitda:'2.9',capexPct:'6.9',fcfMargin:'8',pe:'13.0',peForward:'12.2',moat:'duradero',tipoMoat:'Posición geográfica local + Switching costs moderados',tendenciaMargenes:'ESTABLE',deudaTendencia:'ESTABLE',assetLight:false,criteriosOk:3,clasificacion:'COMPLEMENTARIA_MEDIA',score:45,accion:'ESPERAR',alocacion:'0-2',escenarioInflacion:'NEGATIVO',escenarioInflacionExpl:'Costes salariales suben con inflación, pricing limitado por Medicare',escenarioRecesion:'NEUTRAL',escenarioRecesionExpl:'Healthcare defensivo en demanda pero márgenes comprimen levemente',predictibilidad:'MEDIA',redFlag:'Deuda 2.9x EBITDA. Margen 8% < 20%. Capex $4.87B creciente. Buyback agresivo con deuda alta',fortalezas:['ROIC 21.54% excelente','FCF conversion 99%','Defensivo en demanda'],debilidades:['Margen 8% vs 20%','Deuda 2.9x > 2x límite','Asset-heavy: Capex $4.87B creciente'],descripcionNegocio:'HCA: mayor operador hospitalario privado de USA (186 hospitales, 20 estados). Modelo asset-heavy con Capex masivo continuo.',notas:'COMPLEMENTARIA MEDIA (45/100). NO comprar ahora. Entrar si P/E <11x Y deuda <2.5x. Descartar si deuda >3.5x O márgenes <7%.',analisisCompleto:'HCA: FCF $5.68B (99% conversión) y ROIC 21.54% inflado por apalancamiento (deuda 2.9x). Capex $4.87B/año creciente. Margen 8% estructuralmente bajo. Buyback $9.1B con deuda alta = incoherente. Moat duradero pero telemedicina presiona.',fecha:'2026-06-18'}]


// ═══════════════════════════════════════════════════════════════
// DGI SCORING ENGINE
// ═══════════════════════════════════════════════════════════════
const DS={chowder:v=>v>=16?10:v>=12?7:v>=10?4:0,cagrDiv:v=>v>=15?10:v>=10?7:v>=7?4:1,racha:v=>v>=25?10:v>=15?7:v>=10?5:v>=7?3:0,yld:v=>(v>=2&&v<=3.5)?5:((v>=1&&v<2)||(v>3.5&&v<=4.5))?3:1,payFCF:v=>v<40?12:v<55?9:v<70?5:0,cagrFCF:v=>v>=15?10:v>=10?7:v>=7?4:1,payEPS:v=>v<40?8:v<55?6:v<65?3:0,roic:v=>v>=20?4:v>=15?3:v>=12?2:0,moatW:v=>v==="amplio"?6:v==="estrecho"?3:0,moatT:v=>({monopolio_duopolio:7,red_clientes:6,costes_cambio:5,datos_propietarios:4,escala_marca:2,ninguna:0}[v]||0),deuda:v=>v<1.5?5:v<2.5?3:v<3.5?1:0,rating:v=>["AAA","AA+","AA","AA-","A+","A","A-"].includes(v)?3:v==="BBB+"?2:v==="BBB"?1:0,yldH:v=>v==="mayor"?6:v==="igual"?3:0,perH:v=>v==="bajo"?4:v==="en_linea"?2:0}
function dgiCalcScore(c){const y=+c.yieldActual||0,d=+c.cagrDiv5Y||0,ch=y+d;const A=DS.chowder(ch)+DS.cagrDiv(d)+DS.racha(+c.rachaAnios||0)+DS.yld(y);const B=DS.payFCF(+c.payoutFCF||0)+DS.cagrFCF(+c.cagrFCF5Y||0)+DS.payEPS(+c.payoutEPS||0);const C2=DS.roic(+c.roic||0)+DS.moatW(c.moat||"ninguno")+DS.moatT(c.tipoMoat||"ninguna")+DS.deuda(+c.deudaEbitda||0)+DS.rating(c.rating||"Sin rating");const D=DS.yldH(c.yieldVsHistorico)+DS.perH(c.perVsHistorico);return{A,B,C:C2,D,total:A+B+C2,chowder:Math.round(ch*10)/10}}
function dgiGetClasif(score){if(score>=70)return{label:"PILAR",color:"#15803d",bg:"#f0fdf4",border:"#86efac",dot:"🟢"};if(score>=52)return{label:"COMPLEMENTARIA",color:"#b45309",bg:"#fffbeb",border:"#fcd34d",dot:"🟡"};if(score>=38)return{label:"VIGILANCIA",color:"#c2410c",bg:"#fff7ed",border:"#fdba74",dot:"🟠"};return{label:"DESCARTABLE",color:"#dc2626",bg:"#fef2f2",border:"#fca5a5",dot:"🔴"}}
function dgiCalcUpgrade(co,targetScore){const curScore=+(co.score||dgiCalcScore(co).total);if(curScore>=targetScore)return null;const curYield=+co.yieldActual||0;if(!curYield||!co.cagrDiv5Y)return{noData:true};const working=[];for(let y=0.1;y<=20.05;y+=0.1){const yr=Math.round(y*10)/10;if(dgiCalcScore({...co,yieldActual:String(yr)}).total>=targetScore)working.push(yr)}if(!working.length)return{notAchievable:true};const closest=working.reduce((a,b)=>Math.abs(a-curYield)<=Math.abs(b-curYield)?a:b);const pctC=((curYield/closest)-1)*100;return{targetYield:closest,pctChange:pctC.toFixed(0),up:pctC<0,scoreAtTarget:dgiCalcScore({...co,yieldActual:String(closest)}).total}}
function buildProjection(yld,cagrHist,refInv){const cagrBase=Math.max(cagrHist*0.75,1),cagrCons=Math.max(cagrHist*0.50,0.5);return Array.from({length:11},(_,i)=>({año:i===0?"Hoy":`Año ${i}`,"Optimista":+(yld*(1+cagrHist/100)**i).toFixed(2),"Base (−25%)":+(yld*(1+cagrBase/100)**i).toFixed(2),"Conservador (−50%)":+(yld*(1+cagrCons/100)**i).toFixed(2),rentaBase:Math.round(refInv*(yld*(1+cagrBase/100)**i)/100),rentaOpt:Math.round(refInv*(yld*(1+cagrHist/100)**i)/100),rentaCons:Math.round(refInv*(yld*(1+cagrCons/100)**i)/100)}))}
function yoc10(yld,cagrHist,factor=0.75){return+(yld*(1+Math.max(cagrHist*factor,0.5)/100)**10).toFixed(2)}
function yocGlobal(yld,cagr,inv,years){return Array.from({length:years+1},(_,i)=>({año:i===0?"Hoy":`A${i}`,"Base":+(yld*(1+cagr/100)**i).toFixed(2),"Optimista (+3%)":+(yld*(1+(cagr+3)/100)**i).toFixed(2),"Conservador (−4%)":+(yld*(1+Math.max(cagr-4,1)/100)**i).toFixed(2),renta:Math.round(inv*yld*(1+cagr/100)**i/100)}))}

// ═══════════════════════════════════════════════════════════════
// DGI SEED DATA
// ═══════════════════════════════════════════════════════════════
const DGI_SEED=[{id:"vrsk-001",nombre:"Verisk Analytics",ticker:"VRSK",pais:"USA",sector:"Analytics / Datos de seguros",yieldActual:"1.15",cagrDiv5Y:"10.96",rachaAnios:"7",aniosPagando:"7",payoutFCF:"22",crecBPA5Y:"7.3",payoutEPS:"27.86",cagrFCF5Y:"7.7",cagrFCF10Y:"13.2",roic:"25.99",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"2.7",rating:"BBB+",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"muy_defensiva",sensTipos:"neutral",notasMacro:"En 2020 (COVID): EPS creció +5,4% — extremadamente defensivo. Seguros P&C obligatorios, actuarios necesitan datos ISO independientemente del ciclo.",notas:"Pure-play datos y analytics para seguros P&C (ISO). Cuasi-monopolio en datos de siniestros. ROIC 26%. Payout FCF 22%. Deuda 2,7x por encima de umbral ideal.",fecha:"2026-06-21",score:62,chowder:12.1,scoreA:20,scoreB:24,scoreC:18,scoreD:10,clasificacion:"COMPLEMENTARIA",yoc10opt:3.25,yoc10base:2.53,yoc10cons:1.96},{id:"mrsh-001",nombre:"Marsh & McLennan",ticker:"MRSH",pais:"USA",sector:"Brokerage seguros / Consultoría",yieldActual:"2.22",cagrDiv5Y:"14.12",rachaAnios:"17",aniosPagando:"50",payoutFCF:"35",crecBPA5Y:"14.4",payoutEPS:"43.82",cagrFCF5Y:"10.5",cagrFCF10Y:"12.3",roic:"14.69",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"2.6",rating:"A-",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"En 2020 (COVID): ingresos +3,4%, EPS +7,1% — resistente. Subidas de tipos 2022-2023 fueron viento de cola: mayor rendimiento del float de primas.",notas:"Mayor broker de seguros del mundo (Marsh, Guy Carpenter, Mercer, Oliver Wyman). EBIT margin subiendo de 8% (2009) a 24% (2026). Forward P/E 15,2x muy atractivo.",fecha:"2026-06-21",score:71,chowder:16.3,scoreA:29,scoreB:25,scoreC:17,scoreD:10,clasificacion:"PILAR",yoc10opt:8.32,yoc10base:6.07,yoc10cons:4.39},{id:"tencent-001",nombre:"Tencent Holdings",ticker:"HK:700",pais:"China / Hong Kong",sector:"Tech / Redes sociales / Gaming",yieldActual:"1.19",cagrDiv5Y:"28.73",rachaAnios:"4",aniosPagando:"4",payoutFCF:"16",crecBPA5Y:"17.1",payoutEPS:"15.96",cagrFCF5Y:"5.8",cagrFCF10Y:"17.2",roic:"12.44",moat:"amplio",tipoMoat:"red_clientes",deudaEbitda:"0.1",rating:"A+",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"En 2021-2022 el gobierno limitó gaming de menores. Riesgo regulatorio chino estructural: el gobierno puede cambiar reglas de la noche a la mañana.",notas:"🔴 DESCARTABLE: Solo 4 años historial DGI + riesgo regulatorio chino incompatible con rentas pasivas a 10 años. Chowder 29,92 (el más alto) pero clasificación DESCARTABLE. Revisitar en 2029.",fecha:"2026-06-21",score:66,chowder:29.9,scoreA:23,scoreB:21,scoreC:22,scoreD:10,clasificacion:"DESCARTABLE",yoc10opt:14.87,yoc10base:8.39,yoc10cons:4.55},{id:"spgi-001",nombre:"S&P Global Inc.",ticker:"SPGI",pais:"USA",sector:"Índices / Ratings / Data",yieldActual:"0.94",cagrDiv5Y:"6.73",rachaAnios:"53",aniosPagando:"53",payoutFCF:"21",crecBPA5Y:"8.8",payoutEPS:"24.35",cagrFCF5Y:"10.7",cagrFCF10Y:"18.0",roic:"10.39",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"1.5",rating:"A-",yieldVsHistorico:"igual",perVsHistorico:"en_linea",sensRecesion:"sensible",sensTipos:"neutral",notasMacro:"La rama de ratings cae en recesiones. Índices (AUM-based fees) caen con los mercados. Fusión IHS Markit 2022 diluyó acciones y aumentó deuda.",notas:"Dividend King 53 años. Chowder falla (7,67 < 10) por yield bajo y desaceleración dividendo. ROIC deprimido por goodwill fusión IHS Markit. Revisar en 2-3 años.",fecha:"2026-06-21",score:58,chowder:7.7,scoreA:12,scoreB:27,scoreC:19,scoreD:5,clasificacion:"COMPLEMENTARIA",yoc10opt:1.80,yoc10base:1.54,yoc10cons:1.31},{id:"expn-001",nombre:"Experian plc",ticker:"EXPN",pais:"Reino Unido",sector:"Datos de crédito / Analytics",yieldActual:"2.72",cagrDiv5Y:"8.06",rachaAnios:"10",aniosPagando:"35",payoutFCF:"27",crecBPA5Y:"8.7",payoutEPS:"39.28",cagrFCF5Y:"12.0",cagrFCF10Y:"4.5",roic:"14.89",moat:"estrecho",tipoMoat:"datos_propietarios",deudaEbitda:"2.0",rating:"BBB+",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"sensible",sensTipos:"leve",notasMacro:"Congeló dividendo en COVID 2020-2021. Sensible a tipos altos (menos crédito al consumo). 0% retención fiscal UK para no residentes.",notas:"Pase COVID aplicado: racha ~10 años. Bureau de crédito global (con Equifax y TransUnion). Payout FCF 27% excepcional. ROIC 14,89% roza umbral 15%.",fecha:"2026-06-21",score:59,chowder:10.8,scoreA:18,scoreB:27,scoreC:14,scoreD:10,clasificacion:"COMPLEMENTARIA",yoc10opt:5.90,yoc10base:4.89,yoc10cons:4.04},{id:"cme-001",nombre:"CME Group Inc.",ticker:"CME",pais:"USA",sector:"Bolsa / Derivados financieros",yieldActual:"4.61",cagrDiv5Y:"7.92",rachaAnios:"14",aniosPagando:"22",payoutFCF:"94",crecBPA5Y:"10.8",payoutEPS:"95.15",cagrFCF5Y:"10.7",cagrFCF10Y:"11.1",roic:"9.98",moat:"amplio",tipoMoat:"red_clientes",deudaEbitda:"0.3",rating:"AA-",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"Perfil contracíclico: la volatilidad genera más volumen en derivados. En 2020 los volúmenes se dispararon. Beneficiada por tipos altos (futuros de tipos).",notas:"Monopolio de facto en futuros de tipos, equity indices, energía. ROIC 9,98% artefacto del clearing house. Dividendo especial anual variable hace racha difícil de contar.",fecha:"2026-06-21",score:41,chowder:12.5,scoreA:17,scoreB:7,scoreC:17,scoreD:10,clasificacion:"VIGILANCIA",yoc10opt:9.88,yoc10base:8.21,yoc10cons:6.80},{id:"jnj-001",nombre:"Johnson & Johnson",ticker:"JNJ",pais:"USA",sector:"Farmacéutica / MedTech",yieldActual:"2.35",cagrDiv5Y:"5.18",rachaAnios:"54",aniosPagando:"60",payoutFCF:"70",crecBPA5Y:"6.1",payoutEPS:"59.52",cagrFCF5Y:"-2.5",cagrFCF10Y:"0.8",roic:"16.99",moat:"amplio",tipoMoat:"escala_marca",deudaEbitda:"1.0",rating:"AA+",yieldVsHistorico:"menor",perVsHistorico:"en_linea",sensRecesion:"muy_defensiva",sensTipos:"neutral",notasMacro:"54 años consecutivos incluyendo todas las recesiones desde 1968. Muy defensiva — medicamentos y dispositivos son no discrecionales.",notas:"Dividend King 54 años. Post-spin-off Kenvue (2023) es pura farma + medtech. FCF plano 10 años por Kenvue + adquisiciones. Chowder 7.53 < 10 umbral. Posición defensiva pequeña.",fecha:"2026-06-21",score:43,chowder:7.5,scoreA:16,scoreB:4,scoreC:23,scoreD:2,clasificacion:"VIGILANCIA",yoc10opt:3.91,yoc10base:3.44,yoc10cons:3.04},{id:"msci-001",nombre:"MSCI Inc.",ticker:"MSCI",pais:"USA",sector:"Índices / Analytics financiero",yieldActual:"1.41",cagrDiv5Y:"19.79",rachaAnios:"10",aniosPagando:"12",payoutFCF:"36",crecBPA5Y:"17.3",payoutEPS:"42.68",cagrFCF5Y:"13.9",cagrFCF10Y:"15.7",roic:"41.63",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"3.2",rating:"BBB",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"sensible",notasMacro:"En 2020 el dividendo siguió creciendo pese a caída temporal de AUM. El PER pasó de 60x a 33x en 2022-2023 — compresión de múltiplos, no deterioro del negocio.",notas:"$15 billones en AUM rastrean sus índices. FCF margin 48%. Equity negativo por recompras agresivas. Mayor CAGR dividendo 10Y de la cartera. Riesgo: deuda 3,2x y sensibilidad a tipos.",fecha:"2026-06-21",score:71,chowder:21.2,scoreA:28,scoreB:25,scoreC:18,scoreD:10,clasificacion:"PILAR",yoc10opt:8.58,yoc10base:5.63,yoc10cons:3.62},{id:"wkl-001",nombre:"Wolters Kluwer N.V.",ticker:"WKL",pais:"Países Bajos",sector:"Software / Servicios Profesionales",yieldActual:"4.28",cagrDiv5Y:"13.13",rachaAnios:"12",aniosPagando:"30",payoutFCF:"41",crecBPA5Y:"11.5",payoutEPS:"43.04",cagrFCF5Y:"8.2",cagrFCF10Y:"7.5",roic:"20.57",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"2.0",rating:"BBB+",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"leve",notasMacro:"En 2020 dividendo siguió subiendo. Desplome PER de 25x a 10x en 2022-2025 coincide con tipos altos — re-rating valoración, no deterioro negocio.",notas:"Software crítico para profesionales regulados (legal, tax, healthcare). >85% ingresos recurrentes. Racha 12 años (Koyfin muestra 1 año por error — pago en dos tramos europeos).",fecha:"2026-06-21",score:66,chowder:17.4,scoreA:25,scoreB:19,scoreC:22,scoreD:10,clasificacion:"COMPLEMENTARIA",yoc10opt:15.0,yoc10base:10.95,yoc10cons:8.09},{id:"visa-001",nombre:"Visa Inc.",ticker:"V",pais:"USA",sector:"Pagos digitales",yieldActual:"0.82",cagrDiv5Y:"15.59",rachaAnios:"17",aniosPagando:"18",payoutFCF:"23",crecBPA5Y:"17.8",payoutEPS:"21.94",cagrFCF5Y:"17.3",cagrFCF10Y:"17.5",roic:"41.19",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"0.3",rating:"AA-",yieldVsHistorico:"igual",perVsHistorico:"bajo",sensRecesion:"defensiva",sensTipos:"neutral",notasMacro:"En 2020 impacto temporal por cierre de viajes internacionales pero dividendo nunca recortado. Históricamente más resistente que bancos. Deuda mínima 0,3x EBITDA.",notas:"Peaje sobre comercio global sin riesgo crediticio. ROIC 41%. Payout FCF 23% — décadas de crecimiento por delante. PER 28x vs media histórica 30-40x. Gemelo de MA en modelo.",fecha:"2026-06-21",score:83,chowder:16.4,scoreA:28,scoreB:30,scoreC:25,scoreD:7,clasificacion:"PILAR",yoc10opt:3.49,yoc10base:2.48,yoc10cons:1.74},{id:"ma-001",nombre:"Mastercard Incorporated",ticker:"MA",pais:"USA",sector:"Pagos digitales",yieldActual:"0.71",cagrDiv5Y:"14.18",rachaAnios:"15",aniosPagando:"20",payoutFCF:"16",crecBPA5Y:"21.4",payoutEPS:"17.9",cagrFCF5Y:"18.9",cagrFCF10Y:"16.2",roic:"61.66",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"0.5",rating:"A+",yieldVsHistorico:"igual",perVsHistorico:"bajo",sensRecesion:"defensiva",sensTipos:"neutral",notasMacro:"En 2008-09 el volumen cayó pero dividendo nunca recortado. En 2020 impacto por viajes pero recuperación rápida. En 2022 tipos altos el negocio apenas se vio afectado.",notas:"Duopolio global de red de pagos. ROIC 62%, payout 16% sobre FCF. BPA y FCF llevan una década creciendo al 18-21%. PER actual (28x) muy por debajo de media histórica 35-45x.",fecha:"2026-06-21",score:77,chowder:14.9,scoreA:22,scoreB:30,scoreC:25,scoreD:7,clasificacion:"PILAR",yoc10opt:2.69,yoc10base:1.95,yoc10cons:1.41},{id:"bam-001",nombre:"Brookfield Asset Management",ticker:"BAM",pais:"Canadá / USA",sector:"Gestión activos alternativos",yieldActual:"3.96",cagrDiv5Y:"16",rachaAnios:"2",aniosPagando:"3",payoutFCF:"90",crecBPA5Y:"16",payoutEPS:"116",cagrFCF5Y:"15",cagrFCF10Y:"",roic:"18.92",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"0.5",rating:"BBB+",yieldVsHistorico:"mayor",perVsHistorico:"en_linea",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"Spin-off de Brookfield Corporation dic 2022. Comisiones sobre capital comprometido cuasi-fijas. En tipos altos: más demanda de crédito alternativo.",notas:"⚠️ REGLA SPIN-OFF: CAGR calculado sobre consenso forward. Política declarada distribuir ~90% FRE. Payout GAAP 116% es artefacto; FRE es métrica correcta. REVISITAR 2028.",fecha:"2026-06-21",score:54,chowder:19.96,scoreA:23,scoreB:10,scoreC:21,scoreD:8,clasificacion:"COMPLEMENTARIA",yoc10opt:17.47,yoc10base:12.30,yoc10cons:8.55},{id:"blk-001",nombre:"BlackRock Inc.",ticker:"BLK",pais:"USA",sector:"Gestión activos / Tecnología financiera",yieldActual:"2.18",cagrDiv5Y:"7.30",rachaAnios:"17",aniosPagando:"17",payoutFCF:"80",crecBPA5Y:"8",payoutEPS:"55.67",cagrFCF5Y:"8",cagrFCF10Y:"9",roic:"9.15",moat:"amplio",tipoMoat:"red_clientes",deudaEbitda:"0.1",rating:"AA-",yieldVsHistorico:"menor",perVsHistorico:"en_linea",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"AUM-linked fees caen con mercados, pero Aladdin (55K+ usuarios) es recurrente. Adquisición GIP 2024 + HPS eleva exposición a capital comprometido a 10-15Y.",notas:"ROIC 9,15% deprimido por goodwill masivo (BGI+GIP+HPS). ROIC económico ex-goodwill >25%. Aladdin: red clientes con costes salida prohibitivos. CAGR div desacelera a 7,3%.",fecha:"2026-06-21",score:43,chowder:9.48,scoreA:16,scoreB:7,scoreC:20,scoreD:2,clasificacion:"VIGILANCIA",yoc10opt:4.52,yoc10base:3.28,yoc10cons:2.35},{id:"ko-001",nombre:"The Coca-Cola Company",ticker:"KO",pais:"USA",sector:"Bebidas / Consumer Staples",yieldActual:"2.67",cagrDiv5Y:"4.54",rachaAnios:"54",aniosPagando:"54",payoutFCF:"90",crecBPA5Y:"8",payoutEPS:"80.07",cagrFCF5Y:"3",cagrFCF10Y:"5",roic:"15.85",moat:"amplio",tipoMoat:"escala_marca",deudaEbitda:"2.7",rating:"A+",yieldVsHistorico:"igual",perVsHistorico:"en_linea",sensRecesion:"muy_defensiva",sensTipos:"leve",notasMacro:"En cada recesión desde 1929 KO mantuvo y subió el dividendo. 2B+ raciones diarias en 200 países. COVID 2020: ventas hostelería cayeron pero retail compensó.",notas:"🔴 DESCARTABLE para DGI de crecimiento: Chowder 7,21 < 10 umbral. CAGR dividendo 4,54% apenas supera inflación. YoC base 10Y de solo 3,73% — equivalente a bono Tesoro. Dividend King 54 años pero para cartera de preservación de capital, no crecimiento DGI.",fecha:"2026-06-21",score:32,chowder:7.21,scoreA:16,scoreB:1,scoreC:15,scoreD:5,clasificacion:"DESCARTABLE",yoc10opt:4.16,yoc10base:3.73,yoc10cons:3.34},{id:"ams-001",nombre:"Amadeus IT Group",ticker:"AMS",pais:"España",sector:"Software / Tecnología de viajes",yieldActual:"2.99",cagrDiv5Y:"7.11",rachaAnios:"10",aniosPagando:"13",payoutFCF:"46",crecBPA5Y:"8",payoutEPS:"46.55",cagrFCF5Y:"12",cagrFCF10Y:"8",roic:"17.65",moat:"amplio",tipoMoat:"red_clientes",deudaEbitda:"1.0",rating:"BBB+",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"sensible",sensTipos:"beneficiada",notasMacro:"COVID: ingresos cayeron 70%. En recesiones suaves (2008-09) resiste mejor que aerolíneas. Buyback yield 7,54% en 2025.",notas:"⚠️ REGLA COVID TURISMO: suspensión total 2020-2021. CAGR usado: 10Y FY (7,11%) más honesto. GDS aeronáutico #1 global con efectos red bilaterales. ROIC 17,65%, deuda 1,0x.",fecha:"2026-06-21",score:62,chowder:10.10,scoreA:18,scoreB:22,scoreC:22,scoreD:10,clasificacion:"COMPLEMENTARIA",yoc10opt:5.94,yoc10base:5.03,yoc10cons:4.24},{id:"ice-001",nombre:"Intercontinental Exchange",ticker:"ICE",pais:"USA",sector:"Infraestructura financiera / Exchanges",yieldActual:"1.55",cagrDiv5Y:"9.77",rachaAnios:"11",aniosPagando:"11",payoutFCF:"22",crecBPA5Y:"11",payoutEPS:"28.59",cagrFCF5Y:"8",cagrFCF10Y:"11",roic:"8.51",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"2.8",rating:"A-",yieldVsHistorico:"igual",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"beneficiada",notasMacro:"Volatilidad e incertidumbre generan más volumen en derivados. NYSE + energía + datos hipotecarios (ICE Mortgage Technology). Beneficiada por tipos altos en SOFR futures.",notas:"Operador de NYSE y mercados de energía globales. ROIC 8,51% deprimido por goodwill NYSE 2013. Modelo de datos recurrentes (ICE Data Services, Mortgage Technology) crece. Chowder 11,32 roza umbral 12.",fecha:"2026-06-21",score:60,chowder:11.32,scoreA:17,scoreB:24,scoreC:19,scoreD:7,clasificacion:"COMPLEMENTARIA",yoc10opt:3.98,yoc10base:3.24,yoc10cons:2.63},{id:"mco-001",nombre:"Moody's Corporation",ticker:"MCO",pais:"USA",sector:"Agencia Rating / Analytics",yieldActual:"0.91",cagrDiv5Y:"10.85",rachaAnios:"15",aniosPagando:"25",payoutFCF:"32",crecBPA5Y:"12",payoutEPS:"27.70",cagrFCF5Y:"10.2",cagrFCF10Y:"14.3",roic:"25.58",moat:"amplio",tipoMoat:"monopolio_duopolio",deudaEbitda:"1.5",rating:"A-",yieldVsHistorico:"igual",perVsHistorico:"bajo",sensRecesion:"sensible",sensTipos:"neutral",notasMacro:"Duopolio regulatoriamente protegido: NRSRO status. En recesiones: issuance de deuda cae pero Analytics más defensivo. En tipos altos: menos emisión de nueva deuda.",notas:"ROIC 25,58% genuino. Duopolio MCO+S&P controlan ~75% ratings globales. FCF payout 32% — headroom amplio. Yield 0,91% roza umbral 1%. Chowder 11,76 a 0,24pts del umbral 12.",fecha:"2026-06-21",score:71,chowder:11.76,scoreA:19,scoreB:27,scoreC:25,scoreD:5,clasificacion:"PILAR",yoc10opt:2.55,yoc10base:1.99,yoc10cons:1.54},{id:"axp-001",nombre:"American Express Company",ticker:"AXP",pais:"USA",sector:"Consumer Finance / Pagos premium",yieldActual:"1.12",cagrDiv5Y:"13.78",rachaAnios:"5",aniosPagando:"20",payoutFCF:"20",crecBPA5Y:"10",payoutEPS:"20.90",cagrFCF5Y:"12",cagrFCF10Y:"10",roic:"0",moat:"amplio",tipoMoat:"red_clientes",deudaEbitda:"2.0",rating:"A-",yieldVsHistorico:"menor",perVsHistorico:"en_linea",sensRecesion:"sensible",sensTipos:"neutral",notasMacro:"En GFC 2008-2009 la morosidad disparó pérdidas y AXP recortó dividendo ~75%. Segmento premium más resistente que tarjetas masivas. Berkshire/Buffett ~21%.",notas:"⚠️ Racha solo 5 años: falla filtro DGI 7 años. AXP cortó dividendo en GFC y congeló 2020-2021 — vulnerabilidad estructural. ROIC 0% artefacto Koyfin (ROE real 34%). Candidata en 2029 si racha ≥7 años.",fecha:"2026-06-21",score:62,chowder:14.90,scoreA:17,scoreB:27,scoreC:18,scoreD:2,clasificacion:"COMPLEMENTARIA",yoc10opt:4.08,yoc10base:2.99,yoc10cons:2.18},{id:"unh-001",nombre:"UnitedHealth Group",ticker:"UNH",pais:"USA",sector:"Gestión de salud / Health Services",yieldActual:"2.18",cagrDiv5Y:"12.07",rachaAnios:"17",aniosPagando:"17",payoutFCF:"60",crecBPA5Y:"8",payoutEPS:"66.50",cagrFCF5Y:"3",cagrFCF10Y:"10",roic:"9.29",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"1.9",rating:"A-",yieldVsHistorico:"mayor",perVsHistorico:"alto",sensRecesion:"defensiva",sensTipos:"neutral",notasMacro:"Managed care + Optum: sector defensivo pero MedLR sube en recesiones. En tipos altos: portfolio bonos genera más ingresos.",notas:"🟠 VIGILANCIA: cúmulo riesgos 2024-2026: Change Healthcare cyberattack + CEO asesinado + DOJ antimonopolio Optum + Medical Loss Ratio pressure. ROIC 9,29% en tendencia bajista desde 30%+.",fecha:"2026-06-22",score:49,chowder:14.25,scoreA:26,scoreB:6,scoreC:17,scoreD:6,clasificacion:"VIGILANCIA",yoc10opt:6.82,yoc10base:5.18,yoc10cons:3.92},{id:"oke-001",nombre:"ONEOK Inc.",ticker:"OKE",pais:"USA",sector:"Midstream Energy / Infraestructura gas",yieldActual:"4.99",cagrDiv5Y:"2.35",rachaAnios:"4",aniosPagando:"20",payoutFCF:"85",crecBPA5Y:"15",payoutEPS:"74.03",cagrFCF5Y:"5",cagrFCF10Y:"8",roic:"8.80",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"4.0",rating:"BBB",yieldVsHistorico:"igual",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"perjudicada",notasMacro:"Contratos take-or-pay pero volumen puede caer si productores reducen actividad. Deuda 4,0x post-Magellan se encarece con tipos altos.",notas:"🔴 DESCARTABLE — yield trap clásico: 4,99% con CAGR 2,35%. YoC base 10Y: 5,94% (prácticamente igual al yield actual). Adquisición Magellan elevó deuda a 4,0x EBITDA. CANDIDATO cuando deuda <2,5x y CAGR div >7%.",fecha:"2026-06-22",score:15,chowder:7.34,scoreA:2,scoreB:1,scoreC:12,scoreD:7,clasificacion:"DESCARTABLE",yoc10opt:6.30,yoc10base:5.94,yoc10cons:5.61},{id:"hesm-001",nombre:"Hess Midstream LP",ticker:"HESM",pais:"USA",sector:"Midstream Energy / Infraestructura gas Bakken",yieldActual:"8.35",cagrDiv5Y:"11.29",rachaAnios:"8",aniosPagando:"8",payoutFCF:"75",crecBPA5Y:"20",payoutEPS:"101.95",cagrFCF5Y:"12",cagrFCF10Y:"",roic:"21.30",moat:"amplio",tipoMoat:"costes_cambio",deudaEbitda:"2.7",rating:"BBB",yieldVsHistorico:"mayor",perVsHistorico:"bajo",sensRecesion:"moderada",sensTipos:"perjudicada",notasMacro:"C-CORP desde Q4 2019 (1099-DIV, sin K-1, elegible IRA). Monopolio corredor Bakken con Chevron (post-adquisición Hess). MVCs vigentes hasta 2028.",notas:"✅ NO K-1: C-Corp desde Q4 2019. ROIC 21,30% genuino. Chowder 19,64 — el más alto. YoC base 10Y: 18,82% — el MAYOR de la cartera. Concentración >85% en Chevron (ahora AA credit).",fecha:"2026-06-22",score:45,chowder:19.64,scoreA:21,scoreB:7,scoreC:17,scoreD:10,clasificacion:"VIGILANCIA",yoc10opt:24.29,yoc10base:18.82,yoc10cons:14.46}]

const DGI_EMPTY={nombre:"",ticker:"",pais:"",sector:"",yieldActual:"",cagrDiv5Y:"",rachaAnios:"",aniosPagando:"",payoutFCF:"",crecBPA5Y:"",payoutEPS:"",cagrFCF5Y:"",cagrFCF10Y:"",roic:"",moat:"estrecho",tipoMoat:"ninguna",deudaEbitda:"",rating:"BBB",yieldVsHistorico:"igual",perVsHistorico:"en_linea",sensRecesion:"moderada",sensTipos:"neutral",notasMacro:"",notas:"",fecha:new Date().toISOString().slice(0,10)}


// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
const LS={get:key=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):null;}catch(e){return null;}},set:(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}}
function getQClasif(id){return CLASIFICACIONES.find(c=>c.id===id)||CLASIFICACIONES[0]}
async function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file)})}

// Limpia valores numéricos de Claude (convierte decimal a %, quita texto extra)
function cleanNum(val, isPercent=false){
  if(val==null||val==='')return ''
  const s=String(val).replace(/[^0-9.\-]/g,'') // quitar todo excepto números, punto y menos
  const n=parseFloat(s)
  if(isNaN(n))return ''
  // Si parece decimal cuando debería ser porcentaje (ej: 0.178 → 17.8)
  if(isPercent && Math.abs(n)<2 && n!==0)return String(Math.round(n*1000)/10)
  return String(Math.round(n*100)/100)
}
function cleanResult(r){
  if(!r)return r
  return{...r,
    margenNeto:cleanNum(r.margenNeto),margenEBIT:cleanNum(r.margenEBIT),fcfMargin:cleanNum(r.fcfMargin),
    roic:cleanNum(r.roic),roc:cleanNum(r.roc),roe:cleanNum(r.roe),
    crecimientoCAGR:cleanNum(r.crecimientoCAGR,true),cagrRevenue:cleanNum(r.cagrRevenue,true),
    cagrFCF_historico:cleanNum(r.cagrFCF_historico,true),
    deudaEbitda:cleanNum(r.deudaEbitda),capexPct:cleanNum(r.capexPct),buybackYield:cleanNum(r.buybackYield),
    dcf_cagr_bn:parseFloat(cleanNum(r.dcf_cagr_bn,true))||0,
    dcf_cagr_fcf:parseFloat(cleanNum(r.dcf_cagr_fcf,true))||0,
  }
}
async function compressImage(file, maxW=2200, quality=0.92){
  return new Promise(resolve=>{
    const img=new Image()
    const url=URL.createObjectURL(file)
    img.onload=()=>{
      const ratio=Math.min(1,maxW/img.width)
      const canvas=document.createElement('canvas')
      canvas.width=Math.round(img.width*ratio)
      canvas.height=Math.round(img.height*ratio)
      const ctx=canvas.getContext('2d')
      ctx.drawImage(img,0,0,canvas.width,canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob=>{
        const r=new FileReader()
        r.onload=()=>resolve({data:r.result.split(',')[1],mediaType:'image/jpeg'})
        r.readAsDataURL(blob)
      },'image/jpeg',quality)
    }
    img.onerror=()=>resolve(null)
    img.src=url
  })
}

// ═══════════════════════════════════════════════════════════════
// DCF COMPONENTS
// ═══════════════════════════════════════════════════════════════
function DifBadge({d}){if(d==null)return<span style={{color:C.mut,fontSize:11}}>—</span>;return<span style={{background:difBg(d),color:difColor(d),padding:"3px 8px",borderRadius:16,fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{pct(d)}</span>}
function ClaseSelect({row,rows,persist}){const[open,setOpen]=useState(false);const cur=claseStyle(row.clasificacion);return(<div style={{position:"relative"}}><div onClick={e=>{e.stopPropagation();setOpen(o=>!o)}} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:12,background:cur.bg,border:`1px solid ${cur.border}`,cursor:"pointer",minWidth:100,fontSize:10,fontWeight:700,color:cur.color,whiteSpace:"nowrap"}}>{cur.label||"Sin clasificar"}<span style={{fontSize:8,opacity:.7}}>▼</span></div>{open&&<div style={{position:"absolute",top:"100%",left:0,zIndex:50,background:C.surf,border:`1px solid ${C.brd}`,borderRadius:8,padding:4,minWidth:165,boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>{CLASES_DCF.map(c=>(<div key={c.value} onClick={e=>{e.stopPropagation();const nr=rows.map(x=>x.ticker===row.ticker?{...x,clasificacion:c.value}:x);persist(nr);setOpen(false)}} style={{padding:"7px 12px",cursor:"pointer",borderRadius:6,fontSize:11,fontWeight:600,color:c.value?c.color:C.dim}} onMouseEnter={e=>e.currentTarget.style.background=C.brd} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{c.label||"— Sin clasificar"}</div>))}</div>}</div>)}

// ═══════════════════════════════════════════════════════════════
// QUALITY COMPONENTS
// ═══════════════════════════════════════════════════════════════
function QRing({score,clasificId,size=90}){const cl=getQClasif(clasificId);const r=size*0.38,circ=2*Math.PI*r,dash=Math.min(Math.max(score,0),100)/100*circ;return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size*0.09}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cl.color} strokeWidth={size*0.09} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/><text x={size/2} y={size/2-size*0.04} textAnchor="middle" fontSize={size*0.22} fontWeight="900" fill={cl.color}>{score}</text><text x={size/2} y={size/2+size*0.13} textAnchor="middle" fontSize={size*0.09} fill="#94a3b8">/100</text></svg>)}
function QPill({label,value,good,neutral}){const color=good===true?'#15803d':good===false&&!neutral?'#dc2626':'#475569';return(<div style={{textAlign:'center',minWidth:54}}><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>{label}</div><div style={{fontSize:13,fontWeight:700,color,marginTop:1}}>{value}</div></div>)}
function QBadge({cl,small}){return(<span style={{background:cl.bg,border:`1px solid ${cl.border}`,color:cl.color,borderRadius:20,padding:small?'2px 8px':'3px 10px',fontSize:small?10:11,fontWeight:700,whiteSpace:'nowrap'}}>{cl.dot} {cl.label}</span>)}
function MoatBadge({moat}){const s={permanente:{bg:'#f0fdf4',border:'#86efac',color:'#15803d',label:'✓ Permanente'},duradero:{bg:'#fffbeb',border:'#fcd34d',color:'#b45309',label:'~ Duradero'},temporal:{bg:'#fef2f2',border:'#fca5a5',color:'#dc2626',label:'✗ Temporal'},ninguno:{bg:'#f8fafc',border:'#cbd5e1',color:'#64748b',label:'— Sin moat'}};const m=s[moat]||s.ninguno;return(<div style={{background:m.bg,border:`1px solid ${m.border}`,borderRadius:8,padding:'3px 10px',textAlign:'center'}}><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>Moat</div><div style={{fontSize:11,fontWeight:700,color:m.color,marginTop:1}}>{m.label}</div></div>)}
function KV({label,value,ok}){const color=ok===true?'#15803d':ok===false?'#dc2626':'#1e293b';return(<div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#475569',marginBottom:4}}><span>{label}</span><strong style={{color}}>{value}</strong></div>)}
function InfoBox({color,bg,border,icon,title,children,style={}}){return(<div style={{background:bg,border:`1px solid ${border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color,lineHeight:1.55,...style}}>{title&&<strong style={{display:'block',marginBottom:4}}>{icon} {title}</strong>}{!title&&icon&&<span>{icon} </span>}{children}</div>)}
function EscenarioBadge({val}){const s=ESCENARIO_STYLE[val]||ESCENARIO_STYLE.NEUTRAL;return(<span style={{background:s.bg,color:s.color,borderRadius:12,padding:'2px 10px',fontSize:11,fontWeight:700}}>{s.label}</span>)}

// ═══════════════════════════════════════════════════════════════
// DGI COMPONENTS
// ═══════════════════════════════════════════════════════════════
function DGIRing({score}){const cl=dgiGetClasif(score);const r=40,circ=2*Math.PI*r,dash=(score/90)*circ;return(<svg width="108" height="108" viewBox="0 0 108 108"><circle cx="54" cy="54" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10"/><circle cx="54" cy="54" r={r} fill="none" stroke={cl.color} strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 54 54)"/><text x="54" y="50" textAnchor="middle" fontSize="24" fontWeight="900" fill={cl.color}>{score}</text><text x="54" y="65" textAnchor="middle" fontSize="10" fill="#94a3b8">/ 90</text></svg>)}
function DGICard({children,style={}}){return<div style={{background:"white",border:"1px solid #e2e8f0",borderRadius:14,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",...style}}>{children}</div>}
function DGIInp({value,onChange,type="text",step,min,placeholder}){return(<input type={type} value={value} onChange={onChange} step={step} min={min} placeholder={placeholder} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"inherit",background:"white",boxSizing:"border-box"}} onFocus={e=>e.target.style.boxShadow="0 0 0 3px #bfdbfe"} onBlur={e=>e.target.style.boxShadow="none"}/>)}
function DGISel({value,onChange,options}){return(<select value={value} onChange={onChange} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"inherit",background:"white",boxSizing:"border-box"}}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>)}
function DGIFld({label,hint,children}){return(<div><div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>{children}{hint&&<div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{hint}</div>}</div>)}
function DGIBHeader({letter,title,pts,max}){return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{background:"#0f2246",color:"white",width:24,height:24,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{letter}</div><span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{title}</span></div><span style={{background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>{pts}/{max} pts</span></div>)}

function UpgradeHint({company}){
  const score=+(company.score||dgiCalcScore(company).total);
  if(score>=80)return null;
  const targets=[score<52&&{label:"COMPLEMENTARIA",tScore:52,color:"#b45309",bg:"#fffbeb"},score<70&&{label:"PILAR",tScore:70,color:"#15803d",bg:"#f0fdf4"}].filter(Boolean);
  return(<div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",marginTop:4}}>
    <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>📊 ¿Qué yield para subir de clasificación?</div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {targets.map(({label,tScore,color,bg})=>{
        const res=dgiCalcUpgrade(company,tScore);
        if(!res)return null;
        return(<div key={label} style={{display:"flex",alignItems:"flex-start",gap:10,background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px"}}>
          <span style={{fontWeight:800,color,fontSize:12,minWidth:110}}>→ {label}</span>
          {res.noData&&<span style={{fontSize:12,color:"#94a3b8"}}>Introduce yield y CAGR para calcular</span>}
          {res.notAchievable&&<span style={{fontSize:12,color:"#dc2626"}}>❌ No alcanzable solo con el yield — el negocio necesita mejorar</span>}
          {res.targetYield&&<span style={{fontSize:12,color:"#334155"}}>Yield objetivo <strong style={{color}}>{res.targetYield}%</strong>{res.up?<> → precio sube ~<strong>{Math.abs(res.pctChange)}%</strong></>:<> → precio cae ~<strong>{Math.abs(res.pctChange)}%</strong></>}<span style={{color:"#94a3b8",marginLeft:6}}>→ score {res.scoreAtTarget}/90</span></span>}
        </div>)
      })}
    </div>
  </div>)
}

function SimEmpresaCard({yld,cagrDiv,nombre,ticker}){
  const[refInv,setRefInv]=useState(10000);
  if(!yld||!cagrDiv)return null;
  const cagrBase=Math.max(cagrDiv*0.75,1),cagrCons=Math.max(cagrDiv*0.50,0.5);
  const rows=buildProjection(yld,cagrDiv,refInv);
  const r10=rows[10];
  const scenBadge=(label,cagr,yocVal,renta,color)=>(
    <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",flex:1}}>
      <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{label}</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>CAGR: <strong>{cagr.toFixed(1)}%</strong></div>
      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"#94a3b8"}}>YoC año 10</div><div style={{fontSize:18,fontWeight:900,color}}>{yocVal}%</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"#94a3b8"}}>Renta/año</div><div style={{fontSize:18,fontWeight:900,color}}>{renta.toLocaleString("es")}€</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"#94a3b8"}}>Renta/mes</div><div style={{fontSize:15,fontWeight:700,color:"#475569"}}>{Math.round(renta/12).toLocaleString("es")}€</div></div>
      </div>
    </div>
  );
  return(<DGICard style={{border:"2px solid #dbeafe",background:"#fafcff"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div><div style={{fontWeight:800,color:"#1e293b",fontSize:14}}>📈 Proyección dividendo a 10 años</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>Yield actual <strong>{yld}%</strong> · CAGR histórico 5Y <strong>{cagrDiv}%</strong>{nombre&&` · ${nombre}${ticker?" ("+ticker+")":""}`}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:"#64748b"}}>Ref.:</span><input type="number" value={refInv} onChange={e=>setRefInv(Math.max(1000,+e.target.value))} style={{width:100,border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}}/><span style={{fontSize:12,color:"#64748b"}}>€</span></div>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16}}>
      {scenBadge("🚀 Optimista",cagrDiv,+(yld*(1+cagrDiv/100)**10).toFixed(2),r10.rentaOpt,"#1d4ed8")}
      {scenBadge("✅ Base −25%",cagrBase,+(yld*(1+cagrBase/100)**10).toFixed(2),r10.rentaBase,"#15803d")}
      {scenBadge("🛡️ Conservador −50%",cagrCons,+(yld*(1+cagrCons/100)**10).toFixed(2),r10.rentaCons,"#b45309")}
    </div>
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
        <XAxis dataKey="año" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
        <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
        <Tooltip formatter={v=>[`${v}%`]}/>
        <Legend iconSize={9} wrapperStyle={{fontSize:11}}/>
        <Line type="monotone" dataKey="Optimista" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
        <Line type="monotone" dataKey="Base (−25%)" stroke="#15803d" strokeWidth={2.5} dot={{r:2,fill:"#15803d"}}/>
        <Line type="monotone" dataKey="Conservador (−50%)" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
      </LineChart>
    </ResponsiveContainer>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:12}}>
      <thead><tr style={{background:"#f8fafc"}}>{["Año","YoC Opt.","YoC Base","YoC Cons.","Renta base/año","Renta/mes"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:"#94a3b8",fontWeight:600,fontSize:10}}>{h}</th>)}</tr></thead>
      <tbody>{rows.filter((_,i)=>[1,2,3,5,7,10].includes(i)).map((r,i)=>(
        <tr key={i} style={{borderTop:"1px solid #f1f5f9",background:i%2===0?"white":"#fafafa"}}>
          <td style={{padding:"5px 8px",fontWeight:700,color:"#475569"}}>{r.año}</td>
          <td style={{padding:"5px 8px",color:"#3b82f6",fontWeight:600}}>{r["Optimista"]}%</td>
          <td style={{padding:"5px 8px",color:"#15803d",fontWeight:700}}>{r["Base (−25%)"]}%</td>
          <td style={{padding:"5px 8px",color:"#d97706",fontWeight:600}}>{r["Conservador (−50%)"]}%</td>
          <td style={{padding:"5px 8px",color:"#334155",fontWeight:600}}>{r.rentaBase.toLocaleString("es")}€</td>
          <td style={{padding:"5px 8px",color:"#64748b"}}>{Math.round(r.rentaBase/12).toLocaleString("es")}€</td>
        </tr>
      ))}</tbody>
    </table>
  </DGICard>)
}


// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS (PDF / MD / COPY)
// ═══════════════════════════════════════════════════════════════
function generatePDFHtml(co){
  const cl=getQClasif(co.clasificacion)
  const escBadge=v=>{const s=ESCENARIO_STYLE[v]||ESCENARIO_STYLE.NEUTRAL;return`<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:12px;font-weight:700;font-size:12px">${s.label}</span>`}
  return`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${co.ticker}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:white;padding:32px;font-size:13px;line-height:1.6}h1{font-size:22px;font-weight:900;color:#0f2246;margin-bottom:4px}h2{font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #e2e8f0}.hdr{background:#f0f4f8;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}.score .num{font-size:42px;font-weight:900;color:${cl.color};line-height:1}.badge{display:inline-block;background:${cl.bg};border:1px solid ${cl.border};color:${cl.color};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;margin-bottom:6px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}.lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px}.val{font-size:18px;font-weight:800}.grn{color:#15803d}.red{color:#dc2626}.inf{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:8px;color:#1e40af;font-size:12px}.wrn{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;margin-bottom:8px;color:#dc2626;font-size:12px}.ana{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:12px;white-space:pre-wrap;line-height:1.7;color:#334155}ul{padding-left:16px}li{margin-bottom:3px;font-size:12px}.ftr{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}@media print{body{padding:16px}@page{margin:1cm}}</style></head><body>
<div class="hdr"><div style="flex:1"><h1>${co.nombre} <span style="color:#94a3b8;font-size:15px;font-weight:400">(${co.ticker})</span></h1><span class="badge">${cl.dot} ${cl.label}</span><br/><span style="font-size:12px;color:#64748b">${co.pais} · ${co.sector} · ${co.marketCap||''}</span><br/><span style="font-size:12px;font-weight:700;color:${cl.color}">${ACCION_LABEL[co.accion]||co.accion} · ${co.alocacion||'—'}% cartera</span></div><div class="score"><div class="num">${co.score}</div><div style="font-size:11px;color:#94a3b8">/100</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">${co.criteriosOk||'?'}/7 criterios</div></div></div>
<h2>📊 Métricas</h2><div class="grid3"><div class="box"><div class="lbl">Margen Neto</div><div class="val ${parseFloat(co.margenNeto)>=20?'grn':'red'}">${co.margenNeto}%</div></div><div class="box"><div class="lbl">ROIC</div><div class="val ${parseFloat(co.roic)>=12?'grn':'red'}">${co.roic}%</div></div><div class="box"><div class="lbl">CAGR 5Y</div><div class="val ${parseFloat(co.crecimientoCAGR)>=10?'grn':'red'}">${co.crecimientoCAGR}%</div></div><div class="box"><div class="lbl">Deuda/EBITDA</div><div class="val ${parseFloat(co.deudaEbitda)<=2?'grn':'red'}">${co.deudaEbitda}x</div></div><div class="box"><div class="lbl">FCF Margin</div><div class="val">${co.fcfMargin||'—'}%</div></div><div class="box"><div class="lbl">P/E Forward</div><div class="val">${co.peForward}x</div></div></div>
<h2>🏢 Descripción</h2><div class="inf">${co.descripcionNegocio||'—'}</div>
<h2>🌍 Escenarios</h2><div class="grid3"><div class="box"><div class="lbl">Inflación</div>${escBadge(co.escenarioInflacion)}<div style="font-size:11px;color:#64748b;margin-top:4px">${co.escenarioInflacionExpl||''}</div></div><div class="box"><div class="lbl">Recesión</div>${escBadge(co.escenarioRecesion)}<div style="font-size:11px;color:#64748b;margin-top:4px">${co.escenarioRecesionExpl||''}</div></div><div class="box"><div class="lbl">Predictibilidad</div><div style="font-weight:800;color:#1d4ed8;font-size:14px;margin-top:4px">${co.predictibilidad||'—'}</div></div></div>
${co.fortalezas?.length?`<h2>✅ Fortalezas</h2><ul>${co.fortalezas.map(f=>`<li>${f}</li>`).join('')}</ul>`:''}
${co.debilidades?.length?`<h2>⚠️ Debilidades</h2><ul>${co.debilidades.map(d=>`<li>${d}</li>`).join('')}</ul>`:''}
${co.redFlag&&co.redFlag!=='Ninguna'?`<h2>🚨 Red Flags</h2><div class="wrn">${co.redFlag}</div>`:''}
<h2>📝 Resumen</h2><div class="inf">${co.notas||'—'}</div>
${co.analisisCompleto?`<h2>📄 Análisis</h2><div class="ana">${co.analisisCompleto}</div>`:''}
<div class="ftr">Análisis con Claude Sonnet 4.6 · Datos: Koyfin · ${co.fecha||''}</div>
</body></html>`
}
function generateMarkdown(co){const cl=getQClasif(co.clasificacion);return`${'═'.repeat(79)}\nANÁLISIS: ${co.nombre} (${co.ticker}) | ${cl.label} | Score: ${co.score}/100\n${'═'.repeat(79)}\n\nMétricas: Margen ${co.margenNeto}% | ROIC ${co.roic}% | CAGR ${co.crecimientoCAGR}% | D/EBITDA ${co.deudaEbitda}x | P/E fwd ${co.peForward}x\nMoat: ${co.moat} — ${co.tipoMoat||'—'}\nInflación: ${co.escenarioInflacion} | Recesión: ${co.escenarioRecesion} | Predictibilidad: ${co.predictibilidad}\n\nFortalezas:\n${co.fortalezas?.map(f=>`• ${f}`).join('\n')||'—'}\nDebilidades:\n${co.debilidades?.map(d=>`• ${d}`).join('\n')||'—'}\nRed Flags: ${co.redFlag||'Ninguna'}\n\nResumen:\n${co.notas||'—'}\n\nAnálisis Completo:\n${co.analisisCompleto||'—'}`}
function generateClaudeText(co){const cl=getQClasif(co.clasificacion);return`ANÁLISIS: ${co.nombre} (${co.ticker})\nScore: ${co.score}/100 | ${cl.label}\n\nMétricas: Margen ${co.margenNeto}% | ROIC ${co.roic}% | CAGR ${co.crecimientoCAGR}% | D/EBITDA ${co.deudaEbitda}x | FCF ${co.fcfMargin}% | P/E fwd ${co.peForward}x\nMoat: ${co.moat} — ${co.tipoMoat||'—'}\nInflación: ${co.escenarioInflacion} — ${co.escenarioInflacionExpl||''}\nRecesión: ${co.escenarioRecesion} — ${co.escenarioRecesionExpl||''}\nPredictibilidad: ${co.predictibilidad}\n\nFortalezas:\n${co.fortalezas?.map(f=>`• ${f}`).join('\n')||'—'}\nDebilidades:\n${co.debilidades?.map(d=>`• ${d}`).join('\n')||'—'}\nRed Flags: ${co.redFlag||'Ninguna'}\nResumen: ${co.notas||'—'}\nAnálisis: ${co.analisisCompleto||'—'}\n\n─────────────────────────────────────\nQuiero profundizar en: [escribe aquí tu pregunta]`}
function CopyButton({co}){const[copied,setCopied]=useState(false);return(<button onClick={async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(generateClaudeText(co));setCopied(true);setTimeout(()=>setCopied(false),2500)}catch(err){alert('No se pudo copiar')}}} style={{background:copied?'#f0fdf4':'#eff6ff',border:`1px solid ${copied?'#86efac':'#93c5fd'}`,color:copied?'#15803d':'#1d4ed8',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{copied?'✅ Copiado!':'📋 Copiar para Claude'}</button>)}
function DownloadButton({co}){return(<button onClick={e=>{e.stopPropagation();const b=new Blob([generateMarkdown(co)],{type:'text/markdown;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${co.ticker}-ANALISIS-${co.fecha||'2026'}.md`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u)}} style={{background:'#f0fdf4',border:'1px solid #86efac',color:'#15803d',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>⬇️ .md</button>)}
function PDFButton({co}){return(<button onClick={e=>{e.stopPropagation();const w=window.open('','_blank');w.document.write(generatePDFHtml(co));w.document.close();setTimeout(()=>w.print(),500)}} style={{background:'#fef2f2',border:'1px solid #fca5a5',color:'#dc2626',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📄 PDF</button>)}

// ═══════════════════════════════════════════════════════════════
// QUALITY COMPANY CARD
// ═══════════════════════════════════════════════════════════════
function CompanyCard({co,expanded,onToggle,onDelete}){
  const cl=getQClasif(co.clasificacion)
  return(<div style={{background:'white',borderRadius:12,overflow:'hidden',border:`1px solid ${expanded?cl.border:'#e2e8f0'}`,boxShadow:expanded?`0 0 0 2px ${cl.border}`:'0 1px 3px rgba(0,0,0,.04)',transition:'all .15s'}}>
    <div onClick={onToggle} style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',flexWrap:'wrap'}}>
      <QRing score={+co.score||0} clasificId={co.clasificacion}/>
      <div style={{flex:1,minWidth:160}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:2}}>
          <span style={{fontWeight:800,color:'#1e293b',fontSize:15}}>{co.nombre}</span>
          <span style={{color:'#94a3b8',fontSize:12,fontFamily:'monospace'}}>{co.ticker}</span>
          <QBadge cl={cl} small/>
        </div>
        <div style={{fontSize:11,color:'#94a3b8'}}>{co.pais} · {co.sector}</div>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        <QPill label="Margen" value={`${co.margenNeto}%`} good={parseFloat(co.margenNeto)>=20}/>
        <QPill label="ROIC" value={`${co.roic}%`} good={parseFloat(co.roic)>=12}/>
        <QPill label="CAGR" value={`${co.crecimientoCAGR}%`} good={parseFloat(co.crecimientoCAGR)>=10}/>
        <QPill label="D/EBITDA" value={`${co.deudaEbitda}x`} good={parseFloat(co.deudaEbitda)<=2}/>
        <QPill label="P/E fwd" value={`${co.peForward}x`} neutral/>
        <MoatBadge moat={co.moat}/>
        {co.accion&&<div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'3px 10px',fontSize:11,fontWeight:700,color:'#475569',whiteSpace:'nowrap'}}>{ACCION_LABEL[co.accion]||co.accion}</div>}
        <button onClick={e=>{e.stopPropagation();if(confirm('¿Eliminar?'))onDelete()}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:4,opacity:.5}}>🗑️</button>
        <span style={{color:'#cbd5e1',fontSize:11}}>{expanded?'▲':'▼'}</span>
      </div>
    </div>
    {expanded&&(<div style={{background:'#fafafa',padding:16,borderTop:`1px solid ${cl.border}`}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:12}}>
        <div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>📊 Financieras</div>
          {[['Margen Neto',`${co.margenNeto}%`,parseFloat(co.margenNeto)>=20],['ROIC',`${co.roic}%`,parseFloat(co.roic)>=12],['Crec. CAGR',`${co.crecimientoCAGR}%`,parseFloat(co.crecimientoCAGR)>=10],['D/EBITDA',`${co.deudaEbitda}x`,parseFloat(co.deudaEbitda)<=2],['FCF Margin',`${co.fcfMargin}%`,parseFloat(co.fcfMargin)>=20],['P/E Forward',`${co.peForward}x`,null],['Market Cap',co.marketCap||'—',null]].map(([l,v,ok])=><KV key={l} label={l} value={v} ok={ok}/>)}
        </div>
        <div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>🛡️ Calidad</div>
          {[['Tipo Moat',co.tipoMoat||co.moat],['Márgenes',co.tendenciaMargenes||'—'],['Deuda tend.',co.deudaTendencia||'—'],['Asset-light',co.assetLight?'✓ Sí':'✗ No'],['Criterios',`${co.criteriosOk||'?'}/7`],['Alocación',co.alocacion?`${co.alocacion}%`:'—']].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        </div>
        <div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>🌍 Escenarios</div>
          {co.escenarioInflacion&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>INFLACIÓN</div><EscenarioBadge val={co.escenarioInflacion}/>{co.escenarioInflacionExpl&&<div style={{fontSize:11,color:'#64748b',marginTop:4}}>{co.escenarioInflacionExpl}</div>}</div>}
          {co.escenarioRecesion&&<div style={{marginBottom:8}}><div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>RECESIÓN</div><EscenarioBadge val={co.escenarioRecesion}/>{co.escenarioRecesionExpl&&<div style={{fontSize:11,color:'#64748b',marginTop:4}}>{co.escenarioRecesionExpl}</div>}</div>}
          {co.predictibilidad&&<div><div style={{fontSize:10,color:'#94a3b8',marginBottom:3}}>PREDICTIBILIDAD</div><span style={{background:'#eff6ff',color:'#1d4ed8',borderRadius:12,padding:'2px 10px',fontSize:11,fontWeight:700}}>{co.predictibilidad}</span></div>}
        </div>
      </div>
      {co.descripcionNegocio&&<InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="🏢" style={{marginBottom:8}}>{co.descripcionNegocio}</InfoBox>}
      {(co.fortalezas||co.debilidades)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
        {co.fortalezas?.length>0&&<InfoBox color="#15803d" bg="#f0fdf4" border="#86efac" icon="✅" title="Fortalezas"><ul style={{margin:0,padding:'0 0 0 14px'}}>{co.fortalezas.map((f,i)=><li key={i} style={{fontSize:11,marginBottom:3}}>{f}</li>)}</ul></InfoBox>}
        {co.debilidades?.length>0&&<InfoBox color="#dc2626" bg="#fef2f2" border="#fca5a5" icon="⚠️" title="Debilidades"><ul style={{margin:0,padding:'0 0 0 14px'}}>{co.debilidades.map((d,i)=><li key={i} style={{fontSize:11,marginBottom:3}}>{d}</li>)}</ul></InfoBox>}
      </div>}
      {co.redFlag&&co.redFlag!=='Ninguna'&&<InfoBox color="#dc2626" bg="#fef2f2" border="#fca5a5" icon="🚨" style={{marginBottom:8}}>{co.redFlag}</InfoBox>}
      {co.notas&&<InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="📝" style={{marginBottom:8}}>{co.notas}</InfoBox>}
      {co.analisisCompleto&&<details style={{marginBottom:8}}><summary style={{cursor:'pointer',fontSize:12,fontWeight:700,color:'#475569',padding:'6px 0',userSelect:'none'}}>📄 Análisis completo</summary><div style={{marginTop:8,padding:'10px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#334155',lineHeight:1.65,whiteSpace:'pre-wrap'}}>{co.analisisCompleto}</div></details>}
      <div style={{paddingTop:12,borderTop:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <CopyButton co={co}/><DownloadButton co={co}/><PDFButton co={co}/>
        <span style={{fontSize:11,color:'#94a3b8'}}>Copia · .md · PDF</span>
      </div>
    </div>)}
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// IMAGE DROPZONE
// ═══════════════════════════════════════════════════════════════
function ImageDropzone({images,setImages}){
  const inputRef=useRef();const[dragging,setDragging]=useState(false);
  const addFiles=files=>{const imgs=Array.from(files).filter(f=>f.type.startsWith('image/'));setImages(prev=>[...prev,...imgs].slice(0,6))}
  return(<div>
    <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files)}} onClick={()=>inputRef.current?.click()} style={{border:`2px dashed ${dragging?'#3b82f6':'#93c5fd'}`,borderRadius:12,padding:'24px 20px',textAlign:'center',cursor:'pointer',background:dragging?'#eff6ff':'#f8fafc',marginBottom:16}}>
      <div style={{fontSize:28,marginBottom:8}}>📸</div>
      <div style={{fontWeight:700,color:'#1e293b',marginBottom:4}}>Arrastra los 3 screenshots de Koyfin</div>
      <div style={{fontSize:12,color:'#64748b'}}>o haz click · {images.length}/3 cargados</div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>addFiles(e.target.files)}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
      {SCREENSHOTS_INFO.map(({n,label,hint})=>{const img=images[n-1];return(<div key={n} style={{border:`1px solid ${img?'#86efac':'#e2e8f0'}`,borderRadius:10,padding:10,background:img?'#f0fdf4':'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><span style={{fontSize:16}}>{img?'✅':`${n}️⃣`}</span><strong style={{fontSize:12}}>{label}</strong></div>
        <div style={{fontSize:11,color:'#64748b'}}>{hint}</div>
        {img&&<div style={{fontSize:11,color:'#15803d',marginTop:4,fontWeight:600}}>✓ {img.name?.slice(0,25)||'Cargado'}</div>}
      </div>)})}
    </div>
    {images.length>0&&<button onClick={()=>setImages([])} style={{marginTop:10,background:'none',border:'1px solid #fca5a5',borderRadius:8,padding:'6px 14px',color:'#dc2626',fontSize:12,cursor:'pointer'}}>🗑️ Limpiar</button>}
  </div>)
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS RESULT (Quality)
// ═══════════════════════════════════════════════════════════════
function AnalysisResult({result,onSave,onBack}){
  const cl=getQClasif(result.clasificacion)
  return(<div>
    <div style={{background:cl.bg,border:`2px solid ${cl.border}`,borderRadius:14,padding:20,marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
      <QRing score={+result.score||0} clasificId={result.clasificacion} size={100}/>
      <div style={{flex:1}}>
        <div style={{fontSize:22,fontWeight:900,color:'#1e293b',marginBottom:4}}>{result.nombre}<span style={{color:'#94a3b8',fontSize:14,fontWeight:400,marginLeft:8}}>{result.ticker}</span></div>
        <QBadge cl={cl}/>
        <div style={{marginTop:8,fontSize:12,color:'#64748b'}}>{result.pais} · {result.sector}</div>
        <div style={{marginTop:4,fontSize:12,color:cl.color,fontWeight:700}}>{ACCION_LABEL[result.accion]||result.accion} · {result.alocacion}% cartera</div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,marginBottom:16}}>
      {[{l:'Margen',v:`${result.margenNeto}%`,ok:parseFloat(result.margenNeto)>=20},{l:'ROIC',v:`${result.roic}%`,ok:parseFloat(result.roic)>=12},{l:'CAGR',v:`${result.crecimientoCAGR}%`,ok:parseFloat(result.crecimientoCAGR)>=10},{l:'D/EBITDA',v:`${result.deudaEbitda}x`,ok:parseFloat(result.deudaEbitda)<=2},{l:'FCF',v:`${result.fcfMargin}%`,ok:parseFloat(result.fcfMargin)>=20},{l:'P/E fwd',v:`${result.peForward}x`,ok:null}].map(({l,v,ok})=>(
        <div key={l} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',marginBottom:4}}>{l}</div>
          <div style={{fontSize:16,fontWeight:800,color:ok===true?'#15803d':ok===false?'#dc2626':'#475569'}}>{v}</div>
        </div>
      ))}
    </div>
    {result.descripcionNegocio&&<InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="🏢" style={{marginBottom:10}}>{result.descripcionNegocio}</InfoBox>}
    {result.notas&&<InfoBox color="#1e40af" bg="#eff6ff" border="#bfdbfe" icon="📝" style={{marginBottom:10}}>{result.notas}</InfoBox>}
    {result.analisisCompleto&&<details style={{marginBottom:16}}><summary style={{cursor:'pointer',fontSize:13,fontWeight:700,color:'#475569',padding:'6px 0',userSelect:'none'}}>📄 Análisis completo</summary><div style={{marginTop:8,padding:'12px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#334155',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{result.analisisCompleto}</div></details>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button onClick={onSave} style={{flex:1,background:'#15803d',color:'white',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer'}}>✅ Guardar en Cartera</button>
      <CopyButton co={result}/><DownloadButton co={result}/><PDFButton co={result}/>
      <button onClick={onBack} style={{padding:'14px 20px',background:'white',border:'1px solid #e2e8f0',borderRadius:10,fontSize:14,cursor:'pointer',color:'#64748b'}}>← Volver</button>
    </div>
  </div>)
}


// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App(){
  // ── Navigation ──
  const[tab,setTab]=useState('cartera')

  // ── Quality Cartera ──
  const[qPortfolio,setQPortfolio]=useState([])
  const[qExpanded,setQExpanded]=useState(null)
  const[qFilter,setQFilter]=useState('TODOS')
  const[qImages,setQImages]=useState([])
  const[qAnalyzing,setQAnalyzing]=useState(false)
  const[qResult,setQResult]=useState(null)
  const[qError,setQError]=useState(null)
  const[qSaved,setQSaved]=useState(false)
  const[anthropicKey,setAnthropicKey]=useState(LS.get('anthropic-key')||'')

  // ── DCF ──
  const[dcfRows,setDcfRows]=useState([])
  const[dcfForm,setDcfForm]=useState(EMPTY_DCF)
  const[dcfErrors,setDcfErrors]=useState({})
  const[dcfEditIdx,setDcfEditIdx]=useState(null)
  const[sortKey,setSortKey]=useState('clasificacion')
  const[sortAsc,setSortAsc]=useState(true)
  const[refreshing,setRefreshing]=useState(false)
  const[lastUpd,setLastUpd]=useState(null)
  const[csvUrl,setCsvUrl]=useState(LS.get('gsheets-url')||'')
  const[showCfg,setShowCfg]=useState(false)
  const[dcfImg,setDcfImg]=useState(null)
  const[dcfImgFile,setDcfImgFile]=useState(null)
  const[dcfAnalyzing,setDcfAnalyzing]=useState(false)
  const[dcfLog,setDcfLog]=useState([])
  const dcfFileRef=useRef()

  // ── DGI ──
  const[dgiPortfolio,setDgiPortfolio]=useState([])
  const[dgiForm,setDgiForm]=useState({...DGI_EMPTY})
  const[dgiEditId,setDgiEditId]=useState(null)
  const[dgiExpanded,setDgiExpanded]=useState(null)
  const[dgiSaved,setDgiSaved]=useState(false)
  const[sYld,setSYld]=useState(2.5)
  const[sCagr,setSCagr]=useState(10)
  const[sInv,setSInv]=useState(10000)
  const[sYears,setSYears]=useState(10)

  // ── Load Quality ──
  useEffect(()=>{
    const existing=LS.get('cartera-calidad-v1')
    if(existing){const ids=new Set(existing.map(p=>p.id));const toAdd=SEED_CARTERA.filter(s=>!ids.has(s.id));const merged=[...existing,...toAdd];setQPortfolio(merged);LS.set('cartera-calidad-v1',merged)}
    else{setQPortfolio(SEED_CARTERA);LS.set('cartera-calidad-v1',SEED_CARTERA)}
  },[])

  // ── Load DCF ──
  useEffect(()=>{const saved=LS.get('dcf-rows-v1');setDcfRows(saved?.length?saved:SEED_DCF)},[])

  // ── Load DGI ──
  useEffect(()=>{
    const saved=LS.get('dgi-portfolio-v2')
    if(saved&&saved.length>0){
      // Preservar datos del usuario, solo añadir seed que no exista
      const savedIds=new Set(saved.map(p=>p.id))
      const toAdd=DGI_SEED.filter(s=>!savedIds.has(s.id))
      const final=[...saved,...toAdd]
      setDgiPortfolio(final)
      LS.set('dgi-portfolio-v2',final)
    }else{setDgiPortfolio(DGI_SEED);LS.set('dgi-portfolio-v2',DGI_SEED)}
  },[])

  // ── Quality handlers ──
  const saveQCompany=useCallback(co=>{setQPortfolio(prev=>{const next=prev.filter(p=>p.id!==co.id).concat(co);LS.set('cartera-calidad-v1',next);return next})},[])
  const delQCompany=useCallback(id=>{setQPortfolio(prev=>{const next=prev.filter(p=>p.id!==id);LS.set('cartera-calidad-v1',next);return next})},[])
  const runQAnalysis=async()=>{
    if(qImages.length===0){setQError('Sube al menos 1 screenshot');return}
    const key=anthropicKey||LS.get('anthropic-key')
    if(!key){setQError('Añade tu API key de Anthropic en ⚙️ Ajustes (clave sk-ant-...)');return}
    setQAnalyzing(true);setQError(null);setQResult(null)
    try{
      const imageData=(await Promise.all(qImages.map(f=>compressImage(f)))).filter(Boolean)
      const response=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:8192,messages:[{role:'user',content:[
          ...imageData.map(img=>({type:'image',source:{type:'base64',media_type:img.mediaType,data:img.data}})),
          {type:'text',text:ANALYSIS_PROMPT}
        ]}]})
      })
      const data=await response.json()
      if(data.error)throw new Error(data.error.message||data.error.type||'Error Anthropic API')
      const raw=data.content?.[0]?.text||''
      const match=raw.match(/\{[\s\S]*\}/)
      if(!match)throw new Error(`Claude no devolvió JSON. Respuesta: "${raw.slice(0,150)}"`)
      setQResult(cleanResult(JSON.parse(match[0])))
    }
    catch(e){setQError(e.message)}finally{setQAnalyzing(false)}
  }
  const saveQResult=()=>{
    if(!qResult)return
    const fecha=new Date().toISOString().slice(0,10)

    // ── Guardar en Quality Cartera (ID estable → reemplaza sin duplicados) ──
    const tickerKey=qResult.ticker?.toLowerCase()
    const qco={...qResult,id:`${tickerKey}-quality`,fecha}
    saveQCompany(qco)

    // ── Guardar en DCF tabla ──
    if(qResult.dcf_bn_base&&qResult.dcf_mktCap&&qResult.precio){
      // Preservar clasificación existente si la empresa ya estaba en DCF
      const existingDcf=dcfRows.find(r=>r.ticker===qResult.ticker)
      const dcfEntry=mkRow({
        ticker:qResult.ticker,
        bn:String(qResult.dcf_bn_base),
        fcf:String(qResult.dcf_fcf_base||0),
        cagrBn:String(qResult.dcf_cagr_bn||0),
        cagrFcf:qResult.dcf_fcf_base>0?String(qResult.dcf_cagr_fcf??0):'',
        mktCap:String(qResult.dcf_mktCap),
        price:String(qResult.precio),
        clasificacion:existingDcf?.clasificacion||'',
        note:qResult.dcf_fcf_note||''
      })
      const newDcf=[...dcfRows.filter(r=>r.ticker!==qResult.ticker),dcfEntry]
      persistDcf(newDcf)
    }

    // ── Guardar en DGI cartera ──
    if(qResult.dgi_yieldActual&&parseFloat(qResult.dgi_yieldActual)>0){
      const y=parseFloat(qResult.dgi_yieldActual)||0
      const d=parseFloat(qResult.dgi_cagrDiv)||0
      const dgiEntry={
        id:`${tickerKey}-dgi`,
        nombre:qResult.nombre,ticker:qResult.ticker,pais:qResult.pais,sector:qResult.sector,
        yieldActual:qResult.dgi_yieldActual,cagrDiv5Y:qResult.dgi_cagrDiv,
        rachaAnios:String(qResult.dgi_rachaAnios||0),aniosPagando:String(qResult.dgi_aniosPagando||0),
        payoutFCF:qResult.dgi_payoutFCF,crecBPA5Y:qResult.dgi_cagrBPA5Y,
        payoutEPS:qResult.dgi_payoutEPS,cagrFCF5Y:qResult.dgi_cagrFCF5Y,cagrFCF10Y:'',
        roic:qResult.roic,moat:qResult.dgi_moat,tipoMoat:qResult.dgi_tipoMoat,
        deudaEbitda:qResult.dgi_deudaEbitda,rating:qResult.dgi_rating,
        yieldVsHistorico:qResult.dgi_yieldVsHistorico,perVsHistorico:qResult.dgi_perVsHistorico,
        sensRecesion:qResult.dgi_sensRecesion,sensTipos:qResult.dgi_sensTipos,
        notasMacro:qResult.dgi_notasMacro,notas:qResult.dgi_notas,fecha,
        score:qResult.dgi_scoreTotal,chowder:Math.round((y+d)*10)/10,
        scoreA:qResult.dgi_scoreA,scoreB:qResult.dgi_scoreB,scoreC:qResult.dgi_scoreC,scoreD:0,
        clasificacion:qResult.dgi_clasificacion,
        yoc10opt:yoc10(y,d,1.0),yoc10base:yoc10(y,d,0.75),yoc10cons:yoc10(y,d,0.50)
      }
      const newDgi=[...dgiPortfolio.filter(p=>p.ticker!==qResult.ticker),dgiEntry]
      persistDgi(newDgi)
    }

    setQSaved(true);setTimeout(()=>setQSaved(false),3000)
    setTab('cartera');setQImages([]);setQResult(null)
  }

  // ── DCF handlers ──
  const persistDcf=nr=>{setDcfRows(nr);LS.set('dcf-rows-v1',nr)}
  const setDcfF=useCallback((k,v)=>{setDcfForm(p=>({...p,[k]:v}));setDcfErrors(p=>({...p,[k]:false}))},[])
  const sortedDcfRows=(()=>{const col=SORT_COLS.find(c=>c.key===sortKey);if(!col)return dcfRows;return[...dcfRows].sort((a,b)=>{const va=col.get(a),vb=col.get(b);return typeof va==='string'?sortAsc?va.localeCompare(vb):vb.localeCompare(va):sortAsc?va-vb:vb-va})})()
  const refreshFromSheets=async()=>{
    if(!csvUrl){alert('Configura la URL del Google Sheet en ⚙️ Ajustes');return}
    setRefreshing(true)
    try{const res=await fetch(csvUrl);if(!res.ok)throw new Error('Error fetching CSV');const text=await res.text();const parseCSVLine=line=>{const cols=[];let cur='',inQ=false;for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cols.push(cur);cur=''}else cur+=ch}cols.push(cur);return cols};const lines=text.trim().split('\n').slice(1);const priceMap={};lines.forEach(line=>{if(!line.trim())return;const cols=parseCSVLine(line);const ticker=(cols[0]||'').trim().replace(/"/g,'').toUpperCase();const raw=(cols[3]||'').trim().replace(/"/g,'');const normalized=raw.includes(',')&&raw.includes('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(',','.');const precio=parseFloat(normalized);if(ticker&&!isNaN(precio)&&precio>0)priceMap[ticker]=precio});if(!Object.keys(priceMap).length)throw new Error('Sin precios');const nr=dcfRows.map(row=>{const newPrice=priceMap[row.ticker];if(!newPrice)return row;const updated={...row,price:newPrice};return{...updated,...calcRow({...updated,cagrFcf:row.cagrFcf!=null?String(row.cagrFcf):''})}});persistDcf(nr);setLastUpd(new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}))}
    catch(e){alert('Error: '+e.message)}finally{setRefreshing(false)}
  }
  const analyzeDcf=async()=>{
    if(!dcfImgFile)return;setDcfAnalyzing(true);setDcfLog([])
    const addL=m=>setDcfLog(p=>[...p,m])
    try{addL('Analizando imagen…');const data=await fileToBase64(dcfImgFile);const res=await fetch('/api/analyze-dcf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:{data,mediaType:dcfImgFile.type}})});const json=await res.json();if(!res.ok||!json.ok)throw new Error(json.error||'Error');const d=json.result;addL(`✅ ${d.ticker} | ${d.price} ${d.divisa} | ${d.mktCap}M`);addL(`BN: ${d.bn_base}M → CAGR ${d.cagr_bn}%`);addL(`FCF: ${d.fcf_base}M → CAGR ${d.cagr_fcf}%`);setDcfForm({ticker:d.ticker||'',bn:String(d.bn_base||''),fcf:String(d.fcf_base||''),cagrBn:String(d.cagr_bn||''),cagrFcf:String(d.cagr_fcf??0),mktCap:String(d.mktCap||''),price:String(d.price||''),clasificacion:'',note:d.fcf_note||''});addL('→ Pre-rellenado. Ve a ✏️ DCF Manual');setTab('dcf-add')}
    catch(e){addL('❌ '+e.message)}finally{setDcfAnalyzing(false)}
  }
  const saveDcf=()=>{const errs={};['ticker','bn','cagrBn','mktCap','price'].forEach(k=>{if(!dcfForm[k]&&dcfForm[k]!=='0')errs[k]=true});if(Object.keys(errs).length){setDcfErrors(errs);return};setDcfErrors({});const row=mkRow(dcfForm);const nr=dcfEditIdx!==null?dcfRows.map((r,i)=>i===dcfEditIdx?row:r):[...dcfRows,row];persistDcf(nr);setDcfForm(EMPTY_DCF);setDcfEditIdx(null);setTab('dcf')}
  const delDcf=i=>persistDcf(dcfRows.filter((_,j)=>j!==i))
  const editDcf=i=>{const r=dcfRows[i];setDcfForm({ticker:r.ticker,bn:String(r.bn),fcf:String(r.fcf||''),cagrBn:String(r.cagrBn),cagrFcf:r.cagrFcf!=null?String(r.cagrFcf):'',mktCap:String(r.mktCap),price:String(r.price),clasificacion:r.clasificacion||'',note:r.note||''});setDcfEditIdx(i);setTab('dcf-add')}
  let dcfPreview=null;try{if(dcfForm.bn&&dcfForm.cagrBn&&dcfForm.mktCap&&dcfForm.price)dcfPreview=calcRow(dcfForm)}catch(e){}

  // ── DGI handlers ──
  const persistDgi=p=>{setDgiPortfolio(p);LS.set('dgi-portfolio-v2',p)}
  const dgiUpd=field=>e=>setDgiForm(p=>({...p,[field]:e.target.value}))
  const dgiSc=dgiCalcScore(dgiForm)
  const dgiCl=dgiGetClasif(dgiSc.total)
  const simData=yocGlobal(sYld,sCagr,sInv,sYears)
  const saveDgiCompany=async()=>{
    if(!dgiForm.nombre||!dgiForm.ticker){alert("Nombre y ticker obligatorios");return}
    const sc2=dgiCalcScore(dgiForm);const y=+dgiForm.yieldActual||0,d=+dgiForm.cagrDiv5Y||0
    const entry={...dgiForm,id:dgiEditId||String(Date.now()),score:sc2.total,chowder:sc2.chowder,scoreA:sc2.A,scoreB:sc2.B,scoreC:sc2.C,scoreD:sc2.D,clasificacion:dgiGetClasif(sc2.total).label,yoc10opt:yoc10(y,d,1.0),yoc10base:yoc10(y,d,0.75),yoc10cons:yoc10(y,d,0.50)}
    const newP=dgiEditId?dgiPortfolio.map(p=>p.id===dgiEditId?entry:p):[...dgiPortfolio,entry]
    persistDgi(newP);setDgiForm({...DGI_EMPTY});setDgiEditId(null);setDgiSaved(true);setTimeout(()=>setDgiSaved(false),2000);setTab('dgi-cartera')
  }
  const delDgi=async id=>{if(!confirm("¿Eliminar empresa?"))return;persistDgi(dgiPortfolio.filter(p=>p.id!==id))}
  const editDgi=c=>{setDgiForm({...c});setDgiEditId(c.id);setTab('dgi-analizar')}

  // ── Quality stats ──
  const qPilares=qPortfolio.filter(c=>getQClasif(c.clasificacion).grupo==='PILARES')
  const qAvgScore=qPortfolio.length?Math.round(qPortfolio.reduce((s,c)=>s+(+c.score||0),0)/qPortfolio.length):0
  const qFiltered=qPortfolio.filter(c=>qFilter==='TODOS'||getQClasif(c.clasificacion).grupo===qFilter).sort((a,b)=>(+b.score||0)-(+a.score||0))
  const qByGrupo={};GRUPOS.forEach(g=>{const items=qFiltered.filter(c=>getQClasif(c.clasificacion).grupo===g);if(items.length)qByGrupo[g]=items})

  // ── DGI stats ──
  const dgiByClasif={};['PILAR','COMPLEMENTARIA','VIGILANCIA','DESCARTABLE'].forEach(cl=>{const items=dgiPortfolio.filter(co=>co.clasificacion===cl).sort((a,b)=>(+b.score||0)-(+a.score||0));if(items.length)dgiByClasif[cl]=items})
  const DGI_CL_META={PILAR:{color:"#15803d",bg:"#f0fdf4",border:"#86efac",dot:"🟢"},COMPLEMENTARIA:{color:"#b45309",bg:"#fffbeb",border:"#fcd34d",dot:"🟡"},VIGILANCIA:{color:"#c2410c",bg:"#fff7ed",border:"#fdba74",dot:"🟠"},DESCARTABLE:{color:"#dc2626",bg:"#fef2f2",border:"#fca5a5",dot:"🔴"}}

  // ── Pre-calcular grupos cartera (evita JSX complejo) ──
  const qGruposJSX = GRUPOS.map(grupo => {
    const items = qByGrupo[grupo]
    if (!items) return null
    const gm = GRUPO_META[grupo]
    return (
      <div key={grupo}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{background:gm.bg,border:`1px solid ${gm.border}`,borderRadius:8,padding:'3px 12px',color:gm.color,fontWeight:800,fontSize:12}}>{gm.icon} {grupo}</div>
          <div style={{fontSize:11,color:'#94a3b8'}}>{items.length} empresa{items.length!==1?'s':''}</div>
          <div style={{flex:1,height:1,background:'#e2e8f0'}}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
          {items.map(co => (
            <CompanyCard key={co.id} co={co} expanded={qExpanded===co.id} onToggle={()=>setQExpanded(qExpanded===co.id?null:co.id)} onDelete={()=>delQCompany(co.id)}/>
          ))}
        </div>
      </div>
    )
  })

  // ── Inner components ──
  function DcfInp({k,label,ph,full}){return(<div style={{gridColumn:full?'1/-1':'auto',display:'flex',flexDirection:'column',gap:3}}><label style={{fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',color:dcfErrors[k]?C.red:C.dim}}>{label}{dcfErrors[k]?' *':''}</label><input value={dcfForm[k]??''} onChange={e=>setDcfF(k,e.target.value)} placeholder={ph} style={{background:C.bg,border:`1px solid ${dcfErrors[k]?C.red:C.brd}`,color:C.txt,borderRadius:6,padding:'9px 11px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}}/></div>)}
  function SortTh({col,children}){const active=sortKey===col.key;return(<th onClick={()=>{if(sortKey===col.key)setSortAsc(a=>!a);else{setSortKey(col.key);setSortAsc(true)}}} style={{padding:'10px 8px',textAlign:col.align,color:active?C.acc:C.dim,fontWeight:600,fontSize:10,letterSpacing:1,textTransform:'uppercase',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',...(col.sep?{borderLeft:`2px solid ${C.brd}`,paddingLeft:12}:{})}}>{children}<span style={{opacity:.6,fontSize:9}}>{active?(sortAsc?' ▲':' ▼'):' ⇅'}</span></th>)}

  const NAV=[
    {id:'cartera',label:`💼 Cartera (${qPortfolio.length})`,group:'Q'},
    {id:'analizar',label:'🔍 Analizar',group:'Q'},
    {id:'dcf',label:`📊 DCF (${dcfRows.length})`,group:'D'},
    {id:'dcf-koyfin',label:'📸 DCF Koyfin',group:'D'},
    {id:'dcf-add',label:dcfEditIdx!==null?'✏️ Edit DCF':'➕ DCF Manual',group:'D'},
    {id:'dgi-sim',label:'📈 DGI Sim',group:'G'},
    {id:'dgi-analizar',label:'🔍 DGI Analizar',group:'G'},
    {id:'dgi-cartera',label:`💼 DGI (${dgiPortfolio.length})`,group:'G'},
  ]
  const NAV_COLORS={Q:'#15803d',D:'#1d4ed8',G:'#b45309'}

  const sliders=[{l:"Yield inicial",val:sYld,set:setSYld,min:0.1,max:10,step:0.1,fmt:v=>`${v}%`},{l:"CAGR dividendo",val:sCagr,set:setSCagr,min:1,max:30,step:0.5,fmt:v=>`${v}%/año`},{l:"Inversión",val:sInv,set:setSInv,min:1000,max:500000,step:1000,fmt:v=>`${v.toLocaleString("es")}€`},{l:"Horizonte",val:sYears,set:setSYears,min:3,max:30,step:1,fmt:v=>`${v} años`}]


  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return(<div style={{minHeight:'100vh',background:'#f0f4f8',fontFamily:'system-ui,-apple-system,sans-serif'}}>

    {/* HEADER */}
    <div style={{background:'#0f2246',color:'white',padding:'12px 20px',boxShadow:'0 2px 8px rgba(0,0,0,.25)'}}>
      <div style={{maxWidth:1300,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:17,fontWeight:900,letterSpacing:'-.5px'}}>Quality Compounders + DCF + DGI</div>
          <div style={{fontSize:10,color:'#7eb3e8',marginTop:1}}>Herramientas de Inversión · Análisis con Claude AI</div>
        </div>
        <div style={{display:'flex',gap:14}}>
          {[{l:'Cartera',v:qPortfolio.length,c:'#86efac'},{l:'Pilares',v:qPilares.length,c:'#86efac'},{l:'DCF',v:dcfRows.length,c:'#93c5fd'},{l:'DGI',v:dgiPortfolio.length,c:'#fcd34d'}].map(({l,v,c})=>(
            <div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,color:'#7eb3e8'}}>{l}</div><div style={{fontSize:18,fontWeight:900,color:c}}>{v}</div></div>
          ))}
        </div>
      </div>
    </div>

    {/* TABS */}
    <div style={{background:'white',borderBottom:'1px solid #e2e8f0',overflowX:'auto'}}>
      <div style={{maxWidth:1300,margin:'0 auto',display:'flex',alignItems:'center',minWidth:'max-content'}}>
        {NAV.map((t,i)=>{
          const prevGroup=i>0?NAV[i-1].group:null
          return(<span key={t.id} style={{display:'flex',alignItems:'center'}}>
            {prevGroup&&prevGroup!==t.group&&<div style={{width:1,height:24,background:'#e2e8f0',margin:'0 4px'}}/>}
            <button onClick={()=>setTab(t.id)} style={{padding:'12px 14px',fontSize:12,fontWeight:500,cursor:'pointer',background:'none',border:'none',borderBottom:tab===t.id?`2.5px solid ${NAV_COLORS[t.group]}`:'2.5px solid transparent',color:tab===t.id?NAV_COLORS[t.group]:'#64748b',whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          </span>)
        })}
        <button onClick={()=>setShowCfg(c=>!c)} style={{marginLeft:'auto',marginRight:12,padding:'7px 10px',borderRadius:6,border:'1px solid #e2e8f0',cursor:'pointer',fontSize:13,background:'transparent',color:'#64748b'}}>⚙️</button>
        {qSaved&&<div style={{marginRight:12,background:'#f0fdf4',border:'1px solid #86efac',color:'#15803d',padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>✅ Guardado</div>}
      </div>
    </div>

    {/* SETTINGS */}
    {showCfg&&(<div style={{background:'#0d1525',borderBottom:`1px solid ${C.brd}`,padding:'14px 20px',display:'flex',gap:16,alignItems:'flex-end',flexWrap:'wrap'}}>
      <div style={{display:'flex',flexDirection:'column',gap:4,flex:'1 1 340px'}}>
        <label style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:'uppercase'}}>🔑 Anthropic API Key (para análisis con Claude)</label>
        <input type="password" value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)} placeholder="sk-ant-api03-..." style={{background:C.bg,border:`1px solid ${anthropicKey?C.grn:C.brd}`,color:C.txt,borderRadius:6,padding:'9px 11px',fontSize:13,outline:'none'}}/>
        <div style={{fontSize:10,color:C.mut}}>Obtenla en console.anthropic.com · Se guarda solo en tu navegador</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:4,flex:'1 1 340px'}}>
        <label style={{fontSize:10,color:C.dim,fontWeight:700,textTransform:'uppercase'}}>📊 URL Google Sheet CSV (precios DCF)</label>
        <input value={csvUrl} onChange={e=>setCsvUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv" style={{background:C.bg,border:`1px solid ${C.brd}`,color:C.txt,borderRadius:6,padding:'9px 11px',fontSize:13,outline:'none'}}/>
      </div>
      <button onClick={()=>{LS.set('anthropic-key',anthropicKey);LS.set('gsheets-url',csvUrl);setShowCfg(false)}} style={{padding:'9px 20px',background:C.acc,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>💾 Guardar</button>
    </div>)}

    <div style={{maxWidth:1300,margin:'0 auto',padding:'20px 16px'}}>

      {/* ══ MI CARTERA (Quality) ══ */}
      {tab==='cartera'&&(<div style={{display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12}}>
          {[{l:'🏆 Pilares',v:qPilares.length,sub:'PURO + CÍCLICO',c:'#15803d',bg:'#f0fdf4',b:'#86efac'},{l:'📋 Complementarias',v:qPortfolio.filter(c=>getQClasif(c.clasificacion).grupo==='COMPLEMENTARIAS').length,sub:'Fuerte/Media/Débil',c:'#b45309',bg:'#fffbeb',b:'#fcd34d'},{l:'⭐ Score Medio',v:qAvgScore,sub:'Todas',c:'#1d4ed8',bg:'#eff6ff',b:'#93c5fd'},{l:'📊 Total',v:qPortfolio.length,sub:'Analizadas',c:'#475569',bg:'#f8fafc',b:'#cbd5e1'}].map(({l,v,sub,c,bg,b})=>(
            <div key={l} style={{background:bg,border:`1px solid ${b}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:11,color:c,fontWeight:700,marginBottom:4}}>{l}</div>
              <div style={{fontSize:28,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['TODOS',...GRUPOS].map(g=>(
            <button key={g} onClick={()=>setQFilter(g)} style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:qFilter===g?'2px solid #15803d':'2px solid #e2e8f0',background:qFilter===g?'#f0fdf4':'white',color:qFilter===g?'#15803d':'#64748b'}}>
              {g==='TODOS'?`Todos (${qPortfolio.length})`:`${GRUPO_META[g]?.icon} ${g} (${qPortfolio.filter(c=>getQClasif(c.clasificacion).grupo===g).length})`}
            </button>
          ))}
        </div>
        {qFiltered.length===0&&<div style={{textAlign:'center',padding:40,color:'#94a3b8'}}><div style={{fontSize:32,marginBottom:8}}>📭</div><div>No hay empresas</div></div>}
        {qGruposJSX}
        <button onClick={()=>setTab('analizar')} style={{width:'100%',border:'2px dashed #86efac',background:'transparent',color:'#15803d',borderRadius:12,padding:14,fontSize:13,cursor:'pointer',fontWeight:600}}>🔍 Analizar nueva empresa con Claude</button>
      </div>)}

      {/* ══ ANALIZAR (Quality + Claude) ══ */}
      {tab==='analizar'&&(<div style={{maxWidth:760,margin:'0 auto'}}>
        {!qResult?(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:20}}>
              <h2 style={{margin:'0 0 4px',fontSize:18,fontWeight:800,color:'#1e293b'}}>🔍 Analizar empresa con Claude</h2>
              <p style={{margin:'0 0 16px',fontSize:13,color:'#64748b'}}>Sube hasta 6 screenshots de Koyfin. Claude analiza y guarda en Cartera.</p>
              <ImageDropzone images={qImages} setImages={setQImages}/>
            </div>
            {qError&&<div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:10,padding:12,color:'#dc2626',fontSize:13}}>❌ {qError}</div>}
            <button onClick={runQAnalysis} disabled={qAnalyzing||qImages.length===0} style={{width:'100%',background:qAnalyzing?'#94a3b8':'#0f2246',color:'white',border:'none',borderRadius:12,padding:16,fontSize:15,fontWeight:700,cursor:qAnalyzing||qImages.length===0?'not-allowed':'pointer',opacity:qImages.length===0?.5:1}}>
              {qAnalyzing?'⏳ Analizando con Claude Sonnet 4.6… (30-60 seg)':`🚀 Analizar ${qImages.length>0?`${qImages.length} imágenes`:'empresa'} con Claude`}
            </button>
          </div>
        ):<AnalysisResult result={qResult} onSave={saveQResult} onBack={()=>setQResult(null)}/>}
      </div>)}

      {/* ══ DCF TABLA ══ */}
      {tab==='dcf'&&(<div style={{color:C.txt}}>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={refreshFromSheets} disabled={refreshing} style={{padding:'7px 14px',borderRadius:6,border:`1px solid ${C.acc}`,cursor:refreshing?'not-allowed':'pointer',fontSize:12,fontWeight:600,background:C.accD,color:refreshing?C.mut:C.acc}}>{refreshing?'⏳ Actualizando…':'🔄 Precios GSheets'}</button>
          {lastUpd&&<span style={{fontSize:10,color:C.mut}}>✓ {lastUpd}</span>}
          <button onClick={()=>{setDcfEditIdx(null);setDcfForm(EMPTY_DCF);setTab('dcf-koyfin')}} style={{padding:'7px 14px',borderRadius:6,border:`1px solid ${C.brd}`,cursor:'pointer',fontSize:12,background:'transparent',color:C.dim}}>📸 Analizar Koyfin</button>
          <button onClick={()=>{setDcfEditIdx(null);setDcfForm(EMPTY_DCF);setTab('dcf-add')}} style={{padding:'7px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:C.acc,color:'#fff'}}>✏️ Añadir</button>
        </div>
        <div style={{overflowX:'auto',background:C.surf,borderRadius:12,border:`1px solid ${C.brd}`}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,color:C.txt}}>
            <thead><tr style={{borderBottom:`2px solid ${C.brd}`}}>{SORT_COLS.map(col=><SortTh key={col.key} col={col}>{col.label}</SortTh>)}<th/><th/></tr></thead>
            <tbody>{sortedDcfRows.map((r,si)=>{
              const origIdx=dcfRows.findIndex(x=>x.ticker===r.ticker)
              return(<tr key={r.ticker+si} style={{borderBottom:`1px solid ${C.brd}`}} onMouseEnter={e=>e.currentTarget.style.background=C.surf} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'8px 8px'}}><ClaseSelect row={r} rows={dcfRows} persist={persistDcf}/></td>
                <td style={{padding:'10px 8px',fontWeight:800,color:C.acc,fontSize:13}}>{r.ticker}</td>
                <td style={{padding:'10px 8px',textAlign:'right',color:C.dim}}>{f2(r.price)}</td>
                <td style={{padding:'10px 8px',textAlign:'right',color:C.dim}}>{r.cagrBn?.toFixed(2)}%</td>
                <td style={{padding:'10px 8px',textAlign:'right',color:C.dim}}>{r.cagrFcf!=null?r.cagrFcf.toFixed(2)+'%':'—'}</td>
                <td style={{padding:'10px 8px',textAlign:'right',fontWeight:600}}>{f2(r.poBn)}</td>
                <td style={{padding:'10px 8px',textAlign:'right',fontWeight:600}}>{f2(r.poFcf)}</td>
                <td style={{padding:'10px 8px',textAlign:'right',fontWeight:800,fontSize:13}}>{f2(r.poMed)}</td>
                <td style={{padding:'10px 8px',textAlign:'center'}}><DifBadge d={r.difBn}/></td>
                <td style={{padding:'10px 8px',textAlign:'center'}}><DifBadge d={r.difFcf}/></td>
                <td style={{padding:'10px 8px',textAlign:'center',borderLeft:`2px solid ${C.brd}`,paddingLeft:12}}><DifBadge d={r.difMed}/></td>
                <td style={{padding:'10px 8px',color:C.mut,fontSize:10,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.note}</td>
                <td style={{padding:'10px 8px'}}><button onClick={()=>editDcf(origIdx>=0?origIdx:si)} style={{background:'transparent',border:`1px solid ${C.brd}`,color:C.dim,padding:'2px 7px',borderRadius:4,cursor:'pointer',fontSize:10}}>✏️</button></td>
                <td style={{padding:'10px 8px'}}><button onClick={()=>delDcf(origIdx>=0?origIdx:si)} style={{background:'transparent',border:`1px solid ${C.brd}`,color:C.red,padding:'2px 7px',borderRadius:4,cursor:'pointer',fontSize:10}}>🗑</button></td>
              </tr>)
            })}</tbody>
          </table>
        </div>
        <div style={{marginTop:8,fontSize:11,color:C.mut}}>💡 Clic en cabecera para ordenar · Clic en "Clase" para clasificar · Dif% Media = promedio BN+FCF</div>
      </div>)}

      {/* ══ DCF KOYFIN ══ */}
      {tab==='dcf-koyfin'&&(<div style={{maxWidth:560,color:C.txt}}>
        <div style={{background:C.surf,border:`1px solid ${C.brd}`,borderRadius:12,padding:22,marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:4}}>📸 Analizar Koyfin → datos DCF</div>
          <div style={{fontSize:12,color:C.dim,marginBottom:14}}>Sube 1 screenshot de "Actuals and Consensus". Claude extrae BN, FCF y CAGR.</div>
          <div onClick={()=>dcfFileRef.current?.click()} style={{border:`2px dashed ${dcfImg?C.acc:C.brd}`,borderRadius:10,padding:dcfImg?'6px':'32px 20px',textAlign:'center',cursor:'pointer',marginBottom:12}}>
            {dcfImg?<img src={dcfImg} style={{maxWidth:'100%',maxHeight:260,borderRadius:8}} alt="preview"/>:<div><div style={{fontSize:26,marginBottom:6}}>🖼</div><div style={{color:C.dim,fontSize:13}}>Clic para subir imagen</div></div>}
          </div>
          <input ref={dcfFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(!f)return;setDcfImgFile(f);const r=new FileReader();r.onload=ev=>setDcfImg(ev.target.result);r.readAsDataURL(f)}}/>
          <button onClick={analyzeDcf} disabled={!dcfImgFile||dcfAnalyzing} style={{width:'100%',padding:'11px',background:(!dcfImgFile||dcfAnalyzing)?C.mut:C.acc,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:(!dcfImgFile||dcfAnalyzing)?'not-allowed':'pointer'}}>{dcfAnalyzing?'⏳ Analizando…':'🔍 Extraer datos DCF'}</button>
        </div>
        {dcfLog.length>0&&<div style={{background:'#060d1a',border:`1px solid ${C.brd}`,borderRadius:8,padding:12,fontFamily:'monospace',fontSize:12}}>{dcfLog.map((l,i)=><div key={i} style={{color:l.startsWith('❌')?C.red:l.startsWith('✅')?C.grn:C.dim,marginBottom:2}}>{l}</div>)}</div>}
      </div>)}

      {/* ══ DCF MANUAL ══ */}
      {tab==='dcf-add'&&(<div style={{maxWidth:540,color:C.txt}}>
        <div style={{background:C.surf,border:`1px solid ${C.brd}`,borderRadius:12,padding:22}}>
          <div style={{fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>{dcfEditIdx!==null?`✏️ Editar ${dcfRows[dcfEditIdx]?.ticker}`:'✏️ Nueva valoración DCF'}</span>
            {dcfForm.ticker&&<span style={{fontSize:11,color:C.gold,fontWeight:600}}>{dcfForm.ticker.toUpperCase()}</span>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <DcfInp k="ticker" label="Ticker" ph="MA, GOOGL…"/>
            <DcfInp k="price" label="Precio actual" ph="484.09"/>
            <DcfInp k="mktCap" label="Market Cap (M)" ph="432770"/>
            <DcfInp k="bn" label="BN Ajustado (M)" ph="15415"/>
            <DcfInp k="cagrBn" label="CAGR BN %" ph="12.25"/>
            <DcfInp k="fcf" label="FCF base (M)" ph="16433"/>
            <DcfInp k="cagrFcf" label="CAGR FCF % (0=neg)" ph="11.71"/>
            <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:6}}>
              <label style={{fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',color:C.dim}}>Clasificación DCF</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{CLASES_DCF.map(c=>{const active=dcfForm.clasificacion===c.value;return(<button key={c.value} onClick={()=>setDcfF('clasificacion',c.value)} style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${active?c.border:C.brd}`,background:active?c.bg:'transparent',color:active?c.color:C.dim,cursor:'pointer',fontSize:12,fontWeight:active?700:500}}>{c.label||'Sin clasificar'}</button>)})}</div>
            </div>
            <DcfInp k="note" label="Nota" ph="BN 3Y / FCF 4Y…" full/>
          </div>
          {dcfPreview&&(<div style={{marginTop:14,background:C.bg,border:`1px solid ${C.accD}`,borderRadius:8,padding:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>{[['PO BN',f2(dcfPreview.poBn)],['PO FCF',f2(dcfPreview.poFcf)],['PO Media',f2(dcfPreview.poMed)]].map(([l,v])=><div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,color:C.mut,textTransform:'uppercase',marginBottom:3}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:l==='PO Media'?'#fff':C.dim}}>{v}</div></div>)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,borderTop:`1px solid ${C.brd}`,paddingTop:10}}>{[['Dif% BN',dcfPreview.difBn],['Dif% FCF',dcfPreview.difFcf],['Dif% Media',dcfPreview.difMed]].map(([l,d])=><div key={l} style={{textAlign:'center'}}><div style={{fontSize:9,color:C.mut,textTransform:'uppercase',marginBottom:5}}>{l}</div><DifBadge d={d}/></div>)}</div>
          </div>)}
          <button onClick={saveDcf} style={{marginTop:14,width:'100%',padding:'13px',background:C.acc,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:800,cursor:'pointer'}}>{dcfEditIdx!==null?'💾 Guardar cambios':'✅ Añadir a tabla DCF'}</button>
        </div>
      </div>)}


      {/* ══ DGI SIMULADOR ══ */}
      {tab==='dgi-sim'&&(<div style={{display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <DGICard>
            <div style={{fontWeight:700,color:'#1e293b',marginBottom:20}}>⚙️ Parámetros</div>
            {sliders.map(({l,val,set,min,max,step,fmt})=>(
              <div key={l} style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:'#475569'}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:'#2563eb'}}>{fmt(val)}</span></div>
                <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(parseFloat(e.target.value))} style={{width:'100%',accentColor:'#3b82f6',cursor:'pointer'}}/>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8}}>
              {[{l:'YoC inicial',v:`${sYld}%`,hi:false},{l:`YoC año ${sYears}`,v:`${(sYld*(1+sCagr/100)**sYears).toFixed(2)}%`,hi:true},{l:'Renta año 1',v:`${Math.round(sInv*sYld/100).toLocaleString('es')}€`,hi:false},{l:`Renta año ${sYears}`,v:`${Math.round(sInv*sYld*(1+sCagr/100)**sYears/100).toLocaleString('es')}€`,hi:true}].map(({l,v,hi})=>(
                <div key={l} style={{background:hi?'#eff6ff':'#f8fafc',border:'1px solid '+(hi?'#bfdbfe':'#e2e8f0'),borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'#64748b'}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:900,color:hi?'#1d4ed8':'#1e293b',marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          </DGICard>
          <DGICard style={{overflowY:'auto',maxHeight:420}}>
            <div style={{fontWeight:700,color:'#1e293b',marginBottom:12}}>📋 Proyección año a año</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#f8fafc'}}>{['Año','YoC base','Renta/año','Renta/mes'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:'#94a3b8',fontWeight:600,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{simData.map((r,i)=><tr key={i} style={{background:i%2===0?'white':'#f8fafc',borderTop:'1px solid #f1f5f9'}}>
                <td style={{padding:'7px 8px',fontWeight:600,color:'#475569'}}>{r.año}</td>
                <td style={{padding:'7px 8px',fontWeight:700,color:r['Base']>=5?'#15803d':r['Base']>=3?'#2563eb':'#475569'}}>{r['Base']}%</td>
                <td style={{padding:'7px 8px',color:'#334155'}}>{r.renta.toLocaleString('es')}€</td>
                <td style={{padding:'7px 8px',color:'#64748b'}}>{Math.round(r.renta/12).toLocaleString('es')}€</td>
              </tr>)}</tbody>
            </table>
          </DGICard>
        </div>
        <DGICard>
          <div style={{fontWeight:700,color:'#1e293b',marginBottom:4}}>📈 Evolución del Yield on Cost</div>
          <div style={{fontSize:12,color:'#94a3b8',marginBottom:16}}>Escenario base ({sCagr}% CAGR) · Optimista (+3%) · Conservador (−4%)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={simData}>
              <defs><linearGradient id="gBase" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="año" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v=>[`${v}%`]}/>
              <Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
              <Area type="monotone" dataKey="Optimista (+3%)" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="5 3" fill="none"/>
              <Area type="monotone" dataKey="Base" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gBase)"/>
              <Area type="monotone" dataKey="Conservador (−4%)" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" fill="none"/>
            </AreaChart>
          </ResponsiveContainer>
        </DGICard>
      </div>)}

      {/* ══ DGI ANALIZAR ══ */}
      {tab==='dgi-analizar'&&(<div style={{display:'flex',flexDirection:'column',gap:16}}>
        {/* Score banner */}
        <div style={{background:dgiCl.bg,border:`2px solid ${dgiCl.border}`,borderRadius:14,padding:16,display:'flex',alignItems:'center',gap:16}}>
          <DGIRing score={dgiSc.total}/>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Clasificación en tiempo real</div>
            <div style={{fontSize:22,fontWeight:900,color:dgiCl.color}}>{dgiCl.dot} {dgiCl.label}</div>
            <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{dgiSc.total>=70?'Calidad DGI de primer nivel · PILAR':dgiSc.total>=52?'Buena empresa con limitaciones · COMPLEMENTARIA':dgiSc.total>=38?'No entra ahora · Monitorizar · VIGILANCIA':'No cumple criterios mínimos · DESCARTABLE'}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[['A',dgiSc.A,35],['B',dgiSc.B,30],['C',dgiSc.C,25]].map(([l,v,m])=>(
              <div key={l} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',textAlign:'center',minWidth:60}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase'}}>Bloque {l}</div>
                <div style={{fontSize:15,fontWeight:800,color:'#1e293b',marginTop:2}}>{v}<span style={{fontSize:11,color:'#94a3b8'}}>/{m}</span></div>
              </div>
            ))}
          </div>
        </div>
        <UpgradeHint company={{...dgiForm,score:dgiSc.total,chowder:dgiSc.chowder,scoreA:dgiSc.A,scoreB:dgiSc.B,scoreC:dgiSc.C,scoreD:dgiSc.D,clasificacion:dgiCl.label}}/>

        {/* Info general */}
        <DGICard>
          <div style={{fontSize:11,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>Información General</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {[{l:"Empresa",f:"nombre",ph:"Visa Inc."},{l:"Ticker",f:"ticker",ph:"V"},{l:"País",f:"pais",ph:"USA"},{l:"Sector",f:"sector",ph:"Pagos"}].map(({l,f,ph})=>(
              <DGIFld key={f} label={l}><DGIInp value={dgiForm[f]} onChange={dgiUpd(f)} placeholder={ph}/></DGIFld>
            ))}
          </div>
        </DGICard>

        {/* Bloque A */}
        <DGICard>
          <DGIBHeader letter="A" title="El Dividendo" pts={dgiSc.A} max={35}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
            <DGIFld label="Yield actual (%)" hint="Sweet spot: 2–3.5%"><DGIInp type="number" step="0.1" min="0" value={dgiForm.yieldActual} onChange={dgiUpd('yieldActual')} placeholder="2.5"/></DGIFld>
            <DGIFld label="CAGR Div 5Y (%)" hint="Objetivo: ≥10%"><DGIInp type="number" step="0.1" min="0" value={dgiForm.cagrDiv5Y} onChange={dgiUpd('cagrDiv5Y')} placeholder="10"/></DGIFld>
            <DGIFld label="Racha incrementos" hint="Mínimo: 7 años"><DGIInp type="number" step="1" min="0" value={dgiForm.rachaAnios} onChange={dgiUpd('rachaAnios')} placeholder="15"/></DGIFld>
            <DGIFld label="Años pagando" hint="Informativo"><DGIInp type="number" step="1" min="0" value={dgiForm.aniosPagando} onChange={dgiUpd('aniosPagando')} placeholder="20"/></DGIFld>
            <DGIFld label="Chowder (auto)">
              <div style={{background:dgiSc.chowder>=12?'#f0fdf4':'#fef2f2',border:`1px solid ${dgiSc.chowder>=12?'#86efac':'#fca5a5'}`,color:dgiSc.chowder>=12?'#15803d':'#dc2626',borderRadius:8,padding:'8px 12px',textAlign:'center',fontWeight:900,fontSize:18}}>
                {dgiSc.chowder>0?dgiSc.chowder:'—'}<div style={{fontSize:11,fontWeight:400,marginTop:2}}>{dgiSc.chowder>=12?'✅ Pasa el filtro':dgiSc.chowder>0?'❌ Bajo umbral':'sin datos'}</div>
              </div>
            </DGIFld>
          </div>
        </DGICard>

        {/* Bloque B */}
        <DGICard>
          <DGIBHeader letter="B" title="Sostenibilidad del Dividendo" pts={dgiSc.B} max={30}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            <DGIFld label="Payout FCF (%)" hint="Objetivo: <55%"><DGIInp type="number" step="0.1" value={dgiForm.payoutFCF} onChange={dgiUpd('payoutFCF')} placeholder="45"/></DGIFld>
            <DGIFld label="Payout EPS (%)" hint="Objetivo: <60%"><DGIInp type="number" step="0.1" value={dgiForm.payoutEPS} onChange={dgiUpd('payoutEPS')} placeholder="40"/></DGIFld>
            <DGIFld label="CAGR BPA 5Y (%)" hint="Informativo"><DGIInp type="number" step="0.1" value={dgiForm.crecBPA5Y} onChange={dgiUpd('crecBPA5Y')} placeholder="12"/></DGIFld>
            <DGIFld label="CAGR FCF 5Y (%)" hint="Puntúa en Bloque B"><DGIInp type="number" step="0.1" value={dgiForm.cagrFCF5Y} onChange={dgiUpd('cagrFCF5Y')} placeholder="10"/></DGIFld>
            <DGIFld label="CAGR FCF 10Y (%)" hint="Sostenibilidad LP"><DGIInp type="number" step="0.1" value={dgiForm.cagrFCF10Y} onChange={dgiUpd('cagrFCF10Y')} placeholder="9"/></DGIFld>
          </div>
        </DGICard>

        {/* Bloque C */}
        <DGICard>
          <DGIBHeader letter="C" title="Calidad del Negocio" pts={dgiSc.C} max={25}/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            <DGIFld label="ROIC (%)" hint="Objetivo: ≥15%"><DGIInp type="number" step="0.1" value={dgiForm.roic} onChange={dgiUpd('roic')} placeholder="20"/></DGIFld>
            <DGIFld label="Foso — ancho"><DGISel value={dgiForm.moat} onChange={dgiUpd('moat')} options={[{v:'amplio',l:'Amplio (wide moat)'},{v:'estrecho',l:'Estrecho (narrow moat)'},{v:'ninguno',l:'Sin foso'}]}/></DGIFld>
            <DGIFld label="Foso — tipo / durabilidad"><DGISel value={dgiForm.tipoMoat||'ninguna'} onChange={dgiUpd('tipoMoat')} options={[{v:'monopolio_duopolio',l:'🏆 Monopolio / duopolio (+7pts)'},{v:'red_clientes',l:'🔗 Red de clientes (+6pts)'},{v:'costes_cambio',l:'🔒 Costes de cambio altos (+5pts)'},{v:'datos_propietarios',l:'📊 Datos propietarios únicos (+4pts)'},{v:'escala_marca',l:'🏷️ Escala o marca (+2pts)'},{v:'ninguna',l:'Sin ventaja clara (0pts)'}]}/></DGIFld>
            <DGIFld label="Deuda neta / EBITDA" hint="Objetivo: <2.5x"><DGIInp type="number" step="0.1" value={dgiForm.deudaEbitda} onChange={dgiUpd('deudaEbitda')} placeholder="1.5"/></DGIFld>
            <DGIFld label="Rating crediticio"><DGISel value={dgiForm.rating} onChange={dgiUpd('rating')} options={["AAA","AA+","AA","AA-","A+","A","A-","BBB+","BBB","BBB-","BB+","BB","Sin rating"].map(r=>({v:r,l:r}))}/></DGIFld>
          </div>
        </DGICard>

        {/* Bloque D */}
        <DGICard style={{border:'1px dashed #cbd5e1',background:'#f8fafc'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#64748b'}}>🎯 Indicador de Entrada</span>
            <span style={{fontSize:10,color:'#94a3b8',background:'#e2e8f0',padding:'2px 8px',borderRadius:99}}>informativo · no afecta al score</span>
            <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:'#64748b'}}>{dgiSc.D}/10 pts</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <DGIFld label="Yield vs. media histórica 5Y"><DGISel value={dgiForm.yieldVsHistorico} onChange={dgiUpd('yieldVsHistorico')} options={[{v:'mayor',l:'Mayor → acción más barata (+6 pts)'},{v:'igual',l:'Similar a la media (+3 pts)'},{v:'menor',l:'Menor → acción cara (0 pts)'}]}/></DGIFld>
            <DGIFld label="PER vs. media histórica"><DGISel value={dgiForm.perVsHistorico} onChange={dgiUpd('perVsHistorico')} options={[{v:'bajo',l:'Por debajo → barato (+4 pts)'},{v:'en_linea',l:'En línea con la media (+2 pts)'},{v:'alto',l:'Por encima → caro (0 pts)'}]}/></DGIFld>
          </div>
        </DGICard>

        {/* Macro */}
        <DGICard>
          <div style={{fontSize:11,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>🌐 Sensibilidad Macroeconómica</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <DGIFld label="Comportamiento ante recesión"><DGISel value={dgiForm.sensRecesion} onChange={dgiUpd('sensRecesion')} options={[{v:'muy_defensiva',l:'🛡️ Muy defensiva'},{v:'defensiva',l:'🟢 Defensiva'},{v:'moderada',l:'🟡 Moderada'},{v:'sensible',l:'🟠 Sensible'},{v:'muy_sensible',l:'🔴 Muy sensible'}]}/></DGIFld>
            <DGIFld label="Comportamiento ante subida tipos"><DGISel value={dgiForm.sensTipos} onChange={dgiUpd('sensTipos')} options={[{v:'beneficiada',l:'✅ Beneficiada'},{v:'neutral',l:'🟡 Neutral'},{v:'leve',l:'🟠 Ligeramente sensible'},{v:'perjudicada',l:'🔴 Perjudicada'}]}/></DGIFld>
            <div style={{gridColumn:'1/-1'}}>
              <DGIFld label="Comportamiento histórico en crisis (opcional)">
                <textarea value={dgiForm.notasMacro} onChange={dgiUpd('notasMacro')} rows={2} placeholder="Ej: En 2008-09 mantuvo el dividendo y lo subió un 8%..." style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              </DGIFld>
            </div>
          </div>
        </DGICard>

        {/* Tesis */}
        <DGICard>
          <div style={{fontSize:11,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>📝 Tesis de Inversión</div>
          <textarea value={dgiForm.notas} onChange={dgiUpd('notas')} rows={3} placeholder="¿Por qué encaja en DGI? ¿Qué riesgos tiene? ¿Cuándo vendería?" style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        </DGICard>

        {/* Simulación empresa */}
        <SimEmpresaCard yld={+dgiForm.yieldActual||0} cagrDiv={+dgiForm.cagrDiv5Y||0} nombre={dgiForm.nombre} ticker={dgiForm.ticker}/>

        <button onClick={saveDgiCompany} style={{width:'100%',background:'#0f2246',color:'white',border:'none',borderRadius:12,padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          {dgiSaved?'✅ Guardado':dgiEditId?'💾 Actualizar empresa':'💾 Guardar en cartera DGI'}
        </button>
        {dgiEditId&&<button onClick={()=>{setDgiForm({...DGI_EMPTY});setDgiEditId(null)}} style={{width:'100%',background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'12px',fontSize:13,color:'#64748b',cursor:'pointer',marginTop:8}}>Cancelar edición</button>}
      </div>)}

      {/* ══ DGI CARTERA ══ */}
      {tab==='dgi-cartera'&&(<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
          {[['🟢 PILAR',dgiPortfolio.filter(c=>c.clasificacion==='PILAR').length,'#15803d','#f0fdf4'],['🟡 COMPL.',dgiPortfolio.filter(c=>c.clasificacion==='COMPLEMENTARIA').length,'#b45309','#fffbeb'],['🟠 VIGIL.',dgiPortfolio.filter(c=>c.clasificacion==='VIGILANCIA').length,'#c2410c','#fff7ed'],['🔴 DESC.',dgiPortfolio.filter(c=>c.clasificacion==='DESCARTABLE').length,'#dc2626','#fef2f2']].map(([l,v,c,bg])=>(
            <div key={l} style={{background:bg,borderRadius:12,padding:'12px 14px',textAlign:'center'}}>
              <div style={{fontSize:10,color:c,fontWeight:700,marginBottom:4}}>{l}</div>
              <div style={{fontSize:24,fontWeight:900,color:c}}>{v}</div>
            </div>
          ))}
        </div>
        {['PILAR','COMPLEMENTARIA','VIGILANCIA','DESCARTABLE'].map(clLabel=>{
          const items=dgiByClasif[clLabel];if(!items)return null;
          const cm=DGI_CL_META[clLabel];
          return(<div key={clLabel}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{background:cm.bg,border:`1px solid ${cm.border}`,borderRadius:8,padding:'3px 12px',color:cm.color,fontWeight:800,fontSize:12}}>{cm.dot} {clLabel}</div>
              <div style={{fontSize:11,color:'#94a3b8'}}>{items.length} empresa{items.length!==1?'s':''}</div>
              <div style={{flex:1,height:1,background:'#e2e8f0'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {items.map(co=>{
                const isOpen=dgiExpanded===co.id;const y10o=co.yoc10opt||yoc10(+co.yieldActual||0,+co.cagrDiv5Y||0,1.0);const y10b=co.yoc10base||yoc10(+co.yieldActual||0,+co.cagrDiv5Y||0,0.75);const y10c=co.yoc10cons||yoc10(+co.yieldActual||0,+co.cagrDiv5Y||0,0.50)
                return(<div key={co.id} style={{background:'white',border:`1px solid ${isOpen?cm.border:'#e2e8f0'}`,borderRadius:12,overflow:'hidden',boxShadow:isOpen?`0 0 0 2px ${cm.border}`:'0 1px 3px rgba(0,0,0,.04)'}}>
                  <div onClick={()=>setDgiExpanded(isOpen?null:co.id)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',flexWrap:'wrap'}}>
                    <DGIRing score={+co.score||0}/>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:2}}>
                        <span style={{fontWeight:800,color:'#1e293b',fontSize:14}}>{co.nombre}</span>
                        <span style={{color:'#94a3b8',fontSize:12,fontFamily:'monospace'}}>{co.ticker}</span>
                        <span style={{background:cm.bg,border:`1px solid ${cm.border}`,color:cm.color,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{cm.dot} {clLabel}</span>
                      </div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>{co.pais} · {co.sector}</div>
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      {[['Yield',`${co.yieldActual}%`],['CAGR',`${co.cagrDiv5Y}%`],['Chowder',co.chowder],['Racha',`${co.rachaAnios}a`]].map(([l,v])=>(
                        <div key={l} style={{textAlign:'center',minWidth:50}}><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase'}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:'#475569'}}>{v}</div></div>
                      ))}
                      <div style={{display:'flex',gap:6,background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:'5px 10px',textAlign:'center',minWidth:100}}>
                        <div><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',marginBottom:3}}>YoC año 10</div>
                          <div style={{display:'flex',gap:6,justifyContent:'center',alignItems:'baseline'}}>
                            <span style={{fontSize:10,color:'#94a3b8'}}>{y10c}%</span>
                            <span style={{fontSize:14,fontWeight:900,color:'#15803d'}}>{y10b}%</span>
                            <span style={{fontSize:10,color:'#3b82f6'}}>{y10o}%</span>
                          </div>
                          <div style={{fontSize:9,color:'#94a3b8',marginTop:2}}>cons · base · opt</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:2}}>
                        <button onClick={e=>{e.stopPropagation();editDgi(co)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:4}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();delDgi(co.id)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:4}}>🗑️</button>
                        <span style={{color:'#cbd5e1',fontSize:11,marginLeft:2}}>{isOpen?'▲':'▼'}</span>
                      </div>
                    </div>
                  </div>
                  {isOpen&&(<div style={{background:'#fafafa',padding:16,borderTop:`1px solid ${cm.border}`}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:14}}>
                      <div><div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Bloque A</div>{[['Yield',`${co.yieldActual}%`],['CAGR Div 5Y',`${co.cagrDiv5Y}%`],['Racha',`${co.rachaAnios} años`],['Años pagando',`${co.aniosPagando||'—'}`],['Chowder',co.chowder],['Puntos A',`${co.scoreA||'—'}/35`]].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#475569',marginBottom:4}}><span>{l}</span><strong>{v}</strong></div>)}</div>
                      <div><div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Bloque B</div>{[['Payout FCF',`${co.payoutFCF}%`],['Payout EPS',`${co.payoutEPS}%`],['CAGR BPA',`${co.crecBPA5Y}%`],['CAGR FCF 5Y',`${co.cagrFCF5Y}%`],['CAGR FCF 10Y',`${co.cagrFCF10Y}%`],['Puntos B',`${co.scoreB||'—'}/30`]].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#475569',marginBottom:4}}><span>{l}</span><strong>{v}</strong></div>)}</div>
                      <div><div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Bloque C</div>{[['ROIC',`${co.roic}%`],['Foso ancho',co.moat],['Foso tipo',(co.tipoMoat||'—').replace(/_/g,' ')],['Deuda/EBITDA',`${co.deudaEbitda}x`],['Rating',co.rating],['Puntos C',`${co.scoreC||'—'}/25`],['🎯 Entrada',`${co.scoreD||'—'}/10`]].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#475569',marginBottom:4,textTransform:'capitalize'}}><span style={{textTransform:'none'}}>{l}</span><strong>{v}</strong></div>)}</div>
                      <div><div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Macro</div>{[['Recesión',(co.sensRecesion||'').replace(/_/g,' ')],['Tipos',(co.sensTipos||'').replace(/_/g,' ')]].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#475569',marginBottom:4}}><span>{l}</span><strong style={{textTransform:'capitalize'}}>{v}</strong></div>)}{co.notasMacro&&<div style={{fontSize:11,color:'#64748b',fontStyle:'italic',marginTop:8,lineHeight:1.5}}>"{co.notasMacro.slice(0,120)}..."</div>}</div>
                    </div>
                    <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px',marginBottom:10}}>
                      <div style={{fontSize:11,color:'#1d4ed8',fontWeight:700,marginBottom:8}}>📈 Proyección YoC a 10 años (€10.000 referencia)</div>
                      <div style={{display:'flex',gap:10}}>
                        {[{l:'🚀 Optimista',v:y10o,c:'#3b82f6'},{l:'✅ Base −25%',v:y10b,c:'#15803d'},{l:'🛡️ Conservador −50%',v:y10c,c:'#b45309'}].map(({l,v,c})=>(
                          <div key={l} style={{flex:1,textAlign:'center',background:'white',borderRadius:8,padding:'8px 12px',border:'1px solid #e2e8f0'}}>
                            <div style={{fontSize:10,color:'#64748b',marginBottom:4}}>{l}</div>
                            <div style={{fontSize:20,fontWeight:900,color:c}}>{v}%</div>
                            <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{Math.round(10000*v/100).toLocaleString('es')}€/año</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {co.notas&&<div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#1e40af',fontStyle:'italic',marginBottom:8}}>📝 {co.notas}</div>}
                    {co.clasificacion!=='PILAR'&&<UpgradeHint company={co}/>}
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:8}}>Análisis del {co.fecha}</div>
                  </div>)}
                </div>)
              })}
            </div>
          </div>)
        })}
        <button onClick={()=>setTab('dgi-analizar')} style={{width:'100%',border:'2px dashed #fcd34d',background:'transparent',color:'#b45309',borderRadius:12,padding:14,fontSize:13,cursor:'pointer',fontWeight:600}}>+ Analizar nueva empresa DGI</button>
      </div>)}

    </div>
    <style>{`*{box-sizing:border-box}button:focus{outline:none}details summary::-webkit-details-marker{display:none}input[type="range"]{cursor:pointer;height:4px}`}</style>
  </div>)
}
