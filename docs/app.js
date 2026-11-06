import {createEngine} from './engine.js';
import {createStudy} from './breakdown.js';
import {stages} from './content.js';

const byId = id => document.getElementById(id);
const hero = byId('hero'), breakdown = byId('breakdown');
const play = byId('play'), slider = byId('frame'), status = byId('status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let engine, study, stage = 0, frame = 0, playing = false, ready = false, origin = 0, lastFrame = -1, raf = 0;

function paint() {
  if (!ready) return;
  if (stage) study.renderStage(stage, frame);
  else engine.renderView(frame, 'final');
  slider.value = String(frame);
  slider.setAttribute('aria-valuetext', `Frame ${frame} of 119`);
  byId('position').textContent = `${String(frame).padStart(3, '0')} / 119`;
}

function tick(now) {
  if (!playing) return;
  frame = Math.floor((now - origin) * 24 / 1000) % 120;
  if (frame !== lastFrame) { paint(); lastFrame = frame; }
  raf = requestAnimationFrame(tick);
}

function setPlaying(value) {
  playing = value && ready && !document.hidden;
  play.textContent = playing ? 'Pause' : 'Play';
  cancelAnimationFrame(raf);
  if (playing) {
    origin = performance.now() - frame * 1000 / 24;
    raf = requestAnimationFrame(tick);
  }
}

function selectStage() {
  // The URL can only choose one of the eight fixed views. Never interpret it as HTML or code.
  stage = /^#[1-8]$/.test(location.hash) ? Number(location.hash.slice(1)) : 0;
  const info = stages[stage - 1];
  byId('stages').hidden = stage === 0;
  hero.hidden = !ready || stage !== 0;
  breakdown.hidden = !ready || stage === 0;
  byId('final-link').toggleAttribute('aria-current', !stage);
  byId('breakdown-link').toggleAttribute('aria-current', !!stage);
  if (!stage) byId('final-link').setAttribute('aria-current', 'page');
  else byId('breakdown-link').setAttribute('aria-current', 'page');
  document.querySelectorAll('#stages a').forEach((link, index) => {
    if (index === stage - 1) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  byId('stage-title').textContent = info?.title || 'The complete render';
  byId('stage-count').textContent = stage ? `${String(stage).padStart(2, '0')} / 08` : 'FINAL';
  byId('equation').textContent = info?.equation || 'uₜₜ = c²∇²u';
  byId('description').textContent = info?.body || 'A numerical wave field passes through a six-cell aperture. The height gradient drives raking light, cast shadows and a fixed grain threshold.';
  breakdown.setAttribute('aria-label', info ? `${stage} of 8: ${info.title}. Equation and explanation follow below.` : 'Technical breakdown');
  paint();
}

play.addEventListener('click', () => setPlaying(!playing));
slider.addEventListener('input', () => { setPlaying(false); frame = Number(slider.value); paint(); });
addEventListener('hashchange', selectStage);
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
reducedMotion.addEventListener('change', event => { if (event.matches) setPlaying(false); });
hero.addEventListener('webglcontextlost', event => {
  event.preventDefault(); setPlaying(false); ready = false;
  play.disabled = slider.disabled = true;
  hero.hidden = breakdown.hidden = true; byId('poster').hidden = false;
  status.dataset.error = 'true'; status.textContent = 'The graphics context was lost. Reload to rebuild the wave field.';
});

async function start() {
  selectStage();
  try {
    await document.fonts.load("24px 'Geist Mono'");
    // Let the loading message paint before the deterministic CPU solve begins.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    engine = createEngine(hero);
    study = createStudy(breakdown, engine);
    ready = true;
    play.disabled = slider.disabled = false;
    byId('poster').hidden = true;
    document.querySelector('.viewer').setAttribute('aria-busy', 'false');
    status.textContent = '120 frames / drag the timeline to inspect';
    selectStage();
    setPlaying(!reducedMotion.matches);
  } catch (error) {
    status.dataset.error = 'true';
    status.textContent = 'Interactive rendering is unavailable in this browser. Enable WebGL2 or try a browser with floating-point rendering. The final still and source remain available.';
    document.querySelector('.viewer').setAttribute('aria-busy', 'false');
    console.error('One slit initialization failed:', error);
  }
}
start();
