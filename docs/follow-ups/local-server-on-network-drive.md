# 네트워크 드라이브에서 로컬 서버가 돌지 않음

## 증상
프로젝트가 네트워크 드라이브(`D:` = `\\vpcnas-dm-01.cloudpc.lge.net\...`)에 있으면 `bun run office`(`next dev`)가 `Watchpack Error (watcher): UNKNOWN`을 내다가 ".next 폴더가 지워졌다"며 계속 다시 켜지고, 그동안 hook 요청이 응답 없이 끊긴다. `next build`도 `Cannot depend on path (\\?\UNC\...) outside of root directory`로 실패한다.

## 증거
2026-10-22 호스팅 연결 확인 중 재현했다. 같은 커밋을 로컬 디스크(`C:`)로 꺼내자 `next build`와 `next start -H 127.0.0.1 -p 4747`이 바로 성공했고 hook과 호스팅 전달이 정상 동작했다.

## 추정 원인
Turbopack과 파일 감시가 UNC 경로(`\\?\UNC\...`)와 드라이브 문자 경로를 서로 다른 루트로 본다.

## 다음 단계
로컬 서버를 안정적으로 켜 두는 방법(빌드한 서버로 돌리기)을 정할 때, 실행용 복사본을 로컬 디스크에 두는 방식도 함께 정한다.
