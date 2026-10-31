require "test_helper"

class HouseTest < ActiveSupport::TestCase
  test "new house gets the default plan with string keys" do
    house = House.new(name: "새 집")

    assert_equal House::DEFAULT_PLAN, house.plan
    assert_equal 1, house.plan["schema"]
    assert_equal [], house.plan["walls"]
  end

  test "default plan is not shared between instances" do
    a = House.new(name: "a")
    b = House.new(name: "b")
    a.plan["walls"] << { "id" => "w01" }

    assert_equal [], b.plan["walls"]
    assert_equal [], House::DEFAULT_PLAN["walls"]
  end

  test "default plan survives a round trip through MySQL JSON" do
    house = House.create!(name: "저장")

    assert_equal House::DEFAULT_PLAN, house.reload.plan
    assert house.plan_status_draft?
    assert house.dimension_basis_centerline?
  end

  test "validates name and ceiling height range" do
    house = House.new(name: "", ceiling_height_mm: 1999)

    assert_not house.valid?
    assert_includes house.errors[:name], "can't be blank"
    assert_includes house.errors.attribute_names, :ceiling_height_mm

    house.name = "x" * 101
    house.ceiling_height_mm = 4001
    assert_not house.valid?
    assert_includes house.errors.attribute_names, :name
    assert_includes house.errors.attribute_names, :ceiling_height_mm

    house.name = "ok"
    house.ceiling_height_mm = 2400
    assert house.valid?
  end

  test "enums store strings and reject unknown values" do
    house = houses(:sample)
    house.dimension_basis = "clear"
    house.plan_status = "valid"
    house.save!

    assert_equal "clear", house.reload.dimension_basis_before_type_cast
    assert house.plan_status_valid?

    house.plan_status = "weird"
    assert_not house.valid?
    assert_includes house.errors.attribute_names, :plan_status
  end

  test "destroying a house removes its layouts and versions" do
    house = houses(:sample)
    layout_ids = house.layouts.ids
    version_ids = LayoutVersion.where(layout_id: layout_ids).ids
    assert_not_empty version_ids

    house.destroy!

    assert_empty Layout.where(id: layout_ids)
    assert_empty LayoutVersion.where(id: version_ids)
    assert_empty Placement.where(layout_version_id: version_ids)
  end
end
