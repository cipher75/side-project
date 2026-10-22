"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OfficeScene } from "./scene/office-scene";
import { KIND_STYLE, SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, lookFor } from "./scene/sprite";
import { emptyOfficeState } from "./session-state";
import type { CharacterKind, OfficeState, Session } from "./types";

// 사무실 화면: 서버가 보내는 상태를 구독해 세션마다 사무실을 보여준다. 화면은 보기 전용이다.
export function OfficeView() {
  const state = useOfficeState();
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

      <OfficeScene
        characters={session?.characters ?? []}
        lit={session?.lit ?? false}
        hadWork={(session?.doneCount ?? 0) > 0}
        connected={Boolean(session?.connected)}
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

function useOfficeState(): OfficeState {
  const [state, setState] = useState<OfficeState>(emptyOfficeState);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onmessage = (event) => setState(JSON.parse(event.data) as OfficeState);
    return () => source.close();
  }, []);

  return state;
}

function SessionBadges({ session }: { session: Session }) {
  const waiting = session.characters.filter((c) => c.status === "waiting").length;
  const working = session.characters.filter((c) => c.status === "working").length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {working > 0 ? <Badge>일하는 중 {working}</Badge> : null}
      {waiting > 0 ? <Badge variant="outline">? 허용 대기 {waiting}</Badge> : null}
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
  return session.lit ? "대기" : "퇴근";
}

function StatusDot({ session }: { session: Session }) {
  const waiting = session.characters.some((c) => c.status === "waiting");
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
