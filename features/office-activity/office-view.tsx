"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OfficeScene } from "./scene/office-scene";
import { KIND_STYLE, SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, lookFor } from "./scene/sprite";
import { emptyOfficeState } from "./session-state";
import type { CharacterKind, OfficeState, Session } from "./types";

// 사무실 화면: 서버가 보내는 상태를 구독해 세션마다 사무실을 보여준다. 화면은 보기 전용이다.
export function OfficeView() {
  const { state, link, restarted, acknowledgeRestart } = useOfficeState();
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked && state.sessions[picked] ? picked : state.order[0];
  const session = selectedId ? state.sessions[selectedId] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Claude 사무실</h1>
          <p className="text-sm text-muted-foreground">
            이 PC에서 연결한 Claude Code · 데스크톱 세션의 활동을 보여줍니다
          </p>
        </div>
        {session ? <SessionBadges session={session} /> : null}
      </header>

      {link === "lost" ? (
        <Notice tone="danger">
          사무실 서버와 연결이 끊겼어요. 다시 연결하는 중이에요. 그동안 생긴 허용 대기는 이 화면에 보이지 않으니
          Claude Code나 앱에서 확인해 주세요.
        </Notice>
      ) : null}
      {restarted ? (
        <Notice tone="warning" action={<Button size="sm" variant="outline" onClick={acknowledgeRestart}>확인했어요</Button>}>
          사무실 서버가 다시 켜졌어요. 그전에 떠 있던 허용 대기는 이 화면에서 사라졌을 수 있으니 Claude Code나 앱에서
          확인해 주세요.
        </Notice>
      ) : null}

      {state.order.length > 0 ? (
        <Tabs value={selectedId} onValueChange={(value) => setPicked(String(value))}>
          <TabsList className="h-auto flex-wrap justify-start">
            {state.order.map((id) => (
              <TabsTrigger key={id} value={id}>
                <StatusDot session={state.sessions[id]} />
                {state.sessions[id].name}
                <span className="text-xs font-normal text-muted-foreground">
                  {statusText(state.sessions[id])}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {/* 세션마다 장면을 새로 만든다. 탭을 바꿨을 때 캐릭터가 퇴근하는 장면으로 보이지 않게 한다. */}
      <OfficeScene
        key={selectedId ?? "none"}
        characters={session?.characters ?? []}
        lit={session?.lit ?? false}
        hadWork={(session?.doneCount ?? 0) > 0}
        connected={Boolean(session?.connected)}
        alert={link === "lost" ? "연결이 끊겨 지금 상태를 알 수 없어요" : undefined}
      />

      {session ? (
        <Legend />
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>연결된 세션이 없어요</EmptyTitle>
            <EmptyDescription>
              Claude Code나 데스크톱 앱의 세션에서 <code>/office</code> 스킬을 실행하면 사무실에 불이 켜지고,
              그 세션의 tool · skill · sub-agent가 캐릭터로 나타납니다.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

// connecting: 처음 연결하는 중, open: 연결됨, lost: 끊김(브라우저가 알아서 다시 연결을 시도한다)
type Link = "connecting" | "open" | "lost";

// 서버가 보내는 상태를 구독한다. 연결이 끊기면 화면이 멈춘 채 정상처럼 보이지 않도록 알리고,
// 서버가 다시 켜진 것(instance가 바뀜)을 알아채면 사용자가 확인할 때까지 알린다.
function useOfficeState() {
  const [state, setState] = useState<OfficeState>(emptyOfficeState);
  const [link, setLink] = useState<Link>("connecting");
  const [restarted, setRestarted] = useState(false);
  const instance = useRef<string | undefined>(undefined);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onopen = () => setLink("open");
    source.onerror = () => setLink("lost");
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as OfficeState;
      if (instance.current && next.instance && next.instance !== instance.current) setRestarted(true);
      instance.current = next.instance ?? instance.current;
      setLink("open");
      setState(next);
    };
    return () => source.close();
  }, []);

  return { state, link, restarted, acknowledgeRestart: () => setRestarted(false) };
}

function Notice({ tone, action, children }: { tone: "danger" | "warning"; action?: React.ReactNode; children: React.ReactNode }) {
  const color =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${color}`}>
      <p className="font-medium">{children}</p>
      {action}
    </div>
  );
}

function SessionBadges({ session }: { session: Session }) {
  const waiting = session.characters.filter((c) => c.status === "waiting").length;
  const working = session.characters.filter((c) => c.status === "working").length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {working > 0 ? <Badge>일하는 중 {working}</Badge> : null}
      {waiting > 0 ? <Badge variant="outline">? 허용 대기 {waiting}</Badge> : null}
      {session.priorUnknown && session.connected ? (
        <Badge
          variant="outline"
          className="border-amber-400 text-amber-700 dark:text-amber-300"
          title="사무실 서버가 이 세션의 시작을 보지 못해, 그전의 허용 대기를 모를 수 있어요. 이번 턴이 끝나면 사라집니다."
        >
          이전 상태 모름 · 앱에서 확인
        </Badge>
      ) : null}
      {session.transcriptUnreliable ? (
        <Badge variant="destructive" title="transcript 형식이 예상과 달라, 거절과 중단은 턴이 끝날 때에야 보여줍니다">
          거절 바로 알기 꺼짐
        </Badge>
      ) : null}
      <Badge variant="secondary">오늘 완료 {session.doneCount}</Badge>
    </div>
  );
}

function statusText(session: Session): string {
  const waiting = session.characters.filter((c) => c.status === "waiting").length;
  if (!session.connected) return "종료";
  if (waiting > 0) return `허용 대기 ${waiting}`;
  const working = session.characters.filter((c) => c.status === "working").length;
  if (working > 0) return `진행 중 ${working}`;
  if (session.priorUnknown) return "확인 필요";
  return session.lit ? "대기" : "퇴근";
}

function StatusDot({ session }: { session: Session }) {
  const waiting = session.characters.some((c) => c.status === "waiting") || (session.connected && session.priorUnknown);
  const color = waiting ? "bg-amber-400" : session.lit ? "bg-emerald-500" : "bg-muted-foreground/50";
  return <span className={`size-2 rounded-full ${color}`} aria-hidden />;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <LegendSprite kind="tool" label="tool" />
      <LegendSprite kind="skill" label="skill" />
      <LegendSprite kind="sub" label="sub-agent" />
      <span>
        · 돌아다님 = 수행 중 · <b>?</b> = 허용 대기 · 문밖으로 = 완료
      </span>
    </div>
  );
}

function LegendSprite({ kind, label }: { kind: CharacterKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: KIND_STYLE[kind].accent }}>
      <canvas
        width={SPRITE_WIDTH}
        height={SPRITE_HEIGHT}
        className="h-[34px] w-6 [image-rendering:pixelated]"
        ref={(canvas) => {
          const context = canvas?.getContext("2d");
          if (context) drawSprite(context, { kind, look: lookFor(label), expr: "happy", frame: 0, moving: false });
        }}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
