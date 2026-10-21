/* ZAMP7 · gemelo digital del patio y los muelles, en isométrico, con datos sintéticos.
   Un segundo real = dos minutos simulados. Nada de esto son datos de un cliente.
   Una instancia por contenedor .gemelo: canvas principal, cifras [data-m], reloj, bitácora y sparkline. */
(function () {
  document.querySelectorAll('.gemelo canvas.gemelo__lienzo').forEach(iniciar);

  function iniciar(canvas) {
    const cont = canvas.closest('.gemelo');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = 800, H = 500;            // mundo (planta)
    const CW = 1000, CH = 620;         // lienzo lógico
    const m = k => cont.querySelector('[data-m="' + k + '"]');
    const el = { patio: m('patio'), espera: m('espera'), muelles: m('muelles'), hora: m('hora'), reloj: m('reloj'), eventos: m('eventos'), spark: m('spark'),
      nodos: [1, 2, 3].map(i => document.getElementById('nodo-' + i)), rutas: [1, 2, 3].map(i => document.getElementById('ruta-' + i)) };
    const COL = { fondo: '#0F1019', suelo: '#13141E', sueloB: '#171826', linea: '#2B2E3E', lineaB: '#363A4D', texto: '#A3A3B3', papel: '#F4F3F8', papelB: '#D9D8E2', papelC: '#BDBCC9', azul: '#C0D3ED', azulO: '#1B4883', moradoLuz: '#BC76DB', ok: '#3EC9AC', at: '#F3B747', al: '#FF8A6E', gris: '#5F6782', grisB: '#4E566E' };
    const GATE = { x: 70, y: 250 };
    const SLOTS = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) SLOTS.push({ x: 230 + c * 112, y: 150 + r * 100, truck: null });
    const DOCKS = [0, 1, 2, 3].map(i => ({ x: 650, y: 82 + i * 108, truck: null, t: 0, dur: 0 }));
    const EXIT_X = 900;
    const TL = 56, TWd = 24, TH = 22; // camión: largo, ancho, alto
    const PLACAS = ['WXP', 'TKR', 'LBN', 'SQF', 'MRD', 'GHT', 'PLM', 'JCV', 'NRA', 'FZK'];
    let trucks = [], nextArrival = 2, simMin = 0, served = [], waits = [], eventos = [], serie = [];
    let lastTs = null, id = 0, ultimoSpark = -999;

    // proyección isométrica
    // +x va hacia arriba a la derecha; +y hacia abajo a la derecha. Caras visibles: -x y +y.
    const S = 0.78, CA = 0.866, SA = 0.5, OX = 61, OY = 362;
    const P = (x, y, z) => [OX + (x + y) * CA * S, OY + (y - x) * SA * S - (z || 0) * S];

    function rand(a, b) { return a + Math.random() * (b - a); }
    function hora(mn) { const t = 6 * 60 + Math.floor(mn); const h = Math.floor(t / 60) % 24, mm = t % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
    function evento(tipo, txt, det) { eventos.unshift({ h: hora(simMin), tipo, txt, det }); eventos = eventos.slice(0, 4); pintarEventos(); }
    function pintarEventos() {
      if (!el.eventos) return;
      el.eventos.innerHTML = eventos.map(e => `<li><span class="h">${e.h}</span><span class="tipo tipo--${e.tipo}"></span><span class="txt">${e.txt}${e.det ? `<span class="det"> · ${e.det}</span>` : ''}</span></li>`).join('');
      el.eventos.querySelectorAll('.txt').forEach(s => { if (s.scrollWidth > s.clientWidth + 1) s.classList.add('corto'); });
    }
    function pulse(i) { [el.nodos[i], el.rutas[i]].forEach(n => { if (!n) return; n.classList.add('on'); setTimeout(() => n.classList.remove('on'), 650); }); }
    function spawn() {
      const placa = PLACAS[id % PLACAS.length] + ' ' + (100 + Math.floor(Math.random() * 900));
      trucks.push({ id: ++id, placa, x: -90, y: GATE.y, tx: GATE.x, ty: GATE.y, state: 'llegando', wait: 0, slot: null, dock: null, speed: rand(95, 125), dir: 0 });
    }
    const freeSlot = () => SLOTS.find(s => !s.truck), freeDock = () => DOCKS.find(d => !d.truck);
    function moveTo(t, dt) {
      const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { t.x = t.tx; t.y = t.ty; return true; }
      const step = Math.min(d, t.speed * dt);
      t.x += dx / d * step; t.y += dy / d * step; t.dir = Math.abs(dx) >= Math.abs(dy) ? 0 : 1; return false;
    }
    function step(dtReal) {
      const dt = dtReal, dMin = dtReal * 2;
      simMin += dMin; nextArrival -= dMin;
      if (nextArrival <= 0) { spawn(); nextArrival = rand(5, 12); }
      let cola = 0;
      for (const t of trucks) {
        if (t.state === 'llegando') {
          if (moveTo(t, dt)) { t.state = 'en-porteria'; pulse(0); evento('captura', t.placa + ' en portería', 'placa y sello leídos'); }
        } else if (t.state === 'en-porteria') {
          const s = freeSlot();
          if (s) { s.truck = t; t.slot = s; t.tx = s.x; t.ty = s.y; t.state = 'a-patio'; }
          else { t.tx = GATE.x - 64 * (cola++); t.ty = GATE.y; moveTo(t, dt); }
          t.wait += dMin;
        } else if (t.state === 'a-patio') {
          if (moveTo(t, dt)) t.state = 'esperando';
          t.wait += dMin;
        } else if (t.state === 'esperando') {
          t.wait += dMin;
          const d = freeDock();
          if (d) { d.truck = t; d.dur = rand(22, 42); d.t = 0; t.dock = d; if (t.slot) { t.slot.truck = null; t.slot = null; } t.tx = d.x; t.ty = d.y; t.state = 'a-muelle'; pulse(2); evento('decision', t.placa + ' al muelle M' + (DOCKS.indexOf(d) + 1), Math.round(t.wait) + ' min en patio'); }
          else if (t.wait > 45 && !t.alertado) { t.alertado = true; evento('alerta', t.placa + ' · ' + Math.round(t.wait) + ' min en patio', 'supervisor avisado'); }
        } else if (t.state === 'a-muelle') {
          if (moveTo(t, dt)) { t.state = 'cargando'; waits.push({ m: simMin, w: t.wait }); pulse(1); }
        } else if (t.state === 'cargando') {
          t.dock.t += dMin;
          if (t.dock.t >= t.dock.dur) { evento('medicion', t.placa + ' cargó en ' + Math.round(t.dock.t) + ' min', 'sello con foto'); t.dock.truck = null; t.dock = null; t.tx = EXIT_X; t.ty = t.y; t.state = 'saliendo'; served.push(simMin); }
        } else if (t.state === 'saliendo') {
          if (moveTo(t, dt)) t.state = 'fuera';
        }
      }
      trucks = trucks.filter(t => t.state !== 'fuera');
      waits = waits.filter(w => simMin - w.m < 240); served = served.filter(mm => simMin - mm < 120);
      if (simMin - ultimoSpark >= 10) { ultimoSpark = simMin; const enEspera = trucks.filter(t => ['en-porteria', 'a-patio', 'esperando'].includes(t.state)); serie.push(enEspera.length ? enEspera.reduce((a, t) => a + t.wait, 0) / enEspera.length : 0); serie = serie.slice(-36); }
    }
    function metrics() {
      const enPatio = trucks.filter(t => ['en-porteria', 'a-patio', 'esperando', 'a-muelle'].includes(t.state)).length;
      const avg = waits.length ? waits.reduce((a, b) => a + b.w, 0) / waits.length : 0;
      const busy = DOCKS.filter(d => d.truck).length;
      if (el.patio) el.patio.textContent = enPatio;
      if (el.espera) el.espera.textContent = Math.round(avg);
      if (el.muelles) el.muelles.textContent = busy + '/4';
      if (el.hora) el.hora.textContent = (served.length / 2).toFixed(1).replace('.', ',');
      if (el.reloj) el.reloj.textContent = hora(simMin);
    }

    // ---- dibujo isométrico -------------------------------------------------
    function poly(pts, fill, stroke, lw) {
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    function flat(x0, y0, x1, y1, fill, stroke, dash) {
      if (dash) ctx.setLineDash(dash);
      poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], fill, stroke); ctx.setLineDash([]);
    }
    function box(x0, y0, x1, y1, h, top, left, right, stroke) {
      poly([P(x0, y0, h), P(x0, y1, h), P(x0, y1, 0), P(x0, y0, 0)], left, stroke);   // cara -x (abajo a la izquierda)
      poly([P(x0, y1, h), P(x1, y1, h), P(x1, y1, 0), P(x0, y1, 0)], right, stroke);  // cara +y (abajo a la derecha)
      poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], top, stroke);    // tapa
    }
    function label(txt, x, y, z, color, size, align) {
      const p = P(x, y, z); ctx.font = (size || 11) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = color || COL.texto; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, p[0], p[1]); ctx.textAlign = 'left';
    }
    function drawTruck(t) {
      const acc = (t.state === 'esperando' || t.state === 'en-porteria') ? (t.wait > 45 ? COL.al : t.wait > 25 ? COL.at : null) : null;
      const l = t.dir ? TWd : TL, w = t.dir ? TL : TWd;
      const x0 = t.x - l / 2, x1 = t.x + l / 2, y0 = t.y - w / 2, y1 = t.y + w / 2;
      if (acc) { ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 14; flat(x0 - 4, y0 - 4, x1 + 4, y1 + 4, 'rgba(0,0,0,0)', acc); ctx.restore(); }
      // sombra
      poly([P(x0 + 3, y0 + 3), P(x1 + 3, y0 + 3), P(x1 + 3, y1 + 3), P(x0 + 3, y1 + 3)], 'rgba(0,0,0,.35)');
      // cabina primero (al frente del sentido de marcha), luego el furgón que la tapa donde corresponde
      if (t.dir === 0) { box(x1 - 13, y0, x1, y1, TH + 4, COL.gris, COL.grisB, COL.gris, COL.linea); box(x0, y0, x1 - 13, y1, TH, COL.papel, COL.papelC, COL.papelB, COL.linea); }
      else { box(x0, y1 - 13, x1, y1, TH + 4, COL.gris, COL.grisB, COL.gris, COL.linea); box(x0, y0, x1, y1 - 13, TH, COL.papel, COL.papelC, COL.papelB, COL.linea); }
      // base morada: el dato ya está capturado
      poly([P(x0, y0, 3), P(x0, y1, 3), P(x0, y1, 0), P(x0, y0, 0)], COL.moradoLuz);
      poly([P(x0, y1, 3), P(x1, y1, 3), P(x1, y1, 0), P(x0, y1, 0)], COL.moradoLuz);
      if (acc) label(Math.round(t.wait) + ' min', t.x, t.y, TH + 26, acc, 12, 'center');
    }
    function draw() {
      ctx.clearRect(0, 0, CW, CH);
      ctx.fillStyle = COL.fondo; ctx.fillRect(0, 0, CW, CH);
      // losa del patio
      poly([P(-20, -20), P(W + 20, -20), P(W + 20, H + 20), P(-20, H + 20)], COL.suelo, COL.lineaB);
      ctx.strokeStyle = COL.linea; ctx.lineWidth = 1; ctx.globalAlpha = .7;
      for (let x = 0; x <= W; x += 50) { const a = P(x, 0), b = P(x, H); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (let y = 0; y <= H; y += 50) { const a = P(0, y), b = P(W, y); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // vía de entrada y salida
      flat(-20, GATE.y - 22, GATE.x + 40, GATE.y + 22, COL.sueloB);
      flat(760, 40, W + 20, 460, COL.sueloB);
      // portería: caseta
      box(GATE.x - 36, GATE.y - 120, GATE.x - 16, GATE.y - 60, 34, COL.azulO, '#163A6A', '#1B4883', COL.lineaB);
      flat(GATE.x - 36, GATE.y - 50, GATE.x + 36, GATE.y + 120, null, COL.grisB, [4, 4]);
      label('PORTERÍA', GATE.x - 36, GATE.y - 150, 40, COL.texto, 11);
      // posiciones de patio
      for (const s of SLOTS) flat(s.x - 40, s.y - 19, s.x + 40, s.y + 19, s.truck ? 'rgba(192,211,237,.06)' : null, s.truck ? COL.azul : COL.grisB, [5, 5]);
      label('PATIO · 9 POSICIONES', 190, 408, 0, COL.texto, 11);
      // edificio de muelles (bodega) al fondo derecho
      box(700, 30, 780, 470, 70, '#1A1C2A', '#15161F', '#1E2030', COL.lineaB);
      DOCKS.forEach((d, i) => {
        const yy0 = d.y - 28, yy1 = d.y + 28;
        // puerta del muelle en la cara x=700 (frente a los camiones)
        poly([P(700, yy0, 46), P(700, yy1, 46), P(700, yy1, 0), P(700, yy0, 0)], d.truck ? 'rgba(192,211,237,.18)' : '#0F1019', d.truck ? COL.azul : COL.grisB);
        // plataforma de atraque
        flat(d.x - 40, d.y - 36, d.x + 40, d.y + 36, null, d.truck ? COL.azul : COL.grisB, [3, 4]);
        if (d.truck) {
          const p = Math.min(1, d.t / d.dur);
          flat(d.x - 36, d.y + 30, d.x + 36, d.y + 36, COL.linea);
          flat(d.x - 36, d.y + 30, d.x - 36 + 72 * p, d.y + 36, p > .9 ? COL.ok : COL.azul);
        }
      });
      label('MUELLES', 700, 10, 90, COL.texto, 11);
      label('SALIDA ↗', 800, 470, 0, COL.texto, 11);
      // camiones, de atrás hacia adelante
      trucks.slice().sort((a, b) => (a.y - a.x) - (b.y - b.x)).forEach(drawTruck);
      DOCKS.forEach((d, i) => label('M' + (i + 1) + (d.truck ? ' · ' + Math.round(d.t) + ' min' : ' · libre'), 700, d.y - 26, 60, d.truck ? COL.azul : COL.gris, 11));
      // marco de datos
      ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = COL.at; ctx.fillText('DATOS SINTÉTICOS · 1 S = 2 MIN · GEMELO DIGITAL DEL PATIO', 16, CH - 24);
    }
    function drawSpark() {
      const c = el.spark; if (!c) return;
      const g = c.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1); const r = c.getBoundingClientRect();
      if (r.width < 10) return;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height, n = serie.length; if (n < 2) return;
      const max = Math.max(50, ...serie);
      g.clearRect(0, 0, w, h);
      g.strokeStyle = COL.linea; g.beginPath(); g.moveTo(0, h - 1 - (25 / max) * (h - 8)); g.lineTo(w, h - 1 - (25 / max) * (h - 8)); g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
      g.beginPath(); serie.forEach((v, i) => { const x = i / (n - 1) * w, y = h - 2 - (v / max) * (h - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = COL.azul; g.lineWidth = 1.5; g.stroke();
      g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(192,211,237,.10)'; g.fill();
      const last = serie[n - 1]; g.fillStyle = last > 45 ? COL.al : last > 25 ? COL.at : COL.ok; g.beginPath(); g.arc(w - 2, h - 2 - (last / max) * (h - 8), 3, 0, Math.PI * 2); g.fill();
    }
    function fit() {
      const dpr = Math.min(2, window.devicePixelRatio || 1); const rect = canvas.getBoundingClientRect();
      if (rect.width < 10) return;
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.width * (CH / CW) * dpr);
      ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    }
    let frame = 0;
    function loop(ts) {
      if (lastTs == null) lastTs = ts; const dt = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts;
      if (canvas.width === 0) fit();
      step(dt); draw(); metrics(); if ((frame++ % 30) === 0) drawSpark(); requestAnimationFrame(loop);
    }
    fit(); window.addEventListener('resize', () => { fit(); drawSpark(); }, { passive: true });
    for (let i = 0; i < 2250; i++) step(1 / 30); // 150 minutos simulados antes del primer fotograma
    draw(); metrics(); drawSpark(); pintarEventos();
    if (reduce) return;
    requestAnimationFrame(loop);
  }
})();
