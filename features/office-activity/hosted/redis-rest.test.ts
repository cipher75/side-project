import { describe, expect, test, vi } from "vitest";

import type { HostedMachine } from "./types";
import { createRedisStore } from "./redis-rest";

const machine: HostedMachine = {
  machine: "work-pc",
  heartbeatSec: 20,
  receivedAt: 5_000,
  state: { sessions: {}, order: [] },
};

function fakeFetch(result: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result }), { status: init.status ?? 200 }));
}

function sentBody(fetchMock: ReturnType<typeof fakeFetch>) {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}

describe("Upstash REST 저장소", () => {
  test("PC 상태는 해시 하나에 PC 이름을 필드로 저장한다", async () => {
    const fetchMock = fakeFetch(1);
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fetchMock });

    await store.put(machine);

    expect(fetchMock.mock.calls[0][0]).toBe("https://redis.test");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer T");
    expect(sentBody(fetchMock)).toEqual(["HSET", "office:machines", "work-pc", JSON.stringify(machine)]);
  });

  test("저장된 PC 상태를 한 번의 명령으로 모두 읽는다", async () => {
    const fetchMock = fakeFetch(["work-pc", '{"a":1}', "laptop", '{"b":2}']);
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fetchMock });

    const values = await store.all();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock)).toEqual(["HGETALL", "office:machines"]);
    expect(values).toEqual(['{"a":1}', '{"b":2}']);
  });

  test("저장된 것이 없으면 빈 목록이다", async () => {
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fakeFetch([]) });

    expect(await store.all()).toEqual([]);
  });

  test("오래된 PC 상태를 필드 이름으로 지운다", async () => {
    const fetchMock = fakeFetch(2);
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fetchMock });

    await store.remove(["old-1", "old-2"]);

    expect(sentBody(fetchMock)).toEqual(["HDEL", "office:machines", "old-1", "old-2"]);
  });

  test("지울 것이 없으면 요청하지 않는다", async () => {
    const fetchMock = fakeFetch(0);
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fetchMock });

    await store.remove([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("저장소가 오류를 돌려주면 실패로 알린다", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 401 }));
    const store = createRedisStore({ url: "https://redis.test", token: "T", fetch: fetchMock });

    await expect(store.all()).rejects.toThrow(/WRONGPASS|401/);
  });
});
