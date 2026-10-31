require "application_system_test_case"

# 핵심 흐름 (1) 후반: 도면 에디터에서 벽을 그려 저장 → plan_status valid
class PlanEditorTest < ApplicationSystemTestCase
  test "draw four walls on the grid and save" do
    sign_in_through_browser users(:one)
    house = houses(:empty)
    visit edit_house_plan_path(house)

    assert_selector "[data-testid=plan-canvas] canvas"
    assert_text "벽 0개"
    canvas = find("[data-testid=plan-canvas]")

    # 도면 없음: 1 px = 10 mm, stage 원점은 (40, 40), 컨테이너 테두리 1 px. 3,000 × 2,000 mm 사각형
    canvas.click(x: 41, y: 41, offset: :top_left)
    canvas.click(x: 341, y: 41, offset: :top_left)
    canvas.click(x: 341, y: 241, offset: :top_left)
    canvas.click(x: 41, y: 241, offset: :top_left)
    canvas.click(x: 41, y: 41, offset: :top_left)
    assert_text "벽 4개"
    assert_text "미저장"

    click_button "저장"
    assert_text "도면을 저장했습니다."
    assert_selector ".badge--valid", text: "검증됨"

    house.reload
    assert house.plan_status_valid?
    assert_equal [ [ 0, 0 ], [ 3000, 0 ], [ 3000, 2000 ], [ 0, 2000 ] ], house.walls.map { |w| w["a"] }
    assert_equal 200, house.walls.first["thickness_mm"]
  end

  test "saving fewer than three walls shows the violation banner" do
    sign_in_through_browser users(:one)
    visit edit_house_plan_path(houses(:empty))
    canvas = find("[data-testid=plan-canvas]")
    canvas.click(x: 41, y: 41, offset: :top_left)
    canvas.click(x: 341, y: 41, offset: :top_left)
    assert_text "벽 1개"

    click_button "저장"
    assert_selector ".banner--error", text: "벽은 3개 이상이어야 합니다"
    assert houses(:empty).reload.plan_status_draft?
  end
end

class PlanEditorWithImageTest < ApplicationSystemTestCase
  test "set the scale on a floor plan image, then walls can be drawn" do
    house = houses(:empty)
    FloorPlans::Attach.call(house, fixture_file_upload("floor_plan.png", "image/png"))

    sign_in_through_browser users(:one)
    visit edit_house_plan_path(house)
    assert_selector "[data-testid=plan-canvas] canvas"

    # 이미지가 있고 축척이 없으면 축척 도구로 시작하고 벽 그리기는 비활성
    assert_selector "button[role=radio][aria-checked=true]", text: "축척"
    assert_selector "button[role=radio][disabled]", text: "벽 그리기"
    assert_text "아직 축척이 없습니다"

    fill_in "실제 길이 (mm)", with: 3600
    canvas = find("[data-testid=plan-canvas]")
    canvas.click(x: 200, y: 300, offset: :top_left)
    canvas.click(x: 560, y: 300, offset: :top_left)

    assert_text "축척 설정:"
    assert_selector "button[role=radio][aria-checked=true]", text: "벽 그리기"
    assert_no_selector "button[role=radio][disabled]", text: "벽 그리기"
    assert_text "px/mm"
  end
end
