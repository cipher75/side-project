// Claude Code hook이 보낸 원본 이벤트를 메모리에 최근 순으로 보관한다.
// 서버가 꺼지면 사라지고, 이 PC 밖으로 나가지 않는다.

const MAX_EVENTS = 1000;

type RawEventLogGlobal = typeof globalThis & {
  __officeRawEvents?: RawHookEvent[];
};

export type RawHookEvent = {
  receivedAt: number;
  payload: Record<string, unknown>;
};

function store(): RawHookEvent[] {
  const g = globalThis as RawEventLogGlobal;
  g.__officeRawEvents ??= [];
  return g.__officeRawEvents;
}

export function recordRawEvent(
  payload: Record<string, unknown>,
  receivedAt = Date.now()
): RawHookEvent {
  const events = store();
  const event = { receivedAt, payload };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return event;
}

export function listRawEvents(): RawHookEvent[] {
  return [...store()];
}

export function clearRawEvents(): void {
  store().length = 0;
}
