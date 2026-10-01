/* Shared pointer math; no simulation or rendering here. */
function stickVector(dx, dy, radius, deadzone = .12) {
  const length = Math.hypot(dx, dy);
  const limit = Math.max(1, radius);
  const visualScale = length > limit ? limit / length : 1;
  const amount = Math.min(length / limit, 1);
  const strength = amount > deadzone ? (amount - deadzone) / (1 - deadzone) : 0;
  return {
    x: strength ? dx / length * strength : 0,
    y: strength ? dy / length * strength : 0,
    thumbX: dx * visualScale,
    thumbY: dy * visualScale
  };
}

class VirtualStick {
  constructor(element, onStart = () => {}) {
    this.element = element;
    this.thumb = element.querySelector('.stick-thumb');
    this.pointer = null;
    this.x = this.y = 0;
    element.addEventListener('pointerdown', event => {
      if (this.pointer !== null || event.button !== 0) return;
      event.preventDefault();
      this.pointer = event.pointerId;
      element.setPointerCapture(event.pointerId);
      element.classList.add('active');
      onStart();
      this.update(event);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointer) return;
      event.preventDefault();
      this.update(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, event => {
        if (event.pointerId === this.pointer) this.clear();
      });
    }
  }
  update(event) {
    const bounds = this.element.getBoundingClientRect();
    const radius = (bounds.width - this.thumb.offsetWidth) / 2 - 4;
    const vector = stickVector(event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2, radius);
    this.x = vector.x;
    this.y = vector.y;
    this.thumb.style.transform = `translate(${vector.thumbX}px, ${vector.thumbY}px)`;
  }
  clear() {
    const pointer = this.pointer;
    this.pointer = null;
    this.x = this.y = 0;
    this.thumb.style.transform = '';
    this.element.classList.remove('active');
    if (pointer !== null && this.element.hasPointerCapture(pointer)) this.element.releasePointerCapture(pointer);
  }
}

class GamepadInput {
  constructor(read = () => typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []) {
    this.read=read;this.index=null;this.previous=[];this.connected=false;
  }
  poll(enabled=true) {
    let pads=[];
    try { pads=Array.from(this.read() || []).filter(p=>p && p.connected); } catch {}
    const pad=pads.find(p=>p.index===this.index) || pads[0];
    const disconnected=this.connected&&!pad;
    const result={moveX:0,moveY:0,cameraX:0,cameraY:0,actions:[],disconnected,status:'none'};
    if(!pad) {this.index=null;this.previous=[];this.connected=false;return result;}
    const changed=!this.connected || this.index!==pad.index;
    this.connected=true;this.index=pad.index;
    const buttons=Array.from(pad.buttons || [],b=>Boolean(b?.pressed));
    result.status=pad.mapping==='standard'?'connected':'unsupported';
    if(enabled && !changed && pad.mapping==='standard') {
      for(const [index,action] of [[9,'start'],[0,'pause'],[8,'reset']]) {
        if(buttons[index]&&!this.previous[index]) result.actions.push(action);
      }
    }
    this.previous=buttons;
    if(enabled && pad.mapping==='standard') {
      const axis=i=>Number.isFinite(pad.axes?.[i])?Math.max(-1,Math.min(1,pad.axes[i])):0;
      const move=stickVector(axis(0)*100,axis(1)*100,100,.18);
      const camera=stickVector(axis(2)*100,axis(3)*100,100,.18);
      Object.assign(result,{moveX:move.x,moveY:move.y,cameraX:camera.x,cameraY:camera.y});
    }
    return result;
  }
}

// Make input logic testable with Node and usable as a classic browser script.
if (typeof module !== 'undefined') module.exports = { stickVector, VirtualStick, GamepadInput };
