/* ZAMP7 · video de marca de la portada.
   Se reproduce solo, en silencio, cuando está a la vista; se pausa al salir de pantalla.
   No se reproduce solo con movimiento reducido ni con ahorro de datos: queda el cartel y los controles.
   Si la persona lo pausa a mano, no se vuelve a reproducir solo. */
(function () {
  const v = document.querySelector('.video-marca video');
  if (!v) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ahorro = !!(navigator.connection && navigator.connection.saveData);
  if (reduce || ahorro || !('IntersectionObserver' in window)) return;

  let manual = false, porScript = false;
  const iniciar = () => {
    if (manual || !v.paused) return;
    porScript = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {}).then(() => { porScript = false; }); else porScript = false;
  };
  const detener = () => { if (!v.paused) { porScript = true; v.pause(); } };

  v.addEventListener('pause', () => { if (porScript) porScript = false; else if (!document.hidden) manual = true; });
  v.addEventListener('play', () => { if (!porScript) manual = false; });
  v.preload = 'metadata';

  const io = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= 0.5) iniciar(); else if (!e.isIntersecting || e.intersectionRatio < 0.15) detener(); });
  }, { threshold: [0, 0.15, 0.5, 0.8] });
  io.observe(v);
})();
