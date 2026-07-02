/* ════════════════════════════════════════════════════════
   Método Cenas Ligeras — v7
   ⚠️ CONFIG — completar antes de rodar tráfego:
   1. META_PIXEL_ID
   2. PRICES (checkout URLs por país)
   ════════════════════════════════════════════════════════ */
const META_PIXEL_ID = ''; // ← Tu Pixel ID. Vacío = no carga.

const PRICES = {
  mexico:   { cur:'MXN', price:'197',    ref:'MXN 679',     inst:'o en 3 pagos de MXN 69', co:'CHECKOUT_URL_MX' },
  colombia: { cur:'COP', price:'39.900', ref:'COP 137.900', inst:null,                     co:'CHECKOUT_URL_CO' },
  usa:      { cur:'USD', price:'9.90',   ref:'USD 34.90',   inst:null,                     co:'CHECKOUT_URL_US' },
  otro:     { cur:'USD', price:'9.90',   ref:'USD 34.90',   inst:null,                     co:'CHECKOUT_URL_OTHER' }
};

// ── Meta Pixel (solo si hay ID configurado) ──────────────
if (META_PIXEL_ID) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');
}

// ── Analytics: custom + eventos estándar de Meta ─────────
const STD_EVENTS = { result_view:'Lead', tsl_view:'ViewContent', checkout_start:'InitiateCheckout' };
function trackEvent(name, data) {
  try { if (typeof fbq === 'function') {
    fbq('trackCustom', name, data || {});
    if (STD_EVENTS[name]) fbq('track', STD_EVENTS[name], data || {});
  } } catch(e){}
  try { if (typeof gtag === 'function') gtag('event', name, data || {}); } catch(e){}
}

// ── UTM / fbclid forwarding hacia el checkout ────────────
function withParams(url) {
  try {
    const qs = window.location.search.replace(/^\?/, '');
    if (!qs || !url || url.charAt(0) === '#') return url;
    return url + (url.indexOf('?') > -1 ? '&' : '?') + qs;
  } catch(e) { return url; }
}

// ── State ────────────────────────────────────────────────
const S = {
  screen: 'opening',
  q1:null, q2:null, q3:null, q4:null, q5:null, q6:null, q7:null, q8:null, country:null, cena_pattern:null,
  profile: null, modifier: null,
  situacion: 'llegas a la tarde o la noche',
  objetivo: null, gatillo: null, tentativa: null, objecion: null,
  showSafety: false, safetyCandidate: false,
  scores: { improvisacion:0, hambre:0, rutina:0, tiempo:0 },
  pricing: null
};

const FLOW = ['opening','q1','q2','q3','micro1','q4','q5','q6','q7','micro2','q8','q9','processing','result'];
let idx = 0;

// ── Screen management ────────────────────────────────────
function showScreen(id) {
  const topbar = document.getElementById('quiz-topbar');
  if (topbar) topbar.style.display = id === 'opening' ? 'none' : '';
  document.querySelectorAll('.quiz-screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('visible');
  });
  const el = document.getElementById('screen-' + id);
  if (el) { el.style.display = 'flex'; el.classList.add('visible'); }
  updateProgress(id);
  trackEvent('question_view', { screen: id });
  if (id === 'result') trackEvent('result_view', { profile: S.profile });
}

function quizNext() {
  idx++;
  if (idx >= FLOW.length) return;
  const id = FLOW[idx];
  if (id === 'q3') buildQ3();
  if (id === 'q7') buildQ7();
  if (id === 'processing') startProcessing();
  showScreen(id);
  window.scrollTo(0, 0);
}

