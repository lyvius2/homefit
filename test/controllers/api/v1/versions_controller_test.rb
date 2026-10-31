require "test_helper"

module Api
  module V1
    class VersionsControllerTest < ActionDispatch::IntegrationTest
      setup do
        sign_in_as users(:one)
        @layout = layouts(:main)
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

      def json = response.parsed_body

      def placement(fixture, x, y, rot = 0)
        { fixture_id: fixture.id, x_mm: x, y_mm: y, z_mm: 0, rotation_deg: rot }
      end

      test "index lists versions newest first with placement counts" do
        get api_v1_layout_versions_path(@layout)
        assert_response :success
        data = json["data"]
        assert_equal [ 2, 1 ], data.map { |v| v["version_no"] }
        assert_equal [ 2, 1 ], data.map { |v| v["placements_count"] }
        assert_equal %w[version_no memo created_at placements_count], data.first.keys
        assert_match(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\z/, data.first["created_at"])
      end

      test "latest returns the highest version with placements (R-10)" do
        get latest_api_v1_layout_versions_path(@layout)
        assert_response :success
        data = json["data"]
        assert_equal 2, data["version_no"]
        assert_equal 2, data["placements"].size
        orphan = data["placements"].find { |p| p["name"] == "삭제된 소파" }
        assert_nil orphan["fixture_id"]
        assert_nil orphan["image_url"]
        assert_equal %w[id fixture_id name kind width_mm depth_mm height_mm clearance_mm color x_mm y_mm z_mm rotation_deg image_url], orphan.keys
      end

      test "show by number and 404 for unknown numbers" do
        get api_v1_layout_version_path(@layout, no: 1)
        assert_response :success
        assert_equal 1, json.dig("data", "version_no")
        assert_equal "첫 저장", json.dig("data", "memo")

        get api_v1_layout_version_path(@layout, no: 99)
        assert_response :not_found
      end

      test "latest on a layout without versions is 404" do
        layout = @house.layouts.create!(name: "빈")
        get latest_api_v1_layout_versions_path(layout)
        assert_response :not_found
      end

      test "validate reports collisions without saving" do
        assert_no_difference "LayoutVersion.count" do
          post validate_api_v1_layout_versions_path(@layout), params: { placements: [ placement(@fridge, 1000, 1000), placement(@sofa, 1500, 1000) ] }, as: :json
        end
        assert_response :success
        assert_equal false, json.dig("data", "valid")
        assert_equal [ { "placement_index" => 0, "reasons" => [ "overlap:1" ] }, { "placement_index" => 1, "reasons" => [ "overlap:0" ] } ], json.dig("data", "violations")
      end

      test "create saves a new version with server-side snapshots" do
        assert_difference -> { LayoutVersion.count } => 1, -> { Placement.count } => 2 do
          post api_v1_layout_versions_path(@layout),
               params: { memo: "API 저장", placements: [ placement(@fridge, 1000, 1000, 90), placement(@sofa, 5000, 3000).merge(width_mm: 1) ] }, as: :json
        end
        assert_response :created
        assert_equal 3, json.dig("data", "version_no")
        version = @layout.layout_versions.find_by!(version_no: 3)
        assert_equal 2, version.placements.count
        assert_equal @sofa.width_mm, version.placements.find_by(fixture_id: @sofa.id).width_mm, "클라이언트가 보낸 치수는 무시"
      end

      test "create rejects collisions with 422 collision" do
        assert_no_difference "LayoutVersion.count" do
          post api_v1_layout_versions_path(@layout), params: { placements: [ placement(@fridge, 1000, 400) ] }, as: :json
        end
        assert_response :unprocessable_entity
        assert_equal "collision", json.dig("error", "code")
        assert_equal [ "wall:w01" ], json.dig("error", "details", "violations", 0, "reasons")
      end

      test "create rejects deleted fixtures with 422 fixture_missing" do
        post api_v1_layout_versions_path(@layout), params: { placements: [ { fixture_id: 0, x_mm: 0, y_mm: 0 } ] }, as: :json
        assert_response :unprocessable_entity
        assert_equal "fixture_missing", json.dig("error", "code")
        assert_equal [ 0 ], json.dig("error", "details", "fixture_ids")
      end

      test "create rejects malformed placements with 422 invalid_params" do
        post api_v1_layout_versions_path(@layout), params: { placements: [ placement(@fridge, 1000, 1000, 400) ] }, as: :json
        assert_response :unprocessable_entity
        assert_equal "invalid_params", json.dig("error", "code")

        post api_v1_layout_versions_path(@layout), params: { placements: [ { fixture_id: @fridge.id, x_mm: "abc", y_mm: 0 } ] }, as: :json
        assert_equal "invalid_params", json.dig("error", "code")

        post api_v1_layout_versions_path(@layout), params: { memo: "x" }, as: :json
        assert_equal "invalid_params", json.dig("error", "code")
      end

      test "create allows an empty placements array" do
        post api_v1_layout_versions_path(@layout), params: { placements: [] }, as: :json
        assert_response :created
      end
    end
  end
end
