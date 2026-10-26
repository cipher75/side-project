import { DESKS, SCENE_HEIGHT, SCENE_WIDTH } from "./layout";
import { BULB_COLORS, applyLight, type LightMode } from "./lighting";
import { mix, ramp, rng } from "./palette";

// 320 x 180 논리 좌표의 사무실을 2배 도트(640 x 360)로 그린다.
// 책상 네 개, 화이트보드, 책장, 정수기, 복사기, 허용 대기 회의실, 출입문 배치는 layout.ts의 좌표와 맞춘다.
export const BG_SCALE = 2;
const OUTLINE = "#3a2a26";

type Ramp = string[];

export function drawOffice(c: CanvasRenderingContext2D, mode: LightMode) {
  const d = BG_SCALE;
  const night = mode === "night";
  const rnd = rng(11);
  // rect는 논리 좌표, dev는 실제 도트 좌표.
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x * d), Math.round(y * d), Math.max(1, Math.round(w * d)), Math.max(1, Math.round(h * d)));
  };
  const dev = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // 1도트 외곽선, 위쪽 하이라이트, 아래·오른쪽 그림자가 있는 상자.
  const box = (x: number, y: number, w: number, h: number, r: Ramp) => {
    dev(x * d - 1, y * d - 1, w * d + 2, h * d + 2, OUTLINE);
    rect(x, y, w, h, r[2]);
    dev(x * d, y * d, w * d, d, r[3]);
    dev(x * d, y * d, w * d, 1, r[4]);
    dev(x * d, (y + h) * d - d, w * d, d, r[1]);
    dev((x + w) * d - 1, y * d, 1, h * d, r[1]);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string, outline?: string) => {
    const layers: [string, number][] = outline ? [[outline, 1 / d], [color, 0]] : [[color, 0]];
    for (const [col, ex] of layers) {
      c.fillStyle = col;
      for (let y = Math.floor((cy - ry - ex) * d); y <= Math.ceil((cy + ry + ex) * d); y++) {
        for (let x = Math.floor((cx - rx - ex) * d); x <= Math.ceil((cx + rx + ex) * d); x++) {
          const u = (x + 0.5) / d;
          const v = (y + 0.5) / d;
          if (((u - cx) / (rx + ex)) ** 2 + ((v - cy) / (ry + ex)) ** 2 <= 1) c.fillRect(x, y, 1, 1);
        }
      }
    }
  };
  const polygon = (pts: [number, number][], color: string) => {
    c.fillStyle = color;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x * d, y * d) : c.moveTo(x * d, y * d)));
    c.fill();
  };

  const wall = ramp(158, 0.34, 0.8);
  const woodL = ramp(32, 0.5, 0.6);
  const wood = ramp(26, 0.55, 0.42);
  const floor = ramp(30, 0.5, 0.58);
  const metal = ramp(215, 0.14, 0.72);
  const plant = ramp(128, 0.5, 0.42);
  const pot = ramp(14, 0.55, 0.52);
  const sky = night ? "#1e2c5c" : "#ef8a5d";

  // 벽: 민트 벽지와 나무 판벽
  rect(0, 0, SCENE_WIDTH, 30, wall[3]);
  for (let y = 4; y < 30; y += 8) {
    for (let x = (y / 8) % 2 ? 4 : 0; x < SCENE_WIDTH; x += 8) {
      dev(x * d + 3, y * d, 2, 1, wall[2]);
      dev(x * d + 2, y * d + 1, 4, 1, wall[2]);
      dev(x * d + 3, y * d + 2, 2, 1, wall[2]);
    }
  }
  rect(0, 29, SCENE_WIDTH, 1, wall[1]);
  rect(0, 30, SCENE_WIDTH, 10, woodL[2]);
  rect(0, 30, SCENE_WIDTH, 1, woodL[4]);
  for (let x = 0; x < SCENE_WIDTH; x += 20) {
    rect(x + 2, 32, 16, 6, woodL[3]);
    dev((x + 2) * d, 38 * d - 1, 16 * d, 1, woodL[1]);
    dev(x * d, 30 * d, 1, 10 * d, woodL[1]);
  }
  rect(0, 40, SCENE_WIDTH, 4, wood[1]);
  rect(0, 40, SCENE_WIDTH, 1, wood[3]);
  rect(0, 44, SCENE_WIDTH, 1, OUTLINE);

  // 바닥: 판자마다 색이 조금씩 다른 원목과 나뭇결
  for (let y = 45, row = 0; y < 168; y += 8, row++) {
    let x = -((row * 17) % 40);
    while (x < SCENE_WIDTH) {
      const len = 26 + Math.floor(rnd() * 30);
      const tone = floor[1 + Math.floor(rnd() * 3)];
      rect(x, y, len, 8, tone);
      dev(x * d, y * d, len * d, 1, floor[0]);
      dev(x * d, y * d, 1, 8 * d, floor[0]);
      dev(x * d + 1, y * d + 1, len * d - 2, 1, mix(tone, "#fff3d6", 0.25));
      for (let g = 0; g < 3; g++) {
        dev(Math.round((x + rnd() * len) * d), Math.round(y * d + 2 + rnd() * (8 * d - 4)), Math.round((3 + rnd() * 9) * d), 1, mix(tone, floor[0], 0.35));
      }
      x += len;
    }
  }

  // 책상 밑 러그
  const rugField = ramp(186, 0.5, 0.42);
  const rugBorder = ramp(16, 0.72, 0.58);
  box(16, 56, 134, 104, rugBorder);
  rect(20, 60, 126, 96, rugField[2]);
  dev(20 * d, 60 * d, 126 * d, 1, rugField[0]);
  for (let x = 18; x < 148; x += 4) {
    rect(x, 57.5, 2, 1, "#ffd23f");
    rect(x + 2, 157.5, 2, 1, "#ffd23f");
  }
  for (let y = 66; y < 152; y += 12) {
    for (let x = 26 + ((y / 12) % 2) * 6; x < 142; x += 12) {
      rect(x + 1, y, 1, 1, rugField[3]);
      rect(x, y + 1, 3, 1, rugField[3]);
      rect(x + 1, y + 2, 1, 1, rugField[3]);
      dev((x + 1) * d, (y + 1) * d, 2, 2, rugField[4]);
    }
  }
  for (let y = 58; y < 158; y += 2) {
    dev(15 * d - 4, y * d, 3, 1, rugBorder[3]);
    dev(150 * d + 1, y * d, 3, 1, rugBorder[3]);
  }

  // 창문: 노을 하늘 또는 달이 뜬 밤하늘
  const curtain = ramp(352, 0.6, 0.62);
  for (const wx of [20, 62]) {
    const wy = 8;
    box(wx - 2, wy - 2, 34, 28, ramp(40, 0.3, 0.88));
    const bands = night ? ["#0d1533", "#152049", "#1e2c5c"] : ["#5a3f8f", "#b9528c", "#ef8a5d", "#ffc36b"];
    const bh = 24 / bands.length;
    bands.forEach((color, i) => {
      rect(wx, wy + i * bh, 30, bh, color);
      if (i) for (let x = 0; x < 30 * d; x += 2) dev(wx * d + x + (i % 2), (wy + i * bh) * d - 1, 1, 1, bands[i - 1]);
    });
    if (night) {
      for (let s = 0; s < 6; s++) rect(wx + 2 + rnd() * 26, wy + 1 + rnd() * 12, 1 / d, 1 / d, "#fff");
      if (wx === 20) {
        ellipse(wx + 8, wy + 6, 3, 3, "#f4f0c8");
        ellipse(wx + 9.5, wy + 5, 2.6, 2.6, bands[0]);
      }
    } else ellipse(wx + 18, wy + 17, 4.5, 4.5, "#ffe7a0");
    const hill = night ? "#0f1a2c" : "#3d2f5c";
    ellipse(wx + 8, wy + 24, 12, 6, hill);
    ellipse(wx + 24, wy + 25, 10, 5, night ? "#132036" : "#4a3668");
    rect(wx, wy + 21, 30, 3, hill);
    if (!night) {
      ellipse(wx + 24, wy + 15, 3, 3, "#2c2246");
      rect(wx + 23.5, wy + 17, 1, 4, "#2c2246");
    }
    rect(wx + 14, wy, 2, 24, "#f5efe2");
    rect(wx, wy + 11, 30, 2, "#f5efe2");
    box(wx - 3, wy + 24, 36, 2, woodL);
    rect(wx - 7, wy - 4, 44, 1, OUTLINE);
    for (const cx of [wx - 6, wx + 31]) {
      box(cx, wy - 3, 5, 26, curtain);
      rect(cx + 2, wy - 2, 1, 24, curtain[1]);
      dev((cx + 1) * d, (wy - 2) * d, 1, 24 * d, curtain[4]);
    }
    if (wx === 62) {
      box(wx + 24, wy + 20, 3, 4, pot);
      rect(wx + 24.5, wy + 16, 2, 4, plant[3]);
      rect(wx + 23.5, wy + 17, 1, 2, plant[2]);
    }
  }

  // 플로어 스탠드
  rect(9.5, 20, 1, 30, "#4b4048");
  box(5, 48, 10, 2, metal);
  polygon([[5, 20], [15, 20], [13, 12], [7, 12]], OUTLINE);
  polygon([[5.5, 19.5], [14.5, 19.5], [12.6, 12.5], [7.4, 12.5]], night ? "#7a6a3a" : "#ffe08a");
  rect(7, 18.5, 6, 1, night ? "#5a4e2c" : "#f4c95d");

  // 화이트보드: 포스트잇과 막대 차트
  box(110, 6, 54, 30, metal);
  rect(112, 8, 50, 24, "#fdfdf8");
  for (const [nx, ny, color] of [[114, 10, "#ffe066"], [123, 10, "#ff9ebb"], [114, 19, "#9be7c4"], [123, 19, "#9cc9ff"]] as const) {
    rect(nx, ny, 8, 7, color);
    rect(nx, ny + 6, 8, 1, mix(color, "#000000", 0.18));
    rect(nx + 1, ny + 2, 5, 1 / d, mix(color, "#000000", 0.4));
    rect(nx + 1, ny + 4, 4, 1 / d, mix(color, "#000000", 0.4));
  }
  rect(135, 29, 25, 1, OUTLINE);
  rect(135, 11, 1, 19, OUTLINE);
  for (const [x, y, color] of [[138, 23, "#4a7ad6"], [143, 19, "#ef6f6c"], [148, 15, "#3fbf7f"], [153, 12, "#f4a33c"]] as const) {
    rect(x, y, 3, 29 - y, color);
    rect(x, y, 3, 1, mix(color, "#ffffff", 0.4));
  }
  rect(112, 33, 50, 2, metal[1]);
  for (const [x, color] of [[118, "#d64a4a"], [124, "#4a7ad6"], [130, "#3a9e5b"]] as const) rect(x, 32, 4, 1, color);

  // 책장
  box(179, 9, 24, 31, wood);
  const bookColors = ["#e85d5d", "#4a7ad6", "#3fbf7f", "#ffd23f", "#a77df0", "#ff9ebb", "#4cc9f0", "#f4a33c"];
  for (const sy of [17, 26, 35]) {
    rect(180, sy, 22, 2, wood[0]);
    let x = 181;
    while (x < 200) {
      const w = 2 + Math.floor(rnd() * 2);
      const h = 5 + Math.floor(rnd() * 3);
      const color = bookColors[Math.floor(rnd() * bookColors.length)];
      if (x + w > 201) break;
      rect(x, sy - h, w, h, color);
      dev(x * d, (sy - h) * d, 1, h * d, mix(color, "#ffffff", 0.35));
      dev(x * d + 1, (sy - h + 1) * d, w * d - 2, 1, mix(color, "#ffffff", 0.6));
      x += w + (rnd() < 0.2 ? 1 : 0);
    }
  }
  box(183, 4, 5, 5, pot);
  ellipse(185.5, 3, 3.5, 2.2, plant[3], OUTLINE);
  ellipse(184.5, 2.5, 1.4, 1, plant[4]);
  box(195, 6, 3, 3, ramp(45, 0.85, 0.55));
  rect(194, 3, 5, 3, "#ffd23f");

  // 시계, 포스터, 액자, 벽 선반
  ellipse(214, 20, 6, 6, "#fff8e6", OUTLINE);
  ellipse(214, 20, 4.6, 4.6, "#fffdf6");
  rect(213.5, 16.5, 1, 4, OUTLINE);
  rect(214, 19.5, 3, 1, "#e85d5d");
  box(226, 8, 18, 22, wood);
  rect(228, 10, 14, 18, night ? "#1b2550" : "#f08a5d");
  ellipse(235, 16, 3, 3, night ? "#f4f0c8" : "#fff4c2");
  polygon([[228, 28], [233, 19], [238, 28]], "#5a6fd6");
  polygon([[234, 28], [238.5, 21], [242, 28]], "#3f9a8a");
  box(252, 12, 15, 12, ramp(205, 0.3, 0.8));
  rect(254, 14, 11, 8, "#bfe0f5");
  ellipse(257, 19, 1.5, 1.5, "#e85d5d");
  ellipse(261, 19, 1.5, 1.5, "#4a7ad6");
  ellipse(259, 18, 1.4, 1.4, "#ffd23f");
  box(280, 24, 30, 2, wood);
  const shelfPots: [number, number, number][] = [[352, 0.6, 0.6], [195, 0.6, 0.5], [45, 0.8, 0.55]];
  [283, 292, 301].forEach((x, i) => {
    box(x, 19, 5, 5, ramp(...shelfPots[i]));
    ellipse(x + 2.5, 17.5, 2.8 - i * 0.3, 2.2, plant[2 + (i % 2)], OUTLINE);
  });

  // 전구 줄
  const sag = (x: number) => 2 + 2.2 * Math.abs(Math.sin((x * Math.PI) / 40));
  for (let x = 0; x < SCENE_WIDTH * d; x++) dev(x, Math.round(sag(x / d) * d), 1, 1, "#4b4048");
  for (let x = 5, i = 0; x < SCENE_WIDTH; x += 10, i++) {
    const color = night ? mix(BULB_COLORS[i % 5], "#1a1a2a", 0.6) : BULB_COLORS[i % 5];
    rect(x - 1, sag(x) + 0.5, 2, 2.5, color);
    dev(Math.round((x - 1) * d), Math.round((sag(x) + 0.5) * d), 1, 1, night ? color : "#ffffff");
  }

  // 아래쪽 벽과 출입문
  rect(0, 168, SCENE_WIDTH, 12, wood[1]);
  rect(0, 168, SCENE_WIDTH, 1, OUTLINE);
  rect(0, 169, SCENE_WIDTH, 1, wood[3]);
  box(50, 158, 28, 22, wood);
  rect(53, 161, 22, 19, woodL[2]);
  box(56, 163, 16, 7, ramp(205, 0.35, 0.75));
  rect(56, 163, 16, 3, sky);
  ellipse(72, 174, 1.2, 1.2, "#ffd23f", OUTLINE);
  box(44, 174, 40, 6, ramp(352, 0.65, 0.55));
  for (let x = 46; x < 82; x += 6) rect(x, 175.5, 3, 3, "#ffd23f");

  drawMeetingRoom(rect, dev, box, ellipse, rnd, night, { wood, metal, plant, pot });
  drawDesks(rect, dev, box, ellipse, polygon, night, { wood, woodL, plant, pot });

  // 몬스테라
  box(198, 70, 12, 8, pot);
  rect(198, 73, 12, 1, pot[0]);
  for (const [lx, ly, rx, ry, t] of [[199, 63, 5, 4, 2], [209, 64, 5, 4, 2], [204, 59, 6, 5, 3], [204, 53, 4, 4, 3], [200, 56, 3, 3, 1]]) {
    ellipse(lx, ly, rx, ry, plant[t], OUTLINE);
    rect(lx - rx * 0.4, ly, rx * 0.8, 1 / d, plant[t + 1]);
  }
  // 정수기
  box(168, 104, 14, 14, metal);
  rect(170, 108, 3, 2, "#e85d5d");
  rect(177, 108, 3, 2, "#4a7ad6");
  rect(169, 114, 12, 3, metal[1]);
  box(170, 94, 10, 10, ramp(200, 0.75, 0.66));
  rect(172, 95, 2, 7, "#d9f3ff");
  // 복사기
  box(150, 130, 26, 18, ramp(215, 0.1, 0.78));
  rect(152, 132, 22, 5, "#4b5563");
  rect(153, 133, 6, 3, night ? "#101828" : "#6ec6ff");
  rect(153, 141, 12, 3, "#fbfbf2");
  rect(168, 140, 4, 3, "#4ade80");
  // 상자와 간식
  box(190, 144, 16, 12, ramp(32, 0.5, 0.6));
  rect(197, 144, 2, 12, "#e8d6a8");
  rect(192, 140, 3, 4, "#ff6b6b");
  rect(196, 139, 3, 5, "#ffd23f");
  rect(201, 141, 3, 3, "#4cc9f0");
  // 왼쪽 아래 큰 화분
  box(4, 152, 10, 10, ramp(205, 0.55, 0.55));
  for (const [lx, ly, t] of [[6, 146, 2], [12, 145, 3], [9, 141, 3], [5, 140, 2], [10, 136, 4]]) ellipse(lx, ly, 3, 4, plant[t], OUTLINE);
  // 러그 위에서 자는 고양이
  const cat = ramp(28, 0.8, 0.6);
  ellipse(137, 154, 5.5, 3, cat[2], OUTLINE);
  ellipse(131.5, 152.6, 2.8, 2.4, cat[3], OUTLINE);
  polygon([[129.4, 151], [130.2, 148.6], [131.2, 150.6]], cat[2]);
  polygon([[132, 150.6], [133, 148.6], [133.8, 151]], cat[2]);
  rect(136, 151.5, 1, 4, cat[1]);
  rect(139, 151.5, 1, 4, cat[1]);
  rect(130.5, 153, 1, 1 / d, OUTLINE);
  rect(132.5, 153, 1, 1 / d, OUTLINE);
  ellipse(143, 155.5, 2.6, 1, cat[1], OUTLINE);

  applyLight(c, d, mode);
}

