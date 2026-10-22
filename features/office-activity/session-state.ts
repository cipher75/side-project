import type {
  Character,
  CharacterKind,
  OfficeState,
  Session,
} from "./types";

type Payload = Record<string, unknown>;

// 거절된 캐릭터가 퇴근 장면을 보여줄 시간. 이 시간이 지난 뒤 오는 이벤트에서 정리한다.
const DENIED_KEEP_MS = 8_000;
const LABEL_MAX = 40;
// Claude Code는 거절을 알려 주지 않는다. 허용 대기가 이 시간보다 길어진 뒤 새 호출이 시작되면 거절로 추정한다.
// 거의 동시에 시작된 병렬 호출을 거절로 오해하지 않기 위한 여유다.
const STALE_WAIT_MS = 3_000;

export function emptyOfficeState(): OfficeState {
  return { sessions: {}, order: [] };
}

export function applyHookEvent(
  state: OfficeState,
  payload: Payload,
  now: number
): OfficeState {
  const sessionId = text(payload.session_id);
  if (!sessionId) return state;

  const eventName = text(payload.hook_event_name);
  let session = pruneDenied(
    state.sessions[sessionId] ?? newSession(sessionId, payload),
    now
  );
  session = withName(session, payload);

  switch (eventName) {
    case "OfficeConnect":
      session = { ...session, connected: true };
      break;
    case "UserPromptSubmit":
      session = { ...denyWaiting(session, now), connected: true };
      break;
    case "PreToolUse":
      session = denyWaiting(session, now, STALE_WAIT_MS);
      session = { ...session, connected: true, characters: [...session.characters, startCharacter(payload, now)] };
      break;
    case "UserPromptExpansion":
      session = { ...session, connected: true, characters: addSlashSkill(session.characters, payload, now) };
      break;
    case "PermissionRequest":
      session = markWaiting(session, payload, now);
      break;
    case "PermissionDenied":
      session = markDenied(session, payload, now);
      break;
    case "PostToolUse":
    case "PostToolUseFailure":
      // 백그라운드로 시작한 sub-agent는 응답이 시작만 알린다. 끝났다는 이벤트가 오지 않으므로 턴이 끝날 때 정리한다.
      if (!isAsyncLaunch(payload)) session = finishCharacter(session, text(payload.tool_use_id));
      break;
    case "Stop":
      session = finishWorking(denyWaiting(session, now));
      break;
    case "SessionEnd":
      session = { ...finishAll(session), connected: false };
      break;
    default:
      session = { ...session, connected: true };
  }

  session = { ...session, lit: isLit(session) };
  return {
    sessions: { ...state.sessions, [sessionId]: session },
    order: state.order.includes(sessionId) ? state.order : [...state.order, sessionId],
  };
}

// 이벤트가 오지 않아도 시간이 지난 거절 캐릭터를 정리한다.
export function pruneOfficeState(state: OfficeState, now: number): OfficeState {
  let changed = false;
  const sessions: Record<string, Session> = {};
  for (const [id, session] of Object.entries(state.sessions)) {
    const pruned = pruneDenied(session, now);
    if (pruned !== session) changed = true;
    sessions[id] = pruned === session ? session : { ...pruned, lit: isLit(pruned) };
  }
  return changed ? { ...state, sessions } : state;
}

function newSession(id: string, payload: Payload): Session {
  return { id, name: sessionName(payload) ?? id.slice(0, 8), connected: false, lit: false, doneCount: 0, characters: [] };
}

function withName(session: Session, payload: Payload): Session {
  const name = sessionName(payload);
  return name && name !== session.name ? { ...session, name } : session;
}

function sessionName(payload: Payload): string | undefined {
  return text(payload.project) ?? lastSegment(text(payload.cwd));
}

function isLit(session: Session): boolean {
  return session.connected && (session.characters.length > 0 || session.doneCount === 0);
}

function pruneDenied(session: Session, now: number): Session {
  const kept = session.characters.filter(
    (c) => !(c.status === "denied" && c.deniedAt !== undefined && now - c.deniedAt > DENIED_KEEP_MS)
  );
  const removed = session.characters.length - kept.length;
  return removed ? { ...session, characters: kept, doneCount: session.doneCount + removed } : session;
}

function startCharacter(payload: Payload, now: number): Character {
  const toolName = text(payload.tool_name) ?? "tool";
  const input = payload.tool_input;
  return {
    id: text(payload.tool_use_id) ?? `${toolName}-${now}`,
    kind: kindOf(toolName),
    status: "working",
    label: labelOf(toolName, input),
    toolName,
    toolInput: input,
    since: now,
  };
}

