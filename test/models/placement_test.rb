require "test_helper"

class PlacementTest < ActiveSupport::TestCase
  def snapshot_attributes
    fridge = fixtures(:fridge)
    {
      layout_version: layout_versions(:main_v2),
      fixture: fridge,
      name: fridge.name, kind: fridge.kind, color: fridge.color,
      width_mm: fridge.width_mm, depth_mm: fridge.depth_mm, height_mm: fridge.height_mm,
      clearance_mm: fridge.clearance_mm,
      x_mm: 100, y_mm: 200, z_mm: 0, rotation_deg: 270
    }
  end

  test "can be created with a fixture snapshot" do
    placement = Placement.create!(snapshot_attributes)

    assert placement.persisted?
    assert placement.readonly?
  end

  test "is read-only after creation (R-09)" do
    placement = placements(:v1_fridge)

    assert_raises(ActiveRecord::ReadOnlyRecord) { placement.update!(x_mm: 0) }
    assert_raises(ActiveRecord::ReadOnlyRecord) { placement.destroy! }
    assert_equal 1000, placement.reload.x_mm
  end

  test "fixture is optional (deleted fixtures keep the snapshot)" do
    orphan = placements(:v2_sofa_orphan)

    assert_nil orphan.fixture
    assert orphan.valid?
  end

  test "rotation must be an integer between 0 and 359 (R-01)" do
    placement = Placement.new(snapshot_attributes.merge(rotation_deg: 360))
    assert_not placement.valid?

    placement.rotation_deg = -1
    assert_not placement.valid?

    placement.rotation_deg = 45.5
    assert_not placement.valid?

    placement.rotation_deg = 359
    assert placement.valid?
  end

  test "coordinates and dimensions must be integers" do
    placement = Placement.new(snapshot_attributes.merge(x_mm: 10.5, width_mm: 0, z_mm: -1, kind: "vehicle"))

    assert_not placement.valid?
    assert_equal %i[kind width_mm z_mm x_mm].sort, placement.errors.attribute_names.sort
  end
end
