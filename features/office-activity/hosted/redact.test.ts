import { describe, expect, test } from "vitest";

import type { Character, OfficeState, Session } from "../types";
import { redactState } from "./redact";

function character(overrides: Partial<Character>): Character {
  return {
    id: "t1",
    kind: "tool",
    status: "working",
    label: "",
    toolName: "Read",
    toolInput: {},
    since: 1_000,
    ...overrides,
  };
}

function stateWith(...characters: Character[]): OfficeState {
  const session: Session = {
    id: "s1",
    name: "side-project",
    connected: true,
    lit: true,
    doneCount: 3,
    characters,
  };
  return { sessions: { s1: session }, order: ["s1"], instance: "boot-1" };
}

function labelsOf(state: OfficeState): string[] {
  return state.sessions.s1.characters.map((c) => c.label);
}

describe("호스팅으로 보낼 라벨", () => {
  test("파일을 다루는 도구는 도구 이름과 파일 이름만 남기고 폴더는 버린다", () => {
    const redacted = redactState(
      stateWith(
        character({ id: "a", toolName: "Read", label: "Read · PRODUCT.md", toolInput: { file_path: "D:\\work\\private-client\\PRODUCT.md" } }),
        character({ id: "b", toolName: "Edit", toolInput: { file_path: "/home/me/secrets/.env" } })
      )
    );

    expect(labelsOf(redacted)).toEqual(["Read · PRODUCT.md", "Edit · .env"]);
    expect(JSON.stringify(redacted)).not.toContain("private-client");
    expect(JSON.stringify(redacted)).not.toContain("secrets");
  });

  test("명령, URL, 검색어는 도구 이름만 남기고 내용은 버린다", () => {
    const redacted = redactState(
      stateWith(
        character({ id: "a", toolName: "Bash", label: "Bash · curl -H 'Authorization: SECRET_TOKEN'", toolInput: { command: "curl -H 'Authorization: SECRET_TOKEN' https://x.test" } }),
        character({ id: "b", toolName: "WebFetch", toolInput: { url: "https://example.com/?key=SECRET_KEY" } }),
        character({ id: "c", toolName: "Grep", toolInput: { pattern: "password=SECRET_PATTERN" } })
      )
    );

    expect(labelsOf(redacted)).toEqual(["Bash", "WebFetch", "Grep"]);
    expect(JSON.stringify(redacted)).not.toContain("SECRET");
  });

  test("호출 입력은 어느 필드로도 남지 않는다", () => {
    const redacted = redactState(stateWith(character({ toolName: "Bash", toolInput: { command: "echo SECRET_INPUT" } })));

    expect(JSON.stringify(redacted)).not.toContain("SECRET_INPUT");
    expect(redacted.sessions.s1.characters[0].toolInput).toBeNull();
  });

  test("skill과 sub-agent는 이름만 남기고, 이름이 없으면 설명을 쓰지 않는다", () => {
    const redacted = redactState(
      stateWith(
        character({ id: "a", kind: "skill", toolName: "Skill", label: "skill · shadcn", toolInput: { skill: "shadcn", args: "SECRET_ARGS" } }),
        character({ id: "b", kind: "sub", toolName: "Agent", label: "서브에이전트 · Explore", toolInput: { subagent_type: "Explore", prompt: "SECRET_PROMPT" } }),
        character({ id: "c", kind: "sub", toolName: "Agent", label: "서브에이전트 · SECRET_DESCRIPTION", toolInput: { description: "SECRET_DESCRIPTION" } })
      )
    );

    expect(labelsOf(redacted)).toEqual(["skill · shadcn", "서브에이전트 · Explore", "서브에이전트"]);
    expect(JSON.stringify(redacted)).not.toContain("SECRET");
  });

  test("MCP 도구는 서버와 도구 이름으로 보여준다", () => {
    const redacted = redactState(stateWith(character({ toolName: "mcp__Claude_Browser__computer", toolInput: { text: "SECRET_TEXT" } })));

    expect(labelsOf(redacted)).toEqual(["Claude_Browser · computer"]);
  });
});

describe("호스팅으로 보낼 상태", () => {
  test("세션 이름, 불, 완료 건수, 캐릭터의 상태와 종류는 그대로 보낸다", () => {
    const redacted = redactState(stateWith(character({ id: "a", status: "waiting", kind: "tool", toolName: "Bash", toolInput: { command: "ls" } })));

    expect(redacted).toMatchObject({
      instance: "boot-1",
      order: ["s1"],
      sessions: { s1: { name: "side-project", connected: true, lit: true, doneCount: 3 } },
    });
    expect(redacted.sessions.s1.characters[0]).toMatchObject({ id: "a", status: "waiting", kind: "tool", toolName: "Bash" });
  });

  test("원래 상태를 바꾸지 않는다", () => {
    const original = stateWith(character({ toolName: "Bash", label: "Bash · ls -la", toolInput: { command: "ls -la" } }));

    redactState(original);

    expect(original.sessions.s1.characters[0]).toMatchObject({ label: "Bash · ls -la", toolInput: { command: "ls -la" } });
  });
});
