require "test_helper"

module Api
  module V1
    class FloorPlansControllerTest < ActionDispatch::IntegrationTest
      setup do
        sign_in_as users(:one)
        @house = houses(:sample)
      end

      test "create attaches the image and returns its size" do
        post api_v1_house_floor_plan_path(@house), params: { file: fixture_file_upload("floor_plan.png", "image/png") }
        assert_response :created
        data = response.parsed_body["data"]
        assert_equal [ 640, 480 ], [ data["width_px"], data["height_px"] ]
        assert_match %r{/rails/active_storage/representations/}, data["floor_plan_url"]
        assert @house.reload.plan_status_draft?
      end

      test "create rejects svg with 422 invalid_file" do
        post api_v1_house_floor_plan_path(@house), params: { file: fixture_file_upload("evil.svg", "image/svg+xml") }
        assert_response :unprocessable_entity
        assert_equal "invalid_file", response.parsed_body.dig("error", "code")
      end
    end
  end
end
