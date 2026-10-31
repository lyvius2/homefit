# ADR 0002 — M2: 비밀번호 재설정 제거, 라우트 추가 2건, Plans::Bounds 앞당김

- 날짜: 2026-11-01
- 상태: 승인 (소유자, M2 계획 승인 시)
- 관련: 설계서 Section 4.1, 4.3, 6

## 결정

1. **비밀번호 재설정 흐름을 두지 않는다.** Rails 8 인증 제너레이터가 만드는 `PasswordsController`·`PasswordsMailer`·메일 뷰·`resources :passwords` 를 제거했다.
   사용자가 2명이고 Mac mini 에 SMTP 가 없다. 비밀번호를 잊으면 `bin/rails console` 에서 `User.find_by(email_address:).update!(password:)`.
   계정은 `.env` 의 `HOMEFIT_SEED_USERS`(`이메일:비밀번호,…`)를 시드가 읽어 만든다. 회원가입 화면은 없다.
2. **`GET /layouts` 전체 배치도 목록**을 추가한다. 상단 네비의 "배치도" 항목이 갈 곳이 설계서 4.1 에 없었다. 주택별로 묶어 최신 버전·저장 시각을 보여준다.
3. **HTML 도면 업로드용 `resource :floor_plan`**(`POST/DELETE /houses/:id/floor_plan`)을 둔다. 설계서의 `POST /api/v1/houses/:id/floor_plan` 은 React 에디터용 JSON API 로 M3 에 별도 구현하며, 두 경로 모두 `FloorPlans::Attach` 를 쓴다.
4. **`Plans::Bounds` 를 M3 에서 M2 로 앞당긴다.** S-01 카드의 "외곽 크기" 표시에 필요했다. 사양(벽 끝점 ± 두께/2)은 설계서 Section 2.3 그대로이고 M3 의 외곽 이탈 판정이 같은 클래스를 쓴다.

## 영향

- 설계서 4.1 라우트 블록과 Section 6 인증 항목을 갱신했다.
- 인증 테스트(`test/integration/authentication_test.rb`)와 제너레이터 테스트 일부를 유지한다.
