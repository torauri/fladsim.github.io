const assert = require('node:assert/strict');
const {stickVector, VirtualStick} = require('../controls.js');

assert.equal(stickVector(2, 0, 30).x, 0, 'Small thumb jitter must stay in the deadzone');
const full = stickVector(300, 400, 30);
assert.ok(Math.abs(Math.hypot(full.x, full.y) - 1) < 1e-12, 'Diagonal input must be capped');
assert.ok(Math.abs(Math.hypot(full.thumbX, full.thumbY) - 30) < 1e-12, 'Thumb must stay within the stick');
assert.ok(stickVector(15, 0, 30).x < 1, 'Partial deflection must allow slow movement');

function element() {
  const listeners = {}, captured = new Set();
  const thumb = {offsetWidth:32, style:{}};
  const classes = new Set();
  return {
    thumb, classes,
    querySelector: () => thumb,
    addEventListener: (type, fn) => {listeners[type] = fn;},
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
    getBoundingClientRect: () => ({left:0,top:0,width:88,height:88}),
    classList: {add:name=>classes.add(name), remove:name=>classes.delete(name)},
    send(type, id, x=44, y=44) {listeners[type]({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});}
  };
}
const leftElement = element(), rightElement = element();
let started = 0;
const camera = new VirtualStick(leftElement), movement = new VirtualStick(rightElement, () => started++);
leftElement.send('pointerdown', 1, 80, 44);
rightElement.send('pointerdown', 2, 44, 8);
assert.equal(camera.x, 1);
assert.equal(movement.y, -1, 'Two different fingers must control both sticks simultaneously');
rightElement.send('pointermove', 1, 80, 44);
assert.equal(movement.y, -1, 'A stick must ignore the other finger');
leftElement.send('pointerup', 1);
assert.equal(camera.x, 0);
assert.equal(movement.y, -1, 'Releasing the camera must not release movement');
rightElement.send('pointercancel', 2);
assert.equal(movement.y, 0);
assert.equal(movement.pointer, null);
assert.equal(rightElement.thumb.style.transform, '');
rightElement.send('pointerdown', 3, 80, 44);
rightElement.send('lostpointercapture', 3);
assert.equal(movement.x, 0, 'Losing capture must stop movement');
rightElement.send('pointerdown', 4, 80, 44);
movement.clear();
assert.equal(movement.x, 0, 'Pause, reset or blur must clear input');
assert.equal(started, 3);
console.log('Virtual stick tests passed: deadzone, analog input, clamping, multitouch, release and cancellation.');
