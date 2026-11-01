require "test_helper"

module Plans
  class ValidateTest < ActiveSupport::TestCase
    OUTER = [
      { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
      { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 },
      { "id" => "w03", "a" => [ 9900, 6300 ], "b" => [ 0, 6300 ], "thickness_mm" => 200 }
    ].freeze

    def plan(**overrides)
      House::DEFAULT_PLAN.deep_dup.merge("walls" => OUTER.deep_dup).merge(overrides.transform_keys(&:to_s))
    end

    def codes(result) = result.violations.map(&:code)

    test "three walls without an image is valid" do
      assert Plans::Validate.call(plan).valid?
    end

    test "schema errors short-circuit" do
      result = Plans::Validate.call(plan.merge("unit" => "cm", "walls" => []))
      assert_not result.valid?
      assert_equal [ "schema" ], codes(result).uniq
    end

    test "requires at least 3 walls (R-06)" do
      result = Plans::Validate.call(plan(walls: OUTER.first(2)))
      assert_equal [ "walls_min" ], codes(result)
      assert_equal "/walls", result.violations.first.path
    end

    test "requires a scale when an image is used (R-04)" do
      with_image = plan(image: { "width_px" => 2200, "height_px" => 1540 })
      assert_equal [ "scale_required" ], codes(Plans::Validate.call(with_image))

      with_image["scale"]["px_per_mm"] = 0.2
      with_image["scale"]["measured_mm"] = 3600
      assert Plans::Validate.call(with_image).valid?
    end

    test "recomputes verify error and rejects over 3% (R-05)" do
      p = plan
      p["scale"] = { "px_per_mm" => 0.2, "measured_mm" => 3600, "verify" => { "measured_mm" => 2400, "got_mm" => 2480, "error_pct" => 0.0 } }
      result = Plans::Validate.call(p)
      assert_equal [ "scale_error" ], codes(result)
      assert_match(/3\.3%/, result.violations.first.message)

      p["scale"]["verify"]["got_mm"] = 2470
      assert Plans::Validate.call(p).valid?, "2.9% 는 허용"
    end

    test "rejects duplicate wall ids, zero-length walls and openings on unknown walls" do
      p = plan
      p["walls"] << { "id" => "w01", "a" => [ 5, 5 ], "b" => [ 5, 5 ], "thickness_mm" => 100 }
      p["openings"] << { "id" => "o01", "wall_id" => "nope", "offset_mm" => 0, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" }
      result = Plans::Validate.call(p)

      assert_equal %w[wall_id_duplicate wall_zero_length opening_wall_missing], codes(result)
      assert_equal "/walls/3", result.violations[1].path
      assert_equal "/openings/0/wall_id", result.violations[2].path
    end

    test "rejects openings that run past the wall, overlap on the same wall, or put swing on a window" do
      door = { "id" => "o01", "wall_id" => "w01", "offset_mm" => 9200, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door",
               "swing" => { "hinge" => "a", "side" => "left" } }
      p = plan(openings: [
        door,
        { "id" => "o02", "wall_id" => "w02", "offset_mm" => 1000, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" },
        { "id" => "o03", "wall_id" => "w02", "offset_mm" => 1899, "width_mm" => 800, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" },
        { "id" => "o04", "wall_id" => "w02", "offset_mm" => 2699, "width_mm" => 600, "height_mm" => 1200, "sill_mm" => 900, "type" => "window",
          "swing" => { "hinge" => "b", "side" => "right" } }
      ])
      result = Plans::Validate.call(p)

      assert_equal %w[opening_outside_wall swing_on_window opening_overlap], codes(result)
      assert_equal "/openings/0/offset_mm", result.violations[0].path
      assert_equal "/openings/3/swing", result.violations[1].path
      assert_equal "/openings/2", result.violations[2].path, "o03 은 o02 와 1 mm 겹침. o04 는 o03 과 맞닿기만 함"

      door["offset_mm"] = 9000
      assert Plans::Validate.call(plan(openings: [ door ])).valid?, "offset + width == 벽 길이는 허용"
    end

    test "accepts symbol keys" do
      assert Plans::Validate.call(plan.deep_symbolize_keys).valid?
    end
  end
end
