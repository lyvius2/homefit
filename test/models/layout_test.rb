require "test_helper"

class LayoutTest < ActiveSupport::TestCase
  test "requires house and name" do
    layout = Layout.new
    assert_not layout.valid?
    assert_includes layout.errors.attribute_names, :house
    assert_includes layout.errors.attribute_names, :name
  end

  test "latest_version is the highest version_no (R-10)" do
    assert_equal layout_versions(:main_v2), layouts(:main).latest_version
  end

  test "destroying a layout cascades versions and placements at the DB level (R-09)" do
    layout = layouts(:main)
    version_ids = layout.layout_versions.ids

    assert_difference -> { LayoutVersion.count }, -version_ids.size do
      assert_difference -> { Placement.count }, -Placement.where(layout_version_id: version_ids).count do
        layout.destroy!
      end
    end
  end
end
