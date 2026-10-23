/* ZAMP7 · un solo flujo de datos para un operador logístico, con datos sintéticos.
   De la operación (personal, flota, puerta, reparto, retorno, inventario) a un modelo de datos único,
   revisado por agentes de IA, y de ahí a cada área que decide (finanzas, contabilidad, compras,
   dirección de proyectos, gerencia y clientes). Un segundo real = dos minutos simulados.
   Una instancia por canvas[data-gemelo="flujo"] dentro de .gemelo: lienzo, cifras [data-m], reloj, bitácora y sparkline. */
(function () {
  document.querySelectorAll('.gemelo canvas[data-gemelo="flujo"]').forEach(iniciar);

  function iniciar(canvas) {
    const cont = canvas.closest('.gemelo');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = k => cont.querySelector('[data-m="' + k + '"]');
    const el = { reloj: m('reloj'), eventos: m('eventos'), spark: m('spark'), reg: m('reg'), corr: m('corr'), horas: m('horas'), cons: m('cons') };
    const COL = { fondo: '#0F1019', nodo: '#13141E', linea: '#2B2E3E', texto: '#A3A3B3', papel: '#F4F3F8', azul: '#C0D3ED', azulO: '#1B4883', moradoLuz: '#BC76DB', ok: '#3EC9AC', at: '#F3B747', al: '#FF8A6E', gris: '#5F6782', hub: '#141728' };

    const FUENTES = [
      { t: 'PERSONAL Y TURNOS', d: 'asistencia · productividad', c: 'personal' },
      { t: 'FLOTA', d: 'inspección · OT · km', c: 'flota' },
      { t: 'PUERTA Y SALIDAS', d: 'vehículo · tripulación', c: 'puerta' },
      { t: 'REPARTO', d: 'entregas · rechazos · fotos', c: 'reparto' },
      { t: 'RETORNO Y CONTEO', d: 'devolución · 2.º testigo', c: 'retorno' },
      { t: 'INVENTARIO', d: 'conteos · cierres', c: 'inventario' }
    ];
    const AREAS = [
      { t: 'FINANZAS', d: 'caja · margen por cliente' },
      { t: 'CONTABILIDAD', d: 'provisiones · asientos' },
      { t: 'COMPRAS', d: 'llantas · repuestos · insumos' },
      { t: 'DIRECCIÓN DE PROYECTOS', d: 'hitos · avance · riesgos' },
      { t: 'GERENCIA GENERAL', d: 'informe de las 6 a. m.' },
      { t: 'CLIENTES', d: 'informes · expedientes' }
    ];
    // Destinos más probables de cada fuente para el tráfico de fondo
    const DESTINOS = [[3, 4, 0], [2, 0, 4], [5, 4], [0, 5, 1], [1, 5, 0], [1, 2, 0]];
    // Historias completas: lo que capta la operación, lo que hace el modelo con IA y lo que recibe cada área
    const HISTORIAS = [
      { s: 4, a: 1, id: 'R-214', cap: ['captura', 'Retorno R-214: 3 cajas de diferencia', 'conteo con 2 testigos'], ag: ['Agente: 2 cajas eran digitación', 'corregido y registrado'], fin: ['decision', 'Contabilidad: 1 caja con evidencia', 'lista para reclamar'] },
      { s: 1, a: 2, id: 'F-077', cap: ['captura', 'Inspección: 4 vehículos con llantas al mínimo', 'con foto'], fin: ['decision', 'Compras: orden sugerida de 16 llantas', 'precio del último pedido'] },
      { s: 3, a: 0, id: 'C-312', cap: ['medicion', 'Ruta 12 cerró con COP 8,4 M de recaudo', 'caja cuadrada'], fin: ['medicion', 'Finanzas: flujo de caja del día al minuto', 'por sede y por cliente'] },
      { s: 0, a: 4, id: 'P-019', cap: ['captura', 'Turno B empieza con 2 auxiliares menos', 'asistencia digital'], fin: ['decision', 'Gerencia: mover 1 auxiliar de inventario', 'sugerencia; decide el jefe'] },
      { s: 5, a: 1, id: 'I-508', cap: ['captura', 'Conteo cíclico: 2 referencias no cuadran', 'bodega 2'], ag: ['Agente: unidad de medida errada', 'caja contra unidad, corregido'], fin: ['decision', 'Contabilidad: ajuste de inventario', 'listo para aprobar'] },
      { s: 2, a: 5, id: 'S-841', cap: ['captura', 'Salida del SXT 219 con 22 pedidos', 'hora, foto y sello'], fin: ['medicion', 'Clientes: aviso de despacho enviado', 'con hora estimada'] },
      { s: -1, a: 0, id: 'Q-033', cap: ['captura', 'Finanzas pregunta: margen por cliente', 'esta semana'], asist: true, fin: ['decision', 'Asistente responde con 3 fuentes', 'citadas en la respuesta'] },
      { s: 3, a: 3, id: 'N-040', cap: ['medicion', 'Piloto de ruta nocturna: 38 de 40 entregas', ''], fin: ['decision', 'Proyectos: hito 2 cumplido, 62 %', 'hito 3 en riesgo por fecha'] },
      { s: 3, a: 5, id: 'D-905', cap: ['alerta', 'Rechazo en T9: cliente cerrado', 'con foto y hora'], fin: ['decision', 'Clientes: reprogramado para mañana', 'sin costo de reclamo'] },
      { s: 1, a: 4, id: 'F-131', cap: ['alerta', 'SOAT del JCV 318 vence en 12 días', ''], fin: ['medicion', 'Gerencia: cero documentos vencidos', 'aviso al jefe de flota'] }
    ];

    let CW = 1000, CH = 620, ancho = true, L = null;
    let particulas = [], registros = [], eventos = [], serie = [], llegadas = [];
    let simMin = 0, lastTs = null, ultimoSpark = -999, proxHistoria = 3, iHist = 0, acumFondo = 0;
    let reg = 0, corr = 0, cons = 0, brilloAgente = 0, brilloAsist = 0;
    const brilloF = FUENTES.map(() => 0), brilloA = AREAS.map(() => 0);

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function hora(mn) { const t = 6 * 60 + Math.floor(mn); const h = Math.floor(t / 60) % 24, mm = t % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
    function evento(tipo, txt, det) { eventos.unshift({ h: hora(simMin), tipo, txt, det }); eventos = eventos.slice(0, 4); pintarEventos(); }
    function pintarEventos() {
      if (!el.eventos) return;
      el.eventos.innerHTML = eventos.map(e => `<li><span class="h">${e.h}</span><span class="tipo tipo--${e.tipo}"></span><span class="txt">${e.txt}${e.det ? `<span class="det"> · ${e.det}</span>` : ''}</span></li>`).join('');
      el.eventos.querySelectorAll('.txt').forEach(s => { if (s.scrollWidth > s.clientWidth + 1) s.classList.add('corto'); });
    }

    // ---- geometría: horizontal en pantallas anchas, vertical en el celular ---------
    function layout() {
      if (ancho) {
        CW = 1000; CH = 620;
        const hub = { x0: 365, y0: 90, x1: 635, y1: 520 };
        const nodo = (x, i) => ({ x, y: 54 + i * 82, w: 205, h: 60 });
        return {
          hub,
          f: FUENTES.map((_, i) => nodo(25, i)), a: AREAS.map((_, i) => nodo(770, i)),
          cab: [[25, 30, 'left', '1 · CAPTURA EN LA OPERACIÓN'], [500, 30, 'center', '2 · UN SOLO FLUJO DE DATOS · 3 · IA QUE REVISA'], [975, 30, 'right', '4 · CADA ÁREA DECIDE']],
          entrada: i => [{ x: 230, y: 84 + i * 82 }, { x: 300, y: 84 + i * 82 }, { x: 300, y: hub.y0 + 70 + i * 58 }, { x: hub.x0, y: hub.y0 + 70 + i * 58 }],
          salida: j => [{ x: hub.x1, y: hub.y0 + 70 + j * 58 }, { x: 700, y: hub.y0 + 70 + j * 58 }, { x: 700, y: 84 + j * 82 }, { x: 770, y: 84 + j * 82 }]
        };
      }
      CW = 600; CH = 900;
      const hub = { x0: 40, y0: 268, x1: 560, y1: 610 };
      const nodo = (i, y) => ({ x: 12 + (i % 3) * 196, y: y + Math.floor(i / 3) * 74, w: 184, h: 62 });
      const xc = i => 12 + (i % 3) * 196 + 92;
      return {
        hub,
        f: FUENTES.map((_, i) => nodo(i, 52)), a: AREAS.map((_, i) => nodo(i, 700)),
        cab: [[12, 28, 'left', '1 · CAPTURA EN LA OPERACIÓN'], [300, 246, 'center', '2 · UN SOLO FLUJO · 3 · IA QUE REVISA'], [12, 678, 'left', '4 · CADA ÁREA DECIDE']],
        entrada: i => { const y = 52 + Math.floor(i / 3) * 74 + 62, hx = hub.x0 + 50 + i * 84; return [{ x: xc(i), y }, { x: xc(i), y: y + 40 }, { x: hx, y: hub.y0 - 30 }, { x: hx, y: hub.y0 }]; },
        salida: j => { const y = 700 + Math.floor(j / 3) * 74, hx = hub.x0 + 50 + j * 84; return [{ x: hx, y: hub.y1 }, { x: hx, y: hub.y1 + 30 }, { x: xc(j), y: y - 40 }, { x: xc(j), y }]; }
      };
    }
    function bez(p, t) {
      const u = 1 - t;
      return { x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x, y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y };
    }
    function hubPunto() { const h = L.hub; return { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 }; }

    // ---- simulación -----------------------------------------------------------
    function nueva(s, a, historia) {
      const marcado = historia ? !!historia.ag : Math.random() < 0.05;
      particulas.push({ s, a, fase: s < 0 ? 'salida' : 'entrada', t: 0, vel: historia ? 0.32 : rand(0.4, 0.6), espera: 0, marcado, h: historia || null, id: historia ? historia.id : 'R-' + (100 + Math.floor(Math.random() * 900)) });
      if (historia) {
        evento(historia.cap[0], historia.cap[1], historia.cap[2]);
        if (s >= 0) brilloF[s] = 1;
        if (historia.asist) { brilloAsist = 1; cons++; }
      }
    }
    function alHub(p) {
      reg++; llegadas.push(simMin);
      registros.unshift({ id: p.id, fuente: p.s >= 0 ? FUENTES[p.s].c : 'consulta', estado: p.marcado ? 'revisando' : 'ok', ref: p });
      registros = registros.slice(0, 8);
      p.fase = 'hub'; p.espera = p.marcado ? 2.2 : 0.35;
      if (p.marcado) { brilloAgente = 1; if (p.h && p.h.ag) evento('alerta', p.h.ag[0], p.h.ag[1]); }
    }
    function step(dtReal) {
      const dt = dtReal, dMin = dtReal * 2;
      simMin += dMin; proxHistoria -= dMin; acumFondo += dt;
      for (let i = 0; i < 6; i++) { brilloF[i] = Math.max(0, brilloF[i] - dt * 0.8); brilloA[i] = Math.max(0, brilloA[i] - dt * 0.8); }
      brilloAgente = Math.max(0, brilloAgente - dt * 0.6); brilloAsist = Math.max(0, brilloAsist - dt * 0.6);
      while (acumFondo > 0.3) { acumFondo -= 0.3; const s = Math.floor(Math.random() * FUENTES.length); nueva(s, pick(DESTINOS[s])); }
      if (Math.random() < dt * 0.15) cons++; // consultas al asistente de fondo
      if (proxHistoria <= 0) { proxHistoria = rand(7, 11); const h = HISTORIAS[iHist++ % HISTORIAS.length]; nueva(h.s, h.a, h); }
      for (const p of particulas) {
        if (p.fase === 'entrada') { p.t += p.vel * dt; if (p.t >= 1) alHub(p); }
        else if (p.fase === 'hub') {
          p.espera -= dt;
          if (p.espera <= 0) {
            if (p.marcado) { corr++; p.marcado = false; const r = registros.find(x => x.ref === p); if (r) r.estado = 'corregido'; }
            p.fase = 'salida'; p.t = 0;
          }
        } else if (p.fase === 'salida') {
          if (p.s < 0 && p.t === 0) { reg++; llegadas.push(simMin); registros.unshift({ id: p.id, fuente: 'consulta', estado: 'ok', ref: p }); registros = registros.slice(0, 8); }
          p.t += p.vel * dt;
          if (p.t >= 1) { p.fase = 'fin'; brilloA[p.a] = p.h ? 1 : Math.max(brilloA[p.a], 0.35); if (p.h) evento(p.h.fin[0], p.h.fin[1], p.h.fin[2]); }
        }
      }
      particulas = particulas.filter(p => p.fase !== 'fin');
      llegadas = llegadas.filter(t => simMin - t < 60);
      if (simMin - ultimoSpark >= 10) { ultimoSpark = simMin; serie.push(llegadas.length); serie = serie.slice(-36); }
    }
    function metrics() {
      if (el.reg) el.reg.textContent = reg.toLocaleString('es-CO');
      if (el.corr) el.corr.textContent = corr;
      if (el.horas) el.horas.textContent = (corr * 12 / 60).toFixed(1).replace('.', ',');
      if (el.cons) el.cons.textContent = cons;
      if (el.reloj) el.reloj.textContent = hora(simMin);
    }

    // ---- dibujo -----------------------------------------------------------------
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function texto(t, x, y, color, size, peso, align) { ctx.font = (peso || '') + ' ' + (size || 11) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = color || COL.texto; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }
    function curva(p, color) { ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); ctx.stroke(); }
    function nodo(n, info, b, acento) {
      ctx.fillStyle = b > 0 ? 'rgba(' + acento + ',' + (0.06 + b * 0.16).toFixed(3) + ')' : COL.nodo;
      rr(n.x, n.y, n.w, n.h, 6); ctx.fill();
      ctx.strokeStyle = b > 0.05 ? 'rgba(' + acento + ',' + (0.4 + b * 0.6).toFixed(3) + ')' : COL.linea; ctx.lineWidth = 1; ctx.stroke();
      texto(info.t, n.x + 12, n.y + 22, COL.papel, 12, '600');
      texto(info.d, n.x + 12, n.y + 42, COL.texto, 10.5);
    }
    function draw() {
      ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = COL.fondo; ctx.fillRect(0, 0, CW, CH);
      L.cab.forEach(c => texto(c[3], c[0], c[1], COL.texto, 11, '600', c[2]));
      FUENTES.forEach((_, i) => curva(L.entrada(i), 'rgba(192,211,237,.16)'));
      AREAS.forEach((_, j) => curva(L.salida(j), 'rgba(188,118,219,.18)'));
      FUENTES.forEach((f, i) => nodo(L.f[i], f, brilloF[i], '192,211,237'));
      AREAS.forEach((a, j) => nodo(L.a[j], a, brilloA[j], '188,118,219'));
      hub();
      // registros en movimiento
      for (const p of particulas) {
        if (p.fase === 'hub') continue;
        const q = bez(p.fase === 'entrada' ? L.entrada(p.s) : L.salida(p.a), Math.min(1, p.t));
        const col = p.fase === 'entrada' ? (p.marcado ? COL.at : COL.azul) : COL.moradoLuz;
        if (p.h) {
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          texto(p.id, q.x + 8, q.y - 9, COL.papel, 10, '600');
        } else { ctx.globalAlpha = .85; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      }
      ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = COL.at; ctx.textAlign = 'left';
      ctx.fillText(ancho ? 'DATOS SINTÉTICOS · 1 S = 2 MIN · FLUJO DE DATOS DE UN OPERADOR LOGÍSTICO' : 'DATOS SINTÉTICOS · 1 S = 2 MIN', 12, CH - 24);
    }
    function hub() {
      const h = L.hub, w = h.x1 - h.x0, cx = (h.x0 + h.x1) / 2;
      ctx.save(); ctx.shadowColor = 'rgba(188,118,219,.35)'; ctx.shadowBlur = 24; ctx.fillStyle = COL.hub; rr(h.x0, h.y0, w, h.y1 - h.y0, 10); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(188,118,219,.55)'; ctx.lineWidth = 1.2; rr(h.x0, h.y0, w, h.y1 - h.y0, 10); ctx.stroke();
      texto('MODELO DE DATOS ÚNICO', cx, h.y0 + 24, COL.papel, 13, '600', 'center');
      texto('LA TORRE · ZAMP7', cx, h.y0 + 44, COL.moradoLuz, 10.5, '600', 'center');
      texto('registros hoy ' + reg.toLocaleString('es-CO') + ' · corregidos ' + corr, cx, h.y0 + 64, COL.texto, 10.5, '', 'center');
      // tabla viva de registros
      const tx = h.x0 + 18, ty = h.y0 + 86, fila = ancho ? 26 : 24;
      ctx.strokeStyle = COL.linea; ctx.beginPath(); ctx.moveTo(h.x0 + 12, ty - 8); ctx.lineTo(h.x1 - 12, ty - 8); ctx.stroke();
      const filas = ancho ? 8 : 7;
      registros.slice(0, filas).forEach((r, i) => {
        const y = ty + 6 + i * fila, a = 1 - i * 0.09;
        ctx.globalAlpha = Math.max(.25, a);
        texto(r.id, tx, y, COL.papel, 10.5, '600');
        texto(r.fuente, tx + 64, y, COL.texto, 10.5);
        const ec = r.estado === 'ok' ? COL.ok : r.estado === 'corregido' ? COL.azul : COL.at;
        texto(r.estado === 'ok' ? 'cuadra' : r.estado, h.x1 - 18, y, ec, 10.5, '600', 'right');
        ctx.globalAlpha = 1;
      });
      // agentes de IA
      const by = h.y1 - 40, bw = (w - 36) / 2;
      [[h.x0 + 12, 'AGENTE DE COHERENCIA', brilloAgente, '243,183,71'], [h.x0 + 24 + bw, 'ASISTENTE EN ESPAÑOL', brilloAsist, '188,118,219']].forEach(b => {
        ctx.fillStyle = b[2] > 0 ? 'rgba(' + b[3] + ',' + (0.1 + b[2] * 0.25).toFixed(3) + ')' : '#191B2B'; rr(b[0], by, bw, 28, 14); ctx.fill();
        ctx.strokeStyle = b[2] > 0.05 ? 'rgba(' + b[3] + ',.9)' : COL.linea; ctx.stroke();
        texto(b[1], b[0] + bw / 2, by + 14, b[2] > 0.05 ? COL.papel : COL.texto, ancho ? 10 : 10.5, '600', 'center');
      });
    }
    function drawSpark() {
      const c = el.spark; if (!c) return;
      const g = c.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1); const r = c.getBoundingClientRect();
      if (r.width < 10) return;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height, n = serie.length; if (n < 2) return;
      const max = Math.max(10, ...serie), y = v => h - 3 - v / max * (h - 8);
      g.clearRect(0, 0, w, h);
      g.beginPath(); serie.forEach((v, i) => { const x = i / (n - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
      g.strokeStyle = COL.azul; g.lineWidth = 1.5; g.stroke();
      g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(192,211,237,.10)'; g.fill();
      g.fillStyle = COL.ok; g.beginPath(); g.arc(w - 2, y(serie[n - 1]), 3, 0, Math.PI * 2); g.fill();
    }
    function fit() {
      const rect = canvas.getBoundingClientRect(); if (rect.width < 10) return;
      ancho = rect.width >= 620; L = layout();
      canvas.style.aspectRatio = CW + ' / ' + CH;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.width * (CH / CW) * dpr);
      ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    }
    let frame = 0;
    function loop(ts) {
      if (lastTs == null) lastTs = ts; const dt = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts;
      if (canvas.width === 0 || !L) fit();
      if (L) { step(dt); draw(); metrics(); if ((frame++ % 30) === 0) drawSpark(); }
      requestAnimationFrame(loop);
    }
    L = layout(); fit(); window.addEventListener('resize', () => { fit(); if (L) draw(); drawSpark(); }, { passive: true });
    for (let i = 0; i < 4500; i++) step(1 / 30); // 300 minutos simulados antes del primer fotograma
    draw(); metrics(); drawSpark(); pintarEventos();
    if (reduce) return;
    requestAnimationFrame(loop);
  }
})();
