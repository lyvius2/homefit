require "test_helper"

module Plans
  class SchemaTest < ActiveSupport::TestCase
    FULL_PLAN = {
      "schema" => 1,
      "unit" => "mm",
      "image" => { "width_px" => 2200, "height_px" => 1540 },
      "scale" => {
        "px_per_mm" => 0.1234,
        "measured_mm" => 3600,
        "verify" => { "measured_mm" => 2400, "got_mm" => 2412, "error_pct" => 0.5 }
      },
      "walls" => [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 }
      ],
      "openings" => [
        { "id" => "o01", "wall_id" => "w01", "offset_mm" => 1200, "width_mm" => 900,
          "height_mm" => 2100, "sill_mm" => 0, "type" => "door" }
      ]
    }.freeze

    test "accepts the default empty plan" do
      assert Plans::Schema.call(House::DEFAULT_PLAN).ok?
    end

    test "accepts the Section 2.3 example plan" do
      result = Plans::Schema.call(FULL_PLAN)

      assert result.ok?, result.errors.inspect
    end

    test "accepts symbol keys" do
      assert Plans::Schema.call(House::DEFAULT_PLAN.deep_symbolize_keys).ok?
    end

    test "rejects wrong schema version or unit" do
      assert_not Plans::Schema.call(FULL_PLAN.merge("schema" => 2)).ok?
      assert_not Plans::Schema.call(FULL_PLAN.merge("unit" => "cm")).ok?
    end

    test "rejects missing top-level keys and unknown keys" do
      missing = Plans::Schema.call(FULL_PLAN.except("openings"))
      assert_not missing.ok?
      assert_equal "", missing.errors.first[:path]

      unknown = Plans::Schema.call(FULL_PLAN.merge("extra" => 1))
      assert_not unknown.ok?
    end

    test "rejects non-integer wall coordinates (R-01)" do
      plan = FULL_PLAN.deep_dup
      plan["walls"][0]["a"] = [ 0.5, 0 ]
      result = Plans::Schema.call(plan)

      assert_not result.ok?
      assert_equal "/walls/0/a/0", result.errors.first[:path]
    end

    test "rejects walls without thickness and openings with unknown type" do
      plan = FULL_PLAN.deep_dup
      plan["walls"][0].delete("thickness_mm")
      plan["openings"][0]["type"] = "hatch"
      result = Plans::Schema.call(plan)

      assert_equal [ "/openings/0/type", "/walls/0" ], result.errors.map { |e| e[:path] }.sort
    end

    test "swing is optional and must be hinge a/b with side left/right" do
      plan = FULL_PLAN.deep_dup
      plan["openings"][0]["swing"] = { "hinge" => "b", "side" => "right" }
      assert Plans::Schema.call(plan).ok?

      plan["openings"][0]["swing"] = { "hinge" => "start", "side" => "right" }
      assert_equal [ "/openings/0/swing/hinge" ], Plans::Schema.call(plan).errors.map { |e| e[:path] }

      plan["openings"][0]["swing"] = { "hinge" => "a" }
      assert_not Plans::Schema.call(plan).ok?
    end

    test "scale fields may be null but not negative" do
      plan = FULL_PLAN.deep_dup
      plan["scale"] = { "px_per_mm" => nil, "measured_mm" => nil, "verify" => nil }
      assert Plans::Schema.call(plan).ok?

      plan["scale"]["px_per_mm"] = 0
      assert_not Plans::Schema.call(plan).ok?
    end
  end
end
