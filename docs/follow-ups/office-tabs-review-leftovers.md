# PR #10 리뷰에서 남긴 사무실 탭·장면 지적

## 증상
2026-10-26 PR #10 리뷰(high)에서 나온 지적 가운데, 주 경로를 깨지 않아 이번에 고치지 않은 것들이다.

- 새로 보인 세션마다 탭이 자동으로 넘어가서, 서버가 다시 켜진 뒤 세션들이 하나씩 다시 생길 때 사용자가 고른 탭을 계속 덮어쓴다(`features/office-activity/office-view.tsx`).
- 선택한 탭의 `data-active:ring-2 ring-primary`가 `focus-visible` ring을 가려 키보드 포커스가 안 보일 수 있다(`office-view.tsx`).
- 일을 마치고 3초 머무르는 캐릭터 수에 상한이 없어, 짧은 호출이 몰리면 사무실이 붐빈다(`scene/scene-engine.ts`).
- `isActive`가 `isEnded`의 정확한 반대이고, 탭 클래스의 `dark:data-active:ring-primary`는 앞 값과 같아 쓸모가 없다.
- 머무르던 캐릭터의 id가 목록에 다시 들어와 머무르기가 풀리는 경로를 확인하는 테스트가 없다.

## 증거
PR #10 리뷰 결과. 런타임에서 재현해 보지는 않았다.

## 다음 단계
탭 자동 전환은 "OfficeConnect로 새로 연결된 세션"에서만 일어나게 좁히고, 나머지는 하나씩 확인해 고친다.
