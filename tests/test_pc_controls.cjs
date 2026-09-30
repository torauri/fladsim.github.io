const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the app's input wiring without needing a WebGL renderer or browser.
function surface() {
  const listeners = {}, captures = new Set();
  return {
    children: Array.from({length:4}, () => ({})),
    addEventListener(type, handler) {(listeners[type] ||= []).push(handler);},
    send(type, event={}) {for (const handler of listeners[type] || []) handler(event);},
    setPointerCapture:id=>captures.add(id),
    hasPointerCapture:id=>captures.has(id),
    releasePointerCapture:id=>captures.delete(id),
    focus(){}, value:'random'
  };
}
const elements = new Map();
const element = id => {if (!elements.has(id)) elements.set(id,surface());return elements.get(id);};
const document = surface(), window = surface();
document.getElementById = element;
document.querySelector = selector => element(selector.slice(1));
const orbitCalls = [], targets = [], actions = [];
let resets = 0;
const context = vm.createContext({document,window,console,
  VirtualStick: class {constructor(){this.x=this.y=0;}clear(){this.x=this.y=0;}},
  ResizeObserver: class {observe(){}}, requestAnimationFrame(){},
  fakeWorld:{orbit:(x,y)=>{orbitCalls.push([x,y]);return false;},draw(){},resetCamera(){resets++;}},
  targets, actions
});
const app = fs.readFileSync(require.resolve('../app.js'),'utf8').replace(/boot\(\);\s*$/, '');
vm.runInContext(app,context);
vm.runInContext('world=fakeWorld; command=(action,payload)=>{actions.push(action);if(action==="target") targets.push(JSON.parse(payload));return JSON.stringify(state);};', context);
const canvas = element('arena');
const event = (button, id, x, y, extra={}) => ({button,pointerId:id,clientX:x,clientY:y,pointerType:'mouse',preventDefault(){},...extra});
canvas.send('pointerdown',event(0,1,100,100));
canvas.send('pointermove',event(0,1,125,115));
assert.equal(targets.length,0,'Left drag must never set a movement destination');
assert.equal(orbitCalls.length,1);
assert.ok(orbitCalls[0][0]<0 && orbitCalls[0][1]>0,'Both camera axes must react to drag');
canvas.send('pointermove',event(2,2,200,200));
assert.equal(orbitCalls.length,1,'Unrelated pointers must not rotate the camera');
canvas.send('pointerup',event(2,1,125,115));
canvas.send('pointermove',event(2,1,150,150));
assert.equal(orbitCalls.length,1,'Released drag must stop rotating');
canvas.send('pointerdown',event(0,3,100,100));
canvas.send('pointermove',event(0,3,125,115));
assert.equal(targets.length,0,'Left drag must only rotate the camera');
assert.equal(orbitCalls.length,2);
canvas.send('pointercancel',event(0,3,125,115));
canvas.send('pointerdown',event(0,4,100,100,{altKey:true}));
canvas.send('pointermove',event(0,4,125,115,{altKey:true}));
assert.equal(orbitCalls.length,3,'Left drag with a modifier still rotates');
window.send('blur');
canvas.send('pointermove',event(0,4,150,150));
assert.equal(orbitCalls.length,3,'Blur must cancel any drag');
canvas.send('pointerdown',event(0,5,100,100,{pointerType:'touch'}));
canvas.send('pointermove',event(0,5,125,115,{pointerType:'touch'}));
assert.equal(orbitCalls.length,3,'Touching the field must not rotate or move the player');
assert.equal(targets.length,0);
canvas.send('pointerdown',event(2,6,100,100));
canvas.send('pointermove',event(2,6,125,115));
assert.equal(orbitCalls.length,3,'Right button no longer controls the camera');
element('view').textContent='斜めから見る';
element('start').send('click');
assert.equal(resets,1,'Starting a session must reset the camera');
assert.equal(element('view').textContent,'真上から見る');
assert.equal(actions.at(-1),'start');
element('start').send('click');
assert.equal(resets,2,'Restarting must also reset the camera');
console.log('PC input tests passed: left camera drag, no click/tap movement, pointer cancellation and camera reset on every start.');
