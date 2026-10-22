// 클라이언트에서 쓰는 공개 API. 서버 전용 기능은 "./server"로 따로 가져온다.
export { OfficeView } from "./office-view";
export { HostedOfficeView } from "./hosted/hosted-office-view";
export { isHostedDeployment } from "./hosted/deployment";
export type { Character, OfficeState, Session } from "./types";
