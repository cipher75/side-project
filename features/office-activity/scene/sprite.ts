import type { CharacterKind } from "../types";
import type { Expression } from "./scene-engine";

// 24 x 34 도트 캐릭터: 큰 머리와 작은 몸. 종류별로 모자와 옷 색이 다르다.
export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 34;

const OUTLINE = "#2b1d14";

export const KIND_STYLE: Record<CharacterKind, { tunic: string; tunicDark: string; highlight: string; hat: string; hatDark: string; accent: string }> = {
  tool: { tunic: "#2f9e5b", tunicDark: "#1f7a43", highlight: "#63d38e", hat: "#35b36a", hatDark: "#1f7a43", accent: "#35b36a" },
  skill: { tunic: "#7a4bd1", tunicDark: "#5a33a8", highlight: "#a77df0", hat: "#8d5ae0", hatDark: "#5a33a8", accent: "#8d5ae0" },
  sub: { tunic: "#1f9fb0", tunicDark: "#14727f", highlight: "#5fd6e0", hat: "#26b5c7", hatDark: "#14727f", accent: "#26b5c7" },
};

const HAIRS = ["#7a4a21", "#d9a441", "#2b2b3c", "#c0452f", "#e7e1d0", "#4a7a3a"];
const SKINS = ["#f6c7a1", "#e9ac80", "#c98a5e", "#f9d7b9"];

export type SpriteLook = { hair: string; skin: string };

// 같은 id는 항상 같은 얼굴이 되도록 id에서 외모를 정한다.
export function lookFor(id: string): SpriteLook {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { hair: HAIRS[hash % HAIRS.length], skin: SKINS[(hash >>> 3) % SKINS.length] };
}

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function px(c: Ctx, x: number, y: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, 1, 1);
}

function rows(list: [number, number, number][]): Pt[] {
  const out: Pt[] = [];
  for (const [y, x0, x1] of list) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

function shape(c: Ctx, points: Pt[], fill: string, outline: string = OUTLINE) {
  const set = new Set(points.map((p) => p.join(",")));
  for (const [x, y] of points) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!set.has(`${x + dx},${y + dy}`)) px(c, x + dx, y + dy, outline);
    }
  }
  for (const [x, y] of points) px(c, x, y, fill);
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const out: Pt[] = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) out.push([x, y]);
    }
  }
  return out;
}

export type SpriteOptions = {
  kind: CharacterKind;
  look: SpriteLook;
  expr: Expression;
  frame: number;
  moving: boolean;
};

export function drawSprite(c: Ctx, o: SpriteOptions) {
  c.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  const style = KIND_STYLE[o.kind];
  const { hair, skin } = o.look;
  const stepA = o.moving && o.frame % 2 ? 1 : 0;
  const stepB = o.moving && o.frame % 2 ? 0 : o.moving ? 1 : 0;

  c.globalAlpha = 0.28;
  shape(c, ellipse(12, 32.5, 7, 1.4), "#000", "rgba(0,0,0,0)");
  c.globalAlpha = 1;

  shape(c, rows([[28, 8, 9], [29, 8, 9]]), skin);
  shape(c, rows([[28, 14, 15], [29, 14, 15]]), skin);
  shape(c, rows([[30 - stepA, 7, 10], [31 - stepA, 7, 10], [32 - stepA, 7, 10]]), "#7a4a21");
  shape(c, rows([[30 - stepB, 13, 16], [31 - stepB, 13, 16], [32 - stepB, 13, 16]]), "#7a4a21");

  shape(c, rows([[22, 7, 16], [23, 7, 16], [24, 7, 16], [25, 7, 16], [26, 7, 16], [27, 7, 16]]), style.tunic);
  for (const [x, y] of rows([[22, 8, 15]])) px(c, x, y, style.highlight);
  for (const [x, y] of rows([[23, 16, 16], [24, 16, 16], [25, 16, 16], [27, 7, 16]])) px(c, x, y, style.tunicDark);
  for (const [x, y] of rows([[26, 7, 16]])) px(c, x, y, "#8a5a2b");
  px(c, 11, 26, "#ffd34d");
  px(c, 12, 26, "#ffd34d");

  const swing = o.moving ? (o.frame % 2 ? 1 : -1) : 0;
  shape(c, rows([[23 + swing, 4, 5], [24 + swing, 4, 5], [25 + swing, 4, 5]]), style.tunic);
  shape(c, rows([[23 - swing, 18, 19], [24 - swing, 18, 19], [25 - swing, 18, 19]]), style.tunic);
  px(c, 4, 26 + swing, skin); px(c, 5, 26 + swing, skin);
  px(c, 18, 26 - swing, skin); px(c, 19, 26 - swing, skin);

  const head = ellipse(12, 13.2, 9.4, 9);
  shape(c, head, skin);
  for (const [x, y] of head) {
    if (y < 11 || ((x < 5 || x > 18) && y < 17)) px(c, x, y, hair);
  }
  for (const [x, y] of rows([[11, 7, 8], [11, 15, 16], [10, 9, 14]])) px(c, x, y, hair);

  drawFace(c, o.expr);
  px(c, 6, 17, "#ff9aa2"); px(c, 7, 17, "#ff9aa2"); px(c, 17, 17, "#ff9aa2"); px(c, 18, 17, "#ff9aa2");
  drawHat(c, o.kind);
}

