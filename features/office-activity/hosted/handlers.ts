import { createHash, timingSafeEqual } from "node:crypto";

import type { OfficeState } from "../types";
import type { HostedMachine, HostedPush, HostedSnapshot, HostedStore } from "./types";

// 호스팅의 두 길: PC가 줄인 상태를 올리는 길(보내기 토큰)과 기기가 가져가는 길(보기 토큰).
// 두 토큰은 서로 바꿔 쓸 수 없다.

// 오랫동안 소식이 없는 PC는 호스팅에서 지운다. (스펙: 세션 정리는 몇 시간 단위)
export const MACHINE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const MAX_BODY_CHARS = 512 * 1024;
const MAX_SESSIONS = 50;
const MAX_CHARACTERS = 300;
const MACHINE_NAME = /^[A-Za-z0-9._ -]{1,64}$/;

type HandlerDeps = {
  sendToken: string;
  viewToken: string;
  store: HostedStore;
  now: () => number;
};

export function createHostedHandlers({ sendToken, viewToken, store, now }: HandlerDeps) {
  return {
    async push(request: Request): Promise<Response> {
      if (!hasToken(request, sendToken)) return json({ error: "unauthorized" }, 401);

      const push = await readPush(request);
      if (!push) return json({ error: "invalid body" }, 400);

      try {
        await store.put({ ...push, receivedAt: now() });
      } catch {
        return json({ error: "store unavailable" }, 502);
      }
      return json({ ok: true });
    },

    async state(request: Request): Promise<Response> {
      if (!hasToken(request, viewToken)) return json({ error: "unauthorized" }, 401);

      let values: string[];
      try {
        values = await store.all();
      } catch {
        return json({ error: "store unavailable" }, 502);
      }

      const current = now();
      const machines: HostedMachine[] = [];
      const stale: string[] = [];
      for (const value of values) {
        const machine = parseMachine(value);
        if (!machine) continue;
        if (current - machine.receivedAt > MACHINE_MAX_AGE_MS) stale.push(machine.machine);
        else machines.push(machine);
      }
      // 정리는 보기 요청에 얹어 하되, 실패해도 화면에는 영향이 없다.
      if (stale.length > 0) await store.remove(stale).catch(() => {});

      machines.sort((a, b) => a.machine.localeCompare(b.machine));
      const snapshot: HostedSnapshot = { serverNow: current, machines };
      return json(snapshot);
    },
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function hasToken(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!given || !expected) return false;
  // 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교한다.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function readPush(request: Request): Promise<HostedPush | undefined> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_CHARS) return undefined;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(body)) return undefined;

  const { machine, heartbeatSec, state } = body;
  if (typeof machine !== "string" || !MACHINE_NAME.test(machine)) return undefined;
  if (typeof heartbeatSec !== "number" || !(heartbeatSec >= 5 && heartbeatSec <= 600)) return undefined;
  if (!isSafeState(state)) return undefined;
  return { machine, heartbeatSec, state };
}

// 줄인 상태만 받는다. 호출 입력이 남아 있으면 보내는 쪽이 줄이지 않은 것이므로 통째로 거절한다.
function isSafeState(value: unknown): value is OfficeState {
  if (!isRecord(value) || !isRecord(value.sessions) || !Array.isArray(value.order)) return false;
  const sessions = Object.values(value.sessions);
  if (sessions.length > MAX_SESSIONS) return false;
  return sessions.every((session) => {
    if (!isRecord(session) || !Array.isArray(session.characters) || session.characters.length > MAX_CHARACTERS) return false;
    return session.characters.every((c) => isRecord(c) && (c.toolInput === null || c.toolInput === undefined));
  });
}

function parseMachine(value: string): HostedMachine | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.machine !== "string" || typeof parsed.receivedAt !== "number") return undefined;
    if (typeof parsed.heartbeatSec !== "number" || !isRecord(parsed.state)) return undefined;
    return parsed as unknown as HostedMachine;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
