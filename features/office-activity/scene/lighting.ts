import { DESKS, SCENE_HEIGHT, SCENE_WIDTH, type Point } from "./layout";
import { BAYER4, rgbOf, type Rgb } from "./palette";

// 일하는 동안은 노을 무렵, 모두 퇴근하면 불이 꺼진 밤이다.
export type LightMode = "sunset" | "night";

type Lamp = { at: Point; radius: number; color: Rgb } | { shaft: [number, number][]; color: Rgb };
type LightSetup = { ambient: Rgb; lamps: Lamp[] };

export const BULB_COLORS = ["#ff5d6c", "#ffd23f", "#5ee08a", "#4cc9f0", "#c77dff"];
const WINDOWS = [20, 62];

function setupFor(mode: LightMode): LightSetup {
  const lamps: Lamp[] = [];
  if (mode === "sunset") {
    for (const wx of WINDOWS) {
      lamps.push({ shaft: [[wx, 32], [wx + 30, 32], [wx + 64, 96], [wx + 34, 96]], color: [0.55, 0.3, 0.12] });
      lamps.push({ at: { x: wx + 15, y: 20 }, radius: 32, color: [0.5, 0.3, 0.18] });
    }
    DESKS.forEach(({ x, y }, i) => {
      lamps.push({ at: { x: x + 25, y: y - 6 }, radius: 18, color: [0.12, 0.32, 0.5] });
      if (i % 2 === 0) lamps.push({ at: { x: x + 45, y: y - 2 }, radius: 26, color: i ? [0.15, 0.42, 0.55] : [0.6, 0.45, 0.18] });
    });
    for (let x = 5, i = 0; x < SCENE_WIDTH; x += 10, i++) {
      lamps.push({ at: { x, y: 4 }, radius: 9, color: rgbOf(BULB_COLORS[i % 5]).map((v) => (v / 255) * 0.45) as Rgb });
    }
    lamps.push({ at: { x: 10, y: 22 }, radius: 44, color: [0.6, 0.48, 0.24] });
    // 허용 대기 회의실은 늘 환하게 켜 두어 눈에 띄게 한다.
    lamps.push({ at: { x: 263, y: 100 }, radius: 64, color: [0.42, 0.46, 0.55] });
    lamps.push({ at: { x: 205, y: 64 }, radius: 12, color: [0.08, 0.28, 0.45] });
    // 보스 책상의 초록 은행원 스탠드와 책상 둘레의 따뜻한 빛
    lamps.push({ at: { x: 157, y: 90 }, radius: 26, color: [0.42, 0.5, 0.22] });
    lamps.push({ at: { x: 181, y: 92 }, radius: 30, color: [0.22, 0.18, 0.1] });
    lamps.push({ at: { x: 170, y: 141 }, radius: 7, color: [0.08, 0.4, 0.1] });
    lamps.push({ at: { x: 64, y: 166 }, radius: 16, color: [0.45, 0.12, 0.08] });
    return { ambient: [0.6, 0.52, 0.7], lamps };
  }
  for (const wx of WINDOWS) {
    lamps.push({ shaft: [[wx, 32], [wx + 30, 32], [wx + 52, 90], [wx + 22, 90]], color: [0.16, 0.2, 0.34] });
    lamps.push({ at: { x: wx + 15, y: 20 }, radius: 24, color: [0.12, 0.16, 0.3] });
  }
  lamps.push({ at: { x: 64, y: 166 }, radius: 24, color: [0.55, 0.12, 0.1] });
  lamps.push({ at: { x: 170, y: 141 }, radius: 6, color: [0.05, 0.35, 0.1] });
  DESKS.forEach(({ x, y }) => lamps.push({ at: { x: x + 31, y: y - 4 }, radius: 4, color: [0.35, 0.18, 0.05] }));
  return { ambient: [0.14, 0.16, 0.32], lamps };
}

const SETUPS: Record<LightMode, LightSetup> = { sunset: setupFor("sunset"), night: setupFor("night") };

function inPolygon(pts: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 장면 좌표 한 점에 닿는 빛의 세기(채널별 배율).
export function lightAt(mode: LightMode, x: number, y: number): Rgb {
  const { ambient, lamps } = SETUPS[mode];
  const out: Rgb = [...ambient];
  for (const lamp of lamps) {
    let f = 0;
    if ("shaft" in lamp) f = y > 44 && inPolygon(lamp.shaft, x, y) ? 1 : 0;
    else {
      const d = ((x - lamp.at.x) ** 2 + (y - lamp.at.y) ** 2) / lamp.radius ** 2;
      if (d < 1) f = (1 - d) ** 1.6;
    }
    if (f) for (let i = 0; i < 3; i++) out[i] += lamp.color[i] * f;
  }
  return out;
}

// 그려 둔 배경에 빛을 곱한다. 빛을 7단계로 끊고 바이어 디더로 경계를 섞어 도트 느낌을 지킨다.
export function applyLight(c: CanvasRenderingContext2D, scale: number, mode: LightMode) {
  const W = SCENE_WIDTH * scale;
  const H = SCENE_HEIGHT * scale;
  const img = c.getImageData(0, 0, W, H);
  const px = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const light = lightAt(mode, (x + 0.5) / scale, (y + 0.5) / scale);
      const threshold = BAYER4[(x & 3) + (y & 3) * 4] / 16 - 0.47;
      const i = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const q = Math.max(0, Math.round(light[ch] * 7 + threshold * 0.9) / 7);
        px[i + ch] = Math.min(255, px[i + ch] * Math.min(q, 1.5) + Math.max(0, q - 1) * 60);
      }
    }
  }
  c.putImageData(img, 0, 0);
}

// 캐릭터가 선 자리의 밝기. CSS brightness 값으로 쓴다.
export function brightnessAt(x: number, y: number) {
  const [r, g, b] = lightAt("sunset", x, y - 10);
  return Math.round(Math.min(1.25, (r + g + b) / 3 + 0.08) * 8) / 8;
}
