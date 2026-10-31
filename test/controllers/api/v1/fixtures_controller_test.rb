require "test_helper"

module Api
  module V1
    class FixturesControllerTest < ActionDispatch::IntegrationTest
      setup { sign_in_as users(:one) }

      test "index lists fixtures with image_url" do
        fixtures(:fridge).image.attach(fixture_file_upload("front.jpg", "image/jpeg"))
        get api_v1_fixtures_path
        assert_response :success
        data = response.parsed_body["data"]
        assert_equal Fixture.count, data.size
        fridge = data.find { |f| f["id"] == fixtures(:fridge).id }
        assert_equal %w[id name kind width_mm depth_mm height_mm clearance_mm color image_url], fridge.keys
        assert_match %r{/rails/active_storage/representations/}, fridge["image_url"]
        assert_nil data.find { |f| f["id"] == fixtures(:sofa).id }["image_url"]
      end

      test "index filters by kind" do
        get api_v1_fixtures_path(kind: "furniture")
        assert_equal [ "furniture" ], response.parsed_body["data"].map { |f| f["kind"] }.uniq
      end
    end
  end
end
