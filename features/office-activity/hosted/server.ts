import { hostedSettingsFromEnv } from "./deployment";
import { createHostedHandlers } from "./handlers";
import { redisStoreFromEnv } from "./redis-rest";

// 호스팅 서버 전용 진입점: 환경 변수에서 토큰과 저장소를 읽어 두 길(올리기, 가져가기)을 만든다.
// 토큰이나 저장소 설정이 하나라도 없으면 undefined이고, 그러면 라우트는 존재하지 않는 것처럼 404로 답한다.
export function hostedHandlersFromEnv(env: Record<string, string | undefined> = process.env) {
  const settings = hostedSettingsFromEnv(env);
  const store = redisStoreFromEnv(env);
  if (!settings || !store) return undefined;
  return createHostedHandlers({ ...settings, store, now: () => Date.now() });
}
