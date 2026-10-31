require "application_system_test_case"

# 핵심 흐름 (2): 집기 등록 → 목록 카드
class FixturesTest < ApplicationSystemTestCase
  test "register a fixture with a front image" do
    sign_in_through_browser users(:one)

    click_link "집기", match: :first
    click_link "새 집기"
    fill_in "이름", with: "시스템 테스트 책상"
    select "가구", from: "종류"
    fill_in "W 너비 (mm)", with: 1200
    fill_in "D 깊이 (mm)", with: 600
    fill_in "H 높이 (mm)", with: 730
    attach_file "정면 이미지", Rails.root.join("test/fixtures/files/front.jpg")
    click_button "집기 등록"

    assert_text "집기를 등록했습니다."
    within(".card", text: "시스템 테스트 책상") do
      assert_text "1,200 × 600 × 730 mm"
      assert_selector "img[alt='시스템 테스트 책상 정면']"
    end

    click_link "가전", match: :first
    assert_no_selector ".card__title", text: "시스템 테스트 책상"
  end
end
