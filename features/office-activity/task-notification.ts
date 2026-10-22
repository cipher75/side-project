// 백그라운드로 시작한 sub-agent는 끝났다는 hook 이벤트가 오지 않는다.
// 대신 끝나는 순간 세션 transcript에 알림이 붙으므로, 거기서 시작 호출의 tool_use_id를 찾는다.

const FINISHED_STATUSES = new Set(["completed", "failed", "killed", "stopped"]);

export function finishedTaskToolUseIds(lines: string): string[] {
  const ids: string[] = [];
  for (const line of lines.split("\n")) {
    if (!line.includes("<task-notification>")) continue;
    const content = notificationContent(line);
    if (!content) continue;
    const toolUseId = tag(content, "tool-use-id");
    const status = tag(content, "status");
    if (toolUseId && status && FINISHED_STATUSES.has(status)) ids.push(toolUseId);
  }
  return ids;
}

// 같은 알림이 queue에 들어갈 때(enqueue)만 센다. 빠지거나 전달되는 줄은 같은 알림의 반복이다.
function notificationContent(line: string): string | undefined {
  try {
    const entry: unknown = JSON.parse(line);
    if (typeof entry !== "object" || entry === null) return undefined;
    const record = entry as Record<string, unknown>;
    if (record.type !== "queue-operation" || record.operation !== "enqueue") return undefined;
    return typeof record.content === "string" ? record.content : undefined;
  } catch {
    return undefined;
  }
}

function tag(content: string, name: string): string | undefined {
  return new RegExp(`<${name}>([^<]+)</${name}>`).exec(content)?.[1]?.trim();
}
