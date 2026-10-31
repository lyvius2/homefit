require "test_helper"

module LayoutVersions
  class CreateTest < ActiveSupport::TestCase
    setup do
      @layout = layouts(:main)   # 버전 1, 2 가 있음
      @house = @layout.house
      @house.update!(plan: @house.plan.merge("walls" => [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
        { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 },
        { "id" => "w03", "a" => [ 9900, 6300 ], "b" => [ 0, 6300 ], "thickness_mm" => 200 },
        { "id" => "w04", "a" => [ 0, 6300 ], "b" => [ 0, 0 ], "thickness_mm" => 200 }
      ]))
      @fridge = fixtures(:fridge)
      @sofa = fixtures(:sofa)
    end

    def placement(fixture, x, y, rot = 0)
      { fixture_id: fixture.id, x_mm: x, y_mm: y, z_mm: 0, rotation_deg: rot }
    end

    test "creates the next version with snapshots copied from the fixtures (R-11)" do
      result = LayoutVersions::Create.call(layout: @layout, memo: "셋째", placements: [ placement(@fridge, 1000, 1000, 90), placement(@sofa, 5000, 3000) ])

      assert result.ok?, result.inspect
      version = result.version
      assert_equal 3, version.version_no
      assert_equal "셋째", version.memo
      assert_equal 2, version.placements.count

      snapshot = version.placements.find_by(fixture_id: @fridge.id)
      assert_equal [ @fridge.name, @fridge.kind, @fridge.width_mm, @fridge.depth_mm, @fridge.height_mm, @fridge.clearance_mm, @fridge.color ],
                   [ snapshot.name, snapshot.kind, snapshot.width_mm, snapshot.depth_mm, snapshot.height_mm, snapshot.clearance_mm, snapshot.color ]
      assert_equal [ 1000, 1000, 0, 90 ], [ snapshot.x_mm, snapshot.y_mm, snapshot.z_mm, snapshot.rotation_deg ]
      assert snapshot.readonly?
    end

    test "allows an empty version" do
      result = LayoutVersions::Create.call(layout: @layout, placements: [])
      assert result.ok?
      assert_equal 3, result.version.version_no
      assert_nil result.version.memo
    end

    test "rejects collisions without creating a version (R-08)" do
      assert_no_difference [ "LayoutVersion.count", "Placement.count" ] do
        result = LayoutVersions::Create.call(layout: @layout, placements: [ placement(@fridge, 1000, 1000), placement(@sofa, 1500, 1000) ])

        assert_not result.ok?
        assert_equal "collision", result.error_code
        assert_equal [ 0, 1 ], result.details[:violations].map { |v| v[:placement_index] }
      end
    end

    test "rejects deleted fixtures with fixture_missing" do
      assert_no_difference "LayoutVersion.count" do
        result = LayoutVersions::Create.call(layout: @layout, placements: [ { fixture_id: 0, x_mm: 0, y_mm: 0, z_mm: 0, rotation_deg: 0 } ])

        assert_equal "fixture_missing", result.error_code
        assert_equal [ 0 ], result.details[:fixture_ids]
      end
    end

    test "rejects a memo over 200 characters" do
      result = LayoutVersions::Create.call(layout: @layout, memo: "a" * 201, placements: [])
      assert_equal "invalid_params", result.error_code
    end

    test "version numbers continue from the latest even after a layout starts empty" do
      fresh = @house.layouts.create!(name: "새 배치")
      first = LayoutVersions::Create.call(layout: fresh, placements: [ placement(@fridge, 1000, 1000) ])
      second = LayoutVersions::Create.call(layout: fresh, placements: [ placement(@fridge, 2000, 1000) ])

      assert_equal [ 1, 2 ], [ first.version.version_no, second.version.version_no ]
    end
  end
end
