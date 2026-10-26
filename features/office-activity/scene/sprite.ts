import type { CharacterKind } from "../types";
import type { Expression } from "./scene-engine";
import { BAYER2, mix, ramp, rgbOf } from "./palette";

// 64 x 72 도트 캐릭터: 큰 머리와 작은 몸. 모양은 32 x 36 설계 단위로 잡고 2배로 찍는다.
// 부위마다 5단 명암을 주고, 외곽선은 검정 대신 각 부위의 어두운 색으로 그린다.
const K = 2;
export const SPRITE_WIDTH = 32 * K;
export const SPRITE_HEIGHT = 36 * K;

type Ramp = string[];

export const KIND_STYLE: Record<CharacterKind, { tunic: Ramp; hat: Ramp; accent: string }> = {
  tool: { tunic: ramp(145, 0.55, 0.44), hat: ramp(150, 0.6, 0.47), accent: "#35b36a" },
  skill: { tunic: ramp(266, 0.5, 0.5), hat: ramp(270, 0.55, 0.5), accent: "#8d5ae0" },
  sub: { tunic: ramp(190, 0.62, 0.43), hat: ramp(16, 0.7, 0.58), accent: "#26b5c7" },
};

type Hsl = [number, number, number];
const HAIRS: Hsl[] = [[28, 0.55, 0.32], [42, 0.75, 0.6], [235, 0.25, 0.22], [8, 0.65, 0.45], [210, 0.1, 0.82], [330, 0.6, 0.68], [205, 0.6, 0.5], [24, 0.8, 0.52], [270, 0.4, 0.66], [150, 0.4, 0.42]];
const SKINS: Hsl[] = [[28, 0.62, 0.8], [26, 0.5, 0.7], [24, 0.4, 0.58], [30, 0.7, 0.85], [22, 0.35, 0.46]];
const EYES = ["#3b6fd6", "#3a9e5b", "#8a5a2b", "#a050c8", "#2e2a40"];
const PANTS: Hsl[] = [[230, 0.35, 0.3], [25, 0.35, 0.32], [220, 0.08, 0.3], [40, 0.3, 0.45]];
const SHOE = ramp(20, 0.45, 0.32);
const BELT = ramp(28, 0.5, 0.3);
const GOLD = ramp(45, 0.85, 0.58);
const HEADSET = ramp(220, 0.12, 0.35);
const CUFF = ramp(16, 0.6, 0.66);
const POMPOM = ramp(45, 0.2, 0.9, 5, 0.3);
const INK = "#2a2040";

// 0: 짧은 머리, 1: 단발, 2: 옆으로 넘긴 앞머리, 3: 포니테일
export type SpriteLook = { hair: Ramp; skin: Ramp; eye: string; pants: Ramp; style: number };

// 같은 id는 항상 같은 얼굴이 되도록 id에서 외모를 정한다.
export function lookFor(id: string): SpriteLook {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const pick = <T>(list: T[], shift: number) => list[(hash >>> shift) % list.length];
  return {
    hair: ramp(...pick(HAIRS, 0)),
    skin: ramp(...pick(SKINS, 3), 5, 0.3, 0.25),
    eye: pick(EYES, 11),
    pants: ramp(...pick(PANTS, 13)),
    style: (hash >>> 7) % 4,
  };
}

export type SpriteOptions = {
  kind: CharacterKind;
  look: SpriteLook;
  expr: Expression;
  frame: number;
  moving: boolean;
};

type Test = (u: number, v: number) => boolean;
// 명암 기준이 되는 부위의 중심과 반지름(설계 단위).
type Light = [number, number, number, number];

const ellipse = (cx: number, cy: number, rx: number, ry: number): Test => (u, v) =>
  ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;

