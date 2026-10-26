// 캐릭터와 배경이 함께 쓰는 색 도구.
export type Rgb = [number, number, number];

function hslRgb(h: number, s: number, l: number): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export const toHex = (rgb: Rgb) =>
  "#" + rgb.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("");

export const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

export function mix(a: string, b: string, t: number) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t) as Rgb);
}

function towards(h: number, target: number, amount: number) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}

// 어두운 쪽은 푸른 보라로, 밝은 쪽은 노랑으로 색상을 틀어 단색 명암보다 풍부한 명암 단계를 만든다.
export function ramp(h: number, s: number, l: number, n = 5, spread = 0.5, shift = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const hh = t < 0 ? towards(h, 250, -t * 2 * 26 * shift) : towards(h, 55, t * 2 * 20 * shift);
    const ss = Math.min(1, Math.max(0, s + (t < 0 ? -t * 0.16 : -t * 0.14)));
    const ll = Math.min(0.96, Math.max(0.07, l + t * spread));
    out.push(toHex(hslRgb(hh, ss, ll)));
  }
  return out;
}

// 매번 같은 배경이 나오도록 시드를 받는 난수.
export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export const BAYER2 = [0, 2, 3, 1];
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
