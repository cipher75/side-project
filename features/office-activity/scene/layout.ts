// 사무실 장면의 논리 좌표(320 x 180). 화면 크기에 맞춰 비율로 확대한다.
export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 180;

export type Point = { x: number; y: number };

// 캐릭터가 들어오고 나가는 출입문 앞(발 위치).
export const DOOR: Point = { x: 64, y: 176 };
export const DOOR_OUTSIDE: Point = { x: 64, y: 180 };

// 책상 네 개의 왼쪽 위 모서리. 배경과 조명이 함께 쓴다.
export const DESKS: Point[] = [
  { x: 28, y: 64 },
  { x: 88, y: 64 },
  { x: 28, y: 112 },
  { x: 88, y: 112 },
];

// 일하는 캐릭터가 돌아다니는 지점들.
export const WAYPOINTS: Point[] = [
  { x: 52, y: 94 },
  { x: 112, y: 94 },
  { x: 52, y: 142 },
  { x: 112, y: 142 },
  { x: 160, y: 112 },
  { x: 146, y: 150 },
  { x: 176, y: 128 },
  { x: 190, y: 84 },
  { x: 136, y: 64 },
  { x: 100, y: 118 },
];

// 허용 대기 회의실에서 캐릭터가 서는 자리. 말풍선이 겹치지 않도록 멀리 떨어뜨렸다.
export const SLOTS: Point[] = [
  { x: 240, y: 128 },
  { x: 290, y: 128 },
  { x: 265, y: 148 },
  { x: 300, y: 148 },
  { x: 232, y: 148 },
  { x: 276, y: 120 },
  { x: 250, y: 120 },
];

export const WALK_SPEED = 34;
