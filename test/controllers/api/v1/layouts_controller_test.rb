require "test_helper"

module Api
  module V1
    class LayoutsControllerTest < ActionDispatch::IntegrationTest
      setup { sign_in_as users(:one) }

      test "show returns the layout and latest version number" do
        get api_v1_layout_path(layouts(:main))
        assert_response :success
        data = response.parsed_body["data"]
        assert_equal({ "id" => layouts(:main).id, "house_id" => houses(:sample).id, "name" => "기본 배치" }, data["layout"])
        assert_equal 2, data["latest_version_no"]
      end

      test "layout without versions has null latest_version_no" do
        layout = houses(:sample).layouts.create!(name: "빈 배치")
        get api_v1_layout_path(layout)
        assert_nil response.parsed_body.dig("data", "latest_version_no")
      end
    end
  end
end
