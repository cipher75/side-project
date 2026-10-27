import { describe, expect, test } from "vitest";

import { DETOURS, DOOR_OUTSIDE, NO_GO, REPORT_SPOTS, SLOTS, WAYPOINTS, type Point } from "./layout";
import { crosses, route } from "./route";

const inside = (p: Point) => p.x > NO_GO.x0 && p.x < NO_GO.x1 && p.y > NO_GO.y0 && p.y < NO_GO.y1;

describe("보스 구역을 돌아가는 길", () => {
  test("직원이 서는 지점은 모두 보스 구역 바깥이다", () => {
    for (const p of [...WAYPOINTS, ...DETOURS, ...REPORT_SPOTS, ...SLOTS]) expect(inside(p), `${p.x},${p.y}`).toBe(false);
  });

  test("어느 지점 사이를 오가도 길이 보스 구역을 가로지르지 않는다", () => {
    const stops = [...WAYPOINTS, ...REPORT_SPOTS, ...SLOTS, DOOR_OUTSIDE];
    for (const from of stops) {
      for (const to of stops) {
        const path = route(from, to);
        expect(path[path.length - 1]).toEqual(to);
        let at = from;
        for (const next of path) {
          expect(crosses(at, next), `${from.x},${from.y} → ${to.x},${to.y}`).toBe(false);
          at = next;
        }
      }
    }
  });

  test("구역을 지나지 않는 길은 곧장 간다", () => {
    expect(route({ x: 52, y: 94 }, { x: 112, y: 142 })).toEqual([{ x: 112, y: 142 }]);
  });

  test("구역 건너편으로 갈 때는 위나 아래 통로로 돌아간다", () => {
    const path = route({ x: 112, y: 94 }, SLOTS[0]);
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => p.y <= NO_GO.y0 || p.y >= NO_GO.y1)).toBe(true);
  });
});
