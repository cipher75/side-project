import type { CharacterKind, CharacterStatus } from "../types";
import { BOSS_EXIT, BOSS_SEAT, DOOR, DOOR_OUTSIDE, REPORT_SPOTS, SLOTS, WALK_SPEED, WAYPOINTS, type Point } from "./layout";
import { route } from "./route";

// 서버가 알려 준 캐릭터 목록을 화면 속 움직임으로 옮기는 엔진. DOM과 canvas를 모른다.

export type SceneCharacter = {
  id: string;
  kind: CharacterKind;
  status: CharacterStatus;
  label: string;
};

export type Expression = "happy" | "confused" | "sad" | "plain";
export type BubbleStyle = "work" | "ask" | "sad" | "glad" | "stop" | "done";

export type Walker = {
  id: string;
  kind: CharacterKind;
  label: string;
  x: number;
  y: number;
  flip: 1 | -1;
  expr: Expression;
  bubble: BubbleStyle;
  frame: number;
  moving: boolean;
  fading: boolean;
  // 보스 책상 옆에서 결재받는 중. 말풍선이 보스를 가리지 않게 보스 반대쪽으로 펼친다.
  reporting: boolean;
};

// 보스의 모습: 직원이 일하는 동안 생각에 잠기고(think), 결재할 때 도장을 들고(approve),
// 허용 대기가 생기면 회의실을 보며 의아해한다(confused). 직원이 없어도 턴이 진행 중이면 생각에 잠기고,
// 턴이 끝나 퇴근할 때는 담담하다(plain).
export type BossPose = "think" | "approve" | "confused" | "plain";

export type Boss = {
  x: number;
  y: number;
  seated: boolean;
  pose: BossPose;
  flip: 1 | -1;
  frame: number;
  moving: boolean;
  fading: boolean;
};

type Phase = "to-work" | "idle" | "to-wait" | "waiting" | "sad" | "glad" | "stop" | "to-report" | "reporting" | "leaving";

type Mover = {
  x: number;
  y: number;
  flip: 1 | -1;
  frame: number;
  moving: boolean;
  path: Point[];
  frameTime: number;
};

type Internal = Walker &
  Mover & {
    phase: Phase;
    pause: number;
    slot: number;
    spot: number;
    fadeTime: number;
    // 일을 마친 뒤 사무실을 더 돌아다닐 남은 시간(초). 음수면 아직 일하는 중이다.
    linger: number;
  };

type BossState = Boss & Mover & { phase: "seated" | "leaving" | "returning" | "gone"; fadeTime: number };

const LIGHTS_OFF_DELAY = 1.5;
const FADE_OUT = 0.4;
const SAD_PAUSE = 1.2;
const GLAD_PAUSE = 1.2;
const STOP_PAUSE = 1.2;
const REPORT_PAUSE = 1.4;
const REPORT_RETRY = 0.5;
const FRAME_TIME = 0.17;
// 일을 마친 캐릭터가 바로 나가지 않고 더 돌아다니는 시간. 짧은 호출도 화면에서 볼 수 있게 한다.
const LINGER = 3;

export class SceneEngine {
  private items: Internal[] = [];
  private departed = new Set<string>();
  private serverLit = false;
  private emptyTime = 0;
  private synced = false;
  private chief: BossState = {
    x: BOSS_SEAT.x,
    y: BOSS_SEAT.y,
    seated: true,
    pose: "plain",
    flip: 1,
    frame: 0,
    moving: false,
    fading: false,
    path: [],
    frameTime: 0,
    phase: "gone",
    fadeTime: 0,
  };
  lit = false;

  constructor(private readonly rng: () => number = Math.random) {}

  get walkers(): Walker[] {
    return this.items;
  }

  // 사무실에 보스가 없으면(첫 업무 전, 퇴근 뒤) null.
  get boss(): Boss | null {
    return this.chief.phase === "gone" ? null : this.chief;
  }

