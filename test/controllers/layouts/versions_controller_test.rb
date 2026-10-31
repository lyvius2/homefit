require "test_helper"

module Layouts
  class VersionsControllerTest < ActionDispatch::IntegrationTest
    setup { sign_in_as users(:one) }

    test "index lists versions newest first with counts and the latest badge" do
      get layout_versions_path(layouts(:main))
      assert_response :success
      assert_select "tbody tr", 2
      assert_select "tbody tr:first-child td.mono a", "v2"
      assert_select "tbody tr:first-child .badge--valid", "최신"
      assert_select "tbody tr:last-child td", /첫 저장/
      assert_select "tbody tr:last-child td.mono", /1개/
      assert_select "a[href=?]", layout_path(layouts(:main), version: 1)
    end

    test "empty layout shows the empty state" do
      layout = houses(:sample).layouts.create!(name: "빈")
      get layout_versions_path(layout)
      assert_select ".empty"
    end

    test "show with a version parameter opens the editor read-only" do
      get layout_path(layouts(:main), version: 1)
      assert_response :success
      assert_select "[data-island=LayoutEditor][data-props*='\"version_no\":1']"
      assert_select "[data-island=LayoutEditor][data-props*='\"read_only\":true']"
      assert_select "h1 .badge", "v1 읽기 전용"
    end
  end
end
