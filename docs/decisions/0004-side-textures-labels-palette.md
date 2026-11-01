# ADR 0004 — 집기 박스 옆면 4면 텍스처, 이름 라벨, 기본색 팔레트

- 날짜: 2026-11-01
- 상태: 승인 (소유자 요청)
- 관련: 설계서 Section 2.1(Stage 1), 3(모델 Fixture), 5(S-05, S-06), AGENTS.md Section 6

## 배경

설계서는 집기 이미지를 박스의 정면(+z) 한 면에만 입혔다. 소유자가 실제로 써 보니 (1) 예시 집기가 전부 회색 계열이라 서로 구분이 안 되고, (2) 각도에 따라 이미지가 안 보이고, (3) 3D 뷰에서 어느 박스가 무엇인지 알 수 없었다.

## 결정

1. **텍스처는 옆면 4면**(+x −x +z −z)에 같은 이미지를 입힌다. 윗면·바닥은 `color`. 이미지가 없으면 6면 모두 `color`. 충돌 시 텍스처 면도 빨갛게 물든다. 6면 전부는 위에서 볼 때 늘어나 보여 제외했다.
2. **이름 라벨은 항상 표시**한다. 한글 이름이라 troika `Text`(별도 폰트 필요) 대신 DOM 을 쓴다. 캔버스 위에 오버레이 div 하나를 두고(`FixtureLabels.tsx`), 캔버스 안의 projector 가 `useFrame` 마다 박스 위 60 mm 앵커를 화면 좌표로 투영해 span 의 transform 을 직접 쓴다. drei `Html` 은 라벨마다 React 루트를 만드는데, React 19 에서 첫 인스턴스의 루트가 깨져 내용이 비는 경합("Attempted to synchronously unmount a root while React was already rendering")을 브라우저에서 재현해 쓰지 않았다. `pointer-events: none` 으로 드래그·선택을 막지 않고, 멀어지면 작아진다(0.55–1.1배). 스테이지에 `isolation: isolate` 를 두어 라벨이 플로팅 패널 위로 올라오지 않게 한다.
3. **기본색은 팔레트에서 자동 배정**한다. `Fixture::PALETTE` 12색 중 아직 쓰이지 않은 색을 등록 폼이 미리 채우고(`Fixture.next_color`), 사용자가 바꿀 수 있다. 콜백이 아니라 컨트롤러 `new` 에서 호출하므로 시드·API 처럼 색을 직접 주는 경로는 영향이 없다. 예시 집기 6개의 색도 팔레트로 바꿨다.

## 영향

- `FixtureMesh.tsx`, `editor.css`, `Fixture` 모델·컨트롤러·폼, `db/seeds.rb`, 설계서 Section 2.1/3/5, AGENTS.md Section 6.
