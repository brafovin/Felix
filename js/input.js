// Tastatur + Maus
export const keys = {};
export const mouse = { dx: 0, dy: 0, down: false, locked: false };

const justPressed = new Set();

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!keys[k]) justPressed.add(k);
    keys[k] = true;
    // Verhindert Scrollen mit Leertaste / Pfeilen
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });

  canvas.addEventListener('click', () => {
    if (!mouse.locked) canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (mouse.locked) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
  });
}

// true nur im ersten Frame nach Drücken
export function pressed(key) {
  return justPressed.has(key.toLowerCase());
}

// am Ende jedes Frames aufrufen
export function consumeInput() {
  mouse.dx = 0;
  mouse.dy = 0;
  justPressed.clear();
}
