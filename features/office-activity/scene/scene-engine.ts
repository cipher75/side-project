import type { CharacterKind, CharacterStatus } from "../types";
import { DOOR, DOOR_OUTSIDE, SLOTS, WALK_SPEED, WAYPOINTS, type Point } from "./layout";

// 서버가 알려 준 캐릭터 목록을 화면 속 움직임으로 옮기는 엔진. DOM과 canvas를 모른다.

export type SceneCharacter = {
  id: string;
  kind: CharacterKind;
  status: CharacterStatus;
  label: string;
};

export type Expression = "happy" | "confused" | "sad" | "plain";
export type BubbleStyle = "work" | "ask" | "sad" | "glad" | "stop";

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
};

type Phase = "to-work" | "idle" | "to-wait" | "waiting" | "sad" | "glad" | "stop" | "leaving";

type Internal = Walker & {
  phase: Phase;
  goal: Point;
  pause: number;
  slot: number;
  frameTime: number;
  fadeTime: number;
};

const LIGHTS_OFF_DELAY = 1.5;
const FADE_OUT = 0.4;
const SAD_PAUSE = 1.2;
const GLAD_PAUSE = 1.2;
const STOP_PAUSE = 1.2;
const FRAME_TIME = 0.17;

export class SceneEngine {
  private items: Internal[] = [];
  private departed = new Set<string>();
  private serverLit = false;
  private emptyTime = 0;
  private synced = false;
  lit = false;

  constructor(private readonly rng: () => number = Math.random) {}

  get walkers(): Walker[] {
    return this.items;
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
      if (walker) this.update(walker, character);
      else this.spawn(character, placed);
    }
    for (const walker of this.items) {
      if (!ids.has(walker.id) && walker.phase !== "leaving") this.leave(walker);
    }
    if (serverLit || this.items.length > 0) this.turnOn();
  }

  step(dt: number): void {
    for (const w of [...this.items]) this.advance(w, dt);

    if (this.serverLit || this.items.length > 0) this.turnOn();
    else {
      this.emptyTime += dt;
      if (this.emptyTime >= LIGHTS_OFF_DELAY) this.lit = false;
    }
  }

  private turnOn() {
    this.lit = true;
    this.emptyTime = 0;
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
      phase: "to-work",
      goal: DOOR,
      pause: 0,
      slot: -1,
      frameTime: 0,
      fadeTime: 0,
    };
    this.items.push(walker);
    this.update(walker, character, true);
    if (placed && walker.moving) {
      walker.x = walker.goal.x;
      walker.y = walker.goal.y;
      walker.moving = false;
      this.arrive(walker);
    }
  }

  private update(w: Internal, c: SceneCharacter, isNew = false) {
    w.label = c.label;
    if (c.status === "waiting" && w.phase !== "to-wait" && w.phase !== "waiting") this.goWait(w);
    else if (c.status === "denied" && w.phase !== "sad" && w.phase !== "leaving") this.startSad(w);
    else if (c.status === "approved" && w.phase !== "glad" && w.phase !== "leaving") this.startGlad(w);
    else if (c.status === "cancelled" && w.phase !== "stop" && w.phase !== "leaving") this.startStop(w);
    else if (c.status === "working" && (isNew || w.phase === "to-wait" || w.phase === "waiting")) this.goWork(w);
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
    w.slot = this.freeSlot(w);
    this.walkTo(w, SLOTS[w.slot], "to-wait");
  }

  private startSad(w: Internal) {
    w.expr = "sad";
    w.bubble = "sad";
    w.slot = -1;
    w.moving = false;
    w.pause = SAD_PAUSE;
    w.phase = "sad";
  }

  // 거절은 아니지만 실행되지 않고 끝난 호출(중단, 만료 등). 담담한 표정으로 잠깐 멈췄다가 나간다.
  private startStop(w: Internal) {
    w.expr = "plain";
    w.bubble = "stop";
    w.slot = -1;
    w.moving = false;
    w.pause = STOP_PAUSE;
    w.phase = "stop";
  }

  private startGlad(w: Internal) {
    w.expr = "happy";
    w.bubble = "glad";
    w.slot = -1;
    w.moving = false;
    w.pause = GLAD_PAUSE;
    w.phase = "glad";
  }

  private leave(w: Internal) {
    // 허용 여부를 모른 채 나가는 경우(세션 종료 등)에는 ?를 지우고 평소 모습으로 나간다.
    if (w.bubble === "ask") {
      w.expr = "happy";
      w.bubble = "work";
    }
    w.slot = -1;
    this.walkTo(w, DOOR_OUTSIDE, "leaving");
  }

  private walkTo(w: Internal, goal: Point, phase: Phase) {
    w.goal = goal;
    w.phase = phase;
    w.moving = true;
  }

  private advance(w: Internal, dt: number) {
    if (w.phase === "idle") {
      w.pause -= dt;
      if (w.pause <= 0) this.walkTo(w, this.pickWaypoint(w), "to-work");
    } else if (w.phase === "sad" || w.phase === "glad" || w.phase === "stop") {
      w.pause -= dt;
      if (w.pause <= 0) this.leave(w);
    }
    if (!w.moving) {
      if (w.fading) this.fade(w, dt);
      return;
    }

    const dx = w.goal.x - w.x;
    const dy = w.goal.y - w.y;
    const distance = Math.hypot(dx, dy);
    const stride = WALK_SPEED * dt;
    if (distance <= stride) {
      w.x = w.goal.x;
      w.y = w.goal.y;
      w.moving = false;
      this.arrive(w);
      return;
    }

    w.x += (dx / distance) * stride;
    w.y += (dy / distance) * stride;
    if (Math.abs(dx) > 1) w.flip = dx < 0 ? -1 : 1;
    w.frameTime += dt;
    if (w.frameTime > FRAME_TIME) {
      w.frameTime = 0;
      w.frame += 1;
    }
  }

  private arrive(w: Internal) {
    if (w.phase === "to-work") {
      w.phase = "idle";
      w.pause = 1.4 + this.rng() * 2;
    } else if (w.phase === "to-wait") {
      w.phase = "waiting";
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

  private freeSlot(w: Internal): number {
    const used = new Set(this.items.filter((o) => o !== w && o.slot >= 0).map((o) => o.slot));
    const free = SLOTS.findIndex((_, i) => !used.has(i));
    return free === -1 ? 0 : free;
  }
}
