import { NextResponse, type NextRequest } from "next/server";

// 로컬 서버의 hook 수신·원본 이벤트·스트림은 이 PC의 사무실 주소로 들어온 요청만 받는다.
// 다른 도메인 이름을 127.0.0.1로 바꿔 붙이는 DNS rebinding 페이지가 같은 출처인 척 원본 이벤트를 읽어 가지 못하게 Host를 확인한다.
const ALLOWED_HOSTS = new Set(["127.0.0.1:4747", "localhost:4747"]);

export function proxy(request: NextRequest) {
  if (!ALLOWED_HOSTS.has(request.headers.get("host") ?? "")) {
    return new NextResponse(null, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/events", "/api/stream"],
};
