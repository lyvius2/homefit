require "test_helper"

class LayoutsControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as users(:one)
    @house = houses(:sample)
    @layout = layouts(:main)
  end

  test "index groups layouts by house with the latest version" do
    get layouts_path
    assert_response :success
    assert_select "section.panel h2 a", @house.name
    assert_select "table.table td a", @layout.name
    assert_select "table.table td.mono", "v2"
  end

  test "index does not load every version (one subquery instead of N+1)" do
    queries = []
    callback = ->(_name, _start, _finish, _id, payload) { queries << payload[:sql] if payload[:sql] =~ /\ASELECT/ }
    ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
      get layouts_path
    end
    assert_empty queries.grep(/FROM `layout_versions` WHERE `layout_versions`.`layout_id`/)
  end

  test "new and create under a house" do
    get new_house_layout_path(@house)
    assert_response :success
    assert_select "input[name='layout[name]'][value=?]", "배치 2"

    assert_difference("@house.layouts.count", 1) do
      post house_layouts_path(@house), params: { layout: { name: "거실 안" } }
    end
    layout = @house.layouts.order(:id).last
    assert_redirected_to layout_path(layout)
    assert_equal "거실 안", layout.name
  end

  test "create with blank name renders 422" do
    post house_layouts_path(@house), params: { layout: { name: "" } }
    assert_response :unprocessable_entity
    assert_select ".form__errors"
  end

  test "show renders the island container" do
    get layout_path(@layout)
    assert_response :success
    assert_select "[data-island=LayoutEditor][data-props]"
  end

  test "edit and update rename the layout" do
    get edit_layout_path(@layout)
    assert_response :success
    assert_select "p", /최신 v2/

    patch layout_path(@layout), params: { layout: { name: "새 이름" } }
    assert_redirected_to layout_path(@layout)
    assert_equal "새 이름", @layout.reload.name
  end

  test "destroy removes versions and placements through the DB cascade (R-09)" do
    version_ids = @layout.layout_versions.ids
    assert_difference("Layout.count", -1) do
      delete layout_path(@layout)
    end
    assert_redirected_to house_path(@house)
    assert_empty LayoutVersion.where(id: version_ids)
    assert_empty Placement.where(layout_version_id: version_ids)
  end
end
