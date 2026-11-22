'use strict';

// The SVG owns the geometry and readable labels. Canvas adds only translucent,
// tapered light travelling along those same paths; the static workflow is the fallback.
(() => {
  const home = document.getElementById('home');
  const stage = home?.querySelector('.home-stage');
  if (!stage) return;

  const scenes = [...stage.querySelectorAll('.wf-scene')].map(element => {
    const svg = element.querySelector('.home-workflow-background');
    const canvas = element.querySelector('.wf-motion');
    const context = canvas?.getContext('2d');
    if (!svg || !context) return null;
    return { element, svg, canvas, context, routes: [], width: 0, height: 0 };
  }).filter(Boolean);
  if (!scenes.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) && value !== null
    ? Number(value) : fallback;
  const color = (rgb, alpha) => `rgba(${rgb.join(',')},${alpha})`;
  let active = null;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 2.8;
  let inView = true;
  let suspended = false;
  let palette;

  function readTheme() {
    palette = document.documentElement.dataset.theme === 'dark'
      ? { trail: [108, 219, 186], glow: [66, 203, 161], head: [157, 244, 214], core: [233, 255, 249] }
      : { trail: [43, 145, 120], glow: [61, 170, 139], head: [43, 153, 125], core: [225, 255, 243] };
  }

  function clear(scene) {
    scene.context.setTransform(1, 0, 0, 1, 0, 0);
    scene.context.clearRect(0, 0, scene.canvas.width, scene.canvas.height);
  }

  function sample(path) {
    const length = path.getTotalLength();
    const count = clamp(Math.ceil(length / 2.5), 48, 420);
    const points = Array.from({ length: count + 1 }, (_, index) => {
      const point = path.getPointAtLength(length * index / count);
      return { x: point.x, y: point.y };
    });
    return {
      points,
      duration: clamp(number(path.getAttribute('data-duration'), 5), 1, 20),
      delay: number(path.getAttribute('data-delay'), 0),
      strength: clamp(number(path.getAttribute('data-strength'), 1), 0, 1.5),
      trail: clamp(number(path.getAttribute('data-trail'), 0.18), 0.06, 0.4)
    };
  }

  function pointAt(route, position) {
    const index = clamp(position, 0, 1) * (route.points.length - 1);
    const start = Math.floor(index);
    const end = Math.min(start + 1, route.points.length - 1);
    const fraction = index - start;
    return {
      x: route.points[start].x + (route.points[end].x - route.points[start].x) * fraction,
      y: route.points[start].y + (route.points[end].y - route.points[start].y) * fraction
    };
  }

  function measure() {
    active = null;
    for (const scene of scenes) {
      const bounds = scene.svg.getBoundingClientRect();
      clear(scene);
      if (!bounds.width || !bounds.height || getComputedStyle(scene.element).display === 'none') continue;
      const viewBox = scene.svg.viewBox.baseVal;
      if (!viewBox.width || !viewBox.height) continue;
      scene.width = bounds.width;
      scene.height = bounds.height;
      scene.dpr = Math.min(window.devicePixelRatio || 1, 2);
      scene.scale = Math.min(bounds.width / viewBox.width, bounds.height / viewBox.height);
      scene.offsetX = (bounds.width - viewBox.width * scene.scale) / 2 - viewBox.x * scene.scale;
      scene.offsetY = (bounds.height - viewBox.height * scene.scale) / 2 - viewBox.y * scene.scale;
      scene.canvas.width = Math.round(bounds.width * scene.dpr);
      scene.canvas.height = Math.round(bounds.height * scene.dpr);
      scene.canvas.style.width = `${bounds.width}px`;
      scene.canvas.style.height = `${bounds.height}px`;
      scene.routes = [...scene.svg.querySelectorAll('[data-flow]')].map(sample);
      active = scene;
    }
    sync();
  }

  function trace(context, route, start, end, steps) {
    const first = pointAt(route, start);
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (let index = 1; index <= steps; index++) {
      const point = pointAt(route, start + (end - start) * index / steps);
      context.lineTo(point.x, point.y);
    }
  }

  function drawRoute(scene, route) {
    const context = scene.context;
    const phase = ((elapsed - route.delay) / route.duration % 1 + 1) % 1;
    // Mild acceleration through the middle, then a trailing exit past the endpoint.
    const progress = phase - Math.sin(phase * Math.PI * 2) * 0.035;
    const head = progress * (1 + route.trail);
    const start = Math.max(0, head - route.trail);
    const end = Math.min(1, head);
    if (end <= start || !route.strength) return;
    const unit = 1 / scene.scale;
    const strength = route.strength;
    const exit = clamp((1 + route.trail - head) / route.trail, 0, 1);

    // Broad, very faint underlight gives the narrow stream a translucent second plane.
    trace(context, route, start, end, 24);
    context.strokeStyle = color(palette.glow, 0.027 * strength * exit);
    context.lineWidth = 12 * unit;
    context.stroke();
    context.strokeStyle = color(palette.glow, 0.065 * strength * exit);
    context.lineWidth = 5.5 * unit;
    context.stroke();

    // Segment opacity and width rise towards the head to form a genuinely tapered tail.
    const segments = 32;
    for (let index = 0; index < segments; index++) {
      const tailPosition = index / segments;
      const from = head - route.trail + route.trail * tailPosition;
      const to = from + route.trail / segments;
      if (to <= 0 || from >= 1) continue;
      const first = pointAt(route, Math.max(0, from));
      const second = pointAt(route, Math.min(1, to));
      const intensity = Math.pow((index + 1) / segments, 1.7);
      context.beginPath();
      context.moveTo(first.x, first.y);
      context.lineTo(second.x, second.y);
      context.lineWidth = (0.35 + 1.85 * intensity * strength) * unit;
      context.strokeStyle = color(palette.trail, 0.78 * intensity * strength);
      context.stroke();
    }

    if (head > 0 && head < 1) {
      const point = pointAt(route, head);
      const fade = Math.min(1, head / 0.035, (1 - head) / 0.025);
      const radius = (8 + 2 * strength) * unit;
      const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      halo.addColorStop(0, color(palette.glow, 0.22 * strength * fade));
      halo.addColorStop(0.35, color(palette.glow, 0.08 * strength * fade));
      halo.addColorStop(1, color(palette.glow, 0));
      context.fillStyle = halo;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color(palette.head, 0.86 * strength * fade);
      context.beginPath();
      context.arc(point.x, point.y, (1.25 + 0.35 * strength) * unit, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = color(palette.core, 0.8 * fade);
      context.beginPath();
      context.arc(point.x, point.y, 0.55 * unit, 0, Math.PI * 2);
      context.fill();
    }
  }

  function canAnimate() {
    return active && !home.hidden && !document.hidden && !reducedMotion.matches && inView && !suspended;
  }

  function draw(time) {
    frame = 0;
    if (!canAnimate()) return;
    if (lastTime) elapsed += Math.min(time - lastTime, 50) / 1000;
    lastTime = time;
    clear(active);
    const { context, dpr, scale, offsetX, offsetY } = active;
    context.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const route of active.routes) drawRoute(active, route);
    frame = requestAnimationFrame(draw);
  }

  function sync() {
    if (!canAnimate()) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      scenes.forEach(clear);
      return;
    }
    if (!frame) frame = requestAnimationFrame(draw);
  }

  readTheme();
  const resize = new ResizeObserver(measure);
  resize.observe(stage);
  scenes.forEach(scene => resize.observe(scene.svg));
  new MutationObserver(() => {
    readTheme();
    sync();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(measure).observe(home, { attributes: true, attributeFilter: ['hidden'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      sync();
    }, { rootMargin: '40px' }).observe(stage);
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', sync);
  else reducedMotion.addListener(sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { suspended = true; sync(); });
  window.addEventListener('pageshow', () => { suspended = false; measure(); });
  document.fonts?.ready.then(measure);
  measure();
})();

