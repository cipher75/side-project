import { describe, expect, test } from "vitest";

import { finishedTaskToolUseIds } from "./task-notification";

// 실제 세션 transcript에 남은 모양: 백그라운드 작업이 끝나면 queue-operation enqueue 줄이 붙는다.
function enqueue(toolUseId: string | undefined, status: string, operation = "enqueue") {
  const idLine = toolUseId ? `<tool-use-id>${toolUseId}</tool-use-id>\n` : "";
  return JSON.stringify({
    type: "queue-operation",
    operation,
    sessionId: "s1",
    content: `<task-notification>\n<task-id>a1b2c3</task-id>\n${idLine}<output-file>C:\\x\\a1b2c3.output</output-file>\n<status>${status}</status>\n<summary>Agent "x" finished</summary>\n</task-notification>`,
  });
}

describe("백그라운드 작업이 끝났다는 알림 찾기", () => {
  test("완료된 작업 알림에서 시작 호출의 tool_use_id를 돌려준다", () => {
    expect(finishedTaskToolUseIds(enqueue("toolu_A", "completed"))).toEqual(["toolu_A"]);
  });

  test("사용자가 중단하거나 실패한 작업도 끝난 것으로 본다", () => {
    const lines = [enqueue("toolu_K", "killed"), enqueue("toolu_F", "failed")].join("\n");

    expect(finishedTaskToolUseIds(lines)).toEqual(["toolu_K", "toolu_F"]);
  });

  test("아직 실행 중이라는 알림은 끝난 것으로 보지 않는다", () => {
    expect(finishedTaskToolUseIds(enqueue("toolu_R", "running"))).toEqual([]);
  });

  test("같은 알림이 queue에서 빠지는 remove 줄은 무시한다", () => {
    expect(finishedTaskToolUseIds(enqueue("toolu_A", "completed", "remove"))).toEqual([]);
  });

  test("tool_use_id가 없는 알림과 알림이 아닌 줄은 무시한다", () => {
    const lines = [
      enqueue(undefined, "completed"),
      JSON.stringify({ type: "user", message: { role: "user", content: "<task-notification> 이라고 말했다" } }),
      "not json <task-notification>",
    ].join("\n");

    expect(finishedTaskToolUseIds(lines)).toEqual([]);
  });
});