  sync(characters: SceneCharacter[], serverLit: boolean): void {
    this.serverLit = serverLit;
    // 장면을 처음 맞출 때 이미 있던 캐릭터는 새로 들어온 것이 아니므로 제자리에 바로 세운다.
    const placed = !this.synced;
    this.synced = true;
    const ids = new Set(characters.map((c) => c.id));
    this.departed.forEach((id) => {
      if (!ids.has(id)) this.departed.delete(id);
    });

    for (const character of characters) {
      if (this.departed.has(character.id)) continue;
      const walker = this.items.find((w) => w.id === character.id);
      if (walker) {
        walker.linger = -1;
        this.update(walker, character);
      }
      else this.spawn(character, placed);
    }
    for (const walker of this.items) {
      if (!ids.has(walker.id)) this.finish(walker);
    }
    if (serverLit || this.items.length > 0) this.turnOn();
    this.chief.pose = this.bossPose();
  }

  step(dt: number): void {
    for (const w of [...this.items]) this.advance(w, dt);

    if (this.serverLit || this.items.length > 0) this.turnOn();
    else if (this.chief.phase === "seated") this.bossLeaves();
    this.advanceBoss(dt);
    this.chief.pose = this.bossPose();
    // 보스까지 퇴근한 뒤에 불이 꺼진다.
    if (!this.lit || this.chief.phase !== "gone") return;
    this.emptyTime += dt;
    if (this.emptyTime >= LIGHTS_OFF_DELAY) this.lit = false;
  }

  private turnOn() {
    this.lit = true;
    this.emptyTime = 0;
    const b = this.chief;
    // 퇴근하던 보스는 왔던 길을 되짚어 걸어서 자리로 돌아간다.
    if (b.phase === "leaving" && !b.fading) {
      const exit = BOSS_EXIT[BOSS_EXIT.length - 1];
      b.path = [...route(b, exit), ...BOSS_EXIT.slice(0, -1).reverse(), BOSS_SEAT];
      b.phase = "returning";
      b.moving = true;
    } else if (b.phase === "gone" || b.phase === "leaving") {
      // 이미 문을 나섰거나 나서는 중이면 화면에 없으므로, 처음처럼 자리에 앉혀 둔다.
      Object.assign(b, { ...BOSS_SEAT, seated: true, moving: false, fading: false, path: [], phase: "seated", fadeTime: 0 });
    }
  }

  private bossLeaves() {
    const b = this.chief;
    b.seated = false;
    b.phase = "leaving";
    b.path = [...BOSS_EXIT, ...route(BOSS_EXIT[BOSS_EXIT.length - 1], DOOR_OUTSIDE)];
    b.moving = true;
  }

  private advanceBoss(dt: number) {
    const b = this.chief;
    if (b.phase === "returning") {
      if (this.move(b, dt)) Object.assign(b, { ...BOSS_SEAT, seated: true, flip: 1, phase: "seated" });
      return;
    }
    if (b.phase !== "leaving") return;
    if (b.fading) {
      b.fadeTime += dt;
      if (b.fadeTime >= FADE_OUT) b.phase = "gone";
      return;
    }
    if (this.move(b, dt)) b.fading = true;
  }

  private bossPose(): BossPose {
    const phases = new Set(this.items.map((w) => w.phase));
    if (phases.has("to-wait") || phases.has("waiting")) return "confused";
    if (phases.has("reporting")) return "approve";
    if (phases.has("to-work") || phases.has("idle") || phases.has("to-report")) return "think";
    // 직원이 없어도 서버가 불을 켜 두었으면 턴이 진행 중이다. Claude가 다음 일을 생각하는 중이다.
    if (this.serverLit) return "think";
    return "plain";
  }