type Rect = (x: number, y: number, w: number, h: number, color: string) => void;
type Box = (x: number, y: number, w: number, h: number, r: Ramp) => void;
type Ellipse = (cx: number, cy: number, rx: number, ry: number, color: string, outline?: string) => void;
type Polygon = (pts: [number, number][], color: string) => void;

function drawMeetingRoom(rect: Rect, dev: Rect, box: Box, ellipse: Ellipse, rnd: () => number, night: boolean, r: { wood: Ramp; metal: Ramp; plant: Ramp; pot: Ramp }) {
  const d = BG_SCALE;
  const carpet = ramp(232, 0.32, 0.6);
  rect(214, 50, 98, 100, carpet[2]);
  for (let y = 66; y < 150; y += 8) {
    for (let x = 217 + (((y - 66) / 8) % 2) * 8; x < 309; x += 16) rect(x, y, 8, 8, carpet[3]);
  }
  for (let s = 0; s < 400; s++) dev(Math.round((217 + rnd() * 92) * d), Math.round((66 + rnd() * 84) * d), 1, 1, carpet[1]);
  rect(214, 50, 98, 15, "#e8f1f8");
  box(220, 53, 22, 9, ramp(205, 0.5, 0.82));
  for (let y = 55; y < 62; y += 2) rect(220, y, 22, 1 / d, "#8fb6d6");
  box(288, 53, 18, 9, r.metal);
  rect(289, 54, 16, 7, "#fdfdf8");
  rect(291, 56, 9, 1, "#e85d5d");
  rect(291, 58, 6, 1, "#4a7ad6");
  rect(214, 64, 98, 2, "#6f8fae");
  for (const wx of [214, 309]) {
    rect(wx, 50, 3, 100, "#86aed0");
    rect(wx + 1, 50, 1, 100, "#d4ecff");
  }
  rect(214, 50, 98, 2, "#6f8fae");
  const chairs: [number, number, number][] = [[352, 0.6, 0.58], [45, 0.8, 0.55], [150, 0.5, 0.48], [205, 0.6, 0.55]];
  [240, 255, 270, 285].forEach((x, i) => {
    box(x - 0.5, 76, 9, 7, ramp(...chairs[i]));
    box(x - 0.5, 111, 9, 6, ramp(...chairs[(i + 2) % 4]));
  });
  box(232, 84, 66, 26, r.wood);
  rect(233, 85, 64, 3, r.wood[3]);
  box(240, 89, 11, 7, r.metal);
  rect(241, 90, 9, 5, night ? "#101828" : "#6ec6ff");
  rect(256, 92, 10, 7, "#fbfbf2");
  rect(258, 94, 6, 1 / d, "#99aaaa");
  rect(258, 96, 5, 1 / d, "#99aaaa");
  ellipse(271, 95, 2, 2, "#e85d5d", OUTLINE);
  ellipse(278, 99, 2, 2, "#4cc9f0", OUTLINE);
  // 탁자 위 물음표 메모
  rect(284, 90, 8, 8, "#ffe066");
  rect(287, 91.5, 2, 1, OUTLINE);
  rect(288.5, 92.5, 1, 1.5, OUTLINE);
  rect(287.5, 94, 1, 1, OUTLINE);
  rect(287.5, 96, 1, 1, OUTLINE);
  box(300, 70, 6, 6, r.pot);
  ellipse(303, 67, 4, 4, r.plant[2], OUTLINE);
  ellipse(302, 66, 1.8, 1.6, r.plant[4]);
}

