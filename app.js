/* Input and UI only. Python owns simulation; Three.js owns the 3D scene. */
const canvas = document.querySelector('#arena');
const $ = (id) => document.getElementById(id);
let state = {x: 0, y: .72, target: null, telegraphs: [], angles: [], hits: [], resolved: 0, time: 0, phase: 'ready', paused: false, running: false};
let command, world, lastTime, held = new Set(), canvasPointer = null;
const cameraStick = new VirtualStick($('camera-stick'));
const moveStick = new VirtualStick($('move-stick'), () => call('stop'));
function clearInput() {
  held.clear();
  cameraStick.clear();
  moveStick.clear();
  const pointer = canvasPointer;
  canvasPointer = null;
  if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
}
function orbit(horizontal, vertical) {
  if (!world || (!horizontal && !vertical)) return;
  const top = world.orbit(horizontal, vertical);
  $('view').textContent = top ? '斜めから見る' : '真上から見る';
}
function call(action, payload = {}) {
  if (!command) return;
  state = JSON.parse(command(action, JSON.stringify(payload)));
  updateUI();
}
function draw() { if (world) world.draw(state); }
function resize() { if (world) {world.resize(); draw();} }
$('view').addEventListener('click', () => {
  const top = world.toggleView();
  $('view').textContent = top ? '斜めから見る' : '真上から見る';
  canvas.focus({preventScroll: true});
  draw();
});
$('camera-left').addEventListener('click', () => {world.rotate(-Math.PI / 4); canvas.focus({preventScroll: true}); draw();});
$('camera-right').addEventListener('click', () => {world.rotate(Math.PI / 4); canvas.focus({preventScroll: true}); draw();});
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
  if (!world) return;
  const target = world.point(event);
  if (target) call('target', target);
}
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (canvasPointer || !world || (event.button !== 0 && event.button !== 2)) return;
  event.preventDefault();
  const camera = event.pointerType === 'mouse' && (event.button === 2 || event.altKey);
  canvasPointer = {id: event.pointerId, camera, x: event.clientX, y: event.clientY};
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({preventScroll: true});
  if (!camera) point(event);
});
canvas.addEventListener('pointermove', event => {
  if (!canvasPointer || canvasPointer.id !== event.pointerId) return;
  if (canvasPointer.camera) {
    orbit(-(event.clientX - canvasPointer.x) * .008, (event.clientY - canvasPointer.y) * .008);
    canvasPointer.x = event.clientX;
    canvasPointer.y = event.clientY;
    draw();
  } else point(event);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, event => {
    if (canvasPointer?.id === event.pointerId) canvasPointer = null;
  });
}
document.addEventListener('keydown', event => {
  if (event.target.matches('select, input, textarea, button')) return;
  const key = event.key.toLowerCase();
  if ('wasd'.includes(key) && key.length === 1) { event.preventDefault(); held.add(key); }
});
document.addEventListener('keyup', event => held.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { clearInput(); if (state.running && !state.paused) call('pause'); });
document.addEventListener('visibilitychange', () => { clearInput(); lastTime = undefined; if (document.hidden && state.running && !state.paused) call('pause'); });
window.addEventListener('resize', clearInput);
$('start').addEventListener('click', () => { clearInput(); call('start', { direction: $('direction').value }); canvas.focus({ preventScroll: true }); });
$('reset').addEventListener('click', () => { clearInput(); call('reset'); });
$('pause').addEventListener('click', () => { clearInput(); call('pause'); canvas.focus({ preventScroll: true }); });
function frame(now) {
  if (command && lastTime !== undefined) {
    const dt = Math.min((now - lastTime) / 1000, .1);
    orbit(-cameraStick.x * dt * 1.8, cameraStick.y * dt * 1.2);
    const keyboardX = Number(held.has('d')) - Number(held.has('a'));
    const keyboardY = Number(held.has('s')) - Number(held.has('w'));
    const movement = world.movement(keyboardX || keyboardY ? keyboardX : moveStick.x,
      keyboardX || keyboardY ? keyboardY : moveStick.y);
    call('update', {dt, ...movement});
  }
  lastTime = now; draw(); requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe(canvas);
resize();
async function boot() {
  try {
    const { createArena } = await import('./renderer3d.js');
    world = createArena(canvas);
    resize();
    document.querySelectorAll('.camera-controls button').forEach(button => {button.disabled = false;});
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
    $('message').textContent = 'WebGL対応のブラウザと接続を確認して再読み込みしてください。ローカルでは uv run python serve.py で起動してください。';
  }
}
boot();
