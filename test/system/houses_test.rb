require "application_system_test_case"

# 핵심 흐름 (1): 주택 생성 → 목록 카드. 도면 저장은 M4 에서 이 테스트를 확장한다.
class HousesTest < ApplicationSystemTestCase
  test "create a house and see it in the list" do
    sign_in_through_browser users(:one)

    click_link "새 주택"
    fill_in "이름", with: "시스템 테스트 집"
    fill_in "천장고 (mm)", with: 2400
    select "안목치수 (실측)", from: "치수 기준"
    click_button "주택 만들기"

    assert_text "주택을 만들었습니다."
    assert_selector "h1", text: "시스템 테스트 집"

    click_link "주택", match: :first
    assert_selector ".card__title", text: "시스템 테스트 집"
    within(".card", text: "시스템 테스트 집") do
      assert_text "벽 없음"
      assert_text "초안"
    end
  end

  test "two-step delete asks for a second click" do
    sign_in_through_browser users(:one)
    visit house_path(houses(:empty))
    assert_selector "button[data-armed='false']", text: "주택 삭제"   # Stimulus 연결을 기다린다

    click_button "주택 삭제"
    assert_button "한 번 더 누르면 삭제"
    assert_selector "h1", text: houses(:empty).name   # 아직 삭제되지 않음

    click_button "한 번 더 누르면 삭제"
    assert_text "주택과 배치도를 삭제했습니다."
    assert_no_selector ".card__title", text: houses(:empty).name
  end
end