function drawDesks(rect: Rect, dev: Rect, box: Box, ellipse: Ellipse, polygon: Polygon, night: boolean, r: { wood: Ramp; woodL: Ramp; plant: Ramp; pot: Ramp }) {
  const d = BG_SCALE;
  const chairs: [number, number, number][] = [[352, 0.6, 0.55], [215, 0.6, 0.55], [45, 0.8, 0.55], [270, 0.45, 0.58]];
  const mugs = ["#e85d5d", "#4cc9f0", "#ffd23f", "#a77df0"];
  const code: [number, number, string][] = [[0, 6, "#7ee787"], [2, 9, "#79c0ff"], [2, 5, "#ffa657"], [0, 7, "#d2a8ff"]];
  DESKS.forEach(({ x, y }, i) => {
    const chair = ramp(...chairs[i]);
    box(x + 18, y + 17, 14, 7, chair);
    rect(x + 19, y + 18, 12, 2, chair[3]);
    rect(x + 24, y + 24, 2, 2, OUTLINE);
    rect(x + 20, y + 26, 10, 1, OUTLINE);
    box(x, y, 50, 16, r.woodL);
    rect(x, y + 11, 50, 5, r.wood[2]);
    rect(x, y + 11, 50, 1, r.wood[1]);
    rect(x + 2, y + 16, 2, 2, r.wood[0]);
    rect(x + 46, y + 16, 2, 2, r.wood[0]);
    box(x + 17, y - 12, 16, 11, ramp(225, 0.15, 0.3));
    rect(x + 18, y - 11, 14, 8, night ? "#0b0f1c" : "#1c2440");
    if (night) rect(x + 31, y - 4, 1, 1, "#ff9f43");
    else {
      code.forEach(([indent, len, color], li) => rect(x + 19 + indent, y - 10 + li * 2, len, 1 / d, color));
      dev((x + 19) * d, (y - 10) * d + 1, 2, 1, "#ff7b72");
    }
    rect(x + 23, y - 1, 4, 2, "#7b7f8a");
    box(x + 18, y + 4, 14, 3, ramp(215, 0.1, 0.9));
    for (let kx = 0; kx < 13; kx += 2) dev((x + 19 + kx) * d, (y + 5) * d, 2, 2, "#c6ccd6");
    box(x + 34, y + 5, 2, 3, ramp(215, 0.08, 0.88));
    rect(x + 4, y + 3, 9, 7, "#fbfbf2");
    rect(x + 5, y + 5, 6, 1 / d, "#99aaaa");
    rect(x + 5, y + 7, 5, 1 / d, "#99aaaa");
    box(x + 39, y + 4, 4, 5, ramp(0, 0, 0.95));
    rect(x + 39, y + 4, 4, 2, mugs[i]);
    rect(x + 43, y + 5, 1, 2, OUTLINE);
    if (i % 2 === 0) {
      // 스탠드 조명. 위치는 lighting.ts의 스탠드 빛과 맞춘다.
      rect(x + 46, y - 6, 1, 9, "#4b4048");
      polygon([[x + 42, y - 4], [x + 49, y - 4], [x + 48, y - 9], [x + 43, y - 9]], OUTLINE);
      polygon([[x + 42.5, y - 4.5], [x + 48.5, y - 4.5], [x + 47.6, y - 8.5], [x + 43.4, y - 8.5]], i ? "#4cc9f0" : "#ffd23f");
    } else {
      box(x + 44, y - 3, 4, 4, r.pot);
      ellipse(x + 46, y - 5, 3, 2.5, r.plant[3], OUTLINE);
      ellipse(x + 45.5, y - 5.5, 1.2, 1, r.plant[4]);
    }
    if (i === 2) {
      rect(x + 31, y - 11, 3, 3, "#ffe066");
      rect(x + 16, y - 9, 3, 3, "#ff9ebb");
    }
  });
}

export const BG_WIDTH = SCENE_WIDTH * BG_SCALE;
export const BG_HEIGHT = SCENE_HEIGHT * BG_SCALE;
