/* Shared pointer math; no simulation or rendering here. */
function stickVector(dx, dy, radius, deadzone = .12) {
  const length = Math.hypot(dx, dy);
  const limit = Math.max(1, radius);
  const visualScale = length > limit ? limit / length : 1;
  const amount = Math.min(length / limit, 1);
  const strength = amount > deadzone ? (amount - deadzone) / (1 - deadzone) : 0;
  return {
    x: length ? dx / length * strength : 0,
    y: length ? dy / length * strength : 0,
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

// Make the math testable with Node while loading this file as a classic browser script.
if (typeof module !== 'undefined') module.exports = { stickVector, VirtualStick };
