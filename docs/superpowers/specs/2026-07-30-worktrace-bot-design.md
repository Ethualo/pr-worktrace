# worktrace-bot 설계 문서

**날짜**: 2026-07-30
**목적**: 이직용 포트폴리오 프로젝트 (풀스택). AI 코드리뷰 봇 + 인간 판단 기록(work-trace) 자동 생성기.

## 배경 / 문제

AI 코드리뷰 도구(CodeRabbit, Greptile 등)는 이미 성숙한 시장이라 정면 경쟁은 무의미함. 대신 이 도구들이 하지 않는 것 — "AI 제안을 개발자가 왜 수락/거절했는지"를 자동으로 기록해 포트폴리오용 "work-trace" 문서를 쌓는 데 집중한다. 2026년 개발자 포트폴리오 트렌드 조사 결과, 채용 시장은 코드 결과물보다 AI와 협업하며 내린 판단 과정("work trace")을 더 신뢰 가능한 신호로 보는 추세다.

## 적용 대상

기존에 거의 완성된 개인 프로젝트 2개에 붙인다:
- `feed-flow`
- `claude-context-auto-handoff`

두 레포 모두 GitHub 원격 저장소가 있다고 가정한다 (없으면 먼저 push 필요 — 구현 단계에서 확인).

## 아키텍처 개요

```
GitHub PR 생성/업데이트
        │
        ▼
GitHub Actions 워크플로우 트리거
        │
        ▼
worktrace-bot (Node/TS 실행 파일, Action에서 호출)
        │
        ├─► LLM Provider 어댑터 (Claude API | OpenAI API, config로 선택)
        │        │
        │        ▼
        │   diff 분석 → 리뷰 결과(JSON: 이슈 목록 + 심각도 + 제안)
        │
        ├─► PR에 인라인 리뷰 코멘트 게시 (GitHub REST API)
        │
        └─► 👍/👎 리액션 폴링 (다음 워크플로우 실행 시 또는 별도 스케줄)
                 │
                 ▼
           work-trace 엔트리 생성
                 │
                 ▼
           `.worklog/YYYY-MM-DD-prNN.md` 커밋 (같은 PR 브랜치에 봇이 push)
```

## 컴포넌트

1. **`packages/core`** — diff 파싱, 프롬프트 구성, LLM 응답 → 구조화된 리뷰 이슈 변환. 프레임워크 독립적, LLM/GitHub 몰라도 되는 순수 로직.
2. **`packages/providers`** — `LLMProvider` 인터페이스 (`review(diff): Promise<ReviewResult>`) + `ClaudeProvider`, `OpenAIProvider` 구현체. config(`worktrace.config.json`)의 `provider` 필드로 선택.
3. **`packages/github`** — GitHub REST API 래퍼: PR diff 가져오기, 인라인 코멘트 게시, 코멘트 리액션(👍/👎) 조회, `.worklog/` 파일 커밋.
4. **`packages/worklog`** — 리액션 + 코멘트 스레드를 `work-trace.md` 엔트리(문제/AI제안/판단/근거커밋)로 변환.
5. **`action/`** — 위 패키지들을 묶는 GitHub Action 엔트리포인트. `action.yml` + 워크플로우 예시(`.github/workflows/worktrace.yml`)를 각 대상 레포에 배포.

## 데이터 흐름

1. PR 오픈/업데이트 → Action 실행 → `core`가 diff 분석 → `providers`가 선택된 LLM 호출 → 이슈 리스트 반환.
2. `github` 패키지가 이슈별로 PR에 인라인 코멘트 게시 (각 코멘트에 고유 ID 태그 삽입, 나중에 리액션 매칭용).
3. 다음 트리거(같은 PR에 새 커밋 push, 또는 PR 닫힘 이벤트) 때 이전 코멘트들의 리액션 상태를 조회.
4. 👎 리액션이 있는데 답글이 없으면, 봇이 "이유 한 줄만" 요청 코멘트를 남긴다 (1회만, 스팸 방지).
5. PR이 머지/클로즈되는 시점에 그때까지 수집된 판단들을 `.worklog/<날짜>-pr<번호>.md`로 정리해 커밋.

## 에러 처리

- LLM API 실패(레이트리밋/타임아웃): Action은 실패시키지 않고 경고 코멘트만 남기고 종료 (PR 머지를 막지 않음).
- GitHub API 권한 부족(토큰 스코프): 워크플로우 로그에 명확한 에러 메시지, Action 자체는 실패 처리(설정 문제이므로 사용자가 알아야 함).
- 리액션 조회 시 코멘트가 이미 삭제된 경우: 조용히 스킵.

## 테스트 전략

- `core`, `providers`, `worklog`: 순수 함수 위주라 유닛 테스트로 커버 (mock diff, mock LLM 응답).
- `github` 패키지: GitHub API mock(nock 또는 유사) 사용, 실제 네트워크 호출 없이 테스트.
- Action 전체 흐름: `feed-flow`에 실제로 붙여서 더미 PR로 수동 통합 테스트 (E2E 자동화는 스코프 밖 — 개인 프로젝트 규모 고려).

## 스코프 밖 (v1 제외)

- 웹 대시보드 (여러 레포 통합 뷰) — 추후 별도 스펙.
- 커밋 태그 기반(`#ai-reject:`) 피드백 방식 — 채택 안 함(👍👎 방식 채택).
- 멀티 레포 간 공유 로그 저장소 — ADR 관례상 각 레포 로컬 저장이 표준.