export function drawSprite(c: CanvasRenderingContext2D, o: SpriteOptions) {
  const W = SPRITE_WIDTH;
  const H = SPRITE_HEIGHT;
  const part = new Int16Array(W * H).fill(-1);
  const level = new Float32Array(W * H);
  const parts: { ramp: Ramp; inner: boolean; outline: string }[] = [];

  // 나중에 더한 부위가 앞에 온다. 빛은 왼쪽 위에서 들어온다.
  const add = (r: Ramp, test: Test, [cx, cy, rx, ry]: Light, opt: { inner?: boolean; bias?: number } = {}) => {
    const id = parts.length;
    parts.push({ ramp: r, inner: opt.inner !== false, outline: mix(r[0], "#1a1030", 0.45) });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / K;
        const v = (y + 0.5) / K;
        if (!test(u, v)) continue;
        const nx = (u - cx) / rx;
        const ny = (v - cy) / ry;
        part[y * W + x] = id;
        level[y * W + x] = 0.55 + (nx * -0.51 + ny * -0.86) * 0.42 - Math.max(0, Math.hypot(nx, ny) - 0.8) * 0.5 + (opt.bias ?? 0);
      }
    }
  };

  const style = KIND_STYLE[o.kind];
  const { look } = o;
  const f = o.moving ? o.frame % 4 : 0;
  const leftUp = f === 1 ? 1 : 0;
  const rightUp = f === 3 ? 1 : 0;
  const b = f === 1 || f === 3 ? -0.6 : 0;
  const swing = f === 1 ? 0.9 : f === 3 ? -0.9 : 0;

  if (look.style === 3) add(look.hair, ellipse(26, 19 + b, 3.2, 5.4), [25, 16, 4, 7]);
  if (look.style === 1) add(look.hair, (u, v) => v > 12 + b && ellipse(16, 16 + b, 13.2, 9.6)(u, v), [12, 12, 12, 10]);
  add(look.pants, (u, v) => u >= 11.2 && u <= 14.6 && v >= 28 && v <= 33.4 - leftUp, [12.4, 29, 3, 5]);
  add(look.pants, (u, v) => u >= 17.4 && u <= 20.8 && v >= 28 && v <= 33.4 - rightUp, [18.6, 29, 3, 5]);
  add(SHOE, ellipse(12.6, 33.6 - leftUp, 2.7, 1.5), [12, 32.6, 3, 2]);
  add(SHOE, ellipse(19.6, 33.6 - rightUp, 2.7, 1.5), [19, 32.6, 3, 2]);
  add(style.tunic, ellipse(8.6, 26 + b + swing, 2.3, 3.3), [8, 24.5, 3, 4]);
  add(style.tunic, ellipse(23.4, 26 + b - swing, 2.3, 3.3), [22.6, 24.5, 3, 4]);
  add(look.skin, ellipse(8.4, 29.2 + b + swing, 1.8, 1.6), [8, 28.5, 2, 2]);
  add(look.skin, ellipse(23.6, 29.2 + b - swing, 1.8, 1.6), [23, 28.5, 2, 2]);
  const body: Test = (u, v) => {
    const w = v - b;
    return w >= 22.4 && w <= 31 && Math.abs(u - 16) <= 5.8 + (w - 22.4) * 0.22;
  };
  add(style.tunic, body, [13.5, 23.5, 8, 8]);
  add(BELT, (u, v) => body(u, v) && v - b >= 28.3 && v - b <= 29.7, [14, 28, 8, 2], { inner: false });
  add(look.skin, ellipse(16, 14.2 + b, 11.6, 10.3), [12.5, 10, 12, 11], { bias: 0.14 });
  const sideTo = look.style === 1 ? 23 : 20.5;
  add(look.hair, (u, v) => {
    const w = v - b;
    if (!ellipse(16, 13.4 + b, 12.4, 10.8)(u, v) || w > sideTo) return false;
    const bang = look.style === 2 ? 13.6 - (u - 5) * 0.22 : 11.6 + 1.3 * Math.abs(Math.sin(u * 1.15));
    return w < bang || u < 6.2 || u > 25.8;
  }, [12, 7, 12, 10]);
  addHat(add, o.kind, b);

  const img = c.createImageData(W, H);
  const put = (i: number, hex: string, alpha = 255) => {
    const [r, g, bl] = rgbOf(hex);
    img.data.set([r, g, bl, alpha], i * 4);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / K;
      const v = (y + 0.5) / K;
      if (((u - 16) / 9.5) ** 2 + ((v - 34.6) / 1.6) ** 2 <= 1) img.data.set([20, 12, 30, 70], (y * W + x) * 4);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1].filter((q) => q >= 0);
      if (part[i] < 0) {
        // 빈 칸이 부위와 닿으면 가장 앞 부위의 외곽선 색을 찍는다.
        let front = -1;
        for (const q of near) if (part[q] > front) front = part[q];
        if (front >= 0) put(i, parts[front].outline);
        continue;
      }
      const p = parts[part[i]];
      const n = p.ramp.length;
      const L = level[i] * (n - 1) + (BAYER2[(x & 1) + (y & 1) * 2] / 4 - 0.375) * 0.9;
      // 뒤쪽 부위와 맞닿은 앞 부위 가장자리는 가장 어두운 색으로 안쪽 선을 긋는다.
      const edge = p.inner && near.some((q) => part[q] >= 0 && part[q] < part[i]);
      put(i, edge ? p.ramp[0] : p.ramp[Math.max(0, Math.min(n - 1, Math.round(L)))]);
    }
  }

  // 얼굴과 장식은 도트를 직접 찍는다. blk는 설계 단위, dot은 실제 도트 단위다.
  const blk = (u: number, v: number, w: number, h: number, hex: string) => {
    const x0 = Math.round(u * K);
    const y0 = Math.round((v + b) * K);
    for (let y = y0; y < y0 + Math.max(1, Math.round(h * K)); y++) {
      for (let x = x0; x < x0 + Math.max(1, Math.round(w * K)); x++) {
        if (x >= 0 && y >= 0 && x < W && y < H) put(y * W + x, hex);
      }
    }
  };
  const dot = (x: number, y: number, hex: string) => {
    const yy = y + Math.round(b * K);
    if (x >= 0 && yy >= 0 && x < W && yy < H) put(yy * W + x, hex);
  };
  drawFace(blk, dot, o.expr, look);
  blk(14.6, 22.4, 2.8, 1, "#fffdf3");
  blk(15.4, 23.4, 1.2, 1, "#fffdf3");
  blk(15, 28.5, 2, 1.2, "#ffd34d");
  if (o.kind === "tool") {
    blk(14.8, 5.6, 2.4, 2, "#fffdf3");
    blk(15.4, 6.1, 1.2, 1, style.hat[1]);
  } else if (o.kind === "skill") {
    blk(15, 3.6, 1, 3, "#ffe066");
    blk(14, 4.6, 3, 1, "#ffe066");
    dot(30, 7, "#ffffff");
  } else {
    for (let x = 8; x < 56; x += 3) for (let y = 18; y < 22; y++) dot(x, y, mix("#ff9a7a", "#c0503a", 0.5));
    for (let i = 0; i < 6; i++) blk(5 + i * 1.1, 18.2 + i * 0.5, 1, 1, INK);
    blk(11.4, 21, 1.6, 1.4, "#ff5a5a");
  }
  for (let x = 16; x < 26; x++) dot(x, 20 - Math.round(Math.abs(x - 21) * 0.4), look.hair[4]);
  c.clearRect(0, 0, W, H);
  c.putImageData(img, 0, 0);
}

