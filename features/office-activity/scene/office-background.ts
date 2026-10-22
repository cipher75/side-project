import { SCENE_HEIGHT, SCENE_WIDTH } from "./layout";

// 320 x 180 도트 사무실 배경: 책상 네 개, 화이트보드, 책장, 복사기, 허용 대기 회의실, 출입문.
const OUTLINE = "#2b1d14";

type Ctx = CanvasRenderingContext2D;

export function drawOffice(c: Ctx) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };

  // 바닥과 벽
  rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT, "#c9a56b");
  for (let y = 44; y < 170; y += 8) {
    rect(0, y, SCENE_WIDTH, 1, "#b8935a");
    for (let x = (y / 8) % 2 ? 20 : 0; x < SCENE_WIDTH; x += 40) rect(x, y, 1, 8, "#b8935a");
  }
  rect(0, 0, SCENE_WIDTH, 44, "#efe2c3");
  for (let x = 0; x < SCENE_WIDTH; x += 16) rect(x, 0, 1, 40, "#e3d4af");
  rect(0, 40, SCENE_WIDTH, 4, "#8a6a43");
  rect(0, 44, SCENE_WIDTH, 1, "#6b4f2f");

  // 창문
  for (const [x, y] of [[20, 8], [62, 8]]) {
    rect(x - 1, y - 1, 32, 26, OUTLINE);
    rect(x, y, 30, 24, "#8fd0ff");
    rect(x, y + 14, 30, 10, "#b7e3a0");
    rect(x + 14, y, 2, 24, "#fff");
    rect(x, y + 11, 30, 2, "#fff");
    rect(x + 3, y + 3, 5, 2, "#fff");
    rect(x + 20, y + 5, 6, 2, "#fff");
  }

  // 화이트보드, 책장, 시계
  rect(111, 7, 52, 28, OUTLINE);
  rect(112, 8, 50, 26, "#fbfbf2");
  rect(116, 13, 22, 2, "#4a7ad6");
  rect(116, 19, 30, 2, "#d64a4a");
  rect(116, 25, 16, 2, "#3a9e5b");
  rect(148, 12, 10, 10, "#ffe27a");
  rect(113, 33, 48, 2, "#8a6a43");
  rect(180, 10, 22, 30, OUTLINE);
  rect(181, 11, 20, 28, "#a0693a");
  for (let y = 15; y < 38; y += 8) rect(181, y, 20, 2, "#6b4426");
  const books: [number, number, string][] = [[183, 12, "#d64a4a"], [189, 12, "#4a7ad6"], [195, 12, "#3a9e5b"], [185, 20, "#ffd34d"], [192, 20, "#a77df0"], [184, 28, "#4a7ad6"], [191, 28, "#d64a4a"]];
  for (const [x, y, color] of books) rect(x, y, 4, 6, color);
  rect(208, 14, 12, 12, OUTLINE);
  rect(209, 15, 10, 10, "#fff");
  rect(213, 17, 1, 4, OUTLINE);
  rect(213, 20, 4, 1, OUTLINE);

  // 아래쪽 벽과 출입문
  rect(0, 168, SCENE_WIDTH, 12, "#6b4f2f");
  rect(0, 168, SCENE_WIDTH, 1, "#4a331c");
  rect(50, 160, 28, 20, OUTLINE);
  rect(52, 162, 24, 18, "#e8c88f");
  rect(54, 166, 20, 14, "#f3dcb0");
  rect(60, 170, 8, 10, "#fff7dc");
  rect(46, 172, 36, 8, "#b33b3b");
  rect(48, 174, 32, 4, "#cf5959");

  // 허용 대기 회의실
  rect(214, 50, 98, 100, "#9fb7c9");
  for (let y = 66; y < 150; y += 6) {
    for (let x = 214 + (y % 12 ? 0 : 6); x < 312; x += 12) rect(x, y, 6, 6, "#94adc1");
  }
  rect(214, 50, 98, 16, "#dbe8f2");
  rect(214, 64, 98, 3, "#5d7f99");
  rect(214, 50, 3, 100, "#5d7f99");
  rect(309, 50, 3, 100, "#5d7f99");
  rect(214, 50, 98, 2, "#5d7f99");
  rect(217, 52, 1, 98, "rgba(255,255,255,.5)");
  rect(262, 53, 36, 10, OUTLINE);
  rect(263, 54, 34, 8, "#2b3a55");
  rect(266, 56, 12, 2, "#6ec6ff");
  rect(266, 59, 20, 1, "#6ec6ff");
  rect(232, 84, 66, 28, OUTLINE);
  rect(233, 85, 64, 26, "#a0693a");
  rect(233, 85, 64, 4, "#c58a54");
  for (const x of [240, 255, 270, 285]) rect(x, 76, 8, 8, "#4a7ad6");
  rect(246, 92, 14, 8, "#fbfbf2");
  rect(266, 94, 10, 6, "#fbfbf2");
  rect(280, 91, 8, 8, "#d64a4a");

  // 책상 네 개와 모니터
  for (const [x, y] of [[28, 64], [88, 64], [28, 112], [88, 112]]) {
    rect(x - 1, y - 1, 52, 18, OUTLINE);
    rect(x, y, 50, 16, "#b87a43");
    rect(x, y, 50, 4, "#d9a26c");
    rect(x, y + 12, 50, 4, "#8a5a2b");
    rect(x + 17, y - 12, 16, 11, OUTLINE);
    rect(x + 18, y - 11, 14, 8, "#2b3a55");
    rect(x + 19, y - 10, 12, 6, "#6ec6ff");
    rect(x + 22, y - 3, 6, 2, "#888");
    rect(x + 21, y - 1, 8, 1, "#666");
    rect(x + 4, y + 3, 9, 6, "#fbfbf2");
    rect(x + 38, y + 4, 6, 6, "#d64a4a");
    rect(x + 40, y + 2, 2, 2, "#3a9e5b");
  }

  // 화분, 정수기, 복사기, 상자
  rect(196, 56, 16, 22, OUTLINE);
  rect(197, 70, 14, 7, "#a0693a");
  rect(198, 57, 12, 14, "#3a9e5b");
  rect(201, 58, 6, 10, "#63d38e");
  rect(168, 96, 14, 22, OUTLINE);
  rect(169, 97, 12, 20, "#dbe8f2");
  rect(171, 99, 8, 8, "#6ec6ff");
  rect(170, 108, 10, 8, "#9db0c0");
  rect(150, 130, 26, 18, OUTLINE);
  rect(151, 131, 24, 16, "#c9ccd2");
  rect(153, 133, 20, 5, "#4b5563");
  rect(153, 141, 12, 3, "#fbfbf2");
  rect(168, 140, 4, 3, "#4ade80");
  rect(190, 142, 16, 14, OUTLINE);
  rect(191, 143, 14, 12, "#a0693a");
  rect(193, 136, 12, 8, "#3a9e5b");
  rect(194, 137, 10, 6, "#63d38e");
}
