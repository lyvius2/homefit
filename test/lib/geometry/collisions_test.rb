require "test_helper"

# docs/geometry-fixtures.json 의 collisions 케이스를 Ruby 구현으로 검증한다 (TS: app/frontend/lib/collisions.test.ts).
module Geometry
  class CollisionsTest < ActiveSupport::TestCase
    FIXTURES = JSON.parse(Rails.root.join("docs/geometry-fixtures.json").read).freeze

    FIXTURES.fetch("collisions").each do |c|
      test "collisions: #{c['id']}" do
        footprints = c.fetch("footprints").map { |f| f.symbolize_keys }
        actual = Collisions.check(walls: c.fetch("walls"), footprints:)

        assert_equal c.fetch("expect"), actual.map { |v| v.transform_keys(&:to_s) }

        if (expected_bounds = c["expect_bounds"])
          assert_equal expected_bounds, Bounds.call(c.fetch("walls")).to_h.transform_keys(&:to_s)
        end
      end
    end

    test "Plans::Bounds wraps Geometry::Bounds" do
      walls = FIXTURES.fetch("collisions").first.fetch("walls")
      assert_equal Bounds.call(walls), Plans::Bounds.call({ "walls" => walls })
      assert_nil Plans::Bounds.call(nil)
    end
  end
end
