import { recordRawEvent } from "./raw-event-log";
import { applyHookEvent, emptyOfficeState, pruneOfficeState } from "./session-state";
import type { OfficeState } from "./types";

// 서버 전용 진입점: hook 이벤트를 받아 사무실 상태를 만들고, 화면에 알린다.

type Listener = (state: OfficeState) => void;
type OfficeStoreGlobal = typeof globalThis & {
  __officeStore?: { state: OfficeState; listeners: Set<Listener> };
};

function store() {
  const g = globalThis as OfficeStoreGlobal;
  g.__officeStore ??= { state: emptyOfficeState(), listeners: new Set() };
  return g.__officeStore;
}

export function ingestHookEvent(payload: Record<string, unknown>, now = Date.now()): void {
  recordRawEvent(payload, now);
  const s = store();
  s.state = applyHookEvent(s.state, payload, now);
  notify();
}

export function officeSnapshot(now = Date.now()): OfficeState {
  const s = store();
  s.state = pruneOfficeState(s.state, now);
  return s.state;
}

export function subscribeOffice(listener: Listener): () => void {
  const s = store();
  s.listeners.add(listener);
  return () => s.listeners.delete(listener);
}

// 거절 후 일정 시간이 지나면 이벤트가 없어도 화면에 정리된 상태를 알린다.
export function pruneAndNotify(now = Date.now()): void {
  const s = store();
  const next = pruneOfficeState(s.state, now);
  if (next === s.state) return;
  s.state = next;
  notify();
}

function notify() {
  const s = store();
  s.listeners.forEach((listener) => listener(s.state));
}
