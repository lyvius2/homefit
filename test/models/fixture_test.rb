require "test_helper"

class FixtureTest < ActiveSupport::TestCase
  def valid_attributes
    { name: "식탁", kind: "furniture", width_mm: 1400, depth_mm: 800, height_mm: 740 }
  end

  test "valid with name, kind and dimensions" do
    fixture = Fixture.new(valid_attributes)

    assert fixture.valid?
    assert_equal 0, fixture.clearance_mm
    assert_equal "#8c8f94", fixture.color
  end

  test "next_color prefers a palette color no fixture uses yet" do
    assert_equal Fixture::PALETTE.first, Fixture.next_color

    Fixture.create!(valid_attributes.merge(name: "A", color: Fixture::PALETTE.first))
    assert_equal Fixture::PALETTE.second, Fixture.next_color
  end

  test "next_color cycles by count once every palette color is in use" do
    Fixture::PALETTE.each_with_index { |c, i| Fixture.create!(valid_attributes.merge(name: "P#{i}", color: c)) }

    assert_equal Fixture::PALETTE[Fixture.count % Fixture::PALETTE.size], Fixture.next_color
  end

  test "dimensions must be integers within range (R-07)" do
    fixture = Fixture.new(valid_attributes.merge(width_mm: 9, depth_mm: 10_001, height_mm: 5_001))

    assert_not fixture.valid?
    assert_equal %i[width_mm depth_mm height_mm].sort, fixture.errors.attribute_names.sort

    fixture.assign_attributes(width_mm: 100.5, depth_mm: 100, height_mm: 100)
    assert_not fixture.valid?
    assert_equal [ :width_mm ], fixture.errors.attribute_names
  end

  test "kind is one of furniture, appliance, etc" do
    assert_equal %w[furniture appliance etc], Fixture.kinds.keys

    fixture = Fixture.new(valid_attributes.merge(kind: "vehicle"))
    assert_not fixture.valid?
    assert_includes fixture.errors.attribute_names, :kind
  end

  test "color must be a 6 digit hex" do
    fixture = Fixture.new(valid_attributes.merge(color: "red"))
    assert_not fixture.valid?

    fixture.color = "#ABCDEF"
    assert fixture.valid?
  end

  test "deleting a fixture keeps placements and nullifies fixture_id (R-11)" do
    fridge = fixtures(:fridge)
    placement = placements(:v1_fridge)

    fridge.destroy!

    placement.reload
    assert_nil placement.fixture_id
    assert_equal "(예시) 냉장고", placement.name
    assert_equal 913, placement.width_mm
  end
end

class FixtureImageTest < ActiveSupport::TestCase
  test "accepts jpeg image and rejects svg" do
    fixture = fixtures(:sofa)

    fixture.image = fixture_file_upload("front.jpg", "image/jpeg")
    assert fixture.valid?, fixture.errors.full_messages.inspect

    fixture.image = fixture_file_upload("evil.svg", "image/svg+xml")
    assert_not fixture.valid?
    assert_match(/허용되지 않는 형식/, fixture.errors[:image].first)
  end
end