function drawFace(c: Ctx, expr: Expression) {
  const eye = OUTLINE;
  const eyes: Pt[] = [[8, 14], [14, 14]];
  if (expr === "sad") {
    for (const [x, y] of eyes) { px(c, x, y + 1, eye); px(c, x + 1, y + 1, eye); px(c, x, y + 2, eye); }
    px(c, 7, 12, eye); px(c, 8, 12, eye); px(c, 15, 12, eye); px(c, 16, 12, eye);
    px(c, 10, 19, eye); px(c, 11, 18, eye); px(c, 12, 18, eye); px(c, 13, 18, eye); px(c, 14, 19, eye);
    px(c, 19, 17, "#6ec6ff"); px(c, 19, 18, "#6ec6ff");
    return;
  }
  for (const [x, y] of eyes) {
    for (const dy of [0, 1, 2]) { px(c, x, y + dy, eye); px(c, x + 1, y + dy, eye); }
  }
  if (expr === "confused") {
    px(c, 8, 14, "#fff"); px(c, 15, 14, "#fff");
    px(c, 7, 12, eye); px(c, 8, 12, eye); px(c, 9, 11, eye); px(c, 14, 10, eye); px(c, 15, 10, eye); px(c, 16, 11, eye);
    px(c, 11, 18, eye); px(c, 12, 19, eye); px(c, 13, 18, eye);
    px(c, 20, 9, "#6ec6ff"); px(c, 20, 10, "#6ec6ff"); px(c, 20, 11, "#9ad8ff");
    return;
  }
  px(c, 8, 14, "#fff"); px(c, 14, 14, "#fff");
  if (expr === "plain") {
    px(c, 10, 19, eye); px(c, 11, 19, eye); px(c, 12, 19, eye); px(c, 13, 19, eye);
    return;
  }
  px(c, 10, 18, eye); px(c, 11, 19, eye); px(c, 12, 19, eye); px(c, 13, 19, eye); px(c, 14, 18, eye);
}

function drawHat(c: Ctx, kind: CharacterKind) {
  const style = KIND_STYLE[kind];
  if (kind === "tool") {
    shape(c, rows([[2, 10, 13], [3, 9, 14], [4, 7, 17], [5, 5, 18], [6, 4, 19], [7, 4, 19], [8, 3, 20]]).concat(rows([[3, 15, 17], [4, 18, 20], [5, 20, 21]])), style.hat);
    shape(c, rows([[9, 3, 20]]), style.hatDark);
    for (const [x, y] of rows([[4, 8, 12], [5, 7, 10]])) px(c, x, y, style.highlight);
  } else if (kind === "skill") {
    shape(c, rows([[0, 11, 13], [1, 10, 13], [2, 10, 14], [3, 9, 14], [4, 9, 15], [5, 8, 15], [6, 7, 16], [7, 6, 17], [8, 5, 18]]), style.hat);
    shape(c, rows([[9, 2, 21]]), style.hatDark);
    for (const [x, y] of [[12, 4], [11, 5], [12, 5], [13, 5], [12, 6]]) px(c, x, y, "#ffd34d");
  } else {
    shape(c, rows([[3, 9, 14], [4, 7, 16], [5, 5, 18], [6, 4, 19], [7, 4, 19], [8, 3, 20]]), style.hat);
    for (const [x, y] of rows([[6, 4, 19]])) px(c, x, y, "#ffffff");
    shape(c, rows([[9, 2, 21]]), style.hatDark);
    shape(c, rows([[12, 1, 2], [13, 1, 2], [14, 1, 2], [15, 1, 2], [16, 1, 2]]), "#566074");
    shape(c, rows([[12, 21, 22], [13, 21, 22], [14, 21, 22], [15, 21, 22], [16, 21, 22]]), "#566074");
    px(c, 3, 17, OUTLINE); px(c, 4, 18, OUTLINE); px(c, 5, 19, OUTLINE); px(c, 6, 19, OUTLINE); px(c, 7, 19, "#ff5a5a");
  }
}
