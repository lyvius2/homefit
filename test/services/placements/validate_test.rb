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

    test "house without walls only checks overlaps" do
      @house.update!(plan: House::DEFAULT_PLAN)
      result = Placements::Validate.call(house: @house, placements: [ placement(@fridge, -99_999, 0) ])
      assert result.valid?
    end
  end
end
