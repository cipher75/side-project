// 서버가 켜질 때 한 번 불린다. 내 PC의 로컬 서버라면, 호스팅 설정이 있을 때 줄인 상태를 올리는 전달기를 켠다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startHostedRelayFromEnv } = await import("@/features/office-activity/server");
  startHostedRelayFromEnv();
}
