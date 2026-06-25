// Kleine Helfer
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sanftes Annähern eines Winkels (für Lenkung)
export function approachAngle(current, target, maxStep) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
