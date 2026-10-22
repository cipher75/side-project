import { describe, expect, test } from "vitest";

import { applyHookEvent, emptyOfficeState } from "./session-state";
import type { OfficeState } from "./types";

const S = "session-1";

function apply(state: OfficeState, ...payloads: Record<string, unknown>[]) {
  return payloads.reduce<OfficeState>(
    (current, payload, i) => applyHookEvent(current, payload, 1_000 + i),
    state
  );
}

function session(state: OfficeState, id = S) {
  const found = state.sessions[id];
  if (!found) throw new Error(`session ${id} not found`);
  return found;
}

const connect = {
  hook_event_name: "OfficeConnect",
  session_id: S,
  project: "side-project",
};

describe("연결", () => {
  test("연결 신호를 받으면 프로젝트 이름의 세션이 만들어지고 사무실에 불이 켜진다", () => {
    const state = apply(emptyOfficeState(), connect);

    expect(session(state)).toMatchObject({
      id: S,
      name: "side-project",
      connected: true,
      lit: true,
      characters: [],
    });
  });

  test("연결 신호 없이 첫 이벤트가 와도 cwd 폴더 이름으로 세션이 만들어진다", () => {
    const state = apply(emptyOfficeState(), {
      hook_event_name: "UserPromptSubmit",
      session_id: S,
      cwd: "D:\\claude\\side-project",
    });

    expect(session(state)).toMatchObject({ name: "side-project", lit: true });
  });
});

describe("수행 중", () => {
  test("tool 호출이 시작되면 하는 일이 라벨인 tool 캐릭터가 생긴다", () => {
    const state = apply(emptyOfficeState(), connect, {
      hook_event_name: "PreToolUse",
      session_id: S,
      tool_use_id: "t1",
      tool_name: "Read",
      tool_input: { file_path: "D:\\claude\\side-project\\PRODUCT.md" },
    });

    expect(session(state).characters).toEqual([
      expect.objectContaining({
        id: "t1",
        kind: "tool",
        status: "working",
        label: "Read · PRODUCT.md",
      }),
    ]);
  });

  test("Bash 명령은 라벨에서 길이를 줄여 보여준다", () => {
    const command = "bun run typecheck && bun run lint && bun run test && bun run build";
    const state = apply(emptyOfficeState(), connect, {
      hook_event_name: "PreToolUse",
      session_id: S,
      tool_use_id: "t1",
      tool_name: "Bash",
      tool_input: { command },
    });

    const [character] = session(state).characters;
    expect(character.label.startsWith("Bash · bun run typecheck")).toBe(true);
    expect(character.label.length).toBeLessThanOrEqual(40);
  });

  test("Agent 호출은 sub-agent, Skill 호출은 skill 캐릭터가 된다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      {
        hook_event_name: "PreToolUse",
        session_id: S,
        tool_use_id: "a1",
        tool_name: "Agent",
        tool_input: { subagent_type: "Explore", description: "훅 문서 조사" },
      },
      {
        hook_event_name: "PreToolUse",
        session_id: S,
        tool_use_id: "k1",
        tool_name: "Skill",
        tool_input: { skill: "shadcn" },
      }
    );

    expect(session(state).characters).toEqual([
      expect.objectContaining({ id: "a1", kind: "sub", label: "서브에이전트 · Explore" }),
      expect.objectContaining({ id: "k1", kind: "skill", label: "skill · shadcn" }),
    ]);
  });

  test("호출이 끝나면 캐릭터가 사라지고 한 번 일이 있었던 세션은 불이 꺼진다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      {
        hook_event_name: "PreToolUse",
        session_id: S,
        tool_use_id: "t1",
        tool_name: "Read",
        tool_input: { file_path: "a.md" },
      },
      { hook_event_name: "PostToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read" }
    );

    expect(session(state)).toMatchObject({ characters: [], doneCount: 1, lit: false });
  });

  test("불이 꺼진 뒤 새 호출이 시작되면 다시 켜진다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read", tool_input: {} },
      { hook_event_name: "PostToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read" },
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t2", tool_name: "Read", tool_input: {} }
    );

    expect(session(state)).toMatchObject({ lit: true, doneCount: 1 });
    expect(session(state).characters).toHaveLength(1);
  });

  test("실패로 끝난 호출도 캐릭터가 나간다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Bash", tool_input: { command: "false" } },
      { hook_event_name: "PostToolUseFailure", session_id: S, tool_use_id: "t1", tool_name: "Bash", error: "exit 1" }
    );

    expect(session(state).characters).toEqual([]);
  });
});

