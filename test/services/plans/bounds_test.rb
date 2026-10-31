require "test_helper"

module Plans
  class BoundsTest < ActiveSupport::TestCase
    test "returns nil when there are no walls" do
      assert_nil Plans::Bounds.call(House::DEFAULT_PLAN)
      assert_nil Plans::Bounds.call(nil)
    end

    test "expands wall endpoints by half the thickness" do
      plan = House::DEFAULT_PLAN.merge("walls" => [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
        { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 }
      ])
      box = Plans::Bounds.call(plan)

      assert_equal [ -100, -100, 10000, 6400 ], [ box.min_x, box.min_y, box.max_x, box.max_y ]
      assert_equal 10100, box.width_mm
      assert_equal 6500, box.height_mm
    end

    test "rounds odd thickness outward to integer mm" do
      plan = House::DEFAULT_PLAN.merge("walls" => [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 1000, 0 ], "thickness_mm" => 125 }
      ])
      box = Plans::Bounds.call(plan)

      assert_equal [ -63, -63, 1063, 63 ], [ box.min_x, box.min_y, box.max_x, box.max_y ]
    end
  end
end
