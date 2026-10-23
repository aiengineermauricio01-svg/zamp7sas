/* ZAMP7 · gemelo digital de una flota de reparto, con datos sintéticos.
   Un segundo real = dos minutos simulados. Nada de esto son datos de un cliente.
   Una instancia por canvas[data-gemelo="flota"] dentro de .gemelo: lienzo, cifras [data-m], reloj, bitácora y sparkline. */
(function () {
  document.querySelectorAll('.gemelo canvas[data-gemelo="flota"]').forEach(iniciar);

  function iniciar(canvas) {
    const cont = canvas.closest('.gemelo');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = k => cont.querySelector('[data-m="' + k + '"]');
    const el = { reloj: m('reloj'), eventos: m('eventos'), spark: m('spark'), disp: m('disp'), efect: m('efect'), insp: m('insp'), evid: m('evid') };
    const COL = { fondo: '#0F1019', suelo: '#13141E', linea: '#2B2E3E', lineaB: '#363A4D', texto: '#A3A3B3', papel: '#F4F3F8', papelC: '#BDBCC9', azul: '#C0D3ED', azulO: '#1B4883', moradoLuz: '#BC76DB', ok: '#3EC9AC', at: '#F3B747', al: '#FF8A6E', gris: '#5F6782', grisB: '#4E566E', panel: '#12131C' };
    let CW = 1000, CH = 620, ancho = true;

    // Ciudad: calles en una cuadrícula; el CD y el taller ocupan dos manzanas a la izquierda.
    const XS = [60, 160, 260, 360, 460, 560, 660], YS = [100, 200, 300, 400, 500];
    const D = { x: 160, y: 300 }, TALLER = { x: 160, y: 400 };
    const PARQ = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) PARQ.push({ x: 86 + c * 26, y: 238 + r * 22, v: null });
    const BAHIAS = [{ x: 96, y: 452, v: null }, { x: 132, y: 452, v: null }];
    const PUNTOS = [[360, 100], [560, 100], [660, 200], [460, 200], [260, 200], [560, 300], [360, 300], [660, 400], [460, 400], [260, 500], [560, 500], [660, 500]]
      .map((p, i) => ({ n: 'T' + (i + 1), x: p[0], y: p[1], asignado: false, flash: 0, flashCol: COL.ok }));
    const PLACAS = ['WPL 482', 'SXT 219', 'JCV 318', 'NRA 507', 'KMD 664', 'TBR 135', 'LHG 790', 'PZQ 246'];
    const CAUSAS = ['cliente cerrado', 'sin dinero en caja', 'pedido errado', 'producto averiado'];
    const PASOS = [
      { t: '01 INSPECCIÓN', d: 'preoperacional con foto' },
      { t: '02 SALIDA A RUTA', d: 'vehículo, conductor y entregas' },
      { t: '03 ENTREGA CON PRUEBA', d: 'foto y firma; rechazo con causa' },
      { t: '04 RETORNO Y CIERRE', d: 'recaudo y caja por ruta' },
      { t: '05 TALLER Y DOCUMENTOS', d: 'OT, llantas, SOAT y RTM' }
    ];
    const brillo = [0, 0, 0, 0, 0];

    let flota = [], simMin = 0, eventos = [], serie = [], ultimoSpark = -999, lastTs = null, docTimer = 40, otN = 117;
    let efect = 0, rech = 0, cierres = 0, evid = 0; const inspHoy = new Set();

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function hora(mn) { const t = 6 * 60 + Math.floor(mn); const h = Math.floor(t / 60) % 24, mm = t % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
    function pesos(n) { return 'COP ' + n.toLocaleString('es-CO'); }
    function evento(tipo, txt, det) { eventos.unshift({ h: hora(simMin), tipo, txt, det }); eventos = eventos.slice(0, 4); pintarEventos(); }
    function pintarEventos() {
      if (!el.eventos) return;
      el.eventos.innerHTML = eventos.map(e => `<li><span class="h">${e.h}</span><span class="tipo tipo--${e.tipo}"></span><span class="txt">${e.txt}${e.det ? `<span class="det"> · ${e.det}</span>` : ''}</span></li>`).join('');
      el.eventos.querySelectorAll('.txt').forEach(s => { if (s.scrollWidth > s.clientWidth + 1) s.classList.add('corto'); });
    }
    function pulso(i) { brillo[i] = 1; }

    PLACAS.forEach((placa, i) => {
      const p = PARQ[i]; p.v = true;
      flota.push({ placa, x: p.x, y: p.y, wp: [], estado: 'base', timer: rand(0, 50), parq: p, paradas: [], dir: 0, ot: false, bahia: null, vel: rand(70, 90), alertaLeg: false });
    });

    function ruta(v, destinos) { v.wp = destinos.map(d => ({ x: d.x, y: d.y })); }
    function manhattan(desde, hasta) { return [{ x: hasta.x, y: desde.y }, { x: hasta.x, y: hasta.y }]; }
    function mover(v, dt) {
      if (!v.wp.length) return true;
      const t = v.wp[0], dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
      if (d < 1.2) { v.x = t.x; v.y = t.y; v.wp.shift(); return !v.wp.length; }
      const s = Math.min(d, v.vel * dt);
      v.x += dx / d * s; v.y += dy / d * s;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) v.dir = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;
      return false;
    }
    function aTaller(v) {
      const b = BAHIAS.find(x => !x.v) || BAHIAS[0];
      b.v = true; v.bahia = b; if (v.parq) { v.parq.v = null; }
      ruta(v, [D, TALLER, b]); v.estado = 'a-taller';
    }
    function salir(v) { ruta(v, [D]); v.estado = 'saliendo'; }
    function siguienteParada(v) {
      const p = v.paradas[0];
      v.wp = manhattan({ x: v.x, y: v.y }, p); v.estado = 'ruta'; v.alertaLeg = Math.random() < 0.05;
    }

    function step(dtReal) {
      const dt = dtReal, dMin = dtReal * 2;
      simMin += dMin; docTimer -= dMin;
      for (let i = 0; i < 5; i++) brillo[i] = Math.max(0, brillo[i] - dt * 0.9);
      PUNTOS.forEach(p => { p.flash = Math.max(0, p.flash - dt * 0.6); });
      if (docTimer <= 0) {
        docTimer = rand(80, 120); const v = pick(flota);
        evento('alerta', (Math.random() < 0.5 ? 'SOAT' : 'RTM') + ' de ' + v.placa + ' vence en ' + Math.round(rand(8, 20)) + ' días', 'aviso al jefe de flota'); pulso(4);
      }
      for (const v of flota) {
        if (v.estado === 'base') {
          v.timer -= dMin;
          if (v.timer <= 0) { v.estado = 'inspeccion'; v.timer = rand(3, 5); }
        } else if (v.estado === 'inspeccion') {
          v.timer -= dMin;
          if (v.timer <= 0) {
            inspHoy.add(v.placa); evid++;
            if (Math.random() < 0.09) { evento('alerta', v.placa + ': desgaste de llanta en la inspección', 'OT-' + (++otN) + ' abierta'); pulso(4); aTaller(v); }
            else { evento('captura', v.placa + ' inspección preoperacional', '14 fotos'); pulso(0); salir(v); }
          }
        } else if (v.estado === 'saliendo') {
          if (mover(v, dt)) {
            if (v.parq) { v.parq.v = null; v.parq = null; }
            const libres = PUNTOS.filter(p => !p.asignado).sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
            libres.forEach(p => { p.asignado = true; }); v.paradas = libres;
            if (!libres.length) { v.estado = 'retornando'; ruta(v, [D]); continue; }
            evento('decision', v.placa + ' sale a ruta con ' + libres.length + ' entregas', 'ruta planeada'); pulso(1); siguienteParada(v);
          }
        } else if (v.estado === 'ruta') {
          if (v.alertaLeg && v.wp.length === 1) { v.alertaLeg = false; evento('alerta', v.placa + ' a 68 km/h en zona de 50', 'conductor avisado'); pulso(2); }
          if (mover(v, dt)) { v.estado = 'entregando'; v.timer = rand(4, 9); }
        } else if (v.estado === 'entregando') {
          v.timer -= dMin;
          if (v.timer <= 0) {
            const p = v.paradas.shift(); p.asignado = false; p.flash = 1; evid++;
            if (Math.random() < 0.11) { rech++; p.flashCol = COL.al; evento('alerta', p.n + ' rechazo: ' + pick(CAUSAS), 'con foto y hora'); }
            else { efect++; p.flashCol = COL.ok; evento('medicion', p.n + ' entrega efectiva', 'foto y firma'); }
            pulso(2);
            if (v.paradas.length) siguienteParada(v);
            else { v.estado = 'retornando'; v.wp = manhattan({ x: v.x, y: v.y }, D); }
          }
        } else if (v.estado === 'retornando') {
          if (mover(v, dt)) { const p = PARQ.find(x => !x.v); p.v = true; v.parq = p; ruta(v, [p]); v.estado = 'a-base'; }
        } else if (v.estado === 'a-base') {
          if (mover(v, dt)) {
            cierres++; evid++; pulso(3);
            if (Math.random() < 0.16) evento('decision', v.placa + ' cierre de caja: diferencia de ' + pesos(Math.round(rand(8, 40)) * 1000), 'explicada: devolución');
            else evento('medicion', v.placa + ' cierre de caja', 'recaudo cuadrado');
            v.estado = 'base'; v.timer = rand(30, 55);
          }
        } else if (v.estado === 'a-taller') {
          if (mover(v, dt)) { v.estado = 'taller'; v.timer = rand(35, 65); }
        } else if (v.estado === 'taller') {
          v.timer -= dMin;
          if (v.timer <= 0) {
            evid++; pulso(4); evento('decision', 'OT-' + otN + ' cerrada: ' + v.placa, 'disponible de nuevo');
            v.bahia.v = null; v.bahia = null; const p = PARQ.find(x => !x.v); p.v = true; v.parq = p;
            ruta(v, [TALLER, D, p]); v.estado = 'volviendo';
          }
        } else if (v.estado === 'volviendo') {
          if (mover(v, dt)) { v.estado = 'base'; v.timer = rand(5, 15); }
        }
      }
      if (simMin - ultimoSpark >= 10) { ultimoSpark = simMin; serie.push(efect + rech ? efect / (efect + rech) * 100 : 100); serie = serie.slice(-36); }
    }

    function enTaller() { return flota.filter(v => v.estado === 'taller' || v.estado === 'a-taller').length; }
    function metrics() {
      const n = flota.length;
      if (el.disp) el.disp.textContent = Math.round((n - enTaller()) / n * 100) + ' %';
      if (el.efect) el.efect.textContent = efect + rech ? Math.round(efect / (efect + rech) * 100) + ' %' : '—';
      if (el.insp) el.insp.textContent = inspHoy.size + '/' + n;
      if (el.evid) el.evid.textContent = evid;
      if (el.reloj) el.reloj.textContent = hora(simMin);
    }

    // ---- dibujo -------------------------------------------------------------
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function texto(t, x, y, color, size, peso, align) { ctx.font = (peso || '') + ' ' + (size || 11) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = color || COL.texto; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }
    function manzana(x0, y0, x1, y1, fill, stroke) { ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1); } }
    function vehiculo(v) {
      const L = 20, A = 11, horiz = v.dir === 0;
      const w = horiz ? L : A, h = horiz ? A : L, x = v.x - w / 2, y = v.y - h / 2;
      let anillo = null;
      if (v.estado === 'entregando') anillo = COL.azul; else if (v.estado === 'taller' || v.estado === 'a-taller') anillo = COL.at; else if (v.estado === 'inspeccion') anillo = COL.moradoLuz;
      if (anillo) { ctx.save(); ctx.shadowColor = anillo; ctx.shadowBlur = 10; ctx.strokeStyle = anillo; ctx.lineWidth = 1.5; rr(x - 4, y - 4, w + 8, h + 8, 4); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(x + 2, y + 2, w, h, 2); ctx.fill();
      ctx.fillStyle = COL.papel; rr(x, y, w, h, 2); ctx.fill();
      ctx.fillStyle = COL.gris; // cabina hacia el sentido de marcha
      if (horiz) { const haciaDer = !v.wp.length || v.wp[0].x >= v.x; ctx.fillRect(haciaDer ? x + w - 6 : x, y, 6, h); }
      else { const haciaAbajo = !v.wp.length || v.wp[0].y >= v.y; ctx.fillRect(x, haciaAbajo ? y + h - 6 : y, w, 6); }
      ctx.fillStyle = COL.moradoLuz; if (horiz) ctx.fillRect(x, y + h - 2, w, 2); else ctx.fillRect(x + w - 2, y, 2, h); // el dato ya está capturado
    }
    function draw() {
      ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = COL.fondo; ctx.fillRect(0, 0, CW, CH);
      // manzanas (incluidas medias manzanas en los bordes)
      const xs = [20].concat(XS, [700]), ys = [56].concat(YS, [560]);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i] + (i ? 7 : 0), x1 = xs[i + 1] - (i < xs.length - 2 ? 7 : 0), y0 = ys[j] + (j ? 7 : 0), y1 = ys[j + 1] - (j < ys.length - 2 ? 7 : 0);
        if (x1 - x0 > 4 && y1 - y0 > 4) manzana(x0, y0, x1, y1, COL.suelo, '#1C1E2B');
      }
      // ejes de las calles
      ctx.strokeStyle = '#22242F'; ctx.setLineDash([6, 8]); ctx.lineWidth = 1;
      XS.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 56); ctx.lineTo(x, 560); ctx.stroke(); });
      YS.forEach(y => { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(700, y); ctx.stroke(); });
      ctx.setLineDash([]);
      // CD y taller
      manzana(67, 207, 153, 293, '#152038', COL.azulO); texto('CD · BASE', 110, 220, COL.azul, 10, '600', 'center');
      PARQ.forEach(p => { ctx.strokeStyle = COL.grisB; ctx.setLineDash([3, 3]); ctx.strokeRect(p.x - 11, p.y - 7, 22, 14); ctx.setLineDash([]); });
      manzana(67, 407, 153, 493, '#241D10', '#5A4416'); texto('TALLER', 110, 422, COL.at, 10, '600', 'center');
      BAHIAS.forEach(b => { ctx.strokeStyle = '#5A4416'; ctx.setLineDash([3, 3]); ctx.strokeRect(b.x - 14, b.y - 14, 28, 28); ctx.setLineDash([]); });
      // puntos de entrega
      PUNTOS.forEach(p => {
        const px = p.x + 12, py = p.y + 12;
        if (p.flash > 0) { ctx.save(); ctx.globalAlpha = p.flash; ctx.strokeStyle = p.flashCol; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 8 + (1 - p.flash) * 14, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        ctx.fillStyle = p.asignado ? '#1E2236' : '#181A26'; ctx.strokeStyle = p.asignado ? COL.azul : COL.grisB; ctx.lineWidth = 1;
        ctx.fillRect(px - 6, py - 6, 12, 12); ctx.strokeRect(px - 5.5, py - 5.5, 11, 11);
        texto(p.n, px + 10, py, p.asignado ? COL.azul : COL.texto, 10);
      });
      // ruta planeada de cada vehículo en reparto
      ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      flota.forEach(v => {
        if (!(v.estado === 'ruta' || v.estado === 'entregando') || !v.paradas.length) return;
        ctx.strokeStyle = 'rgba(188,118,219,.55)'; ctx.beginPath(); ctx.moveTo(v.x, v.y);
        let cx = v.x, cy = v.y;
        v.paradas.forEach(p => { ctx.lineTo(p.x, cy); ctx.lineTo(p.x, p.y); cx = p.x; cy = p.y; });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      flota.forEach(vehiculo);
      texto('CIUDAD · 8 VEHÍCULOS · 12 PUNTOS DE ENTREGA', 22, 34, COL.texto, 11, '600');
      if (ancho) panel();
      ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = COL.at; ctx.textAlign = 'left';
      ctx.fillText('DATOS SINTÉTICOS · 1 S = 2 MIN · GEMELO DIGITAL DE LA FLOTA', 22, CH - 24);
    }
    function panel() {
      const x0 = 722, w = 262;
      ctx.fillStyle = COL.panel; rr(x0, 16, w, 588, 6); ctx.fill(); ctx.strokeStyle = COL.linea; ctx.lineWidth = 1; ctx.stroke();
      texto('LO QUE HACE EL SISTEMA', x0 + 14, 38, COL.texto, 11, '600');
      const cuentas = [
        inspHoy.size + '/' + flota.length,
        String(flota.filter(v => v.estado === 'ruta' || v.estado === 'entregando').length),
        efect + ' · ' + rech,
        String(cierres),
        String(enTaller())
      ];
      const pies = ['inspeccionados hoy', 'en ruta ahora', 'efectivas · rechazos', 'cierres hoy', 'en taller ahora'];
      PASOS.forEach((p, i) => {
        const y = 58 + i * 80, b = brillo[i];
        ctx.fillStyle = b > 0 ? 'rgba(188,118,219,' + (0.08 + b * 0.14).toFixed(3) + ')' : '#151623'; rr(x0 + 8, y, w - 16, 70, 4); ctx.fill();
        ctx.fillStyle = b > 0 ? COL.moradoLuz : COL.linea; ctx.fillRect(x0 + 8, y, 3, 70);
        texto(p.t, x0 + 20, y + 18, COL.papel, 12, '600');
        texto(p.d, x0 + 20, y + 38, COL.texto, 10.5);
        texto(cuentas[i], x0 + w - 18, y + 18, b > 0 ? COL.moradoLuz : COL.azul, 15, '600', 'right');
        texto(pies[i], x0 + 20, y + 56, COL.gris, 10);
      });
      const y = 468;
      ctx.fillStyle = '#132620'; rr(x0 + 8, y, w - 16, 124, 4); ctx.fill(); ctx.strokeStyle = 'rgba(62,201,172,.35)'; ctx.stroke();
      texto('CARPETA DE EVIDENCIA', x0 + 20, y + 20, COL.ok, 11, '600');
      texto('para la auditoría de su cliente', x0 + 20, y + 40, COL.texto, 10.5);
      texto(String(evid), x0 + 20, y + 74, COL.papel, 30, '600');
      texto('registros con fecha,', x0 + 110, y + 68, COL.texto, 10.5);
      texto('responsable y foto', x0 + 110, y + 84, COL.texto, 10.5);
      texto('exportable para el auditor', x0 + 20, y + 108, COL.gris, 10);
    }
    function drawSpark() {
      const c = el.spark; if (!c) return;
      const g = c.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1); const r = c.getBoundingClientRect();
      if (r.width < 10) return;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height, n = serie.length; if (n < 2) return;
      const lo = 70, hi = 100, y = v => h - 3 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (h - 8);
      g.clearRect(0, 0, w, h);
      g.strokeStyle = COL.linea; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, y(90)); g.lineTo(w, y(90)); g.stroke(); g.setLineDash([]);
      g.beginPath(); serie.forEach((v, i) => { const x = i / (n - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
      g.strokeStyle = COL.azul; g.lineWidth = 1.5; g.stroke();
      g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(192,211,237,.10)'; g.fill();
      const last = serie[n - 1]; g.fillStyle = last < 85 ? COL.al : last < 90 ? COL.at : COL.ok; g.beginPath(); g.arc(w - 2, y(last), 3, 0, Math.PI * 2); g.fill();
    }
    function fit() {
      const rect = canvas.getBoundingClientRect(); if (rect.width < 10) return;
      ancho = rect.width >= 620; CW = ancho ? 1000 : 720; CH = 620;
      canvas.style.aspectRatio = CW + ' / ' + CH;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.width * (CH / CW) * dpr);
      ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    }
    let frame = 0;
    function loop(ts) {
      if (lastTs == null) lastTs = ts; const dt = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts;
      if (canvas.width === 0) fit();
      step(dt); draw(); metrics(); if ((frame++ % 30) === 0) drawSpark(); requestAnimationFrame(loop);
    }
    fit(); window.addEventListener('resize', () => { fit(); draw(); drawSpark(); }, { passive: true });
    for (let i = 0; i < 4500; i++) step(1 / 30); // 300 minutos simulados antes del primer fotograma
    draw(); metrics(); drawSpark(); pintarEventos();
    if (reduce) return;
    requestAnimationFrame(loop);
  }
})();
