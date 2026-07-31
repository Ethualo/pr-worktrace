# pr-worktrace

[English](README.md)

AI PR 리뷰 봇 + 작업 기록 로거, GitHub Action으로 패키징. 데이터베이스 없음. GitHub 자체(PR 댓글, 리액션, 답글 스레드)가 유일한 상태 저장소라, 매 실행은 GitHub에서 상태를 다시 읽어 재구성하는 무상태(stateless) 프로세스다.

## 왜 만들었나

대부분의 PR 리뷰 봇은 이미 무슨 말을 했는지 기억하려고 백엔드가 필요하다. pr-worktrace는 그렇지 않다. 상태를 자신이 올리는 결과물 안에 인코딩한다. 리뷰 댓글마다 숨긴 HTML 주석 마커를 달고, 봇 자신의 "사유를 남겨달라" 답글에도 같은 식으로 마커를 달아 둔다. 다음 실행 때는 그 마커들을 다시 파싱해 상태를 되살린다. 따로 운영할 인프라도, 낡아서 못 쓰게 될 인프라도 없다.

## 아키텍처

```
packages/core       공유 타입 (ReviewIssue, Severity, ...)
packages/github      GitHub API 프리미티브, DI로 테스트 가능 (모든 함수 첫 인자로 GithubClient)
packages/providers   LLM 프로바이더 추상화 — Claude, 범용 OpenAI 호환 프로바이더
packages/worklog     .worklog/*.md 파일 포맷팅 + 분류 로직
packages/action      오케스트레이션 + GitHub Action 엔트리포인트 (src/main.ts, action.yml)
```

Action은 두 모드로 동작, `main.ts`에서 `mode` 입력값으로 분기:

- **`mode: review`** — LLM 기반 리뷰. `<!-- worktrace-issue:{id} -->` 태그 단 인라인 PR 댓글 게시. `llm_api_key` 필요.
- **`mode: poll`** — LLM 안 씀. 게시된 댓글에서 리뷰 상태 재구성, 거절된 제안엔 사유 요청(봇 답글에 `<!-- worktrace-reason-request -->` 마커 달아 다음 실행에서 봇 답글 vs 사람 답글 구분), PR 종료 시 `.worklog/*.md` 요약 커밋. `createProvider`는 review 모드 안에서만 동적 임포트되므로 poll 모드는 API 키 자체가 필요 없다.

## 프로바이더 추상화

`packages/providers`는 `config.provider` 값으로 분기하며, 값은 정확히 둘뿐이다:

- `claude` — Anthropic Messages API
- `openai` — 범용 OpenAI 호환 프로바이더 (`baseUrl` + `extraBody` 패스스루)

"커스텀"을 위한 세 번째 `provider` 값은 없다. 대신 OpenAI 호환 백엔드라면(자체 호스팅이든 다른 벤더든) `provider: "openai"`에 `baseUrl`만 자기 것으로 넣으면 끝, 코드 수정 불필요. 아래 E2E 검증도 이 방식으로 NVIDIA NIM을 돌렸다: OpenAI 형식 API라 `openai` 프로바이더를 그대로 통과하고, NIM 전용 분기는 코드베이스에 없다. NIM은 기본으로 추론(chain-of-thought)이 켜져 있어 응답 앞에 붙는데, 설정만으로 끈다:

```json
{
  "provider": "openai",
  "model": "nvidia/nemotron-3-super-120b-a12b",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "extraBody": { "chat_template_kwargs": { "enable_thinking": false } }
}
```

`extraBody`는 요청 본문에 그대로 병합되므로, 다른 프로바이더별 토글도 프로바이더 코드 안 건드리고 같은 방식으로 쓸 수 있다.

## 사용 저장소에 설치

1. 워크플로 파일(`.github/workflows/worktrace.yml`):
   ```yaml
   uses: Ethualo/pr-worktrace@v1
   ```
   (저장소 루트 `action.yml`이 `packages/action/dist/index.js`를 그대로 가리키므로, 모노레포지만 서브패스 없이 바로 참조 가능.)
2. 저장소 루트에 `worktrace.config.json` — `provider`, `model`, `baseUrl`, `extraBody`.
3. `WORKTRACE_LLM_API_KEY` 저장소 시크릿 (저장소별 개별 설정. 여러 저장소 공유하려면 GitHub 조직 단위 시크릿 사용.)

## 검증 완료 내역

독립된 두 저장소에서 종단 간(E2E) 검증을 마쳤다. 두 저장소는 LLM 키도, 기본 브랜치(`main` vs `master`)도 서로 다르다.

| 저장소 | PR | 확인 사항 |
|---|---|---|
| feed-flow | #21 | review 모드: 실제 인라인 댓글 게시(빈 `except`, 닫히지 않은 파일 핸들 지적); poll 모드: PR 종료 시 `.worklog/` 커밋 |
| nextrain | #1 | NIM 통한 review 모드, 워크플로 파일이 HEAD 브랜치에만 있는 상태로 검증(같은 저장소 내 PR, 즉 fork 아닌 PR은 base가 아니라 head 브랜치 워크플로를 읽는다는 것 실증); 실제 이슈 지적(`MainActivity.kt` NPE 위험, 알림 권한 처리 누락) |

테스트 PR과 임시 브랜치는 검증 후 모두 닫고 지웠다. 어느 저장소에도 테스트 흔적은 남지 않았다.

## 명령어

```bash
pnpm -r build   # 전체 패키지 빌드 — 워크스페이스 패키지 소스 변경 후 pnpm -r test 전에 필요 (dist/는 gitignore 대상, node_modules 경유 참조)
pnpm -r test    # 전체 패키지 테스트
cd packages/<name> && pnpm test -- <pattern>   # 개별 패키지/파일만
```

## 현재 상태

review·poll 모드, Claude 프로바이더, 범용 OpenAI 호환 프로바이더(NVIDIA NIM 포함)까지 구현·테스트·E2E 검증을 마쳤다.

미완료는 두 가지다. OpenAI 프로바이더는 아직 `extraBody` 외에 OpenAI 전용 기능이 없는 범용 버전에 머물러 있다. 그리고 이 저장소를 실제 프로덕션 저장소에 상시 배포한 적은 없다. 위 E2E 실행은 의도적으로 돌리고 정리까지 마친 검증용 실행이다.
