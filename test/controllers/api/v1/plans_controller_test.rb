require "test_helper"

module Api
  module V1
    class PlansControllerTest < ActionDispatch::IntegrationTest
      OUTER = [
        { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
        { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 },
        { "id" => "w03", "a" => [ 9900, 6300 ], "b" => [ 0, 6300 ], "thickness_mm" => 200 }
      ].freeze

      setup do
        sign_in_as users(:one)
        @house = houses(:sample)
      end

      def json = response.parsed_body

      test "requires authentication with a JSON 401" do
        sign_out
        get api_v1_house_plan_path(@house)
        assert_response :unauthorized
        assert_equal "unauthorized", json.dig("error", "code")
      end

      test "unknown house returns 404 with the error envelope" do
        get api_v1_house_plan_path(house_id: 0)
        assert_response :not_found
        assert_equal({ "error" => { "code" => "not_found", "message" => "찾을 수 없습니다." } }, json)
      end

      test "show returns house, plan and floor_plan_url" do
        get api_v1_house_plan_path(@house)
        assert_response :success
        data = json["data"]
        assert_equal @house.id, data.dig("house", "id")
        assert_equal %w[id name ceiling_height_mm dimension_basis plan_status], data["house"].keys
        assert_equal House::DEFAULT_PLAN, data["plan"]
        assert_nil data["floor_plan_url"]
      end

      test "show returns the editor variant url when a floor plan is attached" do
        @house.floor_plan.attach(fixture_file_upload("floor_plan.png", "image/png"))
        get api_v1_house_plan_path(@house)
        assert_match %r{/rails/active_storage/representations/}, json.dig("data", "floor_plan_url")
      end

      test "update saves a valid plan and marks it valid" do
        put api_v1_house_plan_path(@house), params: { plan: House::DEFAULT_PLAN.merge("walls" => OUTER) }, as: :json
        assert_response :success
        assert_equal "valid", json.dig("data", "plan_status")
        assert_equal 3, json.dig("data", "plan", "walls").size
        assert @house.reload.plan_status_valid?
      end

      test "update rejects an invalid plan with 422 plan_invalid and changes nothing" do
        put api_v1_house_plan_path(@house), params: { plan: House::DEFAULT_PLAN }, as: :json
        assert_response :unprocessable_entity
        assert_equal "plan_invalid", json.dig("error", "code")
        assert_equal [ "walls_min" ], json.dig("error", "details").map { |v| v["code"] }
        assert @house.reload.plan_status_draft?
      end

      test "update ignores client image and uses the attached blob size" do
        @house.floor_plan.attach(fixture_file_upload("floor_plan.png", "image/png"))
        plan = House::DEFAULT_PLAN.merge("walls" => OUTER, "image" => { "width_px" => 1, "height_px" => 1 },
                                         "scale" => { "px_per_mm" => 0.1, "measured_mm" => 3000, "verify" => nil })
        put api_v1_house_plan_path(@house), params: { plan: plan }, as: :json
        assert_response :success
        assert_equal({ "width_px" => 640, "height_px" => 480 }, json.dig("data", "plan", "image"))
      end

      test "update without a scale fails when an image is attached (R-04)" do
        @house.floor_plan.attach(fixture_file_upload("floor_plan.png", "image/png"))
        put api_v1_house_plan_path(@house), params: { plan: House::DEFAULT_PLAN.merge("walls" => OUTER) }, as: :json
        assert_response :unprocessable_entity
        assert_includes json.dig("error", "details").map { |v| v["code"] }, "scale_required"
      end

      test "validate reports violations without saving" do
        post validate_api_v1_house_plan_path(@house), params: { plan: House::DEFAULT_PLAN.merge("walls" => OUTER.first(1)) }, as: :json
        assert_response :success
        assert_equal false, json.dig("data", "valid")
        assert_equal "walls_min", json.dig("data", "violations", 0, "code")
        assert_equal House::DEFAULT_PLAN, @house.reload.plan
      end

      test "missing plan parameter is 422 invalid_params" do
        put api_v1_house_plan_path(@house), params: {}, as: :json
        assert_response :unprocessable_entity
        assert_equal "invalid_params", json.dig("error", "code")
      end
    end
  end
end
