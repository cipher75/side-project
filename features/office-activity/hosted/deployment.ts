// 이 서버가 어디에서 도는지, 어떤 설정이 켜져 있는지를 환경 변수로 정한다.

type Env = Record<string, string | undefined>;

// Vercel에서 도는 서버는 호스팅 배포다. OFFICE_HOSTED=1은 내 PC에서 호스팅 모드를 시험하기 위한 스위치다.
export function isHostedDeployment(env: Env = process.env): boolean {
  return Boolean(env.VERCEL) || env.OFFICE_HOSTED === "1";
}

// 호스팅 쪽: 보내기 토큰(PC가 쓴다)과 보기 토큰(기기가 쓴다)을 둘 다 정해야 길이 열린다.
export function hostedSettingsFromEnv(env: Env = process.env): { sendToken: string; viewToken: string } | undefined {
  const sendToken = env.OFFICE_SEND_TOKEN;
  const viewToken = env.OFFICE_VIEW_TOKEN;
  if (!sendToken || !viewToken || sendToken === viewToken) return undefined;
  return { sendToken, viewToken };
}

// PC 쪽: 호스팅 주소와 보내기 토큰이 있으면 로컬 서버가 줄인 상태를 올린다.
export function relayConfigFromEnv(
  env: Env = process.env,
  computerName = "",
): { url: string; token: string; machine: string } | undefined {
  if (isHostedDeployment(env)) return undefined;
  const url = env.OFFICE_HOSTED_URL;
  const token = env.OFFICE_SEND_TOKEN;
  if (!url || !token) return undefined;
  const machine = safeMachineName(env.OFFICE_MACHINE_NAME || computerName) || "pc";
  return { url, token, machine };
}

// 호스팅이 받는 PC 이름은 영문, 숫자, 점, 밑줄, 공백, 하이픈만 쓴다.
function safeMachineName(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "").trim().slice(0, 64);
}