// ── Progress bar ─────────────────────────────────────────
function updateProgress(id) {
  const phase1 = ['q1','q2','q3'];
  const phase2 = ['micro1','q4','q5','q6','q7'];
  const phase3 = ['micro2','q8','q9','processing','result'];
  const p1 = document.getElementById('prog-1');
  const p2 = document.getElementById('prog-2');
  const p3 = document.getElementById('prog-3');
  if (!p1) return;
  p1.className = 'prog-phase'; p2.className = 'prog-phase'; p3.className = 'prog-phase';
  if (phase1.includes(id)) { p1.classList.add('active'); }
  else if (phase2.includes(id)) { p1.classList.add('done'); p2.classList.add('active'); }
  else if (phase3.includes(id)) { p1.classList.add('done'); p2.classList.add('done'); p3.classList.add('active'); }
}

// ── Q1 ───────────────────────────────────────────────────
const Q1 = {
  tarde_dulce:   { p:'improvisacion', pts:2, mod:'antojos',       sit:'empiezas a buscar algo a media tarde' },
  llego_hambre:  { p:'hambre',        pts:2, mod:'hambre_fisica', sit:'llegas a casa con mucha hambre' },
  pico_cocino:   { p:'improvisacion', pts:2, mod:'picoteo',       sit:'estás preparando la cena' },
  ceno_hambre:   { p:'hambre',        pts:2, mod:'baja_saciedad', sit:'cenas ligero y vuelves a tener hambre' },
  postcena:      { p:'hambre',        pts:2, mod:'postcena',      sit:'terminas de cenar y sigues buscando algo' },
  cada_dia_diff: { p:'tiempo',        pts:2, mod:'falta_rutina',  sit:'tienes que decidir la cena cada noche' }
};
function handleQ1(k) {
  const m = Q1[k]; S.q1=k; S.scores[m.p]+=m.pts; S.modifier=m.mod; S.situacion=m.sit;
  markOpt(event); trackEvent('question_answer',{q:'q1',a:k}); setTimeout(quizNext, 350);
}

// ── Q2 ───────────────────────────────────────────────────
const Q2 = {
  bajar_peso:   'bajar de peso de forma más constante',
  menos_pesada: 'sentirte menos pesada o inflamada',
  dejar_improv: 'dejar de improvisar por la tarde o la noche',
  organizar:    'organizar tus cenas sin cocinar todos los días',
  comer_mejor:  'comer mejor sin seguir una dieta complicada'
};
function handleQ2(k) {
  S.q2=k; S.objetivo=Q2[k];
  markOpt(event); trackEvent('question_answer',{q:'q2',a:k}); setTimeout(quizNext, 350);
}

// ── Q3 ───────────────────────────────────────────────────
function buildQ3() {
  const el = document.getElementById('q3-dynamic');
  if (el) el.textContent = S.situacion;
}
const Q3 = {
  tiempo:    { p:'tiempo',        pts:2, g:'falta de tiempo' },
  cansancio: { p:'tiempo',        pts:1, g:'cansancio al final del día' },
  hambre:    { p:'hambre',        pts:2, g:'mucha hambre acumulada' },
  antojos:   { p:'improvisacion', pts:1, g:'antojos de algo dulce o salado' },
  familia:   { p:'tiempo',        pts:1, g:'necesidad de cocinar para la familia' },
  nada_prep: { p:'improvisacion', pts:2, g:'no tener nada preparado' }
};
function handleQ3(k) {
  const m=Q3[k]; S.q3=k; S.scores[m.p]+=m.pts; S.gatillo=m.g;
  markOpt(event); trackEvent('question_answer',{q:'q3',a:k}); setTimeout(quizNext, 350);
}

// ── Q4 ───────────────────────────────────────────────────
const Q4 = {
  hambre_fisica:  { p:'hambre',        pts:2, safety:false },
  antojo:         { p:'improvisacion', pts:1, safety:false },
  cansada_rapido: { p:'tiempo',        pts:1, safety:false },
  ya_comi:        { p:'hambre',        pts:2, safety:true  },
  distraerse:     { p:null,            pts:0, safety:true  },
  no_se:          { p:null,            pts:0, safety:false }
};
function handleQ4(k) {
  const m=Q4[k]; S.q4=k;
  if (m.p) S.scores[m.p]+=m.pts;
  if (m.safety) S.safetyCandidate=true;
  markOpt(event); trackEvent('question_answer',{q:'q4',a:k}); setTimeout(quizNext, 350);
}