describe("백그라운드로 시작한 sub-agent", () => {
  const launch = {
    hook_event_name: "PreToolUse",
    session_id: S,
    tool_use_id: "a1",
    tool_name: "Agent",
    tool_input: { subagent_type: "Explore" },
  };
  const launched = {
    hook_event_name: "PostToolUse",
    session_id: S,
    tool_use_id: "a1",
    tool_name: "Agent",
    tool_response: { isAsync: true, status: "async_launched", agentId: "agent-1" },
  };

  test("시작만 알리는 응답이 와도 sub-agent 캐릭터는 턴이 끝날 때까지 일한다", () => {
    const state = apply(emptyOfficeState(), connect, launch, launched);

    expect(session(state).characters).toEqual([expect.objectContaining({ id: "a1", status: "working" })]);
    expect(session(state).doneCount).toBe(0);
  });

  test("턴이 끝나면 그 sub-agent 캐릭터도 나간다", () => {
    const state = apply(emptyOfficeState(), connect, launch, launched, { hook_event_name: "Stop", session_id: S });

    expect(session(state)).toMatchObject({ characters: [], doneCount: 1 });
  });

  test("바로 끝나는 일반 Agent 호출은 응답이 오면 나간다", () => {
    const state = apply(emptyOfficeState(), connect, launch, {
      ...launched,
      tool_response: { status: "completed", content: [] },
    });

    expect(session(state).characters).toEqual([]);
  });
});

describe("슬래시로 직접 호출한 skill", () => {
  const expansion = {
    hook_event_name: "UserPromptExpansion",
    session_id: S,
    prompt_id: "p1",
    expansion_type: "slash_command",
    command_name: "shadcn",
    prompt: "/shadcn",
  };

  test("슬래시 명령으로 skill을 호출하면 skill 캐릭터가 생기고 턴이 끝나면 나간다", () => {
    const running = apply(emptyOfficeState(), connect, expansion);
    expect(session(running).characters).toEqual([
      expect.objectContaining({ kind: "skill", status: "working", label: "skill · shadcn" }),
    ]);

    const stopped = apply(running, { hook_event_name: "Stop", session_id: S });
    expect(session(stopped).characters).toEqual([]);
  });

  test("연결용 /office 호출은 캐릭터로 만들지 않는다", () => {
    const state = apply(emptyOfficeState(), connect, { ...expansion, command_name: "office", prompt: "/office" });

    expect(session(state).characters).toEqual([]);
  });
});

describe("MCP tool 이름", () => {
  test("mcp__서버__도구 이름은 서버와 도구로 나눠 읽기 쉽게 보여준다", () => {
    const state = apply(emptyOfficeState(), connect, {
      hook_event_name: "PreToolUse",
      session_id: S,
      tool_use_id: "m1",
      tool_name: "mcp__Claude_Browser__computer",
      tool_input: { action: "screenshot" },
    });

    expect(session(state).characters[0]).toMatchObject({ kind: "tool", label: "Claude_Browser · computer" });
  });
});

