import type { OfficeState } from "../types";
import { redactState } from "./redact";
import type { HostedPush } from "./types";

// PC의 로컬 서버가 줄인 상태를 호스팅으로 올린다. 바뀔 때 보내고, 바뀌지 않아도 살아 있음 신호로 다시 보낸다.
// 전달이 실패하거나 느려도 hook 응답과 로컬 화면에는 영향이 없도록, 이 안의 모든 실패는 여기서 끝난다.

const CHANGE_DELAY_MS = 500;
const ACTIVE_HEARTBEAT_SEC = 20;
const IDLE_HEARTBEAT_SEC = 60;
const REQUEST_TIMEOUT_MS = 5_000;

type RelayOptions = {
  url: string;
  token: string;
  machine: string;
  getState: () => OfficeState;
  subscribe: (listener: (state: OfficeState) => void) => () => void;
  fetch?: typeof fetch;
  onError?: (message: string) => void;
};

export function createRelay(options: RelayOptions) {
  const { token, machine, getState, subscribe, fetch: fetchImpl = fetch, onError = warnOnce() } = options;
  const endpoint = `${options.url.replace(/\/+$/, "")}/api/hosted/push`;

  let running = false;
  let inFlight = false;
  let dirty = false;
  let unsubscribe: (() => void) | undefined;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;

  async function send(): Promise<void> {
    if (!running) return;
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    dirty = false;
    clearTimeout(heartbeatTimer);

    const state = getState();
    const heartbeatSec = heartbeatFor(state);
    const body: HostedPush = { machine, heartbeatSec, state: redactState(state) };
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) onError(`호스팅이 ${response.status}로 응답했어요`);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      inFlight = false;
    }

    if (!running) return;
    if (dirty) {
      void send();
      return;
    }
    heartbeatTimer = setTimeout(() => void send(), heartbeatSec * 1000);
  }

  function onChange() {
    if (changeTimer) return;
    changeTimer = setTimeout(() => {
      changeTimer = undefined;
      void send();
    }, CHANGE_DELAY_MS);
  }

  return {
    start() {
      if (running) return;
      running = true;
      unsubscribe = subscribe(onChange);
      void send();
    },
    stop() {
      running = false;
      unsubscribe?.();
      unsubscribe = undefined;
      clearTimeout(changeTimer);
      clearTimeout(heartbeatTimer);
      changeTimer = undefined;
      heartbeatTimer = undefined;
    },
  };
}

// 연결된 세션이 있으면 짧게, 없으면 길게 신호를 보낸다. 호스팅은 이 값으로 소식이 끊겼는지 판단한다.
function heartbeatFor(state: OfficeState): number {
  const active = Object.values(state.sessions).some((session) => session.connected);
  return active ? ACTIVE_HEARTBEAT_SEC : IDLE_HEARTBEAT_SEC;
}

// 같은 오류가 계속 나도 로그가 넘치지 않게, 메시지가 바뀔 때만 알린다.
function warnOnce() {
  let last = "";
  return (message: string) => {
    if (message === last) return;
    last = message;
    console.warn(`[office] 호스팅 전달 실패: ${message}`);
  };
}
