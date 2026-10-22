import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { HostedSnapshot } from "./types";
import { HostedOfficeView } from "./hosted-office-view";

const TOKEN_KEY = "office.viewToken";

function snapshot(overrides: { receivedAgoSec?: number; instance?: string } = {}): HostedSnapshot {
  const serverNow = 10_000_000;
  return {
    serverNow,
    machines: [
      {
        machine: "work-pc",
        heartbeatSec: 20,
        receivedAt: serverNow - (overrides.receivedAgoSec ?? 3) * 1000,
        state: {
          instance: overrides.instance ?? "boot-1",
          order: ["s1"],
          sessions: {
            s1: {
              id: "s1",
              name: "side-project",
              connected: true,
              lit: true,
              doneCount: 2,
              characters: [{ id: "t1", kind: "tool", status: "waiting", label: "Bash", toolName: "Bash", toolInput: null, since: 1 }],
            },
          },
        },
      },
    ],
  };
}

function respondWith(fn: () => Response | Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(async () => fn());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // jsdom에는 canvas 2D가 없어 그리기를 건너뛴다.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("호스팅 화면: 토큰", () => {
  test("토큰이 없으면 입력 화면만 보이고, 서버에는 아무것도 묻지 않는다", () => {
    const fetchMock = respondWith(() => Response.json(snapshot()));

    render(<HostedOfficeView />);

    expect(screen.getByLabelText("보기 토큰")).toBeInTheDocument();
    expect(screen.queryByText("side-project")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("토큰을 넣으면 그 토큰으로 상태를 가져와 사무실을 보여주고, 이 기기에 기억한다", async () => {
    const fetchMock = respondWith(() => Response.json(snapshot()));
    render(<HostedOfficeView />);

    fireEvent.change(screen.getByLabelText("보기 토큰"), { target: { value: "view-token-456" } });
    fireEvent.click(screen.getByRole("button", { name: "열기" }));

    expect(await screen.findByRole("tab", { name: /side-project/ })).toBeInTheDocument();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer view-token-456");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/hosted/state");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("view-token-456");
  });

  test("기억된 토큰이 있으면 다시 묻지 않고 바로 가져온다", async () => {
    window.localStorage.setItem(TOKEN_KEY, "saved-token");
    const fetchMock = respondWith(() => Response.json(snapshot()));

    render(<HostedOfficeView />);

    expect(await screen.findByRole("tab", { name: /side-project/ })).toBeInTheDocument();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer saved-token");
  });

  test("토큰이 맞지 않으면 기억한 토큰을 지우고 다시 입력받는다", async () => {
    window.localStorage.setItem(TOKEN_KEY, "old-token");
    respondWith(() => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));

    render(<HostedOfficeView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("토큰이 맞지 않아요");
    expect(screen.getByLabelText("보기 토큰")).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("호스팅 화면: 상태", () => {
  beforeEach(() => window.localStorage.setItem(TOKEN_KEY, "t"));

  test("허용 대기 캐릭터와 세션 상태가 로컬 화면과 같은 방식으로 보인다", async () => {
    respondWith(() => Response.json(snapshot()));

    render(<HostedOfficeView />);

    expect(await screen.findByText("? 허용 대기 1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /side-project.*허용 대기 1/ })).toBeInTheDocument();
  });

  test("PC의 소식이 끊기면 안내하고 세션을 소식 끊김으로 보여준다", async () => {
    respondWith(() => Response.json(snapshot({ receivedAgoSec: 300 })));

    render(<HostedOfficeView />);

    expect(await screen.findByText(/PC\(work-pc\)에서 소식이 끊겼어요 · 마지막 상태 5분 전/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /side-project.*소식 끊김/ })).toBeInTheDocument();
  });

  test("호스팅에 닿지 못하면 연결이 끊겼다고 알린다", async () => {
    respondWith(() => {
      throw new Error("offline");
    });

    render(<HostedOfficeView />);

    await waitFor(() => expect(screen.getByText(/사무실 서버와 연결이 끊겼어요/)).toBeInTheDocument());
  });

  test("PC의 로컬 서버가 다시 켜졌으면 확인하라고 알리고, 확인하면 거둔다", async () => {
    let instance = "boot-1";
    respondWith(() => Response.json(snapshot({ instance })));
    render(<HostedOfficeView />);
    await screen.findByRole("tab", { name: /side-project/ });

    instance = "boot-2";
    // 탭이 다시 보이면 바로 한 번 더 가져온다.
    fireEvent(document, new Event("visibilitychange"));

    expect(await screen.findByText(/사무실 서버가 다시 켜졌어요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    expect(screen.queryByText(/사무실 서버가 다시 켜졌어요/)).not.toBeInTheDocument();
  });

  test("가져오는 중에 탭이 다시 보여도 같은 요청을 겹쳐 보내지 않는다", async () => {
    let release: (response: Response) => void = () => {};
    const fetchMock = respondWith(() => new Promise<Response>((resolve) => (release = resolve)));
    render(<HostedOfficeView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent(document, new Event("visibilitychange"));
    fireEvent(document, new Event("visibilitychange"));
    release(Response.json(snapshot()));

    await screen.findByRole("tab", { name: /side-project/ });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("연결된 PC가 없으면 세션을 연결하라는 안내가 보인다", async () => {
    respondWith(() => Response.json({ serverNow: 1, machines: [] }));

    render(<HostedOfficeView />);

    // 장면 안의 문구와 아래 안내가 모두 같은 말을 한다.
    expect((await screen.findAllByText("연결된 세션이 없어요")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
