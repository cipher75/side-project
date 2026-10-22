# 세션이 끊기면 백그라운드 sub-agent 캐릭터가 영영 남음

## 증상
백그라운드 sub-agent가 도는 중에 Claude Code 프로세스가 끝나면, 그 sub-agent 캐릭터들이 끝없이 사무실을 돌아다닌다.

## 증거
2026-10-22 부하 시험에서 sub-agent 20개(첫 시도의 5번, 11–29번)가 `SubagentStart`까지 받은 뒤 프로세스와 함께 멈췄다. 끝 신호(`TranscriptTaskFinished`)도 `SessionEnd`도 오지 않아 `working`·`background`로 남았다. 재시작 뒤 그 호출들에는 "Tool call interrupted … outcome is unknown" 결과만 붙었다.

같은 때 이 interrupted 결과 때문에 "거절 바로 알기 꺼짐"이 잘못 켜지던 문제는 interrupted 결과를 판단하지 않도록 고쳤다. 캐릭터가 남는 문제는 그대로다.

## 추정 원인
`Stop`은 백그라운드 호출을 정리하지 않는다. 남은 정리 신호는 transcript의 작업 완료 알림뿐인데, 프로세스가 죽으면 그 알림이 쓰이지 않는다.

## 다음 단계
같은 세션의 재시작(새 연결 신호나 백그라운드 호출에 붙은 interrupted 결과)을 보면 그 전의 백그라운드 캐릭터를 내보낼지 정한다.
