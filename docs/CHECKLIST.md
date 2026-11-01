# 요구사항·규칙 체크리스트 (M6 마감)

설계서 Section 1 의 R-01~R-12 가 어디서 지켜지고 어떤 테스트가 확인하는지. 갱신일 2026-11-01.

| 규칙 | 구현 | 확인 테스트 |
|---|---|---|
| R-01 정수 mm, 정수 도 | 마이그레이션 INT 컬럼, 모델 `only_integer`, 스키마 `integer`, API `placement_params`, TS `snapMm`/`normalizeDeg` | `test/models/*`, `test/services/plans/schema_test.rb`, `api/v1/versions_controller_test.rb`, `lib/coords.test.ts` |
| R-02 좌상단 원점, y 아래 +, 3D 매핑 | `app/frontend/lib/coords.ts` 한 곳 | `coords.test.ts` |
| R-03 파라메트릭 JSON, 메시 저장 없음 | `houses.plan` JSON, 벽 압출은 `LayoutEditor/Scene.tsx` | 스토리지에 메시 파일을 쓰는 코드 없음 |
| R-04 이미지면 축척 필수 | `Plans::Validate#check_scale`, 에디터는 축척 전 벽 도구 비활성 | `plans/validate_test.rb`, `api/v1/plans_controller_test.rb`, `test/system/plan_editor_test.rb` |
| R-05 검증 오차 3% 초과 거부 | `Plans::Validate` 가 서버에서 재계산 | `plans/validate_test.rb` |
| R-06 벽 3개 이상 | `Plans::Validate#check_walls` | `plans/validate_test.rb`, 시스템 테스트(벽 1개 저장 거부) |
| R-07 W·D·H 필수, 범위 | `fixtures` CHECK, `Fixture` 검증, 폼 min/max | `fixture_test.rb`, `fixtures_controller_test.rb` |
| R-08 겹침·벽·외곽이면 저장 거부, 양쪽 판정 | `Geometry::Collisions` ↔ `lib/collisions.ts`(공용 픽스처), `Placements::Validate`, `LayoutVersions::Create`, 에디터 저장 전 validate | `test/lib/geometry/collisions_test.rb`, `collisions.test.ts`, `layout_versions/create_test.rb`, `versions_controller_test.rb` |
| R-09 버전 불변, 삭제는 배치도 삭제로만 | `LayoutVersion`/`Placement#readonly?`, update/destroy 라우트 없음, DB FK cascade | `layout_version_test.rb`, `placement_test.rb`, `layouts_controller_test.rb` |
| R-10 기본 조회 = 최신 버전 | `versions#latest`, 에디터 `load` | `versions_controller_test.rb`, `LayoutEditor/store.test.ts` |
| R-11 저장 시점 스냅샷, 서버가 복사 | `LayoutVersions::Create#snapshot_row`, `fixture_id` ON DELETE SET NULL | `create_test.rb`("클라이언트 치수 무시"), `fixture_test.rb` |
| R-12 kind 3종 | `Fixture.kinds`, `Placement` inclusion | `fixture_test.rb`, `placement_test.rb` |

## 화면 공통 규칙 (설계서 Section 5)

- 삭제 2단계 버튼: `two_step_delete_button` 헬퍼 + Stimulus `two-step-delete`. 시스템 테스트 `houses_test.rb`.
- 단위 표기 `mm` + 천 단위: `format_mm`, `format_dimensions`, 에디터는 `toLocaleString()`.
- 모바일: 관리 화면은 390 px 1열, 에디터는 < 1024 px 보기 전용 (`useMediaQuery`).
- 에러 화면: `public/404.html`, `422.html`, `500.html` 한국어.

## 설계서와 다른 선택

- ADR 0001 React 19, ADR 0002 비밀번호 재설정 제거 · `/layouts` 목록 · HTML 도면 업로드 라우트 · `Plans::Bounds` 앞당김.
