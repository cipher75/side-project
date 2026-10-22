import { listRawEvents } from "@/features/office-activity/raw-event-log";
import { ingestHookEvent } from "@/features/office-activity/server";

// hook이 보낸 이벤트는 응답 본문을 비워 두어 Claude Code의 동작(허용 여부 등)에 영향을 주지 않는다.
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  ingestHookEvent(payload as Record<string, unknown>);
  return Response.json({});
}

// 개발 중 hook이 실제로 무엇을 보내는지 확인하기 위한 원본 이벤트 목록.
export async function GET() {
  return Response.json(listRawEvents());
}
