# 묻기 모드에서 /office 스킬이 불러와지지 않음

## 증상
권한 모드가 묻기(default)일 때 `/office`를 실행하면 "Shell command permission check failed … Quoted text in this command can't be checked before it runs"로 스킬이 불러와지지 않는다. 연결 신호도 hook도 걸리지 않는다.

## 증거
2026-10-22 사용자가 직접 입력한 `/office`와 에이전트가 부른 `/office`가 모두 이 오류로 막혔다. 같은 세션에서 자동(auto) 모드로 바꾸자 정상으로 불러와지고 hook도 걸렸다. Claude Code 2.1.304, `claude-desktop`.

## 추정 원인
`.claude/skills/office/SKILL.md` 본문의 `` !`curl … $(basename "$PWD") …` `` 동적 명령이 따옴표와 명령 치환을 담고 있어, 묻기 모드의 사전 권한 검사가 거부한다.

## 다음 단계
동적 명령을 검사 가능한 단순한 형태로 바꾸거나, 연결 curl을 에이전트가 실행하도록 본문을 바꾸는 방안을 정한다.
