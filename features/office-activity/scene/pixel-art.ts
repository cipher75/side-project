import { BAYER2, mix, rgbOf } from "./palette";

// 직원과 보스 스프라이트가 함께 쓰는 도트 화가.
// 모양은 설계 단위(cols x rows)로 잡고 scale배 도트로 찍는다. 부위를 겹쳐 쌓고, 부위마다 5단 명암과
// 그 부위의 어두운 색 외곽선, 뒤 부위와 맞닿은 안쪽 선을 그린다.

export type Ramp = string[];
export type Test = (u: number, v: number) => boolean;
// 명암 기준이 되는 부위의 중심과 반지름(설계 단위).
export type Light = [number, number, number, number];
export type PartOptions = { inner?: boolean; bias?: number };
export type Add = (r: Ramp, test: Test, light: Light, opt?: PartOptions) => void;
// blk는 설계 단위, dot은 실제 도트 단위로 직접 찍는다.
export type Blk = (u: number, v: number, w: number, h: number, hex: string) => void;
export type Dot = (x: number, y: number, hex: string) => void;
export type Pen = { blk: Blk; dot: Dot };

export const ellipse = (cx: number, cy: number, rx: number, ry: number): Test => (u, v) =>
  ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;

export function pixelArt(cols: number, rows: number, scale: number) {
  const W = cols * scale;
  const H = rows * scale;
  const part = new Int16Array(W * H).fill(-1);
  const level = new Float32Array(W * H);
  const parts: { ramp: Ramp; inner: boolean; outline: string }[] = [];

  // 나중에 더한 부위가 앞에 온다. 빛은 왼쪽 위에서 들어온다.
  const add: Add = (r, test, [cx, cy, rx, ry], opt = {}) => {
    const id = parts.length;
    parts.push({ ramp: r, inner: opt.inner !== false, outline: mix(r[0], "#1a1030", 0.45) });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / scale;
        const v = (y + 0.5) / scale;
        if (!test(u, v)) continue;
        const nx = (u - cx) / rx;
        const ny = (v - cy) / ry;
        part[y * W + x] = id;
        level[y * W + x] = 0.55 + (nx * -0.51 + ny * -0.86) * 0.42 - Math.max(0, Math.hypot(nx, ny) - 0.8) * 0.5 + (opt.bias ?? 0);
      }
    }
  };

  // 쌓은 부위를 캔버스에 그린다. shadow가 있으면 발밑 그림자를 깔고, 얼굴 같은 장식은 decorate에서 찍는다.
  // dy는 장식을 함께 들썩이게 할 설계 단위 높이(걷는 동작).
  const paint = (c: CanvasRenderingContext2D, decorate: (pen: Pen) => void, opt: { shadow?: Light; dy?: number } = {}) => {
    const img = c.createImageData(W, H);
    const put = (i: number, hex: string) => {
      const [r, g, b] = rgbOf(hex);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    };
    if (opt.shadow) {
      const [sx, sy, srx, sry] = opt.shadow;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if ((((x + 0.5) / scale - sx) / srx) ** 2 + (((y + 0.5) / scale - sy) / sry) ** 2 <= 1) img.data.set([20, 12, 30, 70], (y * W + x) * 4);
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const left = x > 0 ? part[i - 1] : -1;
        const right = x < W - 1 ? part[i + 1] : -1;
        const up = y > 0 ? part[i - W] : -1;
        const down = y < H - 1 ? part[i + W] : -1;
        const me = part[i];
        if (me < 0) {
          // 빈 칸이 부위와 닿으면 가장 앞 부위의 외곽선 색을 찍는다.
          const front = Math.max(left, right, up, down);
          if (front >= 0) put(i, parts[front].outline);
          continue;
        }
        const p = parts[me];
        const n = p.ramp.length;
        const L = level[i] * (n - 1) + (BAYER2[(x & 1) + (y & 1) * 2] / 4 - 0.375) * 0.9;
        // 뒤쪽 부위와 맞닿은 앞 부위 가장자리는 가장 어두운 색으로 안쪽 선을 긋는다.
        const behind = (q: number) => q >= 0 && q < me;
        const edge = p.inner && (behind(left) || behind(right) || behind(up) || behind(down));
        put(i, edge ? p.ramp[0] : p.ramp[Math.max(0, Math.min(n - 1, Math.round(L)))]);
      }
    }
    const lift = Math.round((opt.dy ?? 0) * scale);
    const dot: Dot = (x, y, hex) => {
      const yy = y + lift;
      if (x >= 0 && yy >= 0 && x < W && yy < H) put(yy * W + x, hex);
    };
    const blk: Blk = (u, v, w, h, hex) => {
      const x0 = Math.round(u * scale);
      const y0 = Math.round(v * scale);
      for (let y = y0; y < y0 + Math.max(1, Math.round(h * scale)); y++) {
        for (let x = x0; x < x0 + Math.max(1, Math.round(w * scale)); x++) dot(x, y, hex);
      }
    };
    decorate({ blk, dot });
    c.clearRect(0, 0, W, H);
    c.putImageData(img, 0, 0);
  };

  return { add, paint };
}
