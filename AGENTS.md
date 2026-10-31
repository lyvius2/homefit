# AGENTS.md — HomeFit

이 파일은 이 저장소에서 작업하는 모든 코딩 에이전트(Claude Code, Codex, Continue 등)와 사람이 공유하는 규칙이다. Claude 전용 지시는 `CLAUDE.md`에 있고, 그 파일은 이 파일을 포함(import)한다.

## 1. 프로젝트 한 줄

도면 이미지 위에 벽을 그려 3D 주택을 만들고, 치수를 가진 집기를 배치해 맞는지 확인하는 개인용 웹앱. 설계서는 `docs/DESIGN.md`가 유일한 기준(source of truth)이며, 구현과 어긋나면 **설계서를 먼저 고치고** 코드를 바꾼다.

## 2. 스택 (고정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 언어/프레임워크 | Ruby 3.4, Rails 8.x | `rails new homefit -d mysql --skip-javascript --skip-jbuilder` 기준 |
| DB | MySQL 8.0, utf8mb4 | 개발 DB `homefit_development`, 테스트 `homefit_test` |
| 프론트 빌드 | vite_rails | importmap 사용 안 함 |
| 관리 화면 | ERB + Turbo + Stimulus (npm `@hotwired/turbo-rails`, `@hotwired/stimulus`) | |
| 에디터 2종 | React 19 + TypeScript(strict) | `app/frontend/islands/PlanEditor`, `app/frontend/islands/LayoutEditor` |
| 3D | three + @react-three/fiber + @react-three/drei | |
| 2D 캔버스 | konva + react-konva | |
| 파일 | Active Storage (Disk) + image_processing(libvips) | |
| 잡 | Solid Queue (Rails 8 기본) | Redis 없음 |
| JSON 스키마 | json_schemer | `app/schemas/*.json` |
| 테스트 | Minitest + fixtures, system test는 Capybara/Selenium(headless Chrome) | RSpec 도입하지 않음 |
| 정적 분석 | rubocop-rails-omakase, brakeman, erb_lint, eslint + typescript-eslint, prettier, `tsc --noEmit` | 모두 `bin/ci`에 묶음 |
| 로그 | lograge(JSON) | |

새 gem/npm 패키지는 **먼저 이유를 한 줄 적고 승인을 받은 뒤** 추가한다. 추가하면 이 표나 §8 의존성 메모에 기록한다.

## 3. 저장소 지도

```
app/
  controllers/            # HTML 컨트롤러 (얇게)
  controllers/api/v1/     # JSON API
  models/                 # ActiveRecord. 검증·스코프·간단한 파생값만
  services/               # 다중 모델/트랜잭션 유스케이스: Plans::*, Placements::*, LayoutVersions::*
  lib/geometry/           # 순수 Ruby 기하(OBB, SAT). Rails 의존 금지
  schemas/                # JSON Schema
  frontend/
    entrypoints/          # vite 진입점 (application.ts, islands.tsx)
    islands/PlanEditor/   # 도면 에디터 (React)
    islands/LayoutEditor/ # 배치 에디터 (React)
    lib/geometry.ts       # Ruby Geometry와 동일 동작. 같은 테스트 벡터로 검증
    lib/api.ts            # fetch 래퍼 (CSRF 헤더 포함)
  views/
docs/
  DESIGN.md               # 설계서 (기준 문서)
  geometry-fixtures.json  # Ruby/TS 공용 기하 테스트 벡터
  decisions/              # ADR: NNNN-제목.md (설계서와 다른 선택을 할 때마다 1장)
test/                     # Minitest
bin/ci                    # 린트+분석+테스트 한 번에
```

## 4. 명령

```bash
bin/setup                     # 최초 1회: bundle, npm ci, db:prepare, 시드
bin/dev                       # Rails + vite dev 서버 (Procfile.dev)
bin/rails db:prepare          # 마이그레이션 + 시드(없을 때)
bin/rails test                # 단위/통합
bin/rails test:system         # 시스템 테스트 (브라우저)
bin/ci                        # rubocop, brakeman, erb_lint, eslint, prettier --check, tsc, test
bin/rails console
```

"완료"라고 말하기 전에 반드시 `bin/ci`를 돌리고 결과를 보고한다. 실패를 남긴 채 다음 작업으로 넘어가지 않는다.

## 5. 도메인 규칙 (코드에 그대로 반영)

`docs/DESIGN.md` §1의 R-01~R-12가 원문이다. 특히 자주 틀리는 것:

- 길이는 **정수 mm**, 회전은 **정수 도**. Float 컬럼, cm, m 단위를 만들지 않는다. 표시용 변환은 뷰/프론트에서만.
- 좌표 원점은 도면 좌상단, y는 아래가 +. 3D에서 `y_mm → z`, 높이가 `y`. 이 매핑은 `app/frontend/lib/coords.ts` 한 곳에만 둔다.
- 주택은 파라메트릭 JSON으로만 저장. 메시 파일을 DB·스토리지에 저장하는 코드를 쓰지 않는다.
- `LayoutVersion`과 `Placement`는 **불변**. update/destroy 액션, 콜백, 서비스가 없어야 한다. 모델의 `readonly?`가 이를 강제한다.
- 버전 저장 시 스냅샷(이름·치수·색)은 **서버가 현재 fixture에서 복사**한다. 클라이언트가 보낸 치수를 저장하지 않는다.
- 충돌·축척 검증은 서버가 최종 판정. 클라이언트 판정은 UX용 중복이며, 두 구현은 `docs/geometry-fixtures.json`으로 동일성을 검증한다. 한쪽 로직을 바꾸면 반드시 다른 쪽도 바꾸고 픽스처를 갱신한다.

## 6. 코드 규칙

### Ruby / Rails
- 컨트롤러는 파라미터 정리 → 서비스/모델 호출 → 응답. 비즈니스 분기는 서비스로.
- 서비스 객체: `module Plans; class Validate; def self.call(...) = new(...).call; end; end` 형태, 결과는 `Result = Data.define(:ok?, :value, :errors)` 류의 값 객체로 반환. 예외는 진짜 예외 상황에만.
- 트랜잭션 경계는 서비스에 둔다. 모델 콜백으로 다른 테이블을 건드리지 않는다.
- 마이그레이션은 커밋 후 수정 금지. 바꾸려면 새 마이그레이션. `db:drop`, `db:reset`은 사람이 직접 요청했을 때만.
- Enum 성격 문자열(`kind`, `plan_status`, `dimension_basis`)은 Rails `enum`(string 값)으로 선언하고 DB에는 문자열 저장.
- N+1은 `includes`로 해결하고 테스트에서 쿼리 수를 확인한다(필요 시 `assert_queries`).
- 에러 응답 포맷은 설계서 §4.2 고정. `ApiController#render_error(code, message, details:)` 하나만 쓴다.

### TypeScript / React
- `strict: true`, `any` 금지(불가피하면 `unknown` + 좁히기). ESLint 규칙 끄기 전에 승인.
- 함수 컴포넌트 + 훅. 상태는 에디터별 단일 스토어(zustand 사용 승인됨). 전역 상태 라이브러리 추가 금지.
- 도메인 타입은 `app/frontend/types/domain.ts` 한 곳. 서버 JSON과 필드명을 **그대로**(snake_case) 쓰고 변환 레이어를 두지 않는다.
- R3F: 집기 메시는 `BoxGeometry` + 6면 머티리얼(정면 `+z`에 텍스처). 지오메트리·텍스처는 useMemo/캐시로 재사용.
- 캔버스 조작 이벤트는 `pointer*` 이벤트만 사용(mouse/touch 분기 금지).

### 공통
- 식별자·파일명은 영어, 주석·문서·커밋 본문은 한국어 가능. 커밋 제목은 Conventional Commits 영어: `feat(api): create layout versions with snapshot`.
- 커밋은 작게, 한 커밋 = 한 의도. 마이그레이션과 모델 변경은 같은 커밋.
- 설계서와 다른 선택을 하게 되면 `docs/decisions/NNNN-*.md`에 ADR 1장을 쓰고 설계서를 갱신한 뒤 코드를 바꾼다.
- 비밀값(DB 비밀번호, API 키)은 `config/credentials` 또는 `.env`(gitignore). 코드·문서에 쓰지 않는다.

## 7. 테스트 규칙

- `app/lib/geometry`, `app/services/**`는 **단위 테스트 필수**. 기하는 `docs/geometry-fixtures.json`을 읽어 케이스마다 assert.
- 컨트롤러는 통합 테스트(`ActionDispatch::IntegrationTest`)로 상태 코드·응답 포맷·권한을 확인.
- 시스템 테스트는 핵심 흐름 3개만: (1) 주택 생성 → 도면 저장, (2) 집기 등록, (3) 배치 저장 → 버전 증가. 에디터의 세부 조작은 TS 단위 테스트(vitest)로.
- fixtures는 `test/fixtures/*.yml`. 팩토리 gem 도입하지 않음.

## 8. 의존성 메모

새 의존성을 추가할 때 여기에 한 줄씩.

- (M1) `vite_rails`, `json_schemer`, `lograge`, `image_processing` — 설계서 §2, §6
- (M1) npm: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `konva`, `react-konva`, `zustand`, `@hotwired/turbo-rails`, `@hotwired/stimulus`, `vitest`
- (M1) `dotenv-rails`(development/test) — 외부 MySQL 접속 정보를 `.env`에서 읽기 위해. 키 목록은 `.env.example`. 소유자 승인 2026-11-01
- (M1) npm dev: `vite`, `vite-plugin-ruby`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`, `prettier` — Section 2 표의 빌드·정적 분석 행을 실제 패키지로 옮긴 것