// 슬래시로 직접 입력한 skill은 Skill tool 호출 이벤트가 없어서 확장 이벤트로 알아낸다.
// 끝났다는 이벤트도 따로 없으므로 턴이 끝나는 Stop에서 정리한다. 연결용 /office는 보여주지 않는다.
function addSlashSkill(characters: Character[], payload: Payload, now: number): Character[] {
  const name = text(payload.command_name);
  if (text(payload.expansion_type) !== "slash_command" || !name || name === "office") return characters;
  const id = `slash-${text(payload.prompt_id) ?? now}`;
  if (characters.some((c) => c.id === id)) return characters;
  return [
    ...characters,
    { id, kind: "skill", status: "working", label: `skill · ${name}`, toolName: "Skill", toolInput: { skill: name }, since: now },
  ];
}

function kindOf(toolName: string): CharacterKind {
  if (toolName === "Skill") return "skill";
  if (toolName === "Agent" || toolName === "Task") return "sub";
  return "tool";
}

function labelOf(toolName: string, input: unknown): string {
  const fields = isRecord(input) ? input : {};
  if (toolName === "Skill") return `skill · ${text(fields.skill) ?? text(fields.name) ?? "skill"}`;
  if (toolName === "Agent" || toolName === "Task") {
    return `서브에이전트 · ${text(fields.subagent_type) ?? text(fields.description) ?? "agent"}`;
  }
  const mcp = /^mcp__(.+?)__(.+)$/.exec(toolName);
  if (mcp) return truncate(`${mcp[1]} · ${mcp[2]}`, LABEL_MAX);
  const target = targetOf(fields);
  return truncate(target ? `${toolName} · ${target}` : toolName, LABEL_MAX);
}

function targetOf(fields: Record<string, unknown>): string | undefined {
  const path = text(fields.file_path) ?? text(fields.path) ?? text(fields.notebook_path);
  if (path) return lastSegment(path);
  const url = text(fields.url);
  if (url) return url.replace(/^https?:\/\//, "");
  return text(fields.command) ?? text(fields.pattern) ?? text(fields.query) ?? text(fields.description);
}

function markWaiting(session: Session, payload: Payload, now: number): Session {
  const toolName = text(payload.tool_name);
  const key = stable(payload.tool_input);
  const open = session.characters.filter((c) => c.status === "working" && c.toolName === toolName);
  const target = [...open].reverse().find((c) => stable(c.toolInput) === key) ?? open[open.length - 1];
  if (!target) return session;
  return replace(session, target.id, { status: "waiting", waitingAt: now });
}

// 끝나지 않은 허용 대기 호출을 거절로 추정한다. minWait가 있으면 그보다 오래 기다린 것만 대상으로 한다.
function denyWaiting(session: Session, now: number, minWait?: number): Session {
  const stale = (c: Character) =>
    c.status === "waiting" && (minWait === undefined || now - (c.waitingAt ?? now) > minWait);
  if (!session.characters.some(stale)) return session;
  return {
    ...session,
    characters: session.characters.map((c) => (stale(c) ? { ...c, status: "denied", deniedAt: now } : c)),
  };
}

// 일하던 호출만 끝난 것으로 정리하고, 허용 대기였다가 거절로 추정된 캐릭터는 퇴근 장면을 위해 남긴다.
function finishWorking(session: Session): Session {
  const working = session.characters.filter((c) => c.status === "working").length;
  return {
    ...session,
    characters: session.characters.filter((c) => c.status !== "working"),
    doneCount: session.doneCount + working,
  };
}

function markDenied(session: Session, payload: Payload, now: number): Session {
  const id = text(payload.tool_use_id);
  const toolName = text(payload.tool_name);
  const target =
    session.characters.find((c) => c.id === id) ??
    [...session.characters].reverse().find((c) => c.status === "waiting" && c.toolName === toolName);
  if (!target) return session;
  return replace(session, target.id, { status: "denied", deniedAt: now });
}

function isAsyncLaunch(payload: Payload): boolean {
  const response = payload.tool_response;
  return isRecord(response) && response.isAsync === true;
}

function finishCharacter(session: Session, id: string | undefined): Session {
  if (!id || !session.characters.some((c) => c.id === id)) return session;
  return {
    ...session,
    characters: session.characters.filter((c) => c.id !== id),
    doneCount: session.doneCount + 1,
  };
}

function finishAll(session: Session): Session {
  return {
    ...session,
    characters: [],
    doneCount: session.doneCount + session.characters.length,
  };
}

function replace(session: Session, id: string, patch: Partial<Character>): Session {
  return {
    ...session,
    characters: session.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lastSegment(path: string | undefined): string | undefined {
  return path?.split(/[\\/]/).filter(Boolean).pop();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((k) => `${k}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
