require "test_helper"

class FixturesControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:one)
    @fridge = fixtures(:fridge)
  end

  def valid_params
    { name: "식탁", kind: "furniture", width_mm: 1400, depth_mm: 800, height_mm: 740, clearance_mm: 600, color: "#a8865f" }
  end

  test "index lists all fixtures with kind tabs" do
    get fixtures_path
    assert_response :success
    assert_select ".card", Fixture.count
    assert_select ".tabs__tab--current", /전체/
    assert_select ".card__meta", /913 × 740 × 1,780 mm/
  end

  test "index filters by kind and ignores unknown kinds" do
    get fixtures_path(kind: "appliance")
    assert_select ".card", Fixture.appliance.count
    assert_select ".tabs__tab--current", /가전/

    get fixtures_path(kind: "vehicle")
    assert_select ".card", Fixture.count
  end

  test "new pre-fills an unused palette color" do
    get new_fixture_path
    assert_response :success
    assert_select "input[name='fixture[color]']" do |inputs|
      assert_includes Fixture::PALETTE, inputs.first["value"]
    end
  end

  test "show redirects to edit" do
    get fixture_path(@fridge)
    assert_redirected_to edit_fixture_path(@fridge)
  end

  test "create with image" do
    assert_difference("Fixture.count", 1) do
      post fixtures_path, params: { fixture: valid_params.merge(image: fixture_file_upload("front.jpg", "image/jpeg")) }
    end
    assert_redirected_to fixtures_path
    fixture = Fixture.order(:id).last
    assert fixture.image.attached?
    assert_equal "image/jpeg", fixture.image.content_type
  end

  test "create rejects svg image with 422" do
    assert_no_difference("Fixture.count") do
      post fixtures_path, params: { fixture: valid_params.merge(image: fixture_file_upload("evil.svg", "image/svg+xml")) }
    end
    assert_response :unprocessable_entity
    assert_select ".form__errors li", /허용되지 않는 형식/
  end

  test "create rejects out of range dimensions with 422 (R-07)" do
    post fixtures_path, params: { fixture: valid_params.merge(width_mm: 5, height_mm: 6000) }
    assert_response :unprocessable_entity
    assert_select ".field--invalid", 2
  end

  test "update changes dimensions" do
    patch fixture_path(@fridge), params: { fixture: { width_mm: 900 } }
    assert_redirected_to fixtures_path
    assert_equal 900, @fridge.reload.width_mm
  end

  test "update can remove the image" do
    @fridge.image.attach(fixture_file_upload("front.jpg", "image/jpeg"))
    assert @fridge.image.attached?

    patch fixture_path(@fridge), params: { fixture: { remove_image: "1" } }
    assert_redirected_to fixtures_path
    perform_enqueued_jobs
    assert_not @fridge.reload.image.attached?
  end

  test "destroy keeps placement snapshots (R-11)" do
    placement = placements(:v1_fridge)
    assert_difference("Fixture.count", -1) do
      delete fixture_path(@fridge)
    end
    assert_redirected_to fixtures_path
    placement.reload
    assert_nil placement.fixture_id
    assert_equal "(예시) 냉장고", placement.name
  end
end
