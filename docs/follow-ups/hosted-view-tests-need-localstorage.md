# 호스팅 화면 테스트가 localStorage 없이 실패함

## 증상
`bun run test`에서 `features/office-activity/hosted/hosted-office-view.test.tsx`의 10건이 모두 `beforeEach`의 `window.localStorage.clear()`에서 `Cannot read properties of undefined (reading 'clear')`로 실패한다.

## 증거
2026-10-23 Node v26.12.0에서, 아무것도 바꾸지 않은 `origin/main`(769477b)에서도 같은 10건이 실패했다.

## 추정 원인
Node 26이 내장 `localStorage`를 두면서 jsdom 환경의 `window.localStorage`가 비는 것으로 보인다. 확인하지 않았다.

## 다음 단계
`vitest.setup.ts`에서 테스트용 저장소를 넣거나 jsdom 저장소 설정을 맞춘 뒤, 해당 파일이 통과하는지 확인한다.