// ── Q5 ───────────────────────────────────────────────────
function handleQ5(k) {
  S.q5=k;
  if ((k==='cuatro_cinco'||k==='todos_dias') && S.safetyCandidate) S.showSafety=true;
  markOpt(event); trackEvent('question_answer',{q:'q5',a:k}); setTimeout(quizNext, 350);
}

// ── Q6 ───────────────────────────────────────────────────
const Q6L = {
  cenar_poco:'saltarte la cena', solo_ensalada:'comer solo ensalada',
  dieta_restrict:'seguir una dieta restrictiva', buscar_recetas:'buscar recetas en internet',
  preparar_antici:'preparar con anticipación', productos_light:'los productos light'
};
function handleQ6(k) {
  S.q6=k; S.tentativa=Q6L[k];
  markOpt(event); trackEvent('question_answer',{q:'q6',a:k}); setTimeout(quizNext, 350);
}

// ── Q7 ───────────────────────────────────────────────────
function buildQ7() {
  const el = document.getElementById('q7-dynamic');
  if (el) el.textContent = S.tentativa || 'esa solución';
}
const Q7 = {
  complicado:    { p:'rutina', pts:2, ob:'complicada' },
  cocinar_diario:{ p:'tiempo', pts:2, ob:'cocinar_diario' },
  hambre_fallo:  { p:'hambre', pts:2, ob:'hambre' },
  ingredientes:  { p:'tiempo', pts:1, ob:'ingredientes' },
  familia_fallo: { p:'tiempo', pts:1, ob:'familia' },
  motivacion:    { p:'rutina', pts:2, ob:'motivacion' }
};
function handleQ7(k) {
  const m=Q7[k]; S.q7=k; S.scores[m.p]+=m.pts; S.objecion=m.ob;
  markOpt(event); trackEvent('question_answer',{q:'q7',a:k}); setTimeout(quizNext, 350);
}

// ── Q8 ───────────────────────────────────────────────────
function handleQ8(k) {
  S.q8=k;
  markOpt(event); trackEvent('question_answer',{q:'q8',a:k}); setTimeout(quizNext, 350);
}

// ── Q9: patrón de cena (alimenta el ancla de precio) ─────
function handleQ9(k) {
  S.cena_pattern=k;
  markOpt(event); trackEvent('question_answer',{q:'q9',a:k}); setTimeout(quizNext, 350);
}

// ── Detección de país (timeout + fallback por idioma) ────
function applyCountry(code) {
  const map = { MX:'mexico', CO:'colombia', US:'usa' };
  S.country = map[code] || 'otro';
  S.pricing = PRICES[S.country];
}
function langCountryGuess() {
  const l = (navigator.language || '').toLowerCase();
  if (l.indexOf('-mx') > -1) return 'MX';
  if (l.indexOf('-co') > -1) return 'CO';
  if (l.indexOf('en') === 0) return 'US';
  return null;
}
function detectCountry() {
  applyCountry(langCountryGuess());
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2500);
    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (d && d.country_code) applyCountry(d.country_code); })
      .catch(() => {});
  } catch(e){}
}

// ── Processing ───────────────────────────────────────────
function startProcessing() {
  const stages = [
    { msg: 'Analizando tus respuestas…',   pct: 0   },
    { msg: 'Identificando tu patrón…',      pct: 38  },
    { msg: 'Preparando tu recomendación…',  pct: 72  },
    { msg: 'Tu resultado está listo ✓',     pct: 100 }
  ];
  const bar   = document.getElementById('progress-bar-fill');
  const pctEl = document.getElementById('progress-pct');
  const msgEl = document.getElementById('processing-msg');
  let i = 0;
  function nextStage() {
    if (i >= stages.length) return;
    const s = stages[i];
    if (msgEl) msgEl.textContent = s.msg;
    if (bar)   bar.style.width   = s.pct + '%';
    if (pctEl) pctEl.textContent = s.pct + '%';
    i++;
    if (i < stages.length) {
      setTimeout(nextStage, 850);
    } else {
      computeProfile();
      setTimeout(() => showScreen('result'), 650);
    }
  }
  nextStage();
}

