import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Character, OfficeState } from "../types";
import { createRelay } from "./relay";

function withSessions(...characters: Character[]): OfficeState {
  return {
    sessions: { s1: { id: "s1", name: "side-project", connected: true, lit: true, doneCount: 0, characters } },
    order: ["s1"],
  };
}

const empty: OfficeState = { sessions: {}, order: [] };

const bash: Character = {
  id: "t1", kind: "tool", status: "working", label: "Bash · echo SECRET", toolName: "Bash", toolInput: { command: "echo SECRET" }, since: 1,
};

type Harness = ReturnType<typeof harness>;

function harness(initial: OfficeState) {
  let state = initial;
  const listeners = new Set<(s: OfficeState) => void>();
  const bodies: Record<string, unknown>[] = [];
  const requests: { url: string; auth: string | null }[] = [];
  let respond: () => Promise<Response> = async () => Response.json({ ok: true });

  const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
    requests.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") });
    bodies.push(JSON.parse(String(init?.body)));
    return respond();
  });
  const relay = createRelay({
    url: "https://office.test/",
    token: "SEND",
    machine: "work-pc",
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fetch: fetchMock,
  });

  return {
    relay,
    bodies,
    requests,
    listeners,
    fetchMock,
    change(next: OfficeState) {
      state = next;
      listeners.forEach((l) => l(next));
    },
    failWith(fn: () => Promise<Response>) {
      respond = fn;
    },
  };
}

async function tick(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("호스팅 전달기", () => {
  let h: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    h.relay.stop();
    vi.useRealTimers();
  });

  test("시작하면 바로 줄인 상태를 보내기 토큰과 함께 올린다", async () => {
    h = harness(withSessions(bash));

    h.relay.start();
    await tick(0);

    expect(h.requests).toEqual([{ url: "https://office.test/api/hosted/push", auth: "Bearer SEND" }]);
    expect(h.bodies[0]).toMatchObject({ machine: "work-pc", heartbeatSec: 20 });
    expect(JSON.stringify(h.bodies[0])).not.toContain("SECRET");
  });

  test("짧은 시간에 여러 번 바뀌어도 마지막 상태 하나만 보낸다", async () => {
    h = harness(empty);
    h.relay.start();
    await tick(0);
    h.fetchMock.mockClear();

    h.change(withSessions(bash));
    await tick(100);
    h.change(withSessions(bash, { ...bash, id: "t2" }));
    await tick(600);

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    const sent = h.bodies[h.bodies.length - 1] as { state: OfficeState };
    expect(sent.state.sessions.s1.characters.map((c) => c.id)).toEqual(["t1", "t2"]);
  });

  test("바뀐 것이 없어도 살아 있음 신호로 20초마다 다시 보낸다", async () => {
    h = harness(withSessions(bash));
    h.relay.start();
    await tick(0);

    await tick(20_000);

    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  test("연결된 세션이 없으면 신호 간격이 60초로 느려지고, 호스팅에도 그 간격을 알린다", async () => {
    h = harness(empty);
    h.relay.start();
    await tick(0);
    expect(h.bodies[0]).toMatchObject({ heartbeatSec: 60 });

    await tick(59_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    await tick(1_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  test("바뀌어서 보낸 것도 신호로 치고, 다음 신호는 거기서부터 센다", async () => {
    h = harness(withSessions(bash));
    h.relay.start();
    await tick(0);
    await tick(15_000);
    h.change(withSessions(bash, { ...bash, id: "t2" }));
    await tick(500);
    h.fetchMock.mockClear();

    await tick(19_000);
    expect(h.fetchMock).not.toHaveBeenCalled();
    await tick(1_000);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
  });

  test("전달이 실패해도 예외를 밖으로 내지 않고 다음 신호에서 다시 보낸다", async () => {
    h = harness(withSessions(bash));
    h.failWith(async () => {
      throw new Error("network down");
    });

    h.relay.start();
    await tick(0);
    h.failWith(async () => Response.json({ ok: true }));
    await tick(20_000);

    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  test("호스팅이 오류 코드를 돌려줘도 다음 신호에서 다시 보낸다", async () => {
    h = harness(withSessions(bash));
    h.failWith(async () => new Response("no", { status: 401 }));

    h.relay.start();
    await tick(0);
    await tick(20_000);

    expect(h.fetchMock).toHaveBeenCalledTimes(2);
  });

  test("전달 중에 바뀌면 끝난 직후 최신 상태를 한 번 더 보낸다", async () => {
    h = harness(empty);
    let release: (r: Response) => void = () => {};
    h.failWith(() => new Promise<Response>((resolve) => (release = resolve)));
    h.relay.start();
    await tick(0);

    h.change(withSessions(bash));
    await tick(600);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    h.failWith(async () => Response.json({ ok: true }));
    release(Response.json({ ok: true }));
    await tick(0);

    expect(h.fetchMock).toHaveBeenCalledTimes(2);
    const last = h.bodies[h.bodies.length - 1] as { state: OfficeState };
    expect(last.state.sessions.s1.characters).toHaveLength(1);
  });

  test("멈추면 더 보내지 않고 구독도 거둔다", async () => {
    h = harness(withSessions(bash));
    h.relay.start();
    await tick(0);

    h.relay.stop();
    h.change(withSessions());
    await tick(60_000);

    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.listeners.size).toBe(0);
  });
});
