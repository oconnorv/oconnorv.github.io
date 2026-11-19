import { clamp } from './util.js';

// If a circle overlaps a rectangle, return the direction to push it out (nx, ny) and by how much (pen).
export function circleRect(cx, cy, r, x, y, w, h) {
  const px = clamp(cx, x, x + w);
  const py = clamp(cy, y, y + h);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, pen: r - d, corner: dx !== 0 && dy !== 0 };
  }
  // Centre is inside the rectangle: leave through the nearest side.
  const left = cx - x, right = x + w - cx, top = cy - y, bottom = y + h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === bottom) return { nx: 0, ny: 1, pen: bottom + r, corner: false };
  if (m === top) return { nx: 0, ny: -1, pen: top + r, corner: false };
  if (m === left) return { nx: -1, ny: 0, pen: left + r, corner: false };
  return { nx: 1, ny: 0, pen: right + r, corner: false };
}

// Bounce the ball's direction off a surface with normal (nx, ny). Returns true if it was moving into it.
export function reflect(ball, nx, ny) {
  const dot = ball.dx * nx + ball.dy * ny;
  if (dot >= 0) return false;
  ball.dx -= 2 * dot * nx;
  ball.dy -= 2 * dot * ny;
  return true;
}

// Keep the direction a unit vector, and never let the ball travel almost sideways.
export function normalizeDir(ball, minDy) {
  let { dx, dy } = ball;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  if (Math.abs(dy) < minDy) {
    const sy = dy > 0 ? 1 : -1;
    dy = sy * minDy;
    dx = (dx < 0 ? -1 : 1) * Math.sqrt(1 - minDy * minDy);
  }
  ball.dx = dx;
  ball.dy = dy;
}
