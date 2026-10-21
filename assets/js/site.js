/* ZAMP7 · sitio web · comportamiento compartido (sin dependencias). */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // Navegación móvil
  const toggle = $('.nav__toggle'), links = $('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const abierto = links.classList.toggle('abierto');
      toggle.setAttribute('aria-expanded', String(abierto));
    });
  }
  // Página actual en el menú
  const aqui = location.pathname.split('/').pop() || 'index.html';
  $$('.nav__links a').forEach(a => { if ((a.getAttribute('href') || '').split('/').pop() === aqui) a.setAttribute('aria-current', 'page'); });

  // Revelado al entrar en pantalla
  const revelar = $$('.rev, .frentes, [data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    document.documentElement.classList.add('js-rev');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('en-vista');
        if (e.target.hasAttribute('data-count')) contar(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: .18 });
    revelar.forEach(el => { if (el.hasAttribute('data-count')) el.textContent = formato(0, el.dataset.dec); io.observe(el); });
  } else {
    revelar.forEach(el => { el.classList.add('en-vista'); if (el.hasAttribute('data-count')) el.textContent = formato(Number(el.dataset.count), el.dataset.dec); });
  }
  function formato(n, dec) { return n.toLocaleString('es-CO', { minimumFractionDigits: Number(dec || 0), maximumFractionDigits: Number(dec || 0) }); }
  function contar(el) {
    const fin = Number(el.dataset.count), dec = el.dataset.dec || 0, t0 = performance.now(), dur = 1100;
    const tick = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = formato(fin * e, dec); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // Calculadora de minutos en patio
  const calc = $('#calc');
  if (calc) {
    const i = { cam: $('#c-camiones'), esp: $('#c-espera-min'), cos: $('#c-costo'), dias: $('#c-dias'), red: $('#c-reduccion') };
    const o = { horas: $('#o-horas'), pesos: $('#o-pesos'), ahorro: $('#o-ahorro'), ahorroAnual: $('#o-ahorro-anual'), red: $('#o-red') };
    const pesos = n => '$ ' + Math.round(n).toLocaleString('es-CO');
    function calcular() {
      const cam = +i.cam.value, esp = +i.esp.value, cos = +i.cos.value, dias = +i.dias.value, red = +i.red.value;
      const horasMes = cam * esp / 60 * dias;
      const pesosMes = horasMes * cos;
      const ahorroMes = cam * Math.min(red, esp) / 60 * dias * cos;
      o.horas.textContent = Math.round(horasMes).toLocaleString('es-CO');
      o.pesos.textContent = pesos(pesosMes);
      o.ahorro.textContent = pesos(ahorroMes);
      o.ahorroAnual.textContent = pesos(ahorroMes * 12);
      o.red.textContent = red;
      $$('[data-out]', calc).forEach(s => { const k = s.dataset.out; s.textContent = ({ cam, esp, cos: cos.toLocaleString('es-CO'), dias })[k]; });
    }
    Object.values(i).forEach(inp => inp && inp.addEventListener('input', calcular));
    $$('.campo .rango', calc).forEach(r => { const [range, num] = $$('input', r); range.addEventListener('input', () => { num.value = range.value; calcular(); }); num.addEventListener('input', () => { range.value = num.value; calcular(); }); });
    calcular();
  }

  // Protocolo de medición (pestañas)
  const proto = $('#protocolo');
  if (proto) {
    const botones = $$('[role="tab"]', proto), panel = $('#protocolo-panel'), datos = JSON.parse($('#protocolo-datos').textContent);
    function mostrar(n) {
      botones.forEach(b => b.setAttribute('aria-selected', String(b.dataset.step === n)));
      const d = datos[n]; if (!d) return;
      panel.innerHTML = `<span class="etq etq--morado">Paso ${n} · ${d.dur}</span><h3>${d.t}</h3><p class="lead">${d.q}</p><div class="barra" aria-hidden="true"><span></span></div><p class="nota">${d.n}</p>`;
      requestAnimationFrame(() => { const s = $('.barra span', panel); if (s) s.style.width = d.p + '%'; });
    }
    botones.forEach(b => b.addEventListener('click', () => mostrar(b.dataset.step)));
    mostrar('1');
  }

  // Formulario de tres campos: WhatsApp con mensaje prellenado o correo
  $$('form[data-contacto]').forEach(form => {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const consent = $('input[name="autorizacion"]', form);
      const ok = $('.form__ok', form);
      if (consent && !consent.checked) { consent.focus(); if (ok) { ok.classList.add('visible', 'error'); ok.textContent = 'Marque la casilla de autorización para enviar el formulario.'; } return; }
      if (ok) ok.classList.remove('error');
      const f = new FormData(form), nombre = f.get('nombre') || '', empresa = f.get('empresa') || '', contacto = f.get('contacto') || '';
      const numero = (form.dataset.whatsapp || '').replace(/\D/g, '');
      const texto = `Hola, quiero un diagnóstico de patio y cargue para mi CEDI. Soy ${nombre} de ${empresa}. Contacto: ${contacto}.`;
      if (numero && !numero.startsWith('0000')) {
        window.open('https://wa.me/' + numero + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
      } else {
        const correo = form.dataset.correo || '';
        if (correo && !correo.includes('[')) location.href = 'mailto:' + correo + '?subject=' + encodeURIComponent('Diagnóstico de patio y cargue') + '&body=' + encodeURIComponent(texto);
      }
      if (ok) { ok.classList.add('visible'); ok.textContent = 'Recibido. Respondemos en horario hábil (7 a. m. a 7 p. m.), normalmente el mismo día.'; }
      form.reset();
    });
  });

  // Suscripción a casos firmados: un correo, con autorización, por correo al buzón de la empresa
  $$('form[data-suscribir]').forEach(form => {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const consent = $('input[name="autorizacion"]', form);
      const ok = $('.form__ok', form);
      if (consent && !consent.checked) { consent.focus(); if (ok) { ok.classList.add('visible', 'error'); ok.textContent = 'Marque la casilla de autorización para suscribirse.'; } return; }
      if (ok) ok.classList.remove('error');
      const correoUsuario = (new FormData(form).get('correo') || '').toString().trim();
      const destino = form.dataset.correo || '';
      if (destino && !destino.includes('[')) {
        location.href = 'mailto:' + destino + '?subject=' + encodeURIComponent('Quiero recibir los casos firmados') + '&body=' + encodeURIComponent('Correo para recibir los casos: ' + correoUsuario);
      }
      if (ok) { ok.classList.add('visible'); ok.textContent = 'Anotado. Le escribimos solo cuando se firme un caso.'; }
      form.reset();
    });
  });

  // Barra de progreso de lectura
  const prog = $('.progreso');
  if (prog) {
    const pintar = () => { const h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%'; };
    addEventListener('scroll', pintar, { passive: true }); pintar();
  }

  // Tema: sigue al sistema; el botón fija claro u oscuro y lo recuerda en este navegador
  const tema = $('.tema');
  if (tema) {
    const raiz = document.documentElement;
    try { const g = localStorage.getItem('zamp7-tema'); if (g === 'dark' || g === 'light') raiz.dataset.theme = g; } catch (e) {}
    tema.addEventListener('click', () => {
      const oscuroAhora = raiz.dataset.theme ? raiz.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      const nuevo = oscuroAhora ? 'light' : 'dark';
      raiz.dataset.theme = nuevo;
      try { localStorage.setItem('zamp7-tema', nuevo); } catch (e) {}
    });
  }

  // Foco que sigue al cursor en tarjetas
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.tarjeta, .paso, .servicio, .pila__capa, .principio').forEach(c => {
      c.classList.add('spot');
      c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }

  // Pestañas genéricas: [data-tabs] con botones [role=tab][aria-controls] y paneles [role=tabpanel]
  $$('[data-tabs]').forEach(grupo => {
    const tabs = $$('[role="tab"]', grupo), paneles = $$('[role="tabpanel"]', grupo);
    function activar(tab, enfocar) {
      tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      paneles.forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
      if (enfocar) tab.focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activar(t));
      t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); activar(tabs[(i + d + tabs.length) % tabs.length], true); } });
    });
    const porHash = () => tabs.find(t => location.hash && t.getAttribute('aria-controls') === location.hash.slice(1).split('/').pop());
    const inicial = porHash() || tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
    if (inicial) activar(inicial);
    addEventListener('hashchange', () => { const t = porHash(); if (t) { activar(t); grupo.scrollIntoView({ block: 'start' }); } });
  });

  // Año del pie
  $$('[data-year]').forEach(e => { e.textContent = new Date().getFullYear(); });
})();