// ── Profiles ─────────────────────────────────────────────
const PROFILES = {
  improvisacion: {
    title: 'Demasiadas decisiones al final del día',
    patron: 'Tu patrón: demasiadas decisiones justo cuando tienes menos energía para tomarlas.',
    influye: 'Llegas a la noche sin una opción clara, y eso hace que improvisar parezca más fácil.',
    estrategia: 'Tu mejor estrategia: dejar algunas decisiones preparadas antes del momento difícil.',
    paso: 'Elige 2 o 3 cenas esta semana y deja al menos dos porciones listas.',
    bridge: 'Para tu patrón, el cambio más efectivo no es más fuerza de voluntad — es decidir antes del momento de hambre, no durante él.'
  },
  hambre: {
    title: 'La noche llega con más hambre de la esperada',
    patron: 'Tu patrón: llegar a la noche con hambre acumulada o con una cena poco satisfactoria.',
    influye: 'Cuando el hambre es intensa, las decisiones rápidas ganan.',
    estrategia: 'Tu mejor estrategia: cenas ligeras con volumen, sabor y porciones que te dejen satisfecha.',
    paso: 'Empieza con recetas de mayor volumen y deja dos porciones listas para los días de más hambre.',
    bridge: 'Con tu patrón, llegar a casa con algo ya listo cambia completamente cómo termina tu noche.'
  },
  rutina: {
    title: 'Las soluciones anteriores exigían demasiado',
    patron: 'Tu patrón: soluciones que funcionan los primeros días, pero se vuelven insostenibles.',
    influye: 'Cuando una rutina exige esfuerzo cada vez, mantenerla depende de motivación — y la motivación fluctúa.',
    estrategia: 'Tu mejor estrategia: una estructura sencilla que puedas repetir incluso en una semana difícil.',
    paso: 'Empieza con una sola semana organizada, no con cambiar todo de una vez.',
    bridge: 'Para ti, la clave no es más esfuerzo — es un sistema que no dependa de estar motivada cada día.'
  },
  tiempo: {
    title: 'La cena compite con todo lo demás del día',
    patron: 'Tu patrón: demasiadas decisiones y tareas para resolver la cena cada noche.',
    influye: 'Pensar qué comprar, qué cocinar y cómo adaptarlo para todos convierte la cena en una tarea pesada.',
    estrategia: 'Tu mejor estrategia: preparar varias porciones en una sola sesión.',
    paso: 'Usa una lista única y organiza parte de tus cenas antes de comenzar la semana.',
    bridge: 'Con tu ritmo, preparar una vez para varias noches es la solución más directa para recuperar tus tardes.'
  },
  low: {
    title: 'Tu rutina ya tiene una buena base',
    patron: 'Tu rutina tiene una base más sólida que la mayoría.',
    influye: 'Tu principal oportunidad: reducir decisiones en los días más ocupados.',
    estrategia: 'Tu mejor estrategia: tener opciones listas para cuando tu rutina cambia.',
    paso: 'Deja dos cenas organizadas antes de comenzar cada semana.',
    bridge: 'Tu punto de partida es mejor que el de la mayoría — necesitas un sistema claro para los días difíciles.'
  }
};

function computeProfile() {
  const sc = S.scores;
  let max=0, best='improvisacion';
  for (const [k,v] of Object.entries(sc)) { if(v>max){max=v;best=k;} }
  S.profile = (max<=1) ? 'low' : best;
  renderResult();
}

