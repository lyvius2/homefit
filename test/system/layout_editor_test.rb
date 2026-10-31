require "application_system_test_case"

# 핵심 흐름 (3): 배치 저장 → 버전 증가
class LayoutEditorTest < ApplicationSystemTestCase
  test "add a fixture, save a new version, then switch versions" do
    layout = layouts(:main)   # v1, v2 존재. 주택은 벽 없음(외곽 판정 없음)
    sign_in_through_browser users(:one)
    visit layout_path(layout)

    assert_selector "[data-testid=layout-scene] canvas"
    assert_selector "select[aria-label='기준 버전'] option", text: /v2/
    assert_text "배치된 집기 2개"
    assert_selector ".savebar", text: "충돌 1개"   # v2 에는 삭제된 집기 스냅샷이 있다

    # 삭제된 집기를 제거하고 소파를 추가
    within(".list[aria-label='배치된 집기']") { click_button "삭제된 소파" }
    click_button "제거"
    assert_text "배치된 집기 1개"
    click_button "(예시) 소파 추가"
    assert_text "배치된 집기 2개"
    assert_selector ".savebar", text: "충돌 2개"   # 기본 위치가 냉장고와 겹친다

    # 선택된 소파를 플로팅 패널에서 옮기면 충돌이 풀린다
    within(".inspector") do
      fill_in "X (mm)", with: 5000
      fill_in "Y (mm)", with: 3000
    end
    assert_selector ".savebar", text: "이상 없음"

    fill_in "메모", with: "브라우저에서 저장"
    assert_difference -> { layout.layout_versions.count }, 1 do
      click_button "새 버전으로 저장"
      assert_text "v3 으로 저장했습니다."
    end
    version = layout.layout_versions.order(:version_no).last
    assert_equal [ "브라우저에서 저장", 2 ], [ version.memo, version.placements.count ]
    assert_equal fixtures(:sofa).width_mm, version.placements.find_by(fixture_id: fixtures(:sofa).id).width_mm

    select "v1 · 집기 1개 · 첫 저장", from: "기준 버전"
    assert_text "v1 을 불러왔습니다."
    assert_text "배치된 집기 1개"
  end
end

class VersionArchiveTest < ApplicationSystemTestCase
  test "open an old version read-only from the archive and continue editing from it" do
    layout = layouts(:main)
    sign_in_through_browser users(:one)
    visit layout_versions_path(layout)

    assert_selector "tbody tr", count: 2
    within("tbody tr", text: "v1") { click_link "열기" }

    assert_selector "h1 .badge", text: "v1 읽기 전용"
    assert_text "읽기 전용으로 보는 중입니다."
    assert_text "배치된 집기 1개"
    assert_selector "button[aria-label='(예시) 소파 추가'][disabled]"

    click_button "이 버전에서 이어서 편집"
    assert_text "작업본으로 복사했습니다"
    click_button "(예시) 소파 추가"
    assert_text "배치된 집기 2개"
  end
end
