require "test_helper"

module FloorPlans
  class AttachTest < ActiveSupport::TestCase
    setup do
      @house = houses(:sample)
      @house.update!(plan_status: "valid")
    end

    test "attaches the image, records its pixel size and resets plan_status to draft" do
      result = FloorPlans::Attach.call(@house, fixture_file_upload("floor_plan.png", "image/png"))

      assert result.ok?, result.errors.inspect
      @house.reload
      assert @house.floor_plan.attached?
      assert_equal({ "width_px" => 640, "height_px" => 480 }, @house.plan["image"])
      assert @house.plan_status_draft?
      assert @house.valid?, @house.errors.full_messages.inspect
    end

    test "rejects svg and leaves the house untouched" do
      result = FloorPlans::Attach.call(@house, fixture_file_upload("evil.svg", "image/svg+xml"))

      assert_not result.ok?
      @house.reload
      assert_not @house.floor_plan.attached?
      assert_nil @house.plan["image"]
      assert @house.plan_status_valid?
    end

    test "remove clears the attachment and plan.image" do
      FloorPlans::Attach.call(@house, fixture_file_upload("floor_plan.png", "image/png"))
      FloorPlans::Remove.call(@house.reload)

      @house.reload
      assert_not @house.floor_plan.attached?
      assert_nil @house.plan["image"]
    end
  end
end
