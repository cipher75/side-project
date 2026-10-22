# 세션이 다시 시작되면 사무실 hook이 빠짐

## 증상
`/office`로 연결한 세션이 데스크톱 앱에서 끊겼다가 같은 세션 ID로 이어지면, 그 뒤의 tool, skill, sub-agent 호출과 허용 요청이 하나도 사무실에 나타나지 않는다. 화면은 연결된 것처럼 불이 켜져 있다.

## 증거
2026-10-22 부하 시험에서 transcript의 hook 실행 기록(`hook_success`)이 재시작 전 39건, 재시작 후 0건이었다. 재시작 뒤 Agent 30건, Skill 30건, Bash 10여 건에 대해 서버는 `PreToolUse`·`PostToolUse`·`PermissionRequest`를 하나도 받지 못했고, transcript에서 읽은 `TranscriptNotExecuted`만 받았다. 연결 신호는 curl로 다시 보냈지만 스킬은 다시 부르지 않았다. Claude Code 2.1.304, `claude-desktop`.

## 추정 원인
hook이 `.claude/skills/office/SKILL.md` frontmatter에 있어 스킬을 부른 프로세스에만 걸린다. 프로세스가 새로 뜨면 사라진다.

## 다음 단계
서버가 hook 없이 transcript 신호만 오는 연결 세션을 알아채 "다시 /office 해 주세요" 안내를 띄울지, hook을 프로젝트 설정으로 옮길지 정한다. 그 전까지는 재시작 뒤 `/office`를 다시 실행한다.
