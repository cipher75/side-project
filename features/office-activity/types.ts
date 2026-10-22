export type CharacterKind = "tool" | "skill" | "sub";

// working: 일하는 중, waiting: 허용 대기, denied: 거절되어 퇴근 준비
export type CharacterStatus = "working" | "waiting" | "denied";

// 캐릭터 하나는 tool, skill, sub-agent 호출 한 건이다.
export type Character = {
  id: string;
  kind: CharacterKind;
  status: CharacterStatus;
  label: string;
  toolName: string;
  toolInput: unknown;
  since: number;
  waitingAt?: number;
  deniedAt?: number;
};

export type Session = {
  id: string;
  name: string;
  connected: boolean;
  // 세션이 연결되어 있고, 아직 일이 없었거나 일하는 캐릭터가 있으면 사무실에 불이 켜진다.
  lit: boolean;
  doneCount: number;
  characters: Character[];
};

export type OfficeState = {
  sessions: Record<string, Session>;
  order: string[];
};
