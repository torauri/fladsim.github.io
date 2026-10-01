/* Input and UI only. Python owns simulation; Three.js owns the 3D scene. */
const canvas = document.querySelector('#arena');
const $ = (id) => document.getElementById(id);
const isThreeStars = document.body?.dataset.simulator === 'three-stars';
const isExa = document.body?.dataset.simulator === 'exa';
let state = {x: 0, y: .72, telegraphs: [], angles: [], hits: [], resolved: 0, time: 0, phase: 'ready', paused: false, running: false};
let command, world, lastTime, held = new Set(), canvasPointer = null;
const cameraStick = new VirtualStick($('camera-stick'));
const moveStick = new VirtualStick($('move-stick'));
const gamepadInput = new GamepadInput();
let gamepadFocused = true;
function pollGamepad() {
  const input=gamepadInput.poll(gamepadFocused && !document.hidden);
  const label=$('gamepad-status');
  const message=input.status==='connected'
    ? 'コントローラー接続中：左＝移動／右＝カメラ／START・OPTIONS＝開始／A・×＝一時停止／BACK・SHARE＝リセット'
    : input.status==='unsupported'?'コントローラーを検出しましたが、標準ボタン配置に対応していません。'
    : 'コントローラー：接続してボタンを押すと認識します。';
  if(label && label.textContent!==message) label.textContent=message;
  if(input.disconnected && state.running && !state.paused) call('pause');
  for(const action of input.actions.slice(0,1)) {
    const button=$(action);
    if(button && !button.disabled) button.click();
  }
  return input;
}
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
  if (isExa) return updateExaUI();
  if (isThreeStars) return updateThreeStarsUI();
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
function updateExaUI() {
  const messages={ready:['準備完了','円が通過した直後の場所へ移動しましょう。'],countdown:[`開始まで ${state.countdown}`,'北西・北東からの円を確認しましょう。'],warning:['最初の円を確認','矢印の方向へ円が連続して進みます。'],attack:['エクサを回避',`着弾 ${state.resolved} / ${state.total}。爆発した円の跡へ移動しましょう。`],result:[state.hits.length?'練習終了：被弾あり':'回避成功！',`全 ${state.total} 回の着弾が終了しました。`]};
  const [title,message]=messages[state.phase];
  $('phase').textContent=state.paused?'一時停止中':title;
  $('message').textContent=state.paused?'再開すると同じ位置・時間から続けます。':message;
  $('seconds').textContent=state.time.toFixed(1).padStart(4,'0');
  $('hit-count').textContent=`被弾 ${state.hits.length}`;
  $('start').innerHTML=(state.started?'もう一度はじめる':'練習をはじめる')+'<span>→</span>';
  $('pause').disabled=!state.running;$('pause').textContent=state.paused?'再開':'一時停止';
  $('countdown-overlay').hidden=state.phase!=='countdown';$('countdown-overlay').textContent=state.countdown;
  const latest=state.patterns.at(-1);
  $('pattern-status').textContent=latest?`予兆 ${latest.wave} / 6：${latest.axis==='vertical'?'縦':'横'}・パターン${latest.pattern+1}`:'縦横縦横縦横・計6回';
}
function updateThreeStarsUI() {
  const elements = {fire:'炎',lightning:'雷',ice:'氷'};
  const effect = {earth:'土：中心円範囲',wind:'風：外周ドーナツ範囲'};
  const messages = {
    ready:['準備完了','WASD／右スティックで移動。スタートで3カウントを開始します。'],
    countdown:['開始まで ' + state.countdown,'カウント終了後にデバフが決まります。'],
    preparation:['デバフを確認', '3秒後に最初の塔が光ります。'],
    towers:[`フェーズ ${state.wave} / 3`, `判定まで ${state.remaining.toFixed(1)} 秒。光った塔に入り、ボスの攻撃を避けましょう。`],
    result:[state.hits.length?'練習終了：失敗あり':'3フェーズ成功！',state.hits.length?`${state.hits.length} フェーズで失敗。結果を確認して再挑戦できます。`:'すべての塔とボス攻撃を正しく処理できました。']
  };
  const [title,message] = messages[state.phase];
  $('phase').textContent = state.paused?'一時停止中':title;
  $('message').textContent = state.paused?'再開すると同じ時間・位置から続けます。':message;
  $('seconds').textContent=state.time.toFixed(1).padStart(4,'0');
  $('hit-count').textContent=`失敗 ${state.hits.length}`;
  $('start').innerHTML=(state.started?'もう一度はじめる':'練習をはじめる')+'<span>→</span>';
  $('pause').disabled=!state.running;
  $('pause').textContent=state.paused?'再開':'一時停止';
  $('debuff-status').textContent=!state.debuff_assigned?'デバフ：未付与':state.debuff?`デバフ：${elements[state.debuff]}耐性低下`:'デバフ：なし（無職）';
  $('debuff-status').dataset.element=state.debuff || 'none';
  $('boss-status').textContent=state.boss_effect?effect[state.boss_effect]:'ボス：攻撃エフェクトなし';
  $('boss-status').dataset.effect=state.boss_effect || 'none';
  $('countdown-overlay').textContent=state.phase==='countdown'?state.countdown:'';
  $('countdown-overlay').hidden=state.phase!=='countdown';
  [...$('steps').children].forEach((el,i)=>{el.className=state.hits.includes(i)?'hit':state.resolved>i?'done':state.wave===i+1&&state.phase==='towers'?'shown':'';});
  const reasons={no_tower:'塔に入っていない',wrong_tower:'違う塔に入った',earth:'土攻撃に被弾',wind:'風攻撃に被弾'};
  $('wave-results').textContent=state.results.map(r=>`フェーズ${r.wave}：${r.success?'成功':r.reasons.map(reason=>reasons[reason]).join('・')}`).join('\n');
}
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (canvasPointer || !world || event.pointerType !== 'mouse' || event.button !== 0) return;
  event.preventDefault();
  canvasPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({preventScroll: true});
});
canvas.addEventListener('pointermove', event => {
  if (!canvasPointer || canvasPointer.id !== event.pointerId) return;
  orbit(-(event.clientX - canvasPointer.x) * .008, (event.clientY - canvasPointer.y) * .008);
  canvasPointer.x = event.clientX;
  canvasPointer.y = event.clientY;
  draw();
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
window.addEventListener('blur', () => { gamepadFocused=false;clearInput(); if (state.running && !state.paused) call('pause'); });
window.addEventListener('focus', () => { gamepadFocused=true; });
document.addEventListener('visibilitychange', () => { clearInput(); lastTime = undefined; if (document.hidden && state.running && !state.paused) call('pause'); });
window.addEventListener('resize', clearInput);
$('start').addEventListener('click', () => {
  clearInput();
  world.resetCamera();
  $('view').textContent = '真上から見る';
  call('start', isExa ? {} : isThreeStars ? {debuff:$('debuff-choice').value,attack:$('attack-choice').value} : { direction: $('direction').value });
  canvas.focus({ preventScroll: true });
  draw();
});
$('reset').addEventListener('click', () => { clearInput(); call('reset'); });
$('pause').addEventListener('click', () => { clearInput(); call('pause'); canvas.focus({ preventScroll: true }); });
function frame(now) {
  const pad=command?pollGamepad():{moveX:0,moveY:0,cameraX:0,cameraY:0};
  if (command && lastTime !== undefined) {
    const dt = Math.min((now - lastTime) / 1000, .1);
    const touchCamera=cameraStick.x || cameraStick.y;
    orbit(-(touchCamera?cameraStick.x:pad.cameraX) * dt * 1.8, (touchCamera?cameraStick.y:pad.cameraY) * dt * 1.2);
    const keyboardX = Number(held.has('d')) - Number(held.has('a'));
    const keyboardY = Number(held.has('s')) - Number(held.has('w'));
    const touchMoving=moveStick.x || moveStick.y;
    const movement = world.movement(keyboardX || keyboardY ? keyboardX : touchMoving?moveStick.x:pad.moveX,
      keyboardX || keyboardY ? keyboardY : touchMoving?moveStick.y:pad.moveY);
    call('update', {dt, ...movement});
  }
  lastTime = now; draw(); requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe(canvas);
resize();
async function boot() {
  try {
    const { createArena } = await import('./renderer3d.js');
    world = createArena(canvas, {mode:isExa?'exa':'default'});
    resize();
    document.querySelectorAll('.camera-controls button').forEach(button => {button.disabled = false;});
    if (typeof loadPyodide !== 'function') throw new Error('Pyodide CDN unavailable');
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/' });
    if (isThreeStars || isExa) {
      const dependency = await fetch('./game.py');
      if (!dependency.ok) throw new Error(`game.py: ${dependency.status}`);
      pyodide.FS.writeFile('game.py',await dependency.text());
    }
    const pythonFile=isExa?'exa.py':isThreeStars?'three_stars.py':'game.py';
    const response = await fetch('./'+pythonFile);
    if (!response.ok) throw new Error(`${pythonFile}: ${response.status}`);
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
