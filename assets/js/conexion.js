/* ZAMP7 · «Si existe, lo conectamos»: los sistemas del cliente se conectan al modelo de datos y salen a
   tableros, alertas, asistente e informes. Las líneas se calculan con la posición real de cada caja, así que
   el diagrama funciona igual en computador (de izquierda a derecha) y en celular (de arriba abajo). */
(function () {
  'use strict';
  const cx = document.querySelector('[data-cx]');
  if (!cx) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = cx.querySelector('.cx__lineas'), hub = cx.querySelector('.cx__emblema');
  const origen = Array.from(cx.querySelectorAll('.cx__origen li')), destino = Array.from(cx.querySelectorAll('.cx__destino li'));
  const NS = 'http://www.w3.org/2000/svg';

  function dibujar() {
    const c = cx.getBoundingClientRect(), hb = hub.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`);
    svg.setAttribute('width', c.width); svg.setAttribute('height', c.height);
    const vertical = hb.left < origen[0].getBoundingClientRect().right;  // en celular el modelo queda debajo de las fuentes
    const rel = r => ({ l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top, x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 });
    const H = rel(hb);
    let html = '';
    const curva = (a, b) => vertical
      ? `M${a.x} ${a.y}C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y}`
      : `M${a.x} ${a.y}C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
    origen.forEach((li, i) => {
      const o = rel(li.getBoundingClientRect());
      const a = vertical ? { x: o.x, y: o.b } : { x: o.r, y: o.y }, b = vertical ? { x: H.x + (i - (origen.length - 1) / 2) * 6, y: H.t } : { x: H.l, y: H.y + (i - (origen.length - 1) / 2) * 8 };
      html += `<path id="cx-o${i}" class="cx__l${li.classList.contains('construir') ? ' construir' : ''}" style="--i:${i}" d="${curva(a, b)}"/>`;
    });
    destino.forEach((li, i) => {
      const d = rel(li.getBoundingClientRect());
      const a = vertical ? { x: H.x + (i - (destino.length - 1) / 2) * 8, y: H.b } : { x: H.r, y: H.y + (i - (destino.length - 1) / 2) * 10 }, b = vertical ? { x: d.x, y: d.t } : { x: d.l, y: d.y };
      html += `<path id="cx-d${i}" class="cx__l cx__l--sale" style="--i:${origen.length + i}" d="${curva(a, b)}"/>`;
    });
    svg.innerHTML = html;
    svg.querySelectorAll('.cx__l').forEach(p => { const L = p.getTotalLength(); p.style.setProperty('--L', L.toFixed(1)); });
    if (cx.classList.contains('cx--visto')) datos(0);
  }

  // un dato viaja por cada línea: entra al modelo y sale convertido; aparece al empezar su recorrido
  function datos(espera) {
    if (reduce) return;
    const t = typeof svg.getCurrentTime === 'function' ? svg.getCurrentTime() : 0;
    const dato = (cls, ref, inicio) => `<circle class="${cls}" r="3" opacity="0"><set attributeName="opacity" to="1" begin="${(t + espera + inicio).toFixed(2)}s"/><animateMotion dur="3.4s" begin="${(t + espera + inicio).toFixed(2)}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"><mpath href="#${ref}"/></animateMotion></circle>`;
    let html = '';
    origen.forEach((li, i) => { if (!li.classList.contains('construir')) html += dato('cx__dato', `cx-o${i}`, i * .45); });
    destino.forEach((li, i) => { html += dato('cx__dato cx__dato--sale', `cx-d${i}`, 1.6 + i * .5); });
    svg.insertAdjacentHTML('beforeend', html);
  }

  dibujar();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(dibujar);
  let to; window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(dibujar, 120); });
  if (reduce || !('IntersectionObserver' in window)) { cx.classList.add('cx--visto'); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { cx.classList.add('cx--visto'); datos(1.3); io.disconnect(); } }), { threshold: .35 });
  io.observe(cx);
})();