type Add = (r: Ramp, test: Test, light: Light, opt?: { inner?: boolean; bias?: number }) => void;

function addHat(add: Add, kind: CharacterKind, b: number) {
  const hat = KIND_STYLE[kind].hat;
  if (kind === "tool") {
    add(hat, (u, v) => ellipse(16, 9.2 + b, 11.8, 6.9)(u, v) && v - b < 10.3, [12, 4, 12, 7]);
    add(hat, ellipse(16, 10.4 + b, 13.4, 1.7), [12, 9.5, 14, 2], { bias: -0.15 });
  } else if (kind === "skill") {
    const cone = (u: number, v: number) => {
      const w = v - b;
      return w >= 0.2 && w <= 9.2 && Math.abs(u - (16 + (9.2 - w) * 0.3)) <= ((w - 0.2) / 9) * 10.6;
    };
    add(hat, cone, [14, 3, 9, 8]);
    add(GOLD, (u, v) => cone(u, v) && v - b >= 6.9 && v - b <= 8.7, [12, 7, 10, 2]);
    add(hat, ellipse(16, 9.7 + b, 14.6, 1.9), [12, 9, 14, 2], { bias: -0.1 });
  } else {
    add(hat, (u, v) => ellipse(16, 9.8 + b, 12, 7.3)(u, v) && v - b < 9.4, [12, 4, 12, 7]);
    add(CUFF, (u, v) => v - b >= 8.6 && v - b <= 11.2 && Math.abs(u - 16) <= 12.3, [12, 9, 14, 3]);
    add(POMPOM, ellipse(16, 2.6 + b, 2.7, 2.3), [15, 1.6, 3, 3]);
    add(HEADSET, ellipse(4.3, 15.6 + b, 2.1, 3.1), [3.6, 14, 2.5, 3.5]);
    add(HEADSET, ellipse(27.7, 15.6 + b, 2.1, 3.1), [27, 14, 2.5, 3.5]);
  }
}

