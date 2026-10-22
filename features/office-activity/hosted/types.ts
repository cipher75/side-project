import type { OfficeState } from "../types";

// PC의 로컬 서버가 호스팅으로 보내는 것: 줄인 상태와, 다음 살아 있음 신호까지 걸리는 시간.
export type HostedPush = {
  machine: string;
  heartbeatSec: number;
  state: OfficeState;
};

// 호스팅이 PC마다 하나씩 들고 있는 것. receivedAt은 호스팅 서버가 받은 시각이라 PC 시계가 틀려도 믿을 수 있다.
export type HostedMachine = HostedPush & { receivedAt: number };

// 보기 쪽이 가져가는 것. serverNow는 호스팅 서버의 지금 시각이라, 기기 시계와 상관없이 끊긴 시간을 잴 수 있다.
export type HostedSnapshot = {
  serverNow: number;
  machines: HostedMachine[];
};

// 호스팅이 상태를 어디에 두는지를 감춘다. 저장 기술(Upstash Redis)은 redis-rest.ts에만 있다.
export type HostedStore = {
  put(machine: HostedMachine): Promise<void>;
  all(): Promise<string[]>;
  remove(machines: string[]): Promise<void>;
};
