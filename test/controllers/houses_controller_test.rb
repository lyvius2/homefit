require "test_helper"

class HousesControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:one)
    @house = houses(:sample)
  end

  test "requires authentication" do
    sign_out
    get houses_path
    assert_redirected_to new_session_path
  end

  test "index lists houses with bounds, wall count and layouts count" do
    @house.update!(plan: @house.plan.merge("walls" => [
      { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
      { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 }
    ]))

    get houses_path
    assert_response :success
    assert_select ".card", House.count
    assert_select ".card__meta", /10,100 × 6,500 mm/
    assert_select ".card__meta", /벽 2개/
    assert_select ".card__meta", /배치도 1개/
    assert_select ".badge--draft", "초안"
  end

  test "show renders the form, layouts and floor plan panel" do
    get house_path(@house)
    assert_response :success
    assert_select "form[action=?]", house_path(@house)
    assert_select "a[href=?]", edit_house_plan_path(@house)
    assert_select "a[href=?]", new_house_layout_path(@house)
    assert_select "table.table td a", layouts(:main).name
    assert_select "input[type=file][name=file]"
  end

  test "create with valid params" do
    assert_difference("House.count", 1) do
      post houses_path, params: { house: { name: "새 집", ceiling_height_mm: 2400, dimension_basis: "clear", notes: "메모" } }
    end
    house = House.order(:id).last
    assert_redirected_to house_path(house)
    assert_equal House::DEFAULT_PLAN, house.plan
    assert house.dimension_basis_clear?
  end

  test "create with invalid params re-renders the form with 422" do
    assert_no_difference("House.count") do
      post houses_path, params: { house: { name: "", ceiling_height_mm: 1000 } }
    end
    assert_response :unprocessable_entity
    assert_select ".form__errors li", minimum: 2
  end

  test "update changes basic fields and keeps the plan" do
    patch house_path(@house), params: { house: { name: "바뀐 이름", ceiling_height_mm: 2500 } }
    assert_redirected_to house_path(@house)
    @house.reload
    assert_equal "바뀐 이름", @house.name
    assert_equal 2500, @house.ceiling_height_mm
    assert_equal House::DEFAULT_PLAN, @house.plan
  end

  test "update with invalid params renders show with 422" do
    patch house_path(@house), params: { house: { name: "" } }
    assert_response :unprocessable_entity
    assert_select ".form__errors"
  end

  test "edit redirects to show" do
    get edit_house_path(@house)
    assert_redirected_to house_path(@house)
  end

  test "destroy removes the house and its layouts" do
    layout_ids = @house.layouts.ids
    assert_difference("House.count", -1) do
      delete house_path(@house)
    end
    assert_redirected_to houses_path
    assert_empty Layout.where(id: layout_ids)
  end

  test "uploading a floor plan records image size and shows a thumbnail" do
    post house_floor_plan_path(@house), params: { file: fixture_file_upload("floor_plan.png", "image/png") }
    assert_redirected_to house_path(@house)
    assert_equal({ "width_px" => 640, "height_px" => 480 }, @house.reload.plan["image"])

    get house_path(@house)
    assert_select "img[alt=?]", "#{@house.name} 도면"
    assert_select "form[action=?] button", house_floor_plan_path(@house)
  end

  test "uploading an svg is rejected with an alert" do
    post house_floor_plan_path(@house), params: { file: fixture_file_upload("evil.svg", "image/svg+xml") }
    assert_redirected_to house_path(@house)
    assert_match(/허용되지 않는 형식/, flash[:alert])
    assert_not @house.reload.floor_plan.attached?
  end

  test "deleting the floor plan clears plan.image" do
    post house_floor_plan_path(@house), params: { file: fixture_file_upload("floor_plan.png", "image/png") }
    delete house_floor_plan_path(@house)
    assert_redirected_to house_path(@house)
    assert_nil @house.reload.plan["image"]
    assert_not @house.floor_plan.attached?
  end

  test "plan edit page renders the island container" do
    get edit_house_plan_path(@house)
    assert_response :success
    assert_select "[data-island=PlanEditor][data-props]"
  end
end
