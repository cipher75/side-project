import type { HostedMachine, HostedStore } from "./types";

// Upstash Redis REST API로 PC 상태를 저장한다. 요청마다 끝나는 짧은 호출이라 서버리스에서 연결을 유지할 필요가 없다.
// 해시 하나(office:machines)에 PC마다 필드 하나를 둔다. PC끼리 서로의 쓰기를 덮어쓰지 않는다.
const KEY = "office:machines";

type RedisOptions = {
  url: string;
  token: string;
  fetch?: typeof fetch;
};

export function createRedisStore({ url, token, fetch: fetchImpl = fetch }: RedisOptions): HostedStore {
  async function command(args: string[]): Promise<unknown> {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!response.ok || body.error) throw new Error(`Redis ${args[0]} 실패: ${body.error ?? response.status}`);
    return body.result;
  }

  return {
    async put(machine: HostedMachine) {
      await command(["HSET", KEY, machine.machine, JSON.stringify(machine)]);
    },
    async all() {
      const flat = await command(["HGETALL", KEY]);
      if (!Array.isArray(flat)) return [];
      // 결과는 [필드, 값, 필드, 값, …] 순서다.
      return flat.filter((_, index) => index % 2 === 1).map(String);
    },
    async remove(machines: string[]) {
      if (machines.length === 0) return;
      await command(["HDEL", KEY, ...machines]);
    },
  };
}

// 호스팅 환경 변수에서 저장소를 만든다. Vercel 마켓플레이스가 넣는 이름 두 가지를 모두 받는다.
export function redisStoreFromEnv(env: Record<string, string | undefined> = process.env): HostedStore | undefined {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? createRedisStore({ url, token }) : undefined;
}
