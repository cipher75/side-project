# 개인용 호스팅 설정

내 PC의 사무실 화면을 모바일 등 다른 기기에서도 보기 위한 설정입니다. 무엇이 PC를 떠나는지는 [local-first-deployment](decisions/local-first-deployment.md), 동작은 [hosted-personal-view 스펙](specs/hosted-personal-view/spec.md)을 따릅니다.

```
Claude Code ──hook──▶ 내 PC의 로컬 서버(127.0.0.1:4747) ──줄인 상태(보내기 토큰)──▶ Vercel ──▶ Upstash Redis
                                                                                     ▲
                                                  모바일·다른 PC ──보기 토큰으로 4~15초마다 조회──┘
```

## 1. Vercel에 저장소 붙이기
1. Vercel 프로젝트의 **Storage**에서 Marketplace의 **Upstash Redis**를 만들어 프로젝트에 연결합니다. `KV_REST_API_URL`, `KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)이 환경 변수로 들어옵니다. 코드는 두 이름을 모두 받습니다.
2. **Settings → Environment Variables**(Production)에 토큰 둘을 직접 정합니다. 서로 다른 긴 임의 문자열이어야 하며, 같으면 호스팅 길이 열리지 않습니다.

   | 이름 | 쓰는 곳 |
   |---|---|
   | `OFFICE_SEND_TOKEN` | PC의 로컬 서버가 상태를 올릴 때 |
   | `OFFICE_VIEW_TOKEN` | 기기가 화면을 볼 때 |

3. 환경 변수를 바꾼 뒤에는 다시 배포해야 반영됩니다.
4. 프로젝트의 **Deployment Protection(Vercel Authentication)**이 Production에 켜져 있으면 PC가 보내는 요청이 로그인 화면에 막힙니다. 이 앱은 토큰으로 접근을 막으므로 Production에서는 꺼 주세요.

## 2. PC의 로컬 서버에 호스팅 알려 주기
프로젝트 폴더의 `.env.local`(Git에 올라가지 않습니다)에 적고 `bun run office`를 다시 켭니다.

```
OFFICE_HOSTED_URL=https://내-프로젝트.vercel.app
OFFICE_SEND_TOKEN=Vercel에 정한 것과 같은 보내기 토큰
OFFICE_MACHINE_NAME=work-pc   # 선택. 비우면 컴퓨터 이름을 씁니다. 여러 PC를 쓰면 PC마다 다르게 정합니다
```

서버를 켜면 바로 줄인 상태를 올리고, 바뀔 때마다 보내며, 바뀌지 않아도 20초마다(세션이 없으면 60초마다) 살아 있음 신호를 보냅니다. 전달이 실패해도 로컬 화면과 hook에는 영향이 없고, 터미널에 실패 이유가 한 번 찍힙니다.

## 3. 기기에서 보기
호스팅 주소를 열고 **보기 토큰**을 한 번 넣습니다. 그 기기의 브라우저가 기억하며, 토큰이 바뀌면 다시 묻습니다. 화면은 일이 있으면 4초, 없으면 15초마다 가져오고, 탭이 숨겨지면 멈춥니다.

## 확인과 문제 해결
| 증상 | 원인 |
|---|---|
| 호스팅 화면에 "연결된 세션이 없어요"만 보임 | PC에서 `/office`를 실행하지 않았거나, PC의 `OFFICE_HOSTED_URL`과 `OFFICE_SEND_TOKEN`이 없습니다. |
| "토큰이 맞지 않아요" | `OFFICE_VIEW_TOKEN`과 다른 값을 넣었습니다. 보내기 토큰으로는 화면을 볼 수 없습니다. |
| "PC에서 소식이 끊겼어요" | PC가 꺼졌거나, 로컬 서버가 꺼졌거나, 인터넷이 끊겼거나, 보내기 토큰이 다릅니다. |
| PC 터미널에 "호스팅이 401로 응답했어요" | 보내기 토큰이 호스팅의 `OFFICE_SEND_TOKEN`과 다릅니다. Production에서만 설정했는지도 확인하세요. |
| PC 터미널에 "호스팅이 404로 응답했어요" | 호스팅에 토큰 둘이나 저장소 환경 변수가 없습니다. 설정 뒤 다시 배포했는지 확인하세요. |
| Upstash 연결이 `REDIS_URL` 이름 충돌로 실패함 | 프로젝트에 다른 Redis 통합이 이미 붙어 있습니다. 이 앱은 `REDIS_URL`을 쓰지 않으므로 그 통합의 연결을 풀고(`vercel ir disconnect <리소스> <프로젝트>`) 다시 연결합니다. |
| PC 터미널에 "호스팅 전달 실패: … timeout"이 나오지만 휴대폰에서는 화면이 열림 | PC가 있는 네트워크(회사망 등)가 `*.vercel.app` 주소로 가는 연결을 막고 있습니다. 앱 문제가 아니므로 네트워크를 바꾸거나 사용자 지정 도메인을 씁니다. |

## 사용 한도(무료)
Vercel Hobby는 함수 호출이 월 100만 건, Upstash Redis 무료는 월 50만 명령입니다. PC가 계속 켜져 있고 화면을 하루 8시간 켜 둘 때 대략 한 달에 전달 13만, 조회 29만 정도라 한도 안이지만 여유가 크지는 않습니다. 화면을 하루 종일 켜 두거나 기기를 여럿 켜 두면 늘어납니다.

## 토큰 바꾸기
Vercel의 환경 변수를 바꾸고 다시 배포한 뒤, PC의 `.env.local`을 바꾸고 로컬 서버를 다시 켭니다. 기기는 다음에 열 때 토큰을 다시 묻습니다. 화면에 토큰이 새었다고 의심되면 둘 다 바꾸세요.
