require "test_helper"

# docs/geometry-fixtures.json 의 모든 케이스를 Ruby 구현으로 검증한다.
# TS 구현(app/frontend/lib/geometry.test.ts)도 같은 파일을 읽는다.
module Geometry
  class GeometryTest < ActiveSupport::TestCase
    FIXTURES = JSON.parse(Rails.root.join("docs/geometry-fixtures.json").read).freeze

    def build(shape)
      case shape.fetch("kind")
      when "box"
        Obb.from_footprint(
          x: shape.fetch("x"), y: shape.fetch("y"),
          width: shape.fetch("width"), depth: shape.fetch("depth"),
          rotation_deg: shape.fetch("rotation_deg")
        )
      when "wall"
        ax, ay = shape.fetch("a")
        bx, by = shape.fetch("b")
        Obb.from_segment(ax:, ay:, bx:, by:, thickness: shape.fetch("thickness_mm"))
      else
        raise ArgumentError, "unknown shape kind: #{shape['kind']}"
      end
    end

    test "fixture file has at least 8 SAT cases covering intersect, separate, touch and rotation" do
      sat = FIXTURES.fetch("sat")
      assert_operator sat.size, :>=, 8
      assert sat.any? { |c| c["expect"] }
      assert sat.any? { |c| !c["expect"] }
      assert sat.any? { |c| c["id"].include?("touch") }
      assert sat.any? { |c| c["a"]["rotation_deg"].to_i != 0 || c["b"]["rotation_deg"].to_i != 0 }
    end

    test "epsilon matches the fixture file" do
      assert_equal FIXTURES.fetch("epsilon"), Sat::EPSILON
    end

    FIXTURES.fetch("corners").each do |c|
      test "corners: #{c['id']}" do
        actual = build(c.fetch("shape")).corners.map { |x, y| [ x.round(6), y.round(6) ] }
        assert_equal c.fetch("expect"), actual
      end
    end

    FIXTURES.fetch("sat").each do |c|
      test "sat: #{c['id']}" do
        a = build(c.fetch("a"))
        b = build(c.fetch("b"))
        assert_equal c.fetch("expect"), Sat.intersect?(a, b), "a=#{a.inspect} b=#{b.inspect}"
        assert_equal c.fetch("expect"), Sat.intersect?(b, a), "symmetry"
      end
    end
  end
end
