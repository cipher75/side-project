import { describe, expect, test } from "vitest";

import { hostedHandlersFromEnv } from "./server";

const full = {
  OFFICE_SEND_TOKEN: "send",
  OFFICE_VIEW_TOKEN: "view",
  KV_REST_API_URL: "https://redis.test",
  KV_REST_API_TOKEN: "r",
};

describe("호스팅 길을 열 설정", () => {
  test("토큰 둘과 저장소가 모두 있으면 길을 연다", () => {
    expect(hostedHandlersFromEnv(full)).toBeDefined();
  });

  test("Upstash 이름으로 설정된 저장소도 받는다", () => {
    const upstash = { ...full, KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined, UPSTASH_REDIS_REST_URL: "https://r.test", UPSTASH_REDIS_REST_TOKEN: "r" };

    expect(hostedHandlersFromEnv(upstash)).toBeDefined();
  });

  test("저장소가 없으면 열지 않는다", () => {
    expect(hostedHandlersFromEnv({ ...full, KV_REST_API_URL: undefined })).toBeUndefined();
  });

  test("토큰이 하나라도 없으면 열지 않는다", () => {
    expect(hostedHandlersFromEnv({ ...full, OFFICE_VIEW_TOKEN: undefined })).toBeUndefined();
    expect(hostedHandlersFromEnv({ ...full, OFFICE_SEND_TOKEN: undefined })).toBeUndefined();
  });
});