function renderResult() {
  const p = PROFILES[S.profile] || PROFILES.low;
  setText('result-title', p.title);
  setText('result-patron', p.patron);
  setText('result-influye', p.influye);
  setText('result-estrategia', p.estrategia);
  setText('result-paso', p.paso);
  const bridgeEl = document.getElementById('result-bridge-personal');
  if (bridgeEl && p.bridge) { bridgeEl.textContent = p.bridge; bridgeEl.style.display = 'block'; }
  if (S.showSafety) {
    const sn = document.getElementById('result-safety');
    if(sn) sn.style.display='block';
  }
}

// ── Show TSL ─────────────────────────────────────────────
function showTSL() {
  document.getElementById('quiz-section').style.display='none';
  document.getElementById('tsl-section').style.display='block';
  personalizeTSL();
  window.scrollTo(0,0);
  initStickyCTA();
  trackEvent('tsl_view', { profile: S.profile });
}

// ── Objeción blocks ──────────────────────────────────────
const OBJ = {
  complicada:    { q:'¿Te preocupa que sea complicado?', a:'El método fue creado para uso doméstico. Recetas paso a paso y una Preparación Semanal que organiza varias porciones en una sola sesión, sin técnicas especiales.' },
  cocinar_diario:{ q:'¿No tienes tiempo para cocinar todos los días?', a:'El sistema funciona al revés: cocinas una o dos veces por semana y resuelves varias noches. La Preparación Semanal te enseña cómo.' },
  hambre:        { q:'¿Tienes miedo de quedarte con hambre?', a:'Las recetas incluyen orientación de porciones. El objetivo es una cena ligera con volumen y sabor que te deje satisfecha.' },
  ingredientes:  { q:'¿Los ingredientes son difíciles de encontrar?', a:'La Guía Latinoamericana reúne nombres regionales y alternativas para México, Colombia, EE.UU. y otros mercados.' },
  familia:       { q:'¿Tu familia no va a querer comer lo mismo?', a:'El Bono 5 muestra cómo adaptar la misma base sin empezar otra comida desde cero.' },
  motivacion:    { q:'¿Empiezas con energía pero no logras mantenerlo?', a:'Por eso recibes un Plan de 21 Días y una Preparación Semanal: una estructura pequeña y repetible, incluso en una semana difícil.' }
};

// ── Personalización del TSL ──────────────────────────────
const RESULT_LABELS = {
  improvisacion: 'IMPROVISACIÓN NOCTURNA',
  hambre:        'HAMBRE ACUMULADA AL FINAL DEL DÍA',
  rutina:        'RUTINA DIFÍCIL DE MANTENER',
  tiempo:        'FALTA DE TIEMPO Y ORGANIZACIÓN',
  low:           'TU DIAGNÓSTICO LISTO'
};
const CICLO_INTRO = {
  improvisacion: 'En tu caso, este ciclo suele comenzar cuando llega la noche y no tienes una cena decidida o preparada.',
  hambre:        'En tu caso, este ciclo suele comenzar cuando llegas al final del día con demasiada hambre acumulada.',
  rutina:        'En tu caso, este ciclo suele comenzar con una solución que parece buena, pero resulta difícil de repetir.',
  tiempo:        'En tu caso, este ciclo suele comenzar cuando cada cena exige decidir, comprar y cocinar desde cero.',
  low:           'En tu caso, el desafío principal aparece en los días más ocupados o cansados.'
};
const OFFER_TITLES = {
  improvisacion: 'Tu plan para dejar de improvisar por la noche',
  hambre:        'Tu plan para cenar ligero y quedar satisfecha',
  rutina:        'Tu plan fácil de repetir, incluso en semanas difíciles',
  tiempo:        'Tu plan para resolver varias noches de una vez',
  low:           'Método Cenas Ligeras — Edición Completa'
};
const PRICE_ANCHORS = {
  delivery:  'Menos que un solo pedido a domicilio — y resuelve toda tu semana.',
  cualquier: 'Menos que una sola comida fuera — y dejas de cenar "lo que encuentres".',
  improviso: 'Un solo pago — y dejas de improvisar la cena cada noche.',
  salto:     'Por menos que una comida, dejas de saltarte la cena.'
};