describe("허용 대기와 거절", () => {
  const bash = { command: "git push" };
  const start = [
    connect,
    { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read", tool_input: { file_path: "a.md" } },
    { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t2", tool_name: "Bash", tool_input: bash },
  ];

  test("허용 요청이 오면 같은 호출의 캐릭터만 허용 대기가 된다", () => {
    const state = apply(emptyOfficeState(), ...start, {
      hook_event_name: "PermissionRequest",
      session_id: S,
      tool_name: "Bash",
      tool_input: bash,
    });

    expect(session(state).characters.map((c) => [c.id, c.status])).toEqual([
      ["t1", "working"],
      ["t2", "waiting"],
    ]);
  });

  test("허용된 호출이 끝나면 허용 대기 캐릭터도 나간다", () => {
    const state = apply(
      emptyOfficeState(),
      ...start,
      { hook_event_name: "PermissionRequest", session_id: S, tool_name: "Bash", tool_input: bash },
      { hook_event_name: "PostToolUse", session_id: S, tool_use_id: "t2", tool_name: "Bash" }
    );

    expect(session(state).characters.map((c) => c.id)).toEqual(["t1"]);
  });

  test("거절되면 그 캐릭터는 거절됨 상태가 되고 거절 수가 기록된다", () => {
    const state = apply(
      emptyOfficeState(),
      ...start,
      { hook_event_name: "PermissionRequest", session_id: S, tool_name: "Bash", tool_input: bash },
      { hook_event_name: "PermissionDenied", session_id: S, tool_use_id: "t2", tool_name: "Bash", tool_input: bash, reason: "no" }
    );

    expect(session(state).characters.map((c) => [c.id, c.status])).toEqual([
      ["t1", "working"],
      ["t2", "denied"],
    ]);
  });

  test("거절된 캐릭터는 시간이 지난 뒤 다음 이벤트에서 정리된다", () => {
    let state = apply(
      emptyOfficeState(),
      ...start,
      { hook_event_name: "PermissionRequest", session_id: S, tool_name: "Bash", tool_input: bash },
      { hook_event_name: "PermissionDenied", session_id: S, tool_use_id: "t2", tool_name: "Bash", tool_input: bash }
    );
    state = applyHookEvent(state, { hook_event_name: "PostToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read" }, 60_000);

    expect(session(state).characters).toEqual([]);
  });
});

// Claude Code는 거절을 알려 주지 않으므로, 끝나지 않은 허용 대기 호출은 다음 이벤트에서 거절로 추정한다.
describe("허용 거절 추정", () => {
  const command = { command: "git push" };
  const waitingState = () => {
    let state = applyHookEvent(emptyOfficeState(), connect, 1_000);
    state = applyHookEvent(state, { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Bash", tool_input: command }, 2_000);
    return applyHookEvent(state, { hook_event_name: "PermissionRequest", session_id: S, tool_name: "Bash", tool_input: command }, 2_030);
  };
  const statusOf = (state: OfficeState) => session(state).characters.map((c) => [c.id, c.status]);

  test("허용 대기 중 새 프롬프트가 오면 거절로 보고 거절됨 상태가 된다", () => {
    const state = applyHookEvent(waitingState(), { hook_event_name: "UserPromptSubmit", session_id: S, prompt: "다른 걸 해줘" }, 9_000);

    expect(statusOf(state)).toEqual([["t1", "denied"]]);
  });

  test("허용 대기 중 Stop이 오면 거절로 보고, 일하던 호출은 끝난 것으로 정리한다", () => {
    let state = waitingState();
    state = applyHookEvent(state, { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t2", tool_name: "Read", tool_input: {} }, 2_040);
    state = applyHookEvent(state, { hook_event_name: "Stop", session_id: S }, 9_000);

    expect(statusOf(state)).toEqual([["t1", "denied"]]);
    expect(session(state).doneCount).toBe(1);
  });

  test("3초 넘게 기다린 뒤 새 호출이 시작되면 거절로 본다", () => {
    const state = applyHookEvent(
      waitingState(),
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t2", tool_name: "Read", tool_input: {} },
      5_100
    );

    expect(statusOf(state)).toEqual([["t1", "denied"], ["t2", "working"]]);
  });

  test("거의 동시에 시작된 병렬 호출은 거절로 보지 않는다", () => {
    const state = applyHookEvent(
      waitingState(),
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t2", tool_name: "Read", tool_input: {} },
      4_000
    );

    expect(statusOf(state)).toEqual([["t1", "waiting"], ["t2", "working"]]);
  });

  test("허용되어 호출이 끝나면 거절로 보지 않고 그냥 나간다", () => {
    let state = waitingState();
    state = applyHookEvent(state, { hook_event_name: "PostToolUse", session_id: S, tool_use_id: "t1", tool_name: "Bash" }, 6_000);
    state = applyHookEvent(state, { hook_event_name: "UserPromptSubmit", session_id: S }, 9_000);

    expect(session(state).characters).toEqual([]);
    expect(session(state).doneCount).toBe(1);
  });

  test("일하는 중인 호출은 새 프롬프트가 와도 그대로 둔다", () => {
    let state = applyHookEvent(emptyOfficeState(), connect, 1_000);
    state = applyHookEvent(state, { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read", tool_input: {} }, 2_000);
    state = applyHookEvent(state, { hook_event_name: "UserPromptSubmit", session_id: S }, 9_000);

    expect(statusOf(state)).toEqual([["t1", "working"]]);
  });
});

describe("세션 마무리", () => {
  test("Stop 이벤트가 오면 남은 캐릭터가 모두 나간다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      { hook_event_name: "PreToolUse", session_id: S, tool_use_id: "t1", tool_name: "Read", tool_input: {} },
      { hook_event_name: "Stop", session_id: S }
    );

    expect(session(state)).toMatchObject({ characters: [], doneCount: 1 });
  });

  test("SessionEnd가 오면 세션이 연결 해제되고 불이 꺼진다", () => {
    const state = apply(emptyOfficeState(), connect, {
      hook_event_name: "SessionEnd",
      session_id: S,
    });

    expect(session(state)).toMatchObject({ connected: false, lit: false, characters: [] });
  });

  test("세션이 여럿이면 서로 영향을 주지 않는다", () => {
    const state = apply(
      emptyOfficeState(),
      connect,
      { hook_event_name: "OfficeConnect", session_id: "session-2", project: "blog" },
      { hook_event_name: "PreToolUse", session_id: "session-2", tool_use_id: "x", tool_name: "Read", tool_input: {} }
    );

    expect(session(state).characters).toEqual([]);
    expect(session(state, "session-2").characters).toHaveLength(1);
    expect(state.order).toEqual([S, "session-2"]);
  });

  test("session_id가 없는 이벤트는 무시한다", () => {
    const state = apply(emptyOfficeState(), { hook_event_name: "PreToolUse" });

    expect(state.order).toEqual([]);
  });
});
