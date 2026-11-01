require "test_helper"

module Placements
  class ValidateTest < ActiveSupport::TestCase
    setup do
      @house = houses(:sample)
      @house.update!(plan: @house.plan.merge("walls" => [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
        { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 },
        { "id" => "w03", "a" => [ 9900, 6300 ], "b" => [ 0, 6300 ], "thickness_mm" => 200 },
        { "id" => "w04", "a" => [ 0, 6300 ], "b" => [ 0, 0 ], "thickness_mm" => 200 }
      ]))
      @fridge = fixtures(:fridge)   # 913 × 740
      @sofa = fixtures(:sofa)       # 2200 × 900
    end

    def placement(fixture, x, y, rot = 0)
      { fixture_id: fixture.id, x_mm: x, y_mm: y, z_mm: 0, rotation_deg: rot }
    end

    test "valid placements produce no violations" do
      result = Placements::Validate.call(house: @house, placements: [ placement(@fridge, 1000, 1000), placement(@sofa, 5000, 3000) ])

      assert result.valid?
      assert_empty result.missing_fixture_ids
      assert_equal [ @fridge.id, @sofa.id ].sort, result.fixtures.keys.sort
    end

    test "reports overlap, wall and out_of_bounds with original indexes" do
      result = Placements::Validate.call(house: @house, placements: [
        placement(@fridge, 1000, 1000),
        placement(@sofa, 1500, 1000),          # 냉장고와 겹침
        placement(@fridge, 10300, 3000)        # 벽 w02 + 외곽 이탈
      ])

      assert_equal [
        { placement_index: 0, reasons: [ "overlap:1" ] },
        { placement_index: 1, reasons: [ "overlap:0" ] },
        { placement_index: 2, reasons: [ "wall:w02", "out_of_bounds" ] }
      ], result.violations
    end

    test "missing fixtures are reported and indexes of the rest stay correct" do
      result = Placements::Validate.call(house: @house, placements: [
        { fixture_id: 0, x_mm: 0, y_mm: 0, z_mm: 0, rotation_deg: 0 },   # 없는 집기
        placement(@fridge, 1000, 1000),
        placement(@sofa, 1500, 1000)
      ])

      assert_equal [ 0 ], result.missing_fixture_ids
      assert_equal [
        { placement_index: 0, reasons: [ "fixture_missing" ] },
        { placement_index: 1, reasons: [ "overlap:2" ] },
        { placement_index: 2, reasons: [ "overlap:1" ] }
      ], result.violations
    end

    test "reports door swing zone intrusion after wall reasons" do
      @house.update!(plan: @house.plan.merge("openings" => [
        { "id" => "o01", "wall_id" => "w01", "offset_mm" => 1200, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door",
          "swing" => { "hinge" => "a", "side" => "right" } }
      ]))
      result = Placements::Validate.call(house: @house, placements: [
        placement(@fridge, 1500, 600),   # 부채꼴 안
        placement(@fridge, 5000, 3000)
      ])

      assert_equal [ { placement_index: 0, reasons: [ "door:o01" ] } ], result.violations
    end

    test "a monitor resting on a desk top does not overlap it, but one sunk into it does" do
      desk = Fixture.create!(name: "책상", kind: "furniture", width_mm: 1200, depth_mm: 600, height_mm: 730, color: "#aaaaaa")
      monitor = Fixture.create!(name: "모니터", kind: "appliance", width_mm: 600, depth_mm: 200, height_mm: 400, color: "#bbbbbb")
      on_top = [ placement(desk, 2000, 2000), { fixture_id: monitor.id, x_mm: 2000, y_mm: 1900, z_mm: 730, rotation_deg: 0 } ]
      assert Placements::Validate.call(house: @house, placements: on_top).valid?

      sunk = [ placement(desk, 2000, 2000), { fixture_id: monitor.id, x_mm: 2000, y_mm: 1900, z_mm: 700, rotation_deg: 0 } ]
      assert_equal [
        { placement_index: 0, reasons: [ "overlap:1" ] },
        { placement_index: 1, reasons: [ "overlap:0" ] }
      ], Placements::Validate.call(house: @house, placements: sunk).violations
    end

    test "house without walls only checks overlaps" do
      @house.update!(plan: House::DEFAULT_PLAN)
      result = Placements::Validate.call(house: @house, placements: [ placement(@fridge, -99_999, 0) ])
      assert result.valid?
    end
  end
end