type Blk = (u: number, v: number, w: number, h: number, hex: string) => void;
type Dot = (x: number, y: number, hex: string) => void;

function drawFace(blk: Blk, dot: Dot, expr: Expression, look: SpriteLook) {
  const blush = mix(look.skin[2], "#ff5f87", 0.45);
  blk(7.6, 19.2, 2.4, 1, blush);
  blk(22, 19.2, 2.4, 1, blush);
  const eyes = [11, 19];
  if (expr === "sad") {
    for (const ex of eyes) {
      blk(ex, 17, 2, 1, INK);
      blk(ex - 0.5, 16.2, 1, 1, INK);
      blk(ex + 2, 16.2, 1, 1, INK);
      blk(ex + 0.5, 18, 1, 3, "#7cc8ff");
    }
    blk(14, 21, 1, 1, INK);
    blk(15, 20, 2, 1, INK);
    blk(17, 21, 1, 1, INK);
    return;
  }
  if (expr === "confused") {
    for (const ex of eyes) {
      blk(ex, 15.5, 2, 2.5, INK);
      blk(ex + 1, 15.5, 1, 1, "#ffffff");
    }
    for (const [x, y] of [[13.5, 21], [14.5, 20], [15.5, 21], [16.5, 20], [17.5, 21]]) blk(x, y, 1, 1, INK);
    blk(26, 10, 1.4, 1, "#bfe6ff");
    blk(25.6, 11, 2, 2, "#6ec6ff");
    return;
  }
  // 눈동자: 위는 검정, 아래 절반은 눈 색, 왼쪽 위와 오른쪽 아래에 하이라이트.
  for (const ex of eyes) {
    blk(ex, 15, 2, 3, INK);
    const x0 = ex * K;
    const y0 = 15 * K;
    for (let yy = 3; yy < 6; yy++) for (let xx = 0; xx < 4; xx++) dot(x0 + xx, y0 + yy, yy === 5 ? mix(look.eye, "#ffffff", 0.35) : look.eye);
    for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [3, 4]]) dot(x0 + dx, y0 + dy, "#ffffff");
  }
  if (expr === "plain") {
    blk(15, 21, 2, 1, INK);
    return;
  }
  const x0 = 14 * K;
  const y0 = 20 * K;
  for (let xx = 0; xx < 8; xx++) dot(x0 + xx, y0 + 1, INK);
  for (let xx = 1; xx < 7; xx++) dot(x0 + xx, y0 + 2, xx > 1 && xx < 6 ? "#e85a6f" : INK);
  for (let xx = 2; xx < 6; xx++) dot(x0 + xx, y0 + 3, INK);
  dot(x0 - 1, y0, INK);
  dot(x0 + 8, y0, INK);
}
