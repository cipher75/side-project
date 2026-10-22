import { describe, expect, test } from "vitest";

import { DOOR, SLOTS } from "./layout";
import { SceneEngine, type SceneCharacter } from "./scene-engine";

const work = (id: string, label = `Read · ${id}`): SceneCharacter => ({
  id, kind: "tool", status: "working", label,
});
const waiting = (id: string): SceneCharacter => ({ ...work(id), status: "waiting" });
const denied = (id: string): SceneCharacter => ({ ...work(id), status: "denied" });

// 난수를 순환하는 고정 수열로 바꿔 움직임을 예측할 수 있게 한다.
function engine() {
  let n = 0;
  return new SceneEngine(() => (n = (n + 0.21) % 1));
}

function run(e: SceneEngine, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) e.step(0.05);
}

function walker(e: SceneEngine, id: string) {
  const w = e.walkers.find((x) => x.id === id);
  if (!w) throw new Error(`walker ${id} not found`);
  return w;
}

describe("수행 중", () => {
  test("새 호출은 출입문에서 나타나 사무실 안쪽으로 걸어 들어간다", () => {
    const e = engine();
    e.sync([work("a")], true);

    expect(walker(e, "a")).toMatchObject({ x: DOOR.x, y: DOOR.y, bubble: "work", label: "Read · a" });
    run(e, 1);
    expect(walker(e, "a").y).toBeLessThan(DOOR.y);
    expect(walker(e, "a").moving).toBe(true);
  });

  test("일하는 캐릭터는 가만히 서 있지 않고 계속 돌아다닌다", () => {
    const e = engine();
    e.sync([work("a")], true);
    run(e, 8);
    const first = { x: walker(e, "a").x, y: walker(e, "a").y };

    let moved = false;
    for (let i = 0; i < 400 && !moved; i++) {
      e.step(0.05);
      moved = walker(e, "a").moving && (walker(e, "a").x !== first.x || walker(e, "a").y !== first.y);
    }
    expect(moved).toBe(true);
  });

  test("호출이 끝나 목록에서 빠진 캐릭터는 출입문으로 나가 사라진다", () => {
    const e = engine();
    e.sync([work("a")], true);
    run(e, 6);

    e.sync([], true);
    run(e, 15);

    expect(e.walkers).toEqual([]);
  });
});

describe("허용 대기", () => {
  test("허용 대기 캐릭터는 회의실 자리로 가서 멈추고 의아한 표정으로 ? 말풍선을 띄운다", () => {
    const e = engine();
    e.sync([work("a")], true);
    run(e, 5);
    e.sync([waiting("a")], true);
    run(e, 12);

    expect(walker(e, "a")).toMatchObject({
      x: SLOTS[0].x, y: SLOTS[0].y, bubble: "ask", expr: "confused", moving: false,
    });
  });

  test("허용 대기 캐릭터가 여럿이면 서로 다른 자리에 선다", () => {
    const e = engine();
    e.sync([waiting("a"), waiting("b")], true);
    run(e, 15);

    const spots = new Set(e.walkers.map((w) => `${w.x},${w.y}`));
    expect(spots.size).toBe(2);
  });

  test("다시 일하는 상태가 되면 회의실에서 나와 돌아다닌다", () => {
    const e = engine();
    e.sync([waiting("a")], true);
    run(e, 15);

    e.sync([work("a")], true);
    run(e, 2);

    expect(walker(e, "a")).toMatchObject({ bubble: "work", expr: "happy", moving: true });
  });
});

describe("허용 거절", () => {
  test("거절된 캐릭터는 슬픈 표정으로 회의실에서 나와 출입문으로 퇴근한다", () => {
    const e = engine();
    e.sync([waiting("a")], true);
    run(e, 15);

    e.sync([denied("a")], true);
    expect(walker(e, "a")).toMatchObject({ expr: "sad", bubble: "sad" });
    run(e, 3);
    expect(walker(e, "a").x).toBeLessThan(SLOTS[0].x);

    run(e, 15);
    expect(e.walkers).toEqual([]);
  });

  test("퇴근한 캐릭터는 서버 목록에 거절 상태로 남아 있어도 다시 나타나지 않는다", () => {
    const e = engine();
    e.sync([waiting("a")], true);
    run(e, 15);
    e.sync([denied("a")], true);
    run(e, 20);

    e.sync([denied("a")], true);
    expect(e.walkers).toEqual([]);
  });
});

describe("사무실 불", () => {
  test("서버가 불을 켜면 바로 켜진다", () => {
    const e = engine();
    e.sync([], true);
    e.step(0.05);

    expect(e.lit).toBe(true);
  });

  test("캐릭터가 모두 나가고 서버도 불을 끄면 잠시 뒤에 꺼진다", () => {
    const e = engine();
    e.sync([work("a")], true);
    run(e, 5);
    e.sync([], false);
    run(e, 15);
    expect(e.walkers).toEqual([]);

    run(e, 3);
    expect(e.lit).toBe(false);
  });

  test("캐릭터가 사무실에 남아 있으면 서버가 불을 꺼도 켜져 있다", () => {
    const e = engine();
    e.sync([work("a")], true);
    run(e, 5);
    e.sync([work("a")], false);
    run(e, 5);

    expect(e.lit).toBe(true);
  });

  test("꺼진 뒤 새 호출이 들어오면 다시 켜진다", () => {
    const e = engine();
    e.sync([], false);
    run(e, 3);
    expect(e.lit).toBe(false);

    e.sync([work("a")], true);
    e.step(0.05);
    expect(e.lit).toBe(true);
  });
});
