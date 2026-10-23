/* ZAMP7 · de la materia prima del proveedor a la planta, con datos sintéticos.
   Portal de proveedores con aviso de despacho, agenda de citas, ETA predictiva, portería con lectura de placa y
   foto de la carga, báscula integrada, muestreo con visión por computador, silos con sensores, trazabilidad del
   lote y un agente de IA que concilia orden de compra, aviso, peso y factura. Un segundo real = dos minutos simulados.
   Una instancia por canvas[data-gemelo="materia"] dentro de .gemelo: lienzo, cifras [data-m], reloj, bitácora y sparkline. */
(function () {
  document.querySelectorAll('.gemelo canvas[data-gemelo="materia"]').forEach(iniciar);

  function iniciar(canvas) {
    const cont = canvas.closest('.gemelo');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = k => cont.querySelector('[data-m="' + k + '"]');
    const el = { reloj: m('reloj'), eventos: m('eventos'), spark: m('spark'), vent: m('vent'), patio: m('patio'), rech: m('rech'), conc: m('conc') };
    const COL = { fondo: '#0F1019', suelo: '#13141E', via: '#1A1C28', viaC: '#2A2D3E', linea: '#2B2E3E', lineaB: '#363A4D', texto: '#A3A3B3', papel: '#F4F3F8', papelC: '#BDBCC9', azul: '#C0D3ED', azulO: '#1B4883', moradoLuz: '#BC76DB', ok: '#3EC9AC', at: '#F3B747', al: '#FF8A6E', gris: '#5F6782', grisT: '#8A91A8', grisB: '#4E566E', panel: '#12131C', hub: '#141728' };

    const PROV = ['P-118', 'P-204', 'P-077', 'P-331'];
    const PLACAS = ['WPL 482', 'SXT 219', 'JCV 318', 'NRA 507', 'KMD 664', 'TBR 135', 'LHG 790', 'PZQ 246', 'FGH 351', 'UVD 902'];
    const PASOS = ['AVISO', 'CITA', 'PLACA/FOTO', 'PESO', 'CALIDAD', 'SILO'];
    const CAPACIDAD = 1500, CONSUMO = 2.0, TOLERANCIA = 1.0;

    let CW = 1000, CH = 620, ancho = true, L = null, S = null, lastTs = null, calentando = false;

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function hora(mn) { const t = 6 * 60 + Math.floor(mn); const h = Math.floor(t / 60) % 24, mm = t % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
    function fmt(n, d) { return n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }); }
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    // Toneladas por hora que pronostica el modelo para la hora h del día
    function pron(h) { const x = ((h % 24) + 24) % 24; return Math.round(108 + 32 * Math.sin(x * 0.9) + 12 * Math.cos(x * 2.3)); }
    function suma4h() { const h = Math.floor(6 + S.sim / 60); let t = 0; for (let i = 1; i <= 4; i++) t += pron(h + i); return t; }
    function horasAseguradas() { return S.silos.reduce((a, s) => a + s.nivel, 0) / (CONSUMO * 60); }

    function evento(tipo, txt, det) {
      S.eventos.unshift({ h: hora(S.sim), tipo, txt, det }); S.eventos = S.eventos.slice(0, 4);
      if (!calentando) pintarEventos();
    }
    function pintarEventos() {
      if (!el.eventos || !S) return;
      el.eventos.innerHTML = S.eventos.map(e => `<li><span class="h">${e.h}</span><span class="tipo tipo--${e.tipo}"></span><span class="txt">${e.txt}${e.det ? `<span class="det"> · ${e.det}</span>` : ''}</span></li>`).join('');
      el.eventos.querySelectorAll('.txt').forEach(s => { if (s.scrollWidth > s.clientWidth + 1) s.classList.add('corto'); });
    }
    function luz(k) { S.brillo[k] = 1; }
    function aTorre(p, col) { S.regs++; S.paq.push({ x: p.x, y: p.y, t: 0, col: col || COL.azul }); S.brillo.torre = 1; }

    // ---- geometría: horizontal en pantallas anchas; vertical en el celular -----------------------
    // P(u, v): u corre a lo largo del carril de la planta y v cruza; los silos y el laboratorio quedan al lado de v menor.
    function layout() {
      if (ancho) {
        CW = 1000; CH = 620;
        const P = (u, v) => ({ x: u, y: v });
        const farms = [0, 1, 2, 3].map(i => ({ x: 20, y: 58 + i * 72, w: 132, h: 54, ex: { x: 152, y: 85 + i * 72 }, jn: { x: 176, y: 85 + i * 72 }, av: { x: 152, y: 85 + i * 72 } }));
        const g = {
          P, V1: 368, V2: 412, vStop: 330, uStart: 176, uGate: 500, uB1: 605, uM: [700, 745], uCon: 790, uS: [822, 886, 950], uEnd: 976, uB2: 605, uExit: 424,
          sep: 28, R: 27, cv: 262, tl: 22, ta: 12, esc: 1, fs: 1, farms, inb: [],
          portal: { x: 200, y: 58, w: 150, h: 44 },
          lab: { u0: 684, u1: 784, v0: 214, v1: 312 },
          planta: { x: 466, y: 44, w: 524, h: 396 },
          conc: { x: 470, y: 58, w: 206, h: 178 }, chat: { x: 690, y: 50, w: 295, h: 104 },
          pron: { x: 200, y: 116, w: 250, h: 214 }, agenda: { x: 20, y: 424, w: 430, h: 70 },
          ficha: { x: 470, y: 446, w: 515, h: 50 }, torre: { x: 20, y: 506, w: 965, h: 76 },
          eta: { x: 190, y: 382, w: 262, h: 22 },
          cab: [[20, 30, 'left', '1 · DESDE EL PROVEEDOR'], [200, 30, 'left', '2 · CITA, ETA Y PRONÓSTICO'], [470, 30, 'left', '3 · EN LA PLANTA · IA QUE CONCILIA'], [985, 30, 'right', '4 · IA QUE RESPONDE']],
          vias: [], silosCab: [985, 170, 'right'], pie: [22, CH - 24]
        };
        g.vias = [
          ...farms.map(f => [f.ex, f.jn]), [farms[0].jn, farms[3].jn, P(g.uStart, g.V1)], [P(g.uStart, g.V1), P(g.uEnd, g.V1)],
          [P(g.uCon, g.V1), P(g.uCon, g.V2)], [P(g.uCon, g.V2), P(g.uExit - 18, g.V2)],
          ...g.uM.map(u => [P(u, g.V1), P(u, g.vStop)]), ...g.uS.map(u => [P(u, g.V1), P(u, g.vStop)])
        ];
        return g;
      }
      CW = 420; CH = 876;
      const P = (u, v) => ({ x: v - 190, y: 0.8 * u - 70 });
      const farms = [0, 1, 2, 3].map(i => ({ x: 12 + i * 102, y: 84, w: 96, h: 44, ex: { x: 60 + i * 102, y: 128 }, jn: { x: 60 + i * 102, y: 158 }, av: { x: 60 + i * 102, y: 84 } }));
      const g = {
        P, V1: 368, V2: 412, vStop: 330, uStart: 300, uGate: 500, uB1: 605, uM: [700, 745], uCon: 790, uS: [822, 886, 950], uEnd: 976, uB2: 605, uExit: 470,
        sep: 25, R: 22, cv: 262, tl: 18, ta: 10, esc: 0.8, fs: 1.2, farms, inb: [{ x: 178, y: 158 }],
        portal: { x: 12, y: 34, w: 396, h: 34 },
        lab: { u0: 676, u1: 772, v0: 226, v1: 312 },
        planta: { x: 8, y: 306, w: 404, h: 464 },
        conc: { x: 244, y: 342, w: 164, h: 152 }, chat: { x: 244, y: 624, w: 164, h: 142 },
        pron: { x: 236, y: 176, w: 172, h: 120 }, agenda: { x: 12, y: 232, w: 152, h: 58 },
        ficha: { x: 244, y: 502, w: 164, h: 114 }, torre: { x: 8, y: 778, w: 404, h: 62 },
        eta: { x: 12, y: 186, w: 152, h: 38 },
        cab: [[12, 20, 'left', '1 · DESDE EL PROVEEDOR'], [12, 176, 'left', '2 · EN CAMINO'], [14, 299, 'left', '3 · EN LA PLANTA']],
        vias: [], silosCab: [14, 557, 'left'], pie: [12, CH - 24]
      };
      g.vias = [
        ...farms.map(f => [f.ex, f.jn]), [farms[0].jn, farms[3].jn], [{ x: 178, y: 158 }, P(g.uStart, g.V1)], [P(g.uStart, g.V1), P(g.uEnd, g.V1)],
        [P(g.uCon, g.V1), P(g.uCon, g.V2)], [P(g.uCon, g.V2), P(g.uExit, g.V2)],
        ...g.uM.map(u => [P(u, g.V1), P(u, g.vStop)]), ...g.uS.map(u => [P(u, g.V1), P(u, g.vStop)])
      ];
      return g;
    }
    const pt = (u, v) => L.P(u, v);
    const G = () => pt(L.uGate, L.V1);
    function colaPos(q) {
      const g = G(), n = ancho ? { x: -1, y: 0 } : { x: 0, y: -1 };
      return { x: g.x + n.x * L.sep * q, y: g.y + n.y * L.sep * q };
    }

    // ---- simulación -------------------------------------------------------------------------------
    function nuevo() {
      return {
        sim: 0, camiones: [], cola: [], res: { G: null, B1: null, B2: null, M: [null, null], S: [null, null, null] },
        silos: [0, 1, 2].map(() => ({ nivel: 600, T: 14.4, H: 60, deriva: 0, alerta: false, aire: 0 })),
        citas: [], paq: [], eventos: [], serie: [], porHora: {}, recibidos: [], brillo: {},
        lote: 400 + Math.floor(rand(0, 40)), iProv: 0, prox: 2, proxIoT: rand(70, 110), proxAsist: 55, hAnt: -1,
        star: null, starHold: 0, vista: null, ultimoSpark: -999, lotes: 0, rech: 0, vOk: 0, vTot: 0, sumPatio: 0, nPatio: 0, conc: 0, regs: 0,
        ultimoRech: null, chat: null, resp: null, labTxt: null, placa: null, bTxt: { b1: null, b2: null }
      };
    }
    // Primera ventana de 10 min libre en la agenda a partir de la hora t
    function asignarCita(t, v) {
      let c = t, otro, n = 0;
      // la tolerancia de 0,01 evita que el redondeo de decimales vuelva a hallar la misma cita
      while (n++ < 60 && (otro = S.citas.find(x => x.v !== v && !x.fin && Math.abs(x.t - c) < 9.99))) c = otro.t + 10;
      return c;
    }
    function despachar() {
      const i = S.iProv++ % PROV.length, f = L.farms[i];
      const decl = Math.round(rand(24, 32) * 10) / 10;
      const dev = Math.random() < 0.09 ? -rand(0.015, 0.03) : rand(-0.004, 0.004);
      const neto = decl * (1 + dev), tara = rand(11.2, 14.8), carga = rand(4, 8), viaje = rand(12, 18);
      const cita = asignarCita(S.sim + carga + viaje + 3, null);
      const v = {
        id: 'L-' + dos(Math.floor(++S.lote / 100)) + dos(S.lote % 100), oc: 'OC-' + (5500 + S.lote), prov: i, placa: pick(PLACAS), decl, neto, bruto: neto + tara, tara,
        x: f.ex.x, y: f.ex.y, sx: 1, sy: 0, wp: [], vel: 80, estado: 'carga', timer: cita - 3 - viaje - S.sim, viaje, cita, reprog: false, trafico: Math.random() < 0.14,
        len: 0, rec: 0, etaHecha: false, llegada: 0, vent: false, bay: -1, silo: -1, carga: 'pend', descarga: 0, rechazo: null, cal: null, concT0: null, conciliado: null,
        star: false, fin: false, p: { aviso: true, cita: false, placa: false, peso: false, cal: false, silo: false }
      };
      if (v.timer < carga) v.timer = carga;
      if (!S.star && S.starHold <= 0) { v.star = true; S.star = v; S.vista = v; }
      S.camiones.push(v); S.citas.push({ t: cita, v });
      luz('portal'); S.paq.push({ x: f.av.x, y: f.av.y, t: 0, col: COL.azul, haciaPortal: true });
      if (v.star) evento('captura', PROV[i] + ' avisa el despacho de ' + v.id, fmt(decl, 1) + ' t por el portal de proveedores');
    }
    function salir(v) {
      const f = L.farms[v.prov];
      v.wp = [f.jn, ...L.inb, pt(L.uStart, L.V1)].map(p => ({ x: p.x, y: p.y }));
      let len = 0, a = { x: v.x, y: v.y }; v.wp.forEach(p => { len += Math.hypot(p.x - a.x, p.y - a.y); a = p; });
      v.len = len; v.vel = len / (v.viaje / 2); v.estado = 'viaje'; v.p.cita = true; luz('agenda');
      if (v.star) evento('decision', 'La agenda asigna la cita de ' + hora(v.cita) + ' a ' + v.id, 'báscula libre en esa hora');
    }
    function mover(v, dt) {
      if (!v.wp.length) return true;
      const t = v.wp[0], dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
      if (d < 1.2) { v.x = t.x; v.y = t.y; v.wp.shift(); return !v.wp.length; }
      const s = Math.min(d, v.vel * dt);
      v.x += dx / d * s; v.y += dy / d * s; v.rec += s;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { v.sx = dx / d; v.sy = dy / d; }
      return false;
    }
    function ir(v, pts, vel) { v.wp = pts.map(p => ({ x: p.x, y: p.y })); v.vel = vel * L.esc; }
    const e = (v, tipo, txt, det) => { if (v.star) evento(tipo, txt, det); };

    function etaMedio(v) {
      v.etaHecha = true;
      if (v.trafico) v.vel *= 0.3;
      const eta = S.sim + (v.len - v.rec) / v.vel * 2;
      luz('eta'); luz('pron');
      if (eta > v.cita + 5) {
        const nueva = asignarCita(eta, v), c = S.citas.find(x => x.v === v); if (c) c.t = nueva; v.cita = nueva; v.reprog = true;
        evento('alerta', 'ETA de ' + v.id + ': ' + hora(eta) + ', queda fuera de la ventana', 'la agenda reprograma la cita a las ' + hora(nueva));
      } else e(v, 'medicion', 'ETA de ' + v.id + ': ' + hora(eta), 'dentro de la ventana de la cita');
    }
    function resultadoLab(v) {
      const malo = Math.random() < 0.07, causa = Math.random() < 0.6 ? 'humedad' : 'defectos';
      const hum = malo && causa === 'humedad' ? rand(15.4, 17.5) : rand(12.3, 14.6);
      const def = malo && causa === 'defectos' ? rand(3.4, 5.6) : rand(0.6, 2.4);
      v.cal = { hum, def, malo, causa };
      S.labTxt = { id: v.id, hum, def, malo };
      S.lotes++; luz('lab'); v.p.cal = true; aTorre(pt(L.uM[v.bay], L.vStop), malo ? COL.at : COL.ok);
      if (!malo) {
        v.carga = 'ok'; v.estado = 'lab-ok';
        e(v, 'medicion', 'Laboratorio y visión: ' + v.id + ' con humedad ' + fmt(hum, 1) + ' %', 'defectos ' + fmt(def, 1) + ' % · en rango');
      } else {
        v.carga = 'ret'; v.estado = 'retenido'; v.timer = rand(6, 9);
        const txt = causa === 'humedad' ? 'humedad ' + fmt(hum, 1) + ' %, sobre el límite de 15 %' : 'defectos visibles ' + fmt(def, 1) + ' %, sobre el límite de 3 %';
        v.rechazo = causa === 'humedad' ? 'humedad fuera de rango' : 'defectos sobre el límite'; v.rechTxt = txt;
        evento('alerta', v.id + ' retenido: ' + txt, 'decide el jefe de calidad');
      }
    }
    function conciliar(v) {
      v.concT0 = S.sim; luz('conc');
      if (v.carga === 'rech') { e(v, 'alerta', v.id + ' rechazado: no pasa a liquidación', 'causa registrada para ' + PROV[v.prov]); return; }
      const dev = (v.neto - v.decl) / v.decl * 100;
      v.conciliado = Math.abs(dev) <= TOLERANCIA;
      if (v.conciliado) { S.conc++; e(v, 'decision', 'Agente concilia ' + v.id + ': OC, aviso, peso y factura cuadran', 'liquidación lista para aprobar'); }
      else evento('alerta', 'Agente: ' + v.id + ' pesa ' + fmt(Math.abs(dev), 1) + ' % menos que el aviso', 'pide revisión a compras; no libera el pago');
    }
    function retirar(v) {
      S.camiones.splice(S.camiones.indexOf(v), 1);
      S.sumPatio += S.sim - v.llegada; S.nPatio++;
      if (v.vent) S.vOk++; S.vTot++;
      const c = S.citas.find(x => x.v === v); if (c) c.fin = true;
      if (v === S.star) { v.fin = true; S.starHold = 8; }
    }
    function paso(dtReal) {
      const dt = dtReal, dMin = dtReal * 2, res = S.res;
      S.sim += dMin;
      for (const k in S.brillo) S.brillo[k] = Math.max(0, S.brillo[k] - dt * 0.9);
      S.paq.forEach(p => { p.t += dt * 1.3; }); S.paq = S.paq.filter(p => p.t < 1);
      if (S.star && S.star.fin) { S.starHold -= dMin; if (S.starHold <= 0) { S.star = null; } }
      S.citas = S.citas.filter(c => c.t > S.sim - 75);
      const h = 6 + S.sim / 60, hi = Math.floor(h);

      S.prox -= dMin;
      if (S.prox <= 0) { despachar(); S.prox = 60 / (pron(h) / 27) * rand(0.55, 1.45); }
      if (hi !== S.hAnt) {
        if (S.hAnt >= 0) { evento('medicion', 'Pronóstico de las próximas 4 h: ' + suma4h() + ' t', 'para dimensionar las citas'); luz('pron'); }
        S.hAnt = hi;
      }

      // silos con sensores: consumo de la planta, temperatura y humedad; una deriva de temperatura de vez en cuando
      S.silos.forEach((s, k) => {
        s.nivel = Math.max(60, s.nivel - CONSUMO / 3 * (s.nivel / 600) * dMin); // la planta procesa más cuanto más inventario hay
        s.T += (14.4 + s.deriva - s.T) * Math.min(1, dMin * 0.04) + rand(-0.02, 0.02);
        s.H += (60 - s.H) * Math.min(1, dMin * 0.02) + rand(-0.05, 0.05);
        if (s.deriva && !s.alerta && s.T - 14.4 >= 1.5) {
          s.alerta = true; s.aire = 22; luz('s' + k);
          evento('alerta', 'Silo ' + (k + 1) + ': la temperatura sube ' + fmt(s.T - 14.4, 1) + ' °C en ' + Math.round(S.sim - s.t0) + ' min', 'aireación sugerida; decide el jefe de planta');
        }
        if (s.aire > 0) { s.aire -= dMin; if (s.aire <= 0) { s.deriva = 0; s.alerta = false; evento('decision', 'Jefe de planta ordena la aireación del silo ' + (k + 1), 'la temperatura vuelve al rango'); } }
      });
      S.proxIoT -= dMin;
      if (S.proxIoT <= 0) { S.proxIoT = rand(110, 160); const s = S.silos[Math.floor(Math.random() * 3)]; if (!s.deriva) { s.deriva = 1.9; s.t0 = S.sim; } }

      // asistente en español: pregunta y respuesta con fuentes
      S.proxAsist -= dMin;
      if (S.proxAsist <= 0) {
        S.proxAsist = rand(95, 130);
        const op = [];
        op.push({ q: '¿Qué llega en las próximas 4 horas?', a: 'Se pronostican ' + suma4h() + ' t, con las citas ya asignadas en la agenda.', f: ['pronóstico', 'agenda', 'avisos'] });
        op.push({ q: '¿Cuánto proceso hay asegurado?', a: fmt(horasAseguradas(), 1) + ' h con el inventario de los 3 silos.', f: ['sensores', 'plan de proceso'] });
        if (S.ultimoRech) op.push({ q: '¿Por qué se rechazó ' + S.ultimoRech.id + '?', a: S.ultimoRech.id + ': ' + S.ultimoRech.txt + '.', f: ['laboratorio', 'ficha del lote'] });
        const o = pick(op);
        S.chat = { q: o.q, a: null, f: null, t0: S.sim }; S.resp = { o, t: 3 }; luz('asist');
        evento('captura', 'Jefe de planta pregunta: ' + o.q, 'por escrito, en español');
      }
      if (S.resp) { S.resp.t -= dMin; if (S.resp.t <= 0) { S.chat.a = S.resp.o.a; S.chat.f = S.resp.o.f; luz('asist'); evento('decision', 'Asistente responde con ' + S.resp.o.f.length + ' fuentes', 'citadas en la respuesta'); S.resp = null; } }
      if (S.chat && S.sim - S.chat.t0 > 70) S.chat = null;

      // camiones
      for (const v of S.camiones.slice()) {
        const est = v.estado;
        if (est === 'carga') { v.timer -= dMin; if (v.timer <= 0) salir(v); }
        else if (est === 'viaje') {
          if (!v.etaHecha && v.rec >= v.len * 0.4) etaMedio(v);
          if (mover(v, dt)) {
            v.estado = 'cola'; S.cola.push(v); v.vent = !v.reprog && Math.abs(S.sim - v.cita) <= 5;
          }
        } else if (est === 'cola') {
          const q = S.cola.indexOf(v), p = colaPos(q);
          v.vel = 80 * L.esc; v.wp = [p]; mover(v, dt);
          if (q === 0 && !res.G && Math.hypot(v.x - p.x, v.y - p.y) < 1.5) {
            res.G = v; v.llegada = S.sim; v.estado = 'puerta'; v.timer = rand(1.2, 2.2); luz('puerta'); v.p.placa = true; S.placa = { placa: v.placa, t: S.sim };
            aTorre(G(), COL.azul);
            e(v, 'captura', 'Portería lee la placa ' + v.placa + ' de ' + v.id, 'foto de la carga, no del conductor');
          }
        } else if (est === 'puerta') {
          v.timer -= dMin;
          if (v.timer <= 0 && !res.B1) { res.B1 = v; res.G = null; S.cola.shift(); ir(v, [pt(L.uB1, L.V1)], 95); v.estado = 'a-B1'; }
        } else if (est === 'a-B1') {
          if (mover(v, dt)) { v.estado = 'bascula1'; v.timer = rand(2.5, 3.5); luz('b1'); v.p.peso = true; S.bTxt.b1 = Math.round(v.bruto * 1000); aTorre(pt(L.uB1, L.V1), COL.ok); e(v, 'medicion', 'Báscula: ' + v.id + ' entra con ' + fmt(Math.round(v.bruto * 1000), 0) + ' kg', 'peso bruto leído por el sistema'); }
        } else if (est === 'bascula1') {
          v.timer -= dMin;
          const j = res.M.findIndex(x => !x);
          if (v.timer <= 0 && j >= 0) {
            res.M[j] = v; res.B1 = null; v.bay = j; ir(v, [pt(L.uM[j], L.V1), pt(L.uM[j], L.vStop)], 95); v.estado = 'a-M';
            const hr = Math.floor(6 + S.sim / 60); S.porHora[hr] = (S.porHora[hr] || 0) + v.neto; S.recibidos.push({ t: S.sim, ton: v.neto });
          }
        } else if (est === 'a-M') {
          if (mover(v, dt)) { v.estado = 'muestreo'; v.timer = rand(7, 10); luz('lab'); e(v, 'captura', 'Muestreo de ' + v.id + ': sonda y foto de la muestra', 'visión por computador cuenta los defectos'); }
        } else if (est === 'muestreo') {
          v.timer -= dMin; if (v.timer <= 0) resultadoLab(v);
        } else if (est === 'retenido') {
          v.timer -= dMin;
          if (v.timer <= 0) {
            v.carga = 'rech'; S.rech++; S.ultimoRech = { id: v.id, txt: v.rechTxt }; v.estado = 'sale-M';
            evento('decision', 'Calidad rechaza ' + v.id + ': ' + v.rechazo, 'causa registrada para ' + PROV[v.prov]);
          }
        } else if (est === 'sale-M') {
          if (!res.B2) { res.B2 = v; res.M[v.bay] = null; ir(v, [pt(L.uM[v.bay], L.V1), pt(L.uCon, L.V1), pt(L.uCon, L.V2), pt(L.uB2, L.V2)], 95); v.estado = 'a-B2'; }
        } else if (est === 'lab-ok') {
          const k = S.silos.map((s, i) => ({ s, i })).filter(o => !res.S[o.i] && o.s.nivel + v.neto < CAPACIDAD * 0.96).sort((a, b) => a.s.nivel - b.s.nivel)[0];
          if (k) { res.S[k.i] = v; res.M[v.bay] = null; v.silo = k.i; ir(v, [pt(L.uM[v.bay], L.V1), pt(L.uS[k.i], L.V1), pt(L.uS[k.i], L.vStop)], 95); v.estado = 'a-S'; }
        } else if (est === 'a-S') {
          if (mover(v, dt)) {
            v.estado = 'descarga'; v.timer = v.tot = rand(12, 16); luz('s' + v.silo); v.p.silo = true; aTorre(pt(L.uS[v.silo], L.vStop), COL.moradoLuz);
            e(v, 'captura', 'Lote ' + v.id + ' etiquetado con ' + (S.lote % 2 ? 'RFID' : 'código de barras'), 'silo ' + (v.silo + 1) + ' · ' + PROV[v.prov] + ' · ' + hora(S.sim));
          }
        } else if (est === 'descarga') {
          v.timer -= dMin; const d0 = v.descarga; v.descarga = Math.min(1, 1 - v.timer / v.tot); S.silos[v.silo].nivel += v.neto * (v.descarga - d0);
          if (v.timer <= 0 && !res.B2) { v.carga = 'vacio'; res.B2 = v; res.S[v.silo] = null; ir(v, [pt(L.uS[v.silo], L.V1), pt(L.uCon, L.V1), pt(L.uCon, L.V2), pt(L.uB2, L.V2)], 95); v.estado = 'a-B2'; }
        } else if (est === 'a-B2') {
          if (mover(v, dt)) { v.estado = 'bascula2'; v.timer = rand(2.5, 3.5); luz('b2'); S.bTxt.b2 = Math.round(v.tara * 1000); aTorre(pt(L.uB2, L.V2), COL.ok); e(v, 'medicion', 'Báscula de salida: neto de ' + v.id + ' = ' + fmt(Math.round(v.neto * 1000), 0) + ' kg', 'tara ' + fmt(Math.round(v.tara * 1000), 0) + ' kg'); }
        } else if (est === 'bascula2') {
          v.timer -= dMin;
          if (v.timer <= 0) { conciliar(v); aTorre(pt(L.uB2, L.V2), COL.moradoLuz); res.B2 = null; ir(v, [pt(L.uExit, L.V2)], 95); v.estado = 'salida'; }
        } else if (est === 'salida') {
          if (mover(v, dt)) retirar(v);
        }
      }
      const ventana = 60; S.recibidos = S.recibidos.filter(r => S.sim - r.t < ventana);
      if (S.sim - S.ultimoSpark >= 10) { S.ultimoSpark = S.sim; S.serie.push(Math.round(S.recibidos.reduce((a, r) => a + r.ton, 0))); S.serie = S.serie.slice(-36); }
    }
    function metrics() {
      if (el.vent) el.vent.textContent = S.vTot ? Math.round(S.vOk / S.vTot * 100) + ' %' : '—';
      if (el.patio) el.patio.textContent = S.nPatio ? Math.round(S.sumPatio / S.nPatio) : '—';
      if (el.rech) el.rech.textContent = S.rech + ' de ' + S.lotes;
      if (el.conc) el.conc.textContent = S.conc;
      if (el.reloj) el.reloj.textContent = hora(S.sim);
    }

    // ---- dibujo -----------------------------------------------------------------------------------
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function texto(t, x, y, color, size, peso, align) { ctx.font = (peso || '') + ' ' + ((size || 11) * L.fs) + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = color || COL.texto; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.textAlign = 'left'; }
    function ancha(t, size, peso) { ctx.font = (peso || '') + ' ' + ((size || 11) * L.fs) + 'px "IBM Plex Mono", monospace'; return ctx.measureText(t).width; }
    function envolver(t, maxW, size, maxL) {
      const pal = String(t).split(' '), lin = []; let cur = '';
      pal.forEach(p => { const x = cur ? cur + ' ' + p : p; if (ancha(x, size) > maxW && cur) { lin.push(cur); cur = p; } else cur = x; });
      if (cur) lin.push(cur);
      if (lin.length > maxL) { lin.length = maxL; lin[maxL - 1] = lin[maxL - 1].replace(/\s*\S*$/, '') + '…'; }
      return lin;
    }
    function caja(r, fill, stroke, rad) { ctx.fillStyle = fill || COL.panel; rr(r.x, r.y, r.w, r.h, rad || 6); ctx.fill(); ctx.strokeStyle = stroke || COL.linea; ctx.lineWidth = 1; ctx.stroke(); }
    function resalte(r, k, rgb) { const b = S.brillo[k] || 0; if (b > 0.04) { ctx.save(); ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.35 + b * 0.65).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.shadowColor = 'rgba(' + rgb + ',.8)'; ctx.shadowBlur = 10 * b; rr(r.x, r.y, r.w, r.h, 6); ctx.stroke(); ctx.restore(); } }
    function rect2(a, b, fill, stroke, dash) { // rectángulo entre dos puntos de la geometría
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; if (dash) ctx.setLineDash(dash); ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.setLineDash([]); }
      return { x, y, w, h };
    }

    function dibujarVias() {
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      L.vias.forEach(l => { ctx.strokeStyle = COL.via; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(l[0].x, l[0].y); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i].x, l[i].y); ctx.stroke(); });
      ctx.strokeStyle = COL.viaC; ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
      L.vias.forEach(l => { ctx.beginPath(); ctx.moveTo(l[0].x, l[0].y); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i].x, l[i].y); ctx.stroke(); });
      ctx.setLineDash([]);
    }
    function dibujarFincas() {
      L.farms.forEach((f, i) => {
        const hay = S.camiones.some(v => v.prov === i && v.estado === 'carga');
        ctx.fillStyle = hay ? 'rgba(192,211,237,.08)' : COL.suelo; rr(f.x, f.y, f.w, f.h, 6); ctx.fill();
        ctx.strokeStyle = hay ? COL.azul : COL.linea; ctx.stroke();
        texto(ancho ? 'PROVEEDOR ' + PROV[i] : PROV[i], f.x + 10, f.y + (ancho ? 20 : 15), COL.papel, ancho ? 11 : 11, '600');
        texto(hay ? (ancho ? 'cargando · aviso' : 'cargando') : (ancho ? 'acopio en finca' : 'acopio'), f.x + 10, f.y + (ancho ? 40 : 32), hay ? COL.azul : COL.texto, ancho ? 10 : 9);
      });
      const p = L.portal; caja(p, COL.suelo, COL.linea); resalte(p, 'portal', '192,211,237');
      texto('PORTAL DE PROVEEDORES', p.x + 12, p.y + (ancho ? 18 : 12), COL.papel, ancho ? 12 : 11, '600');
      texto('aviso de despacho y cita', p.x + 12, p.y + (ancho ? 35 : 25), COL.texto, ancho ? 10.5 : 10);
    }
    function dibujarETA() {
      const r = L.eta, b = S.brillo.eta || 0;
      ctx.fillStyle = b > 0 ? 'rgba(188,118,219,' + (0.1 + b * 0.2).toFixed(3) + ')' : '#191B2B'; rr(r.x, r.y, r.w, r.h, ancho ? 11 : 6); ctx.fill();
      ctx.strokeStyle = b > 0.05 ? 'rgba(188,118,219,.9)' : COL.linea; ctx.stroke();
      if (ancho) texto('ETA PREDICTIVA · GPS SOLO DURANTE EL VIAJE', r.x + r.w / 2, r.y + r.h / 2, b > 0.05 ? COL.papel : COL.texto, 10, '600', 'center');
      else { texto('ETA PREDICTIVA', r.x + r.w / 2, r.y + 13, b > 0.05 ? COL.papel : COL.texto, 10, '600', 'center'); texto('GPS solo en el viaje', r.x + r.w / 2, r.y + 28, COL.texto, 9, '', 'center'); }
    }
    function dibujarPronostico() {
      const r = L.pron, hNow = 6 + S.sim / 60, hi = Math.floor(hNow), h0 = hi - 3;
      caja(r); resalte(r, 'pron', '188,118,219');
      texto(ancho ? 'PRONÓSTICO DE LLEGADAS' : 'PRONÓSTICO', r.x + 12, r.y + 17, COL.papel, ancho ? 11 : 10, '600');
      texto(ancho ? 't/h · punteado pronóstico · lleno real' : 'punteado = pronóstico', r.x + 12, r.y + (ancho ? 34 : 31), COL.texto, ancho ? 9.5 : 8.5);
      const bx = r.x + 12, bw = (r.w - 24) / 8, by = r.y + r.h - 24, alto = r.h - (ancho ? 76 : 70), max = 230;
      ctx.strokeStyle = COL.linea; ctx.beginPath(); ctx.moveTo(bx, by + .5); ctx.lineTo(r.x + r.w - 12, by + .5); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const hh = h0 + i, x = bx + i * bw, hf = pron(hh) / max * alto;
        const real = hh >= 6 && hh <= hi ? (S.porHora[hh] || 0) : null;
        if (real != null) { const hr = Math.min(alto + 6, real / max * alto); ctx.fillStyle = hh === hi ? 'rgba(188,118,219,.5)' : COL.moradoLuz; ctx.fillRect(x + 4, by - hr, bw - 8, hr); }
        ctx.strokeStyle = 'rgba(192,211,237,.7)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 3.5, by - hf + .5, bw - 7, hf); ctx.setLineDash([]);
        texto(dos(((hh % 24) + 24) % 24), x + bw / 2, by + 12, hh === hi ? COL.papel : COL.grisT, 9.5, '', 'center');
      }
      const lx = bx + (3 + (hNow - hi)) * bw; ctx.strokeStyle = COL.at; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(lx, by - alto - 4); ctx.lineTo(lx, by); ctx.stroke(); ctx.setLineDash([]);
    }
    function dibujarAgenda() {
      const r = L.agenda; caja(r); resalte(r, 'agenda', '192,211,237');
      texto('AGENDA DE CITAS', r.x + 12, r.y + 16, COL.papel, ancho ? 11 : 10, '600');
      if (ancho) texto('ventanas de 10 min', r.x + r.w - 12, r.y + 16, COL.texto, 9.5, '', 'right');
      const span = 180, t0 = S.sim - 60, ax = r.x + 10, aw = r.w - 20, ay = r.y + 32, ah = ancho ? 16 : 14;
      ctx.strokeStyle = COL.linea; ctx.beginPath(); ctx.moveTo(ax, ay + ah + 6.5); ctx.lineTo(ax + aw, ay + ah + 6.5); ctx.stroke();
      for (let k = Math.ceil((t0 + 360) / 30); k <= Math.floor((t0 + span + 360) / 30); k++) {
        const x = ax + (k * 30 - 360 - t0) / span * aw, hr = Math.floor(k / 2) % 24;
        ctx.strokeStyle = COL.grisB; ctx.beginPath(); ctx.moveTo(x + .5, ay + ah + 3); ctx.lineTo(x + .5, ay + ah + 9); ctx.stroke();
        if (ancho && k % 2 === 0 && x > ax + 8 && x < ax + aw - 8) texto(dos(hr) + ':00', x, ay + ah + 17, COL.grisT, 9, '', 'center');
      }
      ctx.save(); ctx.beginPath(); ctx.rect(ax, ay - 6, aw, ah + 12); ctx.clip();
      S.citas.forEach(c => {
        const v = c.v, x = ax + (c.t - 5 - t0) / span * aw, w = 10 / span * aw;
        if (x + w < ax || x > ax + aw) return;
        const llego = v.estado !== 'carga' && v.estado !== 'viaje';
        if (c.fin) { ctx.fillStyle = v.vent ? COL.ok : COL.at; ctx.globalAlpha = .85; ctx.fillRect(x, ay, w - 1, ah); ctx.globalAlpha = 1; }
        else if (llego) { ctx.fillStyle = COL.moradoLuz; ctx.fillRect(x, ay, w - 1, ah); }
        else { ctx.strokeStyle = v.reprog ? COL.at : COL.azul; ctx.setLineDash(v.reprog ? [2, 2] : []); ctx.strokeRect(x + .5, ay + .5, w - 2, ah - 1); ctx.setLineDash([]); }
        if (v.star && !v.fin) { ctx.strokeStyle = COL.papel; ctx.lineWidth = 1.4; ctx.strokeRect(x - 1, ay - 1.5, w + 1, ah + 3); ctx.lineWidth = 1; }
      });
      ctx.restore();
      const nx = ax + 60 / span * aw; ctx.strokeStyle = COL.at; ctx.beginPath(); ctx.moveTo(nx + .5, ay - 4); ctx.lineTo(nx + .5, ay + ah + 6); ctx.stroke();
    }

    // Planta: portería, báscula, muestreo con laboratorio, silos con sensores
    function dibujarPlanta() {
      const pl = L.planta; ctx.strokeStyle = COL.linea; ctx.setLineDash([4, 5]); rr(pl.x, pl.y, pl.w, pl.h, 8); ctx.stroke(); ctx.setLineDash([]);
      const f = L.fs;
      // portería: caseta, barrera y cámara
      const g = G(), b = S.brillo.puerta || 0, cs = rect2(pt(L.uGate - 22, L.V1 - 46), pt(L.uGate + 22, L.V1 - 20), '#152038', b > 0.05 ? COL.azul : COL.azulO);
      const bar = S.res.G ? 'abierta' : 'cerrada';
      ctx.strokeStyle = bar === 'abierta' ? COL.ok : COL.al; ctx.lineWidth = 2.5;
      const a1 = pt(L.uGate, L.V1 - 9), a2 = pt(L.uGate, L.V1 + 9); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke(); ctx.lineWidth = 1;
      const cam = pt(L.uGate + 12, L.V1 - 33); ctx.fillStyle = b > 0.05 ? COL.papel : COL.gris; ctx.beginPath(); ctx.arc(cam.x, cam.y, 4, 0, Math.PI * 2); ctx.fill();
      if (b > 0.05) { ctx.save(); ctx.globalAlpha = b * .6; ctx.strokeStyle = COL.papel; ctx.beginPath(); ctx.arc(cam.x, cam.y, 6 + (1 - b) * 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const lg = ancho ? { x: g.x - 24, y: g.y - 96, al: 'left' } : { x: g.x - 52, y: g.y - 8, al: 'right' };
      texto('PORTERÍA', lg.x, lg.y, COL.papel, 11, '600', lg.al); texto('placa y foto', lg.x, lg.y + 12 * f, COL.texto, 9.5, '', lg.al); texto('de la carga', lg.x, lg.y + 24 * f, COL.texto, 9.5, '', lg.al);
      if (S.placa && S.sim - S.placa.t < 14) { // la placa leída
        const px = lg.al === 'left' ? lg.x : lg.x - 62, py = lg.y + 32 * f;
        ctx.fillStyle = COL.at; rr(px, py, 62, 14 * f, 3); ctx.fill(); texto(S.placa.placa, px + 31, py + 7 * f, '#1A1405', 10, '600', 'center');
      }
      // básculas: entrada en el carril 1 y salida en el carril 2
      [['b1', L.V1, 'ENTRADA'], ['b2', L.V2, 'SALIDA']].forEach(([k, v, nom]) => {
        const bb = S.brillo[k] || 0, r = rect2(pt(L.uB1 - 50, v - 15), pt(L.uB1 + 50, v + 15), bb > 0 ? 'rgba(62,201,172,' + (0.08 + bb * 0.18).toFixed(3) + ')' : '#181A26', bb > 0.05 ? COL.ok : COL.grisB);
        const c = pt(L.uB1, v), tx = S.bTxt[k], oc = S.res[k === 'b1' ? 'B1' : 'B2'], pesando = !!oc && (oc.estado === 'bascula1' || oc.estado === 'bascula2');
        if (ancho) {
          if (pesando && tx) { texto(fmt(tx, 0), c.x - 13, c.y, COL.papel, 9.5, '600', 'right'); texto('kg', c.x + 13, c.y, COL.papel, 9.5, '600'); }
          else texto(nom, c.x, c.y, COL.grisT, 9.5, '', 'center');
        } else if (!pesando) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-Math.PI / 2); texto(nom, 0, 0, COL.grisT, 9, '', 'center'); ctx.restore(); }
      });
      if (ancho) { texto('BÁSCULA', L.uB1 - 50, L.V1 - 38 - 14, COL.papel, 11, '600'); texto('integrada con el ERP', L.uB1 - 50, L.V1 - 38, COL.texto, 9.5); }
      else { const c = pt(L.uB1, L.V1); texto('BÁSCULA', c.x - 28, c.y - 7, COL.papel, 11, '600', 'right'); texto('integrada', c.x - 28, c.y + 7, COL.texto, 9.5, '', 'right'); }
      // laboratorio
      const lb = S.brillo.lab || 0, lab = rect2(pt(L.lab.u0, L.lab.v0), pt(L.lab.u1, L.lab.v1), lb > 0 ? 'rgba(243,183,71,' + (0.06 + lb * 0.14).toFixed(3) + ')' : '#181A26', lb > 0.05 ? COL.at : COL.grisB);
      const lc = lab.x + lab.w / 2, tl = ancho ? 10.5 : 10;
      texto('LABORATORIO', lc, lab.y + 14, COL.papel, tl, '600', 'center');
      if (ancho) texto('muestra y visión', lc, lab.y + 28, COL.texto, 9, '', 'center');
      if (S.labTxt) {
        const t = S.labTxt, y0 = lab.y + (ancho ? 46 : 30), dy = ancho ? 14 : 13, c9 = ancho ? 9.5 : 9;
        texto(t.id, lc, y0, COL.papel, c9, '600', 'center');
        texto('hum ' + fmt(t.hum, 1) + ' %', lc, y0 + dy, COL.papelC, c9, '', 'center');
        texto('def ' + fmt(t.def, 1) + ' %', lc, y0 + 2 * dy, COL.papelC, c9, '', 'center');
        texto(t.malo ? 'retenido' : 'en rango', lc, y0 + 3 * dy, t.malo ? COL.at : COL.ok, c9, '600', 'center');
      }
      // silos con sensores IoT
      const hAseg = horasAseguradas();
      texto(ancho ? 'SILOS CON SENSORES · ' + fmt(hAseg, 1) + ' h DE PROCESO ASEGURADAS' : 'SILOS · SENSORES IoT', L.silosCab[0], L.silosCab[1], COL.texto, 10, '600', L.silosCab[2]);
      S.silos.forEach((s, k) => {
        const c = pt(L.uS[k], L.cv), bs = S.brillo['s' + k] || 0, R = L.R, caliente = s.T - 14.4 > 1.2;
        const y1 = pt(L.uS[k], L.cv + R), y2 = pt(L.uS[k], L.vStop);
        ctx.strokeStyle = COL.grisB; ctx.beginPath(); ctx.moveTo(y1.x, y1.y); ctx.lineTo(y2.x, y2.y); ctx.stroke();
        ctx.fillStyle = '#181A26'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
        const nv = Math.min(1, s.nivel / CAPACIDAD); ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, R - 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(188,118,219,' + (0.22 + bs * 0.3).toFixed(3) + ')'; ctx.fillRect(c.x - R, c.y + R - nv * 2 * R, 2 * R, nv * 2 * R); ctx.restore();
        ctx.strokeStyle = caliente ? COL.at : bs > 0.05 ? COL.moradoLuz : COL.grisB; ctx.lineWidth = bs > 0.05 || caliente ? 1.6 : 1; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
        texto('SILO ' + (k + 1), c.x, c.y - 5, COL.papel, ancho ? 10 : 9, '600', 'center'); texto(Math.round(nv * 100) + ' %', c.x, c.y + 8, COL.papelC, ancho ? 9.5 : 8.5, '', 'center');
        const tt = fmt(s.T, 1) + ' °C', hh = Math.round(s.H) + ' %';
        if (ancho) { texto(tt, c.x, c.y - R - 24, caliente ? COL.at : COL.ok, 10, '600', 'center'); texto('hum ' + hh, c.x, c.y - R - 11, COL.texto, 9, '', 'center'); }
        else texto(fmt(s.T, 1) + '° · ' + hh.replace(' ', ''), c.x + R + 5, c.y - 13, caliente ? COL.at : COL.ok, 8.5, '600');
      });
    }

    function camion(v) {
      const horiz = Math.abs(v.sx) >= Math.abs(v.sy), w = horiz ? L.tl : L.ta, h = horiz ? L.ta : L.tl, x = v.x - w / 2, y = v.y - h / 2;
      let anillo = null;
      if (v.estado === 'salida' && v.wp.length) ctx.globalAlpha = Math.max(0, Math.min(1, Math.hypot(v.wp[0].x - v.x, v.wp[0].y - v.y) / 45));
      if (v.star && !v.fin) anillo = COL.moradoLuz; else if (v.estado === 'retenido') anillo = COL.at;
      if (anillo) { ctx.save(); ctx.shadowColor = anillo; ctx.shadowBlur = 10; ctx.strokeStyle = anillo; ctx.lineWidth = 1.5; rr(x - 4, y - 4, w + 8, h + 8, 4); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(x + 2, y + 2, w, h, 2); ctx.fill();
      ctx.fillStyle = COL.papel; rr(x, y, w, h, 2); ctx.fill();
      const adelante = (horiz ? v.sx : v.sy) >= 0; ctx.fillStyle = COL.gris; // cabina hacia el sentido de marcha
      if (horiz) ctx.fillRect(adelante ? x + w - 6 : x, y, 6, h); else ctx.fillRect(x, adelante ? y + h - 6 : y, w, 6);
      const col = v.carga === 'ok' ? COL.ok : v.carga === 'ret' ? COL.at : v.carga === 'rech' ? COL.al : v.carga === 'pend' ? COL.azul : null;
      if (col) { ctx.fillStyle = col; ctx.globalAlpha = v.estado === 'descarga' ? Math.max(.12, 1 - v.descarga) : .95; if (horiz) ctx.fillRect(adelante ? x + 1.5 : x + 7.5, y + 1.5, w - 9, h - 3); else ctx.fillRect(x + 1.5, adelante ? y + 1.5 : y + 7.5, w - 3, h - 9); ctx.globalAlpha = 1; }
      if (v.star && !v.fin && v.estado !== 'carga') { const der = !horiz && v.x > CW - 70; texto(v.id, v.x + (horiz ? 0 : der ? -12 : 12), v.y - (horiz ? 14 : 0), COL.papel, 9.5, '600', horiz ? 'center' : der ? 'right' : 'left'); }
      ctx.globalAlpha = 1;
    }

    // Conciliación con IA del lote que sigue la bitácora
    function dibujarConciliacion() {
      const r = L.conc, v = S.vista; caja(r, COL.hub, 'rgba(188,118,219,.5)'); resalte(r, 'conc', '188,118,219');
      texto('CONCILIACIÓN CON IA', r.x + 12, r.y + 18, COL.papel, ancho ? 12 : 10, '600');
      texto(v ? 'lote ' + v.id : 'orden · aviso · peso · factura', r.x + 12, r.y + 35, COL.moradoLuz, ancho ? 10.5 : 9.5, '600');
      const ct = v && v.concT0 != null ? S.sim - v.concT0 : -1;
      const nom = ancho ? ['ORDEN DE COMPRA', 'AVISO DE DESPACHO', 'PESO DE BÁSCULA', 'FACTURA'] : ['ORDEN', 'AVISO', 'PESO', 'FACTURA'];
      const pesoOk = !v || Math.abs((v.neto - v.decl) / v.decl * 100) <= TOLERANCIA;
      const filas = v ? [
        [nom[0], v.oc, true, true],
        [nom[1], fmt(v.decl, 1) + ' t', true, true],
        [nom[2], v.p.peso && ct >= 0 ? fmt(v.neto, 2) + ' t' : '…', ct >= 0.3, pesoOk],
        [nom[3], ct >= 1.2 ? fmt(v.decl, 1) + ' t' : '…', ct >= 1.6, true]
      ] : nom.map(n => [n, '…', false, true]);
      const fl = ancho ? 21 : 18;
      filas.forEach((f, i) => {
        const y = r.y + (ancho ? 56 : 54) + i * fl;
        const mal = f[2] && !f[3];
        texto(f[0], r.x + 12, y, COL.texto, ancho ? 9 : 8.5, ''); texto(f[1], r.x + r.w - 32, y, mal ? COL.at : f[2] ? COL.papel : COL.grisT, ancho ? 10 : 9, '600', 'right');
        if (mal) texto('!', r.x + r.w - 19, y, COL.at, 11, '600', 'center');
        else if (f[2]) { ctx.strokeStyle = COL.ok; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r.x + r.w - 24, y); ctx.lineTo(r.x + r.w - 20, y + 4); ctx.lineTo(r.x + r.w - 13, y - 4); ctx.stroke(); ctx.lineWidth = 1; }
      });
      const yv = r.y + (ancho ? 56 : 54) + 4 * fl + 6;
      let txt = 'esperando el lote…', col = COL.grisT, sub = '';
      if (v && v.carga === 'rech') { txt = 'RECHAZADO'; col = COL.al; sub = 'por ' + (v.cal ? v.cal.causa : 'calidad'); }
      else if (v && ct >= 2.4) { if (v.conciliado) { txt = 'CUADRA'; col = COL.ok; sub = 'liquidación lista'; } else { txt = 'DIFERENCIA ' + fmt((v.decl - v.neto) / v.decl * 100, 1) + ' %'; col = COL.at; sub = 'revisión de compras'; } }
      else if (v && ct < 0) { txt = 'espera el peso final'; col = COL.grisT; }
      else if (v) { txt = 'verificando…'; col = COL.azul; }
      ctx.fillStyle = 'rgba(255,255,255,.04)'; rr(r.x + 8, yv - 7, r.w - 16, ancho ? 30 : 28, 4); ctx.fill();
      texto(txt, r.x + 16, yv + (sub ? 3 : 8), col, ancho ? 11 : 10, '600'); if (sub) texto(sub, r.x + 16, yv + (ancho ? 17 : 16), COL.texto, ancho ? 9 : 8.5);
    }
    // Trazabilidad: dónde va el lote que sigue la bitácora
    function dibujarFicha() {
      const r = L.ficha, v = S.vista; caja(r, COL.panel, COL.linea);
      const t = v ? (ancho ? 'TRAZABILIDAD DE ' + v.id + ' · ' + PROV[v.prov] + ' · ' + fmt(Math.round(v.neto * 1000), 0) + ' kg' : 'LOTE ' + v.id + ' · ' + PROV[v.prov]) : 'TRAZABILIDAD DEL LOTE';
      texto(t, r.x + 12, r.y + 15, COL.papel, ancho ? 10.5 : 9, '600');
      if (ancho) {
        const bw = (r.w - 24) / 6;
        PASOS.forEach((n, i) => {
          const on = v && v.p[['aviso', 'cita', 'placa', 'peso', 'cal', 'silo'][i]], rech = i === 4 && v && v.carga === 'rech', x = r.x + 12 + i * bw;
          ctx.fillStyle = on ? (rech ? 'rgba(255,138,110,.14)' : 'rgba(62,201,172,.12)') : '#151623'; rr(x, r.y + 24, bw - 6, 20, 4); ctx.fill();
          ctx.strokeStyle = on ? (rech ? COL.al : COL.ok) : COL.linea; ctx.stroke();
          texto((on ? (rech ? '× ' : '✓ ') : '') + n, x + (bw - 6) / 2, r.y + 34, on ? (rech ? COL.al : COL.ok) : COL.grisT, 8.5, '600', 'center');
        });
      } else {
        PASOS.forEach((n, i) => {
          const on = v && v.p[['aviso', 'cita', 'placa', 'peso', 'cal', 'silo'][i]], rech = i === 4 && v && v.carga === 'rech', y = r.y + 30 + i * 13.2;
          texto((on ? (rech ? '× ' : '✓ ') : '· ') + n, r.x + 14, y, on ? (rech ? COL.al : COL.ok) : COL.grisT, 8.5, '600');
        });
      }
    }
    function dibujarAsistente() {
      const r = L.chat; caja(r, COL.panel, COL.linea); resalte(r, 'asist', '188,118,219');
      texto('ASISTENTE EN ESPAÑOL', r.x + 12, r.y + 16, COL.papel, ancho ? 11 : 9.5, '600');
      if (ancho) texto('cita sus fuentes', r.x + r.w - 12, r.y + 16, COL.texto, 9.5, '', 'right');
      const c = S.chat, tam = ancho ? 10 : 9, lh = ancho ? 14 : 13.5, w = r.w - 24; let y = r.y + 36;
      if (!c) { envolver('Pregunte lo que necesite: qué llega esta tarde, por qué se rechazó un lote o cuántas horas de proceso hay aseguradas.', w, tam, ancho ? 4 : 7).forEach(l => { texto(l, r.x + 12, y, COL.grisT, tam); y += lh; }); return; }
      envolver('› ' + c.q, w, tam, 2).forEach(l => { texto(l, r.x + 12, y, COL.azul, tam, '600'); y += lh; });
      y += 3;
      if (!c.a) { texto('consultando sus sistemas…', r.x + 12, y, COL.grisT, tam); return; }
      envolver(c.a, w, tam, ancho ? 3 : 4).forEach(l => { texto(l, r.x + 12, y, COL.papel, tam); y += lh; });
      y += 3; envolver('Fuentes: ' + c.f.join(' · '), w, tam - 0.5, 2).forEach(l => { texto(l, r.x + 12, y, COL.moradoLuz, tam - 0.5); y += lh; });
    }
    function dibujarTorre() {
      const r = L.torre; ctx.save(); ctx.shadowColor = 'rgba(188,118,219,.3)'; ctx.shadowBlur = 20; ctx.fillStyle = COL.hub; rr(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(188,118,219,' + (0.4 + (S.brillo.torre || 0) * 0.4).toFixed(3) + ')'; ctx.lineWidth = 1.2; rr(r.x, r.y, r.w, r.h, 10); ctx.stroke(); ctx.lineWidth = 1;
      texto('LA TORRE · UN SOLO MODELO DE DATOS', r.x + 14, r.y + 18, COL.papel, ancho ? 12 : 10.5, '600');
      texto(ancho ? 'registros hoy ' + fmt(S.regs, 0) + ' · lotes conciliados ' + S.conc : fmt(S.regs, 0) + ' registros', r.x + r.w - 14, r.y + 18, COL.texto, ancho ? 10.5 : 9, '', 'right');
      const pills = ancho ? [['PRONÓSTICO Y ETA', 'pron'], ['CONCILIACIÓN: OC · AVISO · PESO · FACTURA', 'conc'], ['ASISTENTE EN ESPAÑOL', 'asist']] : [['PRONÓSTICO Y ETA', 'pron'], ['CONCILIACIÓN', 'conc'], ['ASISTENTE', 'asist']];
      const pesos = ancho ? [0.26, 0.46, 0.28] : [0.4, 0.33, 0.27], tot = r.w - 28 - 16, py = r.y + (ancho ? 34 : 32), ph = ancho ? 30 : 24; let x = r.x + 14;
      pills.forEach((p, i) => {
        const w = tot * pesos[i], b = S.brillo[p[1]] || 0, rgb = p[1] === 'conc' ? '243,183,71' : '188,118,219';
        ctx.fillStyle = b > 0 ? 'rgba(' + rgb + ',' + (0.1 + b * 0.25).toFixed(3) + ')' : '#191B2B'; rr(x, py, w, ph, ph / 2); ctx.fill();
        ctx.strokeStyle = b > 0.05 ? 'rgba(' + rgb + ',.9)' : COL.linea; ctx.stroke();
        texto(p[0], x + w / 2, py + ph / 2, b > 0.05 ? COL.papel : COL.texto, ancho ? 10 : 9, '600', 'center'); x += w + 8;
      });
    }
    function dibujarPaquetes() {
      S.paq.forEach(p => {
        let x, y;
        if (p.haciaPortal) { const q = L.portal, a = p.t * p.t * (3 - 2 * p.t); x = p.x + (q.x + q.w / 2 - p.x) * a; y = p.y + (q.y + q.h / 2 - p.y) * a; }
        else { const a = p.t * p.t; x = p.x; y = p.y + (L.torre.y - p.y) * a; }
        ctx.save(); ctx.globalAlpha = 1 - p.t * 0.4; ctx.shadowColor = p.col; ctx.shadowBlur = 8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }
    function draw() {
      ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = COL.fondo; ctx.fillRect(0, 0, CW, CH);
      L.cab.forEach(c => texto(c[3], c[0], c[1], COL.texto, 11, '600', c[2]));
      dibujarVias(); dibujarPlanta(); dibujarFincas(); dibujarETA(); dibujarPronostico(); dibujarAgenda();
      S.camiones.forEach(camion);
      dibujarConciliacion(); dibujarFicha(); dibujarAsistente(); dibujarTorre(); dibujarPaquetes();
      ctx.font = '600 ' + (11 * (ancho ? 1 : 1)) + 'px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = COL.at; ctx.textAlign = 'left';
      ctx.fillText(reduce ? (ancho ? 'IMAGEN FIJA (MOVIMIENTO REDUCIDO) · DATOS SINTÉTICOS · 1 S = 2 MIN' : 'IMAGEN FIJA · DATOS SINTÉTICOS') : ancho ? 'DATOS SINTÉTICOS · 1 S = 2 MIN · DE LA MATERIA PRIMA A LA PLANTA' : 'DATOS SINTÉTICOS · 1 S = 2 MIN', L.pie[0], L.pie[1]);
    }
    function drawSpark() {
      const c = el.spark; if (!c || !S) return;
      const g = c.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1); const r = c.getBoundingClientRect();
      if (r.width < 10) return;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height, n = S.serie.length; if (n < 2) return;
      const max = Math.max(100, ...S.serie), y = v => h - 3 - v / max * (h - 8);
      g.clearRect(0, 0, w, h);
      g.beginPath(); S.serie.forEach((v, i) => { const x = i / (n - 1) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
      g.strokeStyle = COL.azul; g.lineWidth = 1.5; g.stroke();
      g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(192,211,237,.10)'; g.fill();
      g.fillStyle = COL.ok; g.beginPath(); g.arc(w - 2, y(S.serie[n - 1]), 3, 0, Math.PI * 2); g.fill();
    }
    function calentar() {
      calentando = true; for (let i = 0; i < 4500; i++) paso(1 / 30); calentando = false;
      if (reduce) for (let i = 0; i < 3000; i++) { // un fotograma fijo con un lote ya conciliado
        const v = S.vista; if (v && v.concT0 != null && S.sim - v.concT0 >= 2.6 && v.conciliado) break; paso(1 / 30);
      }
      if (reduce) S.chat = { q: '¿Qué llega en las próximas 4 horas?', a: 'Se pronostican ' + suma4h() + ' t, con las citas ya asignadas en la agenda.', f: ['pronóstico', 'agenda', 'avisos'], t0: S.sim };
    }
    function reiniciar() { S = nuevo(); calentar(); draw(); metrics(); drawSpark(); pintarEventos(); }
    function fit() {
      const rect = canvas.getBoundingClientRect(); if (rect.width < 10) return false;
      const antes = ancho; ancho = rect.width >= 620; const cambio = !L || antes !== ancho; L = layout();
      canvas.style.aspectRatio = CW + ' / ' + CH;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.width * (CH / CW) * dpr);
      ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
      return cambio;
    }
    let frame = 0, visible = true;
    function loop(ts) {
      if (!visible) { lastTs = null; requestAnimationFrame(loop); return; }
      if (lastTs == null) lastTs = ts; const dt = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts;
      if (canvas.width === 0 || !L) { if (fit()) reiniciar(); }
      if (L && S) { paso(dt); draw(); metrics(); if ((frame++ % 30) === 0) drawSpark(); }
      requestAnimationFrame(loop);
    }
    L = layout(); fit(); S = nuevo(); calentar();
    let espera = null;
    window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { if (fit()) reiniciar(); else if (S) { draw(); drawSpark(); } }, 120); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '150px' }).observe(canvas);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (S) { draw(); drawSpark(); } });
    draw(); metrics(); drawSpark(); pintarEventos();
    if (reduce) return;
    requestAnimationFrame(loop);
  }
})();