function personalizeTSL() {
  const p = PROFILES[S.profile] || PROFILES.low;
  const pr = S.pricing || PRICES.otro;

  const heroTag = document.getElementById('hero-profile-line');
  if (heroTag) {
    heroTag.textContent = 'TU RESULTADO: ' + (RESULT_LABELS[S.profile] || RESULT_LABELS.low);
    heroTag.style.display = 'inline-block';
  }

  const cicloEl = document.getElementById('ciclo-dynamic-intro');
  if (cicloEl) cicloEl.textContent = CICLO_INTRO[S.profile] || CICLO_INTRO.low;

  setText('tsl-profile-title', p.title);
  setText('tsl-profile-patron', p.patron);
  setText('tsl-profile-estrategia', p.estrategia);

  const ob = OBJ[S.objecion] || OBJ.complicada;
  setText('objecion-title', ob.q);
  setText('objecion-body', ob.a);

  setText('offer-title-dyn', OFFER_TITLES[S.profile] || OFFER_TITLES.low);

  const anchorEl = document.getElementById('price-anchor-line');
  if (anchorEl) anchorEl.textContent = PRICE_ANCHORS[S.cena_pattern] || PRICE_ANCHORS.improviso;

  document.querySelectorAll('.price-amount').forEach(el => {
    el.textContent = pr.cur + ' ' + pr.price;
  });
  document.querySelectorAll('.price-ref-amount').forEach(el => {
    if (pr.ref) el.textContent = pr.ref;
  });
  if (pr.inst) {
    document.querySelectorAll('.price-installments').forEach(el => {
      el.textContent = pr.inst; el.style.display='block';
    });
  }

  document.querySelectorAll('.checkout-btn').forEach(el => {
    el.href = withParams(pr.co);
    el.addEventListener('click', () => trackEvent('checkout_start', { profile: S.profile, country: S.country }));
  });
}

// ── Sticky CTA ───────────────────────────────────────────
let stickyInited = false;
function initStickyCTA() {
  if (stickyInited) return;
  stickyInited = true;
  const bar = document.getElementById('sticky-cta');
  if (!bar) return;
  let nearOffer = false;
  const targets = [document.getElementById('oferta'), document.querySelector('.final-cta')].filter(Boolean);
  if ('IntersectionObserver' in window && targets.length) {
    const io = new IntersectionObserver(entries => {
      nearOffer = entries.some(e => e.isIntersecting) ||
        targets.some(t => { const r = t.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
      update();
    }, { threshold: 0 });
    targets.forEach(t => io.observe(t));
  }
  function update() {
    const show = window.scrollY > 500 && !nearOffer;
    bar.classList.toggle('show', show);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ── Helpers ──────────────────────────────────────────────
function setText(id, txt) {
  const el=document.getElementById(id); if(el) el.textContent=txt;
}
function markOpt(e) {
  if (!e || !e.currentTarget) return;
  const parent = e.currentTarget.closest('.options');
  if (parent) parent.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'));
  e.currentTarget.classList.add('selected');
}

// ── FAQ accordion ────────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
      trackEvent('faq_open');
    });
  });
}

// ── Boot (espera el DOM del componente existir) ──────────
function initAll() {
  if (window.__clBooted) return;
  window.__clBooted = true;
  showScreen('opening');
  initFAQ();
  detectCountry();
  trackEvent('quiz_start');
}
(function boot() {
  if (document.getElementById('screen-opening')) { initAll(); return; }
  let tries = 0;
  const t = setInterval(() => {
    if (document.getElementById('screen-opening')) { clearInterval(t); initAll(); }
    else if (++tries > 150) { clearInterval(t); }
  }, 100);
})();
