import { describe, expect, test } from "vitest";

import { hostedSettingsFromEnv, isHostedDeployment, relayConfigFromEnv } from "./deployment";

describe("어디에서 도는 서버인지", () => {
  test("Vercel에서 도는 서버는 호스팅 배포이고, 내 PC의 서버는 아니다", () => {
    expect(isHostedDeployment({ VERCEL: "1" })).toBe(true);
    expect(isHostedDeployment({})).toBe(false);
  });

  test("OFFICE_HOSTED=1이면 PC에서도 호스팅 배포처럼 돌려 시험할 수 있다", () => {
    expect(isHostedDeployment({ OFFICE_HOSTED: "1" })).toBe(true);
  });
});

describe("호스팅 쪽 설정", () => {
  test("두 토큰이 모두 있어야 호스팅 길을 연다", () => {
    expect(hostedSettingsFromEnv({ OFFICE_SEND_TOKEN: "s", OFFICE_VIEW_TOKEN: "v" })).toEqual({ sendToken: "s", viewToken: "v" });
    expect(hostedSettingsFromEnv({ OFFICE_SEND_TOKEN: "s" })).toBeUndefined();
    expect(hostedSettingsFromEnv({ OFFICE_VIEW_TOKEN: "v" })).toBeUndefined();
    expect(hostedSettingsFromEnv({})).toBeUndefined();
  });

  test("두 토큰이 같으면 보내기와 보기를 나눈 의미가 없어 열지 않는다", () => {
    expect(hostedSettingsFromEnv({ OFFICE_SEND_TOKEN: "same", OFFICE_VIEW_TOKEN: "same" })).toBeUndefined();
  });
});

describe("PC 쪽 전달기 설정", () => {
  const env = { OFFICE_HOSTED_URL: "https://office.example.app", OFFICE_SEND_TOKEN: "s" };

  test("호스팅 주소와 보내기 토큰이 있으면 전달기를 켠다", () => {
    expect(relayConfigFromEnv({ ...env, OFFICE_MACHINE_NAME: "work-pc" }, "host")).toEqual({
      url: "https://office.example.app",
      token: "s",
      machine: "work-pc",
    });
  });

  test("PC 이름이 없으면 컴퓨터 이름을 쓴다", () => {
    expect(relayConfigFromEnv(env, "my-laptop")?.machine).toBe("my-laptop");
  });

  test("컴퓨터 이름에 쓸 수 없는 글자가 있으면 바꾼다", () => {
    expect(relayConfigFromEnv(env, "내/PC")?.machine).toBe("PC");
  });

  test("주소나 토큰이 없으면 전달기를 켜지 않는다", () => {
    expect(relayConfigFromEnv({ OFFICE_SEND_TOKEN: "s" }, "h")).toBeUndefined();
    expect(relayConfigFromEnv({ OFFICE_HOSTED_URL: "https://x.app" }, "h")).toBeUndefined();
  });

  test("호스팅 배포에서는 전달기를 켜지 않는다", () => {
    expect(relayConfigFromEnv({ ...env, VERCEL: "1" }, "h")).toBeUndefined();
  });
});
