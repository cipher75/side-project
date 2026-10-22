export type CharacterKind = "tool" | "skill" | "sub";

// working: 일하는 중, waiting: 허용 대기,
// approved: 허용되어 일을 마치고 퇴근 준비, denied: 사용자가 거절해 퇴근 준비,
// cancelled: 거절은 아니지만 실행되지 않고 끝나 퇴근 준비(중단, 만료, 권한 규칙 등)
export type CharacterStatus = "working" | "waiting" | "approved" | "denied" | "cancelled";

// 캐릭터 하나는 tool, skill, sub-agent 호출 한 건이다.
export type Character = {
  id: string;
  kind: CharacterKind;
  status: CharacterStatus;
  label: string;
  toolName: string;
  toolInput: unknown;
  since: number;
  // 서버가 PreToolUse hook을 놓쳐 허용 요청만으로 만든 캐릭터. 진짜 tool_use_id를 아직 모른다.
  orphan?: boolean;
  // 백그라운드로 시작한 sub-agent: 턴이 끝나도 계속 일하고, 끝났다는 알림이 올 때 나간다.
  background?: boolean;
  waitingAt?: number;
  // approved, denied, cancelled가 된 시각. 퇴근 장면을 보여줄 시간이 지나면 목록에서 정리한다.
  endedAt?: number;
};

export type Session = {
  id: string;
  name: string;
  connected: boolean;
  // 세션이 연결되어 있고, 아직 일이 없었거나 일하거나 기다리는 캐릭터가 있으면 사무실에 불이 켜진다.
  lit: boolean;
  doneCount: number;
  // 서버가 이 세션의 시작(연결 신호)을 보지 못했다. 서버가 다시 켜지는 등으로 그전의 허용 대기를 모를 수 있다.
  // 턴이 끝나면(Stop) 남은 허용 창이 없으므로 다시 알게 된다.
  priorUnknown?: boolean;
  // transcript를 믿을 수 없게 된 세션. 실행되지 않았다는 판단을 쓰지 않는다.
  transcriptUnreliable?: boolean;
  characters: Character[];
};

export type OfficeState = {
  sessions: Record<string, Session>;
  order: string[];
  // 서버가 켜질 때마다 바뀌는 값. 화면은 이 값이 바뀌면 서버가 다시 켜진 것을 안다.
  instance?: string;
};
