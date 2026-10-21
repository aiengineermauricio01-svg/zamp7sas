/* ZAMP7 · «De la planilla al tablero»: escena fija que avanza con el scroll (sin dependencias).
   Actos: 1) la planilla como llega hoy, con sus errores; 2) se ordena fila a fila; 3) cada camión salta
   de la planilla a un punto del tablero; 4) el asistente de IA responde con el dato y la causa.
   Con movimiento reducido (o sin JavaScript) se muestra el tablero final, completo e interactivo. */
(function () {
  'use strict';
  const raiz = document.getElementById('de-la-planilla-al-tablero');
  if (!raiz) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => raiz.querySelector(s), $$ = s => Array.from(raiz.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const suave = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Datos sintéticos de un turno de patio. *r = como llega escrito en la planilla; el resto, ya ordenado.
  const D = [
    { placa: 'JCV 391', pr: 'JCV 391', lr: '6:40', l: '06:40', mr: 'M1', m: 1, er: '12', e: 12, cr: 'si', c: true },
    { placa: 'SQF 847', pr: 'sqf847', lr: '06:52 a. m.', l: '06:52', mr: 'muelle 3', m: 3, er: '41 min', e: 41, cr: 'NO', c: false },
    { placa: 'FZK 500', pr: 'FZK 500', lr: '0705', l: '07:05', mr: '2', m: 2, er: '18', e: 18, cr: 'Sí', c: true },
    { placa: 'PLM 109', pr: 'PLM-109', lr: '7.12', l: '07:12', mr: 'M4', m: 4, er: '9', e: 9, cr: 'si', c: true },
    { placa: 'TRX 224', pr: 'TRX 224', lr: '07:30', l: '07:30', mr: 'M3', m: 3, er: '47', e: 47, cr: 'no', c: false },
    { placa: 'TRX 224', pr: 'TRX 224', lr: '07:30', l: '07:30', mr: 'M3', m: 3, er: '47', e: 47, cr: 'no', c: false, dup: true },
    { placa: 'KDL 618', pr: 'KDL 618', lr: '7:41', l: '07:41', mr: 'Mue 1', m: 1, er: '15', e: 15, cr: 'S', c: true },
    { placa: 'GHT 229', pr: 'GHT 229', lr: '08:02', l: '08:02', mr: '', m: 2, er: '22', e: 22, cr: 'si', c: true },
    { placa: 'WXP 429', pr: 'wxp 429', lr: '8:15', l: '08:15', mr: 'M3', m: 3, er: '58 min', e: 58, cr: 'no', c: false },
    { placa: 'MRD 345', pr: 'MRD 345', lr: '8.20', l: '08:20', mr: 'muelle 4', m: 4, er: '11', e: 11, cr: 'Si', c: true },
    { placa: 'BNO 702', pr: 'BNO 702', lr: '08:33 a. m.', l: '08:33', mr: 'M2', m: 2, er: '26', e: 26, cr: 'no', c: false },
    { placa: 'CSA 118', pr: 'CSA118', lr: '0848', l: '08:48', mr: '3', m: 3, er: '52', e: 52, cr: 'N', c: false },
    { placa: 'LUV 930', pr: 'LUV 930', lr: '9:05', l: '09:05', mr: 'M1', m: 1, er: '14', e: 14, cr: 'si', c: true },
    { placa: 'HZE 461', pr: 'HZE 461', lr: '09:12', l: '09:12', mr: 'M4', m: 4, er: '8', e: 8, cr: 'sí', c: true },
    { placa: 'QTA 557', pr: 'QTA 557', lr: '9.30', l: '09:30', mr: 'M3', m: 3, er: '44', e: 44, cr: 'no', c: false },
    { placa: 'YRB 083', pr: 'YRB 083', lr: '09:41', l: '09:41', mr: 'M2', m: 2, er: '19', e: 19, cr: 'si', c: true },
  ];
  D.forEach(r => { r.mu = 'M' + r.m; r.ci = r.c ? 'Sí' : 'No'; r.ee = String(r.e); });
  const camiones = D.filter(r => !r.dup);
  const META = 25;
  const prom = a => (a.length ? a.reduce((s, r) => s + r.e, 0) / a.length : 0);
  const estado = e => (e <= META ? 'ok' : e <= 40 ? 'aten' : 'alerta');

  // ---------- 1. la planilla ----------
  const escena = $('.escena'), planilla = $('.escena__planilla'), tablero = $('.escena__tablero'), grid = $('.pl__grid');
  const COLS = [['Placa', 'pr', 'placa', 'texto'], ['Llegada', 'lr', 'l', 'hora'], ['Muelle', 'mr', 'mu', 'muelle'], ['Espera', 'er', 'ee', 'min'], ['Cita', 'cr', 'ci', 'sí/no']];
  let h = '<span class="pl__esq"></span>' + 'ABCDE'.split('').map(l => `<span class="pl__letra">${l}</span>`).join('');
  h += '<span class="pl__num">1</span>' + COLS.map(c => `<span class="pl__tit">${c[0]}<em class="tipo">${c[3]}</em></span>`).join('');
  let errores = 0;
  D.forEach((r, i) => {
    h += `<span class="pl__num" data-f="${i}">${i + 2}</span>`;
    COLS.forEach(([, raw, ok], j) => {
      const vr = String(r[raw]), vo = String(r[ok]), mal = r.dup || vr !== vo;
      if (mal) errores++;
      h += `<span class="pl__c${mal ? ' con-error' : ''}${j === 3 ? ' pl__esp' : ''}" data-f="${i}"><i class="r">${vr || '&#8203;'}</i><i class="o">${vo}</i></span>`;
    });
  });
  grid.innerHTML = h;
  const filas = D.map((r, i) => ({ celdas: $$(`[data-f="${i}"]`), dup: !!r.dup, est: '' }));
  const espCelda = i => grid.querySelector(`.pl__esp[data-f="${i}"]`);
  $('[data-pl="errores"]').textContent = `${errores} celdas con error`;
  $('[data-pl="ordenada"]').textContent = `Ordenada: ${camiones.length} camiones, 0 errores`;
  const scan = $('.pl__scan');

  // ---------- 2. el tablero ----------
  const svg = $('.tb__svg');
  const X0 = 46, X1 = 548, Y0 = 14;
  let Y1 = 256, AL = 300, dots = [];
  const xm = m => X0 + (m - .5) * (X1 - X0) / 4, ym = e => Y1 - (e / 60) * (Y1 - Y0);
  function construirGrafico() {
  const caja = svg.getBoundingClientRect();
  AL = caja.width > 0 ? clamp(Math.round(560 * caja.height / caja.width), 230, 520) : 300;
  Y1 = AL - 44;
  svg.setAttribute('viewBox', `0 0 560 ${AL}`);
  let s = '';
  [0, 15, 30, 45, 60].forEach(v => { s += `<line class="g" x1="${X0}" x2="${X1}" y1="${ym(v)}" y2="${ym(v)}"/><text class="ax" x="${X0 - 10}" y="${ym(v) + 4}" text-anchor="end">${v}</text>`; });
  s += `<rect class="banda" x="${xm(3) - 58}" y="${Y0 - 6}" width="116" height="${Y1 - Y0 + 12}" rx="8"/>`;
  s += `<line class="meta" x1="${X0}" x2="${X1}" y1="${ym(META)}" y2="${ym(META)}"/><text class="meta-t" x="${X1}" y="${ym(META) - 7}" text-anchor="end">meta ${META} min</text>`;
  for (let m = 1; m <= 4; m++) s += `<text class="col" x="${xm(m)}" y="${AL - 16}" text-anchor="middle">Muelle ${m}</text><line class="prom" data-m="${m}" x1="${xm(m) - 34}" x2="${xm(m) + 34}"/><text class="prom-t" data-m="${m}" x="${xm(m) + 40}"></text>`;
  camiones.forEach((r, k) => {
    r.x = xm(r.m) + (((k * 37) % 9) - 4) * 7; r.y = ym(r.e);
    s += `<circle class="dot ${estado(r.e)}${r.c ? '' : ' sin-cita'}" data-k="${k}" cx="${r.x.toFixed(1)}" cy="${r.y.toFixed(1)}" r="6.5" tabindex="-1" role="img" aria-label="${r.placa}, muelle ${r.m}, ${r.e} minutos en patio, ${r.c ? 'con' : 'sin'} cita"/>`;
  });
  svg.innerHTML = s;
  dots = $$('.dot');
  dots.forEach(d => {
    d.addEventListener('pointerenter', () => mostrar(d)); d.addEventListener('focus', () => mostrar(d));
    d.addEventListener('pointerleave', () => { tip.hidden = true; }); d.addEventListener('blur', () => { tip.hidden = true; });
  });
  }
  let filtro = 'todos';
  const pasa = r => filtro === 'todos' || (filtro === 'con' ? r.c : !r.c);

  function kpis(f = 1) {
    const sel = camiones.filter(pasa);
    const p = prom(sel), porMuelle = [1, 2, 3, 4].map(m => ({ m, v: prom(sel.filter(r => r.m === m)), n: sel.filter(r => r.m === m).length })).filter(x => x.n);
    const lento = porMuelle.sort((a, b) => b.v - a.v)[0] || { m: '-', v: 0 };
    const vp = $('[data-kpi="prom"]');
    vp.textContent = Math.round(p * f); vp.className = 'v ' + (p > META ? 'aten' : 'ok');
    $('[data-kpi="n"]').textContent = Math.round(sel.length * f);
    $('[data-kpi="lento"]').textContent = `M${lento.m} · ${Math.round(lento.v * f)}`;
    $('[data-kpi="lento"]').className = 'v ' + estado(lento.v);
    $('[data-kpi="cita"]').textContent = `${Math.round(prom(camiones.filter(r => r.c)) * f)} / ${Math.round(prom(camiones.filter(r => !r.c)) * f)}`;
    for (let m = 1; m <= 4; m++) {
      const g = sel.filter(r => r.m === m), y = ym(prom(g));
      const l = svg.querySelector(`.prom[data-m="${m}"]`), t = svg.querySelector(`.prom-t[data-m="${m}"]`);
      l.setAttribute('y1', y); l.setAttribute('y2', y); l.style.opacity = g.length ? 1 : 0;
      t.setAttribute('y', y + 4); t.textContent = g.length ? Math.round(prom(g)) : '';
    }
    dots.forEach((d, k) => d.classList.toggle('fuera', !pasa(camiones[k])));
  }
  $$('.chips button').forEach(b => b.addEventListener('click', () => {
    filtro = b.dataset.f;
    $$('.chips button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    kpis();
  }));

  // información de cada punto al pasar el cursor o con el teclado
  const tip = $('.tip'), caja = $('.tb__grafico');
  function mostrar(d) {
    const r = camiones[+d.dataset.k], a = d.getBoundingClientRect(), c = caja.getBoundingClientRect();
    tip.innerHTML = `<b>${r.placa}</b><span>Muelle ${r.m} · llegó ${r.l}</span><span>${r.e} min en patio · ${r.c ? 'con' : 'sin'} cita</span>`;
    tip.hidden = false;
    const x = clamp(a.left - c.left + a.width / 2, 90, c.width - 90);
    tip.style.transform = `translate(${x}px, ${a.top - c.top - 10}px) translate(-50%, -100%)`;
  }
  construirGrafico();

  // ---------- 3. el asistente ----------
  const PREGUNTA = '¿Por qué subió la espera en el muelle 3?';
  const qTxt = $('.msg-u .txt'), qCaret = $('.msg-u .caret'), resp = $('.msg-a'), lineas = $$('.msg-a .linea');

  // ---------- 4. la escena avanza con el scroll ----------
  const pasos = $$('.historia__pasos li');
  let pasoActual = -1;
  function paso(n) {
    if (n === pasoActual) return;
    pasoActual = n;
    pasos.forEach((li, i) => { li.classList.toggle('activo', i === n); li.setAttribute('aria-current', i === n ? 'step' : 'false'); });
  }

  const capa = $('.escena__particulas');
  let parts = [], medidas = [];
  function crearParticulas() {
    capa.innerHTML = camiones.map(r => `<span class="part">${r.e}</span>`).join('');
    parts = Array.from(capa.children);
  }
  function medir() {
    const e = escena.getBoundingClientRect();
    const t0 = planilla.style.transform, t1 = tablero.style.transform;
    planilla.style.transform = 'none'; tablero.style.transform = 'none';
    medidas = camiones.map((r, k) => {
      const celda = espCelda(D.indexOf(r)).getBoundingClientRect(), dot = dots[k].getBoundingClientRect();
      return { sx: celda.left - e.left + celda.width / 2, sy: celda.top - e.top + celda.height / 2, sw: Math.max(30, celda.width - 10), sh: Math.max(16, celda.height - 6),
        ex: dot.left - e.left + dot.width / 2, ey: dot.top - e.top + dot.height / 2, ed: Math.max(9, dot.width) };
    });
    planilla.style.transform = t0; tablero.style.transform = t1;
  }

  let ultimoF = -1;
  function render(p, conParticulas) {
    const a = seg(p, .02, .15), b = seg(p, .19, .40), c = seg(p, .44, .68), q = seg(p, .71, .78), r = seg(p, .80, .91);
    paso(p < .18 ? 0 : p < .42 ? 1 : p < .70 ? 2 : 3);
    // actos 1 y 2: errores que aparecen, limpieza fila a fila
    filas.forEach((f, i) => {
      const umbral = (i + .5) / filas.length, vis = a > umbral, limpia = b > umbral, est = (vis ? 'v' : '') + (limpia ? 'l' : '');
      if (est === f.est) return;
      f.est = est;
      f.celdas.forEach(el => { el.classList.toggle('mal', vis && !limpia && el.classList.contains('con-error')); el.classList.toggle('limpia', limpia); el.classList.toggle('quitada', limpia && f.dup); });
    });
    planilla.classList.toggle('con-errores', a > .05 && b < 1);
    planilla.classList.toggle('ordenada', b >= 1);
    planilla.classList.toggle('tipada', b > .04);
    scan.style.opacity = b > 0 && b < 1 ? 1 : 0;
    scan.style.top = `calc(var(--pl-cab) + ${b.toFixed(3)} * var(--pl-cuerpo))`;
    // acto 3: la planilla se retira, el tablero entra y los camiones saltan
    const sale = suave(seg(c, .3, .85)), entra = suave(seg(c, .12, .55));
    planilla.style.opacity = 1 - sale;
    planilla.style.transform = `translateY(${-14 * sale}px) scale(${1 - .05 * sale})`;
    planilla.style.visibility = sale >= 1 ? 'hidden' : 'visible';
    tablero.style.opacity = entra;
    tablero.style.transform = `translateY(${(1 - entra) * 18}px)`;
    tablero.classList.toggle('vivo', c >= 1);
    const fk = c >= 1 ? 1 : suave(seg(c, .45, 1));
    if (Math.abs(fk - ultimoF) > .004 || (fk === 1 && ultimoF !== 1)) { ultimoF = fk; kpis(fk); }
    camiones.forEach((cam, k) => {
      const tk = suave(seg(c, k * .03, k * .03 + .42));
      dots[k].classList.toggle('llego', tk >= 1);
      if (dots[k].tabIndex !== (c >= 1 ? 0 : -1)) dots[k].tabIndex = c >= 1 ? 0 : -1;
      if (!conParticulas) return;
      const el = parts[k], m = medidas[k];
      if (!m || c <= 0 || tk >= 1) { el.style.opacity = 0; return; }
      const w = lerp(m.sw, m.ed, tk), hh = lerp(m.sh, m.ed, tk);
      const x = lerp(m.sx, m.ex, tk), y = lerp(m.sy, m.ey, tk) - Math.sin(Math.PI * tk) * 70;
      el.style.opacity = 1;
      el.style.width = w + 'px'; el.style.height = hh + 'px'; el.style.borderRadius = lerp(3, m.ed / 2, tk) + 'px';
      el.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - hh / 2).toFixed(1)}px)`;
      el.style.color = `rgba(10,10,18,${(1 - seg(tk, 0, .4)).toFixed(2)})`;
      el.className = 'part' + (tk > .55 ? ' ' + estado(cam.e) : '');
    });
    // acto 4: la pregunta se escribe, la respuesta llega y el tablero señala la causa
    const nq = Math.round(q * PREGUNTA.length);
    if (qTxt.textContent.length !== nq) qTxt.textContent = PREGUNTA.slice(0, nq);
    qCaret.style.opacity = q > 0 && q < 1 ? 1 : 0;
    $('.msg-u').style.opacity = q > 0 ? 1 : 0;
    resp.classList.toggle('visible', r > 0);
    lineas.forEach((l, j) => l.classList.toggle('visible', r > j / lineas.length));
    $('.tb__asistente').classList.toggle('pensando', q >= 1 && r <= 0);
    svg.classList.toggle('causa', r > .15);
  }

  kpis();
  window.addEventListener('resize', () => { if (!raiz.classList.contains('historia--viva')) { construirGrafico(); kpis(); render(1, false); } });
  const viva = !reduce && 'IntersectionObserver' in window && typeof requestAnimationFrame === 'function';
  if (!viva) { render(1, false); return; }

  raiz.classList.add('historia--viva');
  crearParticulas();
  const pista = $('.historia__pista'), fija = $('.historia__fija');
  const progreso = () => { const r = pista.getBoundingClientRect(), total = pista.offsetHeight - fija.offsetHeight; return total > 0 ? clamp(-r.top / total) : 1; };
  let pedido = false;
  const cuadro = () => { pedido = false; render(progreso(), true); };
  const pedir = () => { if (!pedido) { pedido = true; requestAnimationFrame(cuadro); } };
  const remedir = () => { construirGrafico(); kpis(); ultimoF = -1; medir(); pedir(); };
  remedir();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);
  let to; window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(remedir, 120); });
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { window.addEventListener('scroll', pedir, { passive: true }); remedir(); }
    else window.removeEventListener('scroll', pedir);
  }), { rootMargin: '200px 0px' }).observe(pista);
})();
