import { DETOURS, NO_GO, WAYPOINTS, type Point } from "./layout";

type Rect = { x0: number; x1: number; y0: number; y1: number };

// 선분 a→b가 사각형 안을 지나는지(Liang–Barsky). 모서리를 스치기만 하면 지나지 않은 것으로 본다.
export function crosses(a: Point, b: Point, r: Rect = NO_GO): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [[-dx, a.x - r.x0], [dx, r.x1 - a.x], [-dy, a.y - r.y0], [dy, r.y1 - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t1 - t0 > 1e-6;
}

// 보스 구역을 가로지르지 않는 가장 짧은 길. 지나갈 지점들을 순서대로 돌려주며 마지막이 목적지다.
// 지점이 십여 개뿐이라 다익스트라를 그대로 돈다.
export function route(from: Point, to: Point): Point[] {
  if (!crosses(from, to)) return [to];
  const nodes = [from, ...WAYPOINTS, ...DETOURS, to];
  const last = nodes.length - 1;
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === last) break;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v] || crosses(nodes[u], nodes[v])) continue;
      const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  // 출발점이 구역 안이라 길이 없으면 곧장 간다.
  if (prev[last] < 0) return [to];
  const path: Point[] = [];
  for (let v = last; v > 0; v = prev[v]) path.unshift(nodes[v]);
  return path;
}
