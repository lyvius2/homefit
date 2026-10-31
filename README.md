# HomeFit

도면 이미지 위에 벽을 그려 3D 주택을 만들고, 실제 치수를 가진 집기(가구·가전)를 배치해 "들어가는지, 동선이 나오는지"를 확인하는 개인용 웹앱입니다. 배치는 저장할 때마다 불변 버전으로 쌓입니다.

설계의 기준 문서는 [docs/DESIGN.md](docs/DESIGN.md)이고, 코딩 규칙은 [AGENTS.md](AGENTS.md)에 있습니다.

## 스택

| 영역 | 선택 |
|---|---|
| 백엔드 | Ruby 3.4, Rails 8, MySQL 8.0 (utf8mb4, 외부 서버) |
| 프론트 | vite_rails, React 18 + TypeScript(strict), Turbo/Stimulus |
| 3D / 2D | three + @react-three/fiber + @react-three/drei, konva + react-konva |
| 파일 / 잡 | Active Storage(Disk) + libvips, Solid Queue |
| 테스트 / 분석 | Minitest, vitest, rubocop, brakeman, erb_lint, eslint, prettier, tsc |

## 요구 사항

- macOS, Ruby 3.4.x (rbenv), Node 22.x
- 외부 MySQL 8.0 서버와 접속 계정 (`homefit_development`, `homefit_test` DB 생성 권한)
- libvips (`brew install vips`), MySQL 클라이언트 라이브러리 (`brew install mysql-client`)
- Chrome (시스템 테스트)

## 설정

1. `.env.example`을 `.env`로 복사하고 DB 접속 정보를 채웁니다. `.env`는 커밋하지 않습니다.
2. `bin/setup` 으로 의존성 설치, DB 준비, 시드를 한 번에 실행합니다.

```bash
cp .env.example .env     # 이후 값 편집
bin/setup
```

## 명령

```bash
bin/dev                 # Rails + Vite 개발 서버
bin/ci                  # 린트·정적 분석·테스트 전부 (커밋 전 필수)
bin/rails test          # 단위·통합 테스트
bin/rails test:system   # 브라우저 시스템 테스트
```

## 저장소 지도

```
app/services/        유스케이스 (Plans::*, Placements::*, LayoutVersions::*)
app/lib/geometry/    순수 Ruby 기하 (OBB, SAT)
app/schemas/         Plan JSON 스키마
app/frontend/        Vite 진입점, React 에디터 2종, TS 기하
docs/                설계서, 기하 테스트 벡터, ADR
```

## 도메인 규칙 요약

- 길이는 정수 mm, 회전은 정수 도. 좌표 원점은 도면 좌상단이고 y는 아래가 양수입니다.
- 주택은 벽 선분 JSON으로만 저장하고 메시 파일은 저장하지 않습니다.
- 배치 버전과 배치 레코드는 불변이며, 저장 시 집기 치수를 서버가 스냅샷으로 복사합니다.
- 충돌·축척 검증은 서버가 최종 판정하고, 클라이언트 판정은 같은 테스트 벡터로 동일성을 검증합니다.

자세한 규칙은 docs/DESIGN.md의 Section 1을 참고하세요.
