# CLAUDE.md — HomeFit

@AGENTS.md

위 AGENTS.md가 공통 규칙이다. 아래는 Claude Code에서 작업할 때의 추가 지시.

## 작업 시작 시

1. 매 세션 첫 작업 전에 `docs/DESIGN.md`의 §1(규칙)과 현재 마일스톤(§7) 항목을 읽는다. 다른 절은 필요할 때 찾아 읽는다.
2. 작업 범위가 마일스톤 하나 이상이거나 파일 5개 이상을 건드리면 **plan mode로 계획을 먼저 보여주고** 승인 후 구현한다. 작은 수정은 바로 한다.
3. 설계서와 요청이 충돌하면 코드를 쓰기 전에 지적한다. 조용히 설계서 쪽을 바꾸지 않는다.

## 작업 중

- 마일스톤 안에서도 **의미 단위마다 커밋**한다(마이그레이션+모델, 서비스+테스트, 컨트롤러+통합테스트, 화면). 커밋 전에 `bin/ci`.
- gem/npm 추가, 마이그레이션 변경, 설계서와 다른 선택, 외부 API 호출 추가 — 이 네 가지는 **먼저 묻는다.**
- Rails·Vite·R3F API가 기억과 다를 수 있으면 추측하지 말고 `bundle open`, `node_modules` 소스, 또는 공식 가이드로 확인한 뒤 쓴다. 특히 Rails 8 인증 제너레이터, Active Storage variant, Solid Queue 설정.
- 긴 작업(의존성 설치, 시스템 테스트)은 백그라운드로 돌리고 그동안 다음 단계를 준비한다.
- 콘솔에서 `db:drop`/`db:reset`/`rm -rf`는 사람이 그 명령을 직접 말했을 때만.

## 보고 형식

- 작업 끝에는 (1) 무엇이 바뀌었는지 3줄 이내, (2) `bin/ci` 결과, (3) 설계서 대비 미구현·보류 항목, (4) 다음 단계 제안 1개. 과정 나열은 하지 않는다.
- 막혔을 때는 시도한 것 1–2개와 함께 질문한다. 같은 접근을 세 번 이상 반복하지 않는다.

## 이 프로젝트에서 자주 쓰는 확인 명령

```bash
bin/ci
bin/rails test test/services            # 서비스만
bin/rails test test/lib/geometry        # 기하만
npx vitest run app/frontend/lib         # TS 기하 + 유틸
bin/rails runner 'puts Plans::Validate.call(House.first.plan).inspect'
```

## 알고 있어야 할 사람 쪽 맥락

- 소유자는 Java/Kotlin·Spring 15년차 백엔드 개발자이고 Rails는 이 프로젝트로 익히는 중이다. Rails 관용구(convention over configuration, 콜백, concern)를 쓸 때 **왜 그렇게 하는지 한 줄**을 덧붙이면 좋다. Spring 대응 개념이 있으면 비유해도 된다("Service 빈 ↔ app/services PORO").
- 사용자는 두 사람(소유자와 약혼자). 멀티테넌시·권한 체계는 만들지 않는다.
- 배포 대상은 집에 있는 Mac mini 1대. 컨테이너·클라우드 전제의 복잡한 구성은 제안하지 않는다.
