/* Browser input and rendering only; simulation and collision live in game.py. */
const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
let state = { x: 0, y: .72, target: null, telegraphs: [], angles: [], hits: [], resolved: 0, time: 0, phase: 'ready', paused: false, running: false };
let command, lastTime, size = 600, radius = 246, held = new Set(), dragging = false;
const colors = ['#cf81ee', '#ebd88b', '#e97c7c', '#ebd88b', '#83b8f2', '#ebd88b', '#93d6a4', '#ebd88b'];
function call(action, payload = {}) {
  if (!command) return;
  state = JSON.parse(command(action, JSON.stringify(payload)));
  updateUI();
}
function resize() {
  size = canvas.clientWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  radius = size * .41;
  draw();
}
function circle(x, y, r, fill, stroke, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function draw() {
  ctx.clearRect(0, 0, size, size);
  ctx.save(); ctx.translate(size / 2, size / 2);
  const r = radius;
  circle(0, 0, r + 8, null, '#314955');
  const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  floor.addColorStop(0, '#213842'); floor.addColorStop(1, '#172b35');
  circle(0, 0, r, floor, '#66808a', 1.5);
  ctx.save(); circle(0, 0, r); ctx.clip();
  ctx.strokeStyle = '#48616b33'; ctx.lineWidth = 1;
  for (let n = -4; n <= 4; n++) {
    const p = n * r / 4;
    ctx.beginPath(); ctx.moveTo(-r, p); ctx.lineTo(r, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, -r); ctx.lineTo(p, r); ctx.stroke();
  }
  circle(0, 0, r * .73, null, '#75909b16');
  for (const t of state.telegraphs) {
    ctx.save(); ctx.rotate(t.angle * Math.PI / 180);
    ctx.fillStyle = t.attack ? '#ff5f688c' : '#edaa4930';
    ctx.fillRect(0, -r * 1.5, r * .5, r * 3);
    ctx.strokeStyle = t.attack ? '#ff8490' : '#e6a04aa0'; ctx.lineWidth = t.attack ? 3 : 1.5;
    ctx.strokeRect(0, -r * 1.5, r * .5, r * 3);
    ctx.restore();
    const a = t.angle * Math.PI / 180;
    const bx = Math.cos(a) * r * .27, by = Math.sin(a) * r * .27;
    circle(bx, by, Math.max(9, size * .019), '#322c25', t.attack ? '#ff8490' : '#edb465');
    ctx.fillStyle = '#ffe1aa'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(10, size * .02)}px sans-serif`; ctx.fillText(t.index + 1, bx, by);
  }
  ctx.restore();
  // Diameter 0.46 of the arena diameter, always centered.
  circle(0, 0, r * .46, '#b1424310', '#d47570', 2);
  ctx.save(); ctx.setLineDash([3, 5]); circle(0, 0, r * .43, null, '#ba676448'); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0, -r * .46 - 5); ctx.lineTo(-7, -r * .46 + 8); ctx.lineTo(7, -r * .46 + 8); ctx.closePath(); ctx.fillStyle = '#dc9188'; ctx.fill();
  circle(0, 0, r * .085, '#263740', '#698089');
  ctx.fillStyle = '#9ab0b6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.max(8, size * .016)}px sans-serif`; ctx.fillText('BOSS', 0, 0);
  const labels = ['A', '2', 'B', '3', 'C', '4', 'D', '1'];
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    const x = Math.cos(angle) * r * .88, y = Math.sin(angle) * r * .88;
    const s = size * .031;
    ctx.fillStyle = colors[i] + '19'; ctx.strokeStyle = colors[i]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - s, y - s, s * 2, s * 2, i % 2 ? s : 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors[i]; ctx.font = `600 ${size * .031}px sans-serif`; ctx.fillText(labels[i], x, y + 1);
  }
  if (state.target) {
    const [x, y] = state.target;
    ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = '#87d9c568';
    ctx.beginPath(); ctx.moveTo(state.x * r, state.y * r); ctx.lineTo(x * r, y * r); ctx.stroke(); ctx.restore();
    circle(x * r, y * r, 6, null, '#87d9c590');
  }
  const recentHit = state.hits.some(i => state.time >= 6 + i && state.time < 6.6 + i);
  const px = state.x * r, py = state.y * r;
  ctx.save(); ctx.shadowColor = recentHit ? '#ff6470' : '#8af4e0'; ctx.shadowBlur = 13;
  circle(px, py, r * .025, recentHit ? '#ff6470' : '#a9ffe9', '#e8fff9', 1.5); ctx.restore();
  circle(px, py, r * .043, null, '#88eed555');
  ctx.restore();
}
function updateUI() {
  const messages = {
    ready: ['準備完了', 'フィールド上で位置を調整して、練習をはじめましょう。'],
    telegraph: ['予兆を記憶', '出現した順番と位置を覚えましょう。'],
    wait: ['攻撃まで ' + Math.max(0, 6 - state.time).toFixed(1) + ' 秒', '最初の攻撃範囲から離れましょう。'],
    attack: ['攻撃を回避', '予兆の順番に、1秒間隔で攻撃が来ます。'],
    result: [state.hits.length ? 'もう一度、挑戦。' : '回避成功！', state.hits.length ? `4回中 ${state.hits.length} 回被弾。順番を思い出して再挑戦。` : '4つの攻撃をすべて避けられました。']
  };
  const [title, message] = messages[state.phase];
  $('phase').textContent = state.paused ? '一時停止中' : title;
  $('message').textContent = state.paused ? '再開すると同じ位置・時間から練習を続けます。' : message;
  $('seconds').textContent = state.time.toFixed(1).padStart(4, '0');
  $('hit-count').textContent = `被弾 ${state.hits.length}`;
  $('start').innerHTML = (state.angles.length ? 'もう一度はじめる' : '練習をはじめる') + '<span>→</span>';
  $('pause').disabled = !state.running;
  $('pause').textContent = state.paused ? '再開' : '一時停止';
  [...$('steps').children].forEach((el, i) => {
    el.className = state.hits.includes(i) ? 'hit' : state.resolved > i ? 'done' : state.angles.length && state.time >= i ? 'shown' : '';
  });
}
function point(event) {
  const bounds = canvas.getBoundingClientRect();
  call('target', { x: (event.clientX - bounds.left - size / 2) / radius, y: (event.clientY - bounds.top - size / 2) / radius });
}
canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragging = true; canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); point(event); });
canvas.addEventListener('pointermove', event => { if (dragging) point(event); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
document.addEventListener('keydown', event => {
  if (event.target.matches('select, input, textarea, button')) return;
  const key = event.key.toLowerCase();
  if ('wasd'.includes(key) && key.length === 1) { event.preventDefault(); held.add(key); }
});
document.addEventListener('keyup', event => held.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { held.clear(); if (state.running && !state.paused) call('pause'); });
document.addEventListener('visibilitychange', () => { held.clear(); lastTime = undefined; if (document.hidden && state.running && !state.paused) call('pause'); });
$('start').addEventListener('click', () => { held.clear(); call('start', { direction: $('direction').value }); canvas.focus({ preventScroll: true }); });
$('reset').addEventListener('click', () => { held.clear(); call('reset'); });
$('pause').addEventListener('click', () => { held.clear(); call('pause'); canvas.focus({ preventScroll: true }); });
function frame(now) {
  if (command && lastTime !== undefined) call('update', { dt: Math.min((now - lastTime) / 1000, .1), dx: Number(held.has('d')) - Number(held.has('a')), dy: Number(held.has('s')) - Number(held.has('w')) });
  lastTime = now; draw(); requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe(canvas);
resize();
async function boot() {
  try {
    if (typeof loadPyodide !== 'function') throw new Error('Pyodide CDN unavailable');
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/' });
    const response = await fetch('./game.py');
    if (!response.ok) throw new Error(`game.py: ${response.status}`);
    await pyodide.runPythonAsync(await response.text());
    command = pyodide.globals.get('command');
    $('runtime').textContent = 'Python • Ready';
    $('start').disabled = false; $('reset').disabled = false;
    call('reset'); requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    $('runtime').textContent = '読み込みエラー';
    $('phase').textContent = '読み込めませんでした';
    $('message').textContent = '接続を確認して再読み込みしてください。ローカルでは uv run python serve.py で起動してください。';
  }
}
boot();