  private spawn(character: SceneCharacter, placed = false) {
    const walker: Internal = {
      id: character.id,
      kind: character.kind,
      label: character.label,
      x: DOOR.x,
      y: DOOR.y,
      flip: 1,
      expr: "happy",
      bubble: "work",
      frame: 0,
      moving: false,
      fading: false,
      reporting: false,
      phase: "to-work",
      path: [],
      pause: 0,
      slot: -1,
      spot: -1,
      frameTime: 0,
      fadeTime: 0,
      linger: -1,
    };
    this.items.push(walker);
    this.update(walker, character, true);
    if (placed && walker.moving) {
      const goal = walker.path[walker.path.length - 1];
      walker.x = goal.x;
      walker.y = goal.y;
      walker.path = [];
      walker.moving = false;
      this.arrive(walker);
    }
  }

  private update(w: Internal, c: SceneCharacter, isNew = false) {
    w.label = c.label;
    if (c.status === "waiting" && w.phase !== "to-wait" && w.phase !== "waiting") this.goWait(w);
    else if (c.status === "denied" && w.phase !== "sad" && w.phase !== "leaving") this.startSad(w);
    else if (c.status === "approved" && !["glad", "to-report", "reporting", "leaving"].includes(w.phase)) this.startGlad(w);
    else if (c.status === "cancelled" && w.phase !== "stop" && w.phase !== "leaving") this.startStop(w);
    else if (c.status === "working" && (isNew || w.phase === "to-wait" || w.phase === "waiting")) this.goWork(w);
  }

  // 서버 목록에서 빠진 캐릭터. 일하다 끝난 직원은 3초쯤 더 돌아다닌 뒤 보스에게 결재를 받고 나가고,
  // 허용 여부를 모른 채 빠진 허용 대기 캐릭터는 ?만 지우고 바로 나간다.
  private finish(w: Internal) {
    if (w.linger >= 0) return;
    if (w.phase === "to-work" || w.phase === "idle") w.linger = LINGER;
    else if (w.phase === "to-wait" || w.phase === "waiting") this.leave(w);
  }

  private goWork(w: Internal) {
    w.expr = "happy";
    w.bubble = "work";
    w.slot = -1;
    this.walkTo(w, this.pickWaypoint(w), "to-work");
  }

  private goWait(w: Internal) {
    w.expr = "confused";
    w.bubble = "ask";
    w.spot = -1;
    // 회의실 자리가 모두 차면 첫 자리에 겹쳐서라도 선다. ?가 보이지 않는 것보다 낫다.
    w.slot = Math.max(0, this.freeIndex(SLOTS.length, w, "slot"));
    this.walkTo(w, SLOTS[w.slot], "to-wait");
  }

  // 결재 자리로 간다. 자리가 모두 차 있으면 false를 돌려주고, 부른 쪽이 잠시 뒤 다시 시도한다.
  private goReport(w: Internal): boolean {
    w.expr = "happy";
    if (w.bubble !== "glad") w.bubble = "done";
    const spot = this.freeIndex(REPORT_SPOTS.length, w, "spot");
    if (spot < 0) return false;
    w.slot = -1;
    w.linger = -1;
    w.spot = spot;
    this.walkTo(w, REPORT_SPOTS[spot], "to-report");
    return true;
  }

  private startSad(w: Internal) {
    this.pauseWith(w, "sad", "sad", "sad", SAD_PAUSE);
  }

  // 거절은 아니지만 실행되지 않고 끝난 호출(중단, 만료 등). 담담한 표정으로 잠깐 멈췄다가 나간다.
  private startStop(w: Internal) {
    this.pauseWith(w, "stop", "plain", "stop", STOP_PAUSE);
  }

  private startGlad(w: Internal) {
    this.pauseWith(w, "glad", "happy", "glad", GLAD_PAUSE);
  }

  private pauseWith(w: Internal, phase: Phase, expr: Expression, bubble: BubbleStyle, pause: number) {
    w.expr = expr;
    w.bubble = bubble;
    w.slot = -1;
    w.spot = -1;
    w.reporting = false;
    w.moving = false;
    w.path = [];
    w.pause = pause;
    w.phase = phase;
  }

