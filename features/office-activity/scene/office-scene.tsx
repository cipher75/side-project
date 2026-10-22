"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { cn } from "cn";

import { SceneEngine, type SceneCharacter, type Walker } from "./scene-engine";
import { drawOffice } from "./office-background";
import { SCENE_HEIGHT, SCENE_WIDTH } from "./layout";
import styles from "./office-scene.module.css";
import { KIND_STYLE, SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, lookFor } from "./sprite";

type OfficeSceneProps = {
  characters: SceneCharacter[];
  lit: boolean;
  // 한 번이라도 일이 끝난 세션인지에 따라 불이 꺼진 이유를 다르게 안내한다.
  hadWork: boolean;
  connected: boolean;
};

export function OfficeScene({ characters, lit, hadWork, connected }: OfficeSceneProps) {
  const [engine] = useState(() => new SceneEngine());
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const bgRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = bgRef.current?.getContext("2d");
    if (context) drawOffice(context);
  }, []);

  useEffect(() => {
    engine.sync(characters, lit);
  }, [engine, characters, lit]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      // 백그라운드 탭처럼 프레임이 드물게 와도 실제 시간과 비슷하게 움직이도록 한 번에 최대 0.5초까지 진행한다.
      engine.step(Math.min(0.5, (now - last) / 1000));
      last = now;
      redraw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

  const walkers = engine.walkers;
  const empty = walkers.length === 0;
  const note = !connected
    ? "연결된 세션이 없어요"
    : engine.lit
      ? "첫 업무를 기다리는 중이에요"
      : hadWork
        ? "모두 퇴근했어요 · 불이 꺼졌어요"
        : "";

  return (
    <div
      className={cn(styles.scene, engine.lit ? styles.on : styles.off)}
      role="img"
      aria-label="사무실 장면"
    >
      <canvas ref={bgRef} className={styles.bg} width={SCENE_WIDTH} height={SCENE_HEIGHT} />
      <div className={styles.layer}>
        <div className={cn(styles.sign, styles.signRoom)} style={{ left: "calc(263 * var(--p))", top: "calc(53 * var(--p))" }}>
          허용 대기 회의실
        </div>
        <div className={cn(styles.sign, styles.signExit)} style={{ left: "calc(64 * var(--p))", top: "calc(166 * var(--p))" }}>
          퇴근
        </div>
      </div>
      <div className={styles.layer}>
        {walkers.map((w) => (
          <WalkerSprite key={w.id} walker={w} />
        ))}
      </div>
      <div className={styles.night} />
      <div className={styles.layer}>
        {walkers.map((w) => (
          <WalkerBubble key={w.id} walker={w} />
        ))}
      </div>
      {empty && note ? <div className={styles.note}>{note}</div> : null}
    </div>
  );
}

function WalkerSprite({ walker }: { walker: Walker }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = lookFor(walker.id);

  useEffect(() => {
    const context = ref.current?.getContext("2d");
    if (context) {
      drawSprite(context, { kind: walker.kind, look, expr: walker.expr, frame: walker.frame, moving: walker.moving });
    }
  });

  return (
    <div
      className={cn(styles.char, !walker.moving && styles.bob, walker.fading && styles.fading)}
      style={{ ...position(walker), zIndex: Math.round(walker.y) }}
    >
      <canvas
        ref={ref}
        width={SPRITE_WIDTH}
        height={SPRITE_HEIGHT}
        style={{ transform: `scaleX(${walker.flip})` }}
      />
    </div>
  );
}

function WalkerBubble({ walker }: { walker: Walker }) {
  const edge = walker.x < 70 ? styles.edgeLeft : walker.x > 262 ? styles.edgeRight : "";
  const kindColor = { "--kind": KIND_STYLE[walker.kind].accent } as React.CSSProperties;

  return (
    <div
      className={cn(styles.bubble, edge, walker.bubble === "ask" && styles.ask, walker.bubble === "sad" && styles.sad)}
      style={{ ...position(walker), ...kindColor, opacity: walker.fading ? 0 : 1 }}
    >
      {walker.bubble === "ask" ? (
        <>
          <b>?</b>
          <span>{walker.label}</span>
        </>
      ) : walker.bubble === "sad" ? (
        "거절됨 · 퇴근할게요"
      ) : (
        <>
          <i className={styles.dot} />
          {walker.label}
        </>
      )}
    </div>
  );
}

function position(walker: Walker): React.CSSProperties {
  return { "--x": walker.x.toFixed(2), "--y": walker.y.toFixed(2) } as React.CSSProperties;
}
