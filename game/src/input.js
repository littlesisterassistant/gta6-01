'use strict';
/* Keyboard + mouse state. WASD/arrows move & drive, E enter/exit car,
   Space handbrake, F punch/shoot (or mouse click to shoot), P pause,
   R restart, M/Tab minimap toggle. */

const Input = {
  keys: {},
  pressed: {},
  mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  down(...codes) { return codes.some(c => this.keys[c]); },
  hit(...codes) { return codes.some(c => this.pressed[c]); },
  endFrame() { this.pressed = {}; this.mouseClicked = false; },
};