  private leave(w: Internal) {
    // 허용 여부를 모른 채 나가는 경우(세션 종료 등)에는 ?를 지우고 평소 모습으로 나간다.
    if (w.bubble === "ask") {
      w.expr = "happy";
      w.bubble = "work";
    }
    w.slot = -1;
    w.spot = -1;
    w.linger = -1;
    this.walkTo(w, DOOR_OUTSIDE, "leaving");
  }

  // 보스 구역을 돌아가는 길을 따라 걷는다.
  private walkTo(w: Internal, goal: Point, phase: Phase) {
    w.reporting = false;
    w.path = route(w, goal);
    w.phase = phase;
    w.moving = true;
  }

  private advance(w: Internal, dt: number) {
    if (w.linger >= 0) {
      w.linger -= dt;
      // 결재 자리가 비기를 기다리며 조금 더 돌아다닌다.
      if (w.linger < 0 && !this.goReport(w)) w.linger = REPORT_RETRY;
    }
    if (w.phase === "idle") {
      w.pause -= dt;
      if (w.pause <= 0) this.walkTo(w, this.pickWaypoint(w), "to-work");
    } else if (w.phase === "sad" || w.phase === "stop" || w.phase === "reporting") {
      w.pause -= dt;
      if (w.pause <= 0) this.leave(w);
    } else if (w.phase === "glad") {
      w.pause -= dt;
      if (w.pause <= 0 && !this.goReport(w)) w.pause = REPORT_RETRY;
    }
    if (!w.moving) {
      if (w.fading) this.fade(w, dt);
      return;
    }
    if (this.move(w, dt)) this.arrive(w);
  }

  // 길의 다음 지점으로 한 걸음 옮긴다. 마지막 지점에 닿으면 true.
  private move(m: Mover, dt: number): boolean {
    let stride = WALK_SPEED * dt;
    while (m.path.length > 0) {
      const next = m.path[0];
      const dx = next.x - m.x;
      const dy = next.y - m.y;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) m.flip = dx < 0 ? -1 : 1;
      if (distance > stride) {
        m.x += (dx / distance) * stride;
        m.y += (dy / distance) * stride;
        break;
      }
      m.x = next.x;
      m.y = next.y;
      stride -= distance;
      m.path.shift();
    }
    m.frameTime += dt;
    if (m.frameTime > FRAME_TIME) {
      m.frameTime = 0;
      m.frame += 1;
    }
    if (m.path.length > 0) return false;
    m.moving = false;
    return true;
  }

  private arrive(w: Internal) {
    if (w.phase === "to-work") {
      w.phase = "idle";
      w.pause = 1.4 + this.rng() * 2;
    } else if (w.phase === "to-wait") {
      w.phase = "waiting";
    } else if (w.phase === "to-report") {
      // 보스가 있는 오른쪽을 보고 선다.
      w.phase = "reporting";
      w.reporting = true;
      w.flip = 1;
      w.pause = REPORT_PAUSE;
    } else if (w.phase === "leaving") {
      w.fading = true;
      this.departed.add(w.id);
    }
  }

  private fade(w: Internal, dt: number) {
    w.fadeTime += dt;
    if (w.fadeTime >= FADE_OUT) this.items = this.items.filter((item) => item !== w);
  }

  private pickWaypoint(w: Internal): Point {
    const options = WAYPOINTS.filter((p) => Math.hypot(p.x - w.x, p.y - w.y) > 8);
    return options[Math.floor(this.rng() * options.length)];
  }

  // 다른 캐릭터가 쓰지 않는 자리 번호. 모두 차 있으면 -1.
  private freeIndex(count: number, w: Internal, key: "slot" | "spot"): number {
    const used = new Set(this.items.filter((o) => o !== w && o[key] >= 0).map((o) => o[key]));
    for (let i = 0; i < count; i++) if (!used.has(i)) return i;
    return -1;
  }
}
