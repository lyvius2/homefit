module Api
  module V1
    # POST /api/v1/houses/:house_id/floor_plan (multipart file) — 도면 에디터의 업로드/교체
    class FloorPlansController < ApiController
      def create
        house = House.find(params[:house_id])
        result = FloorPlans::Attach.call(house, params[:file])
        return render_error("invalid_file", result.errors.join(" ")) unless result.ok?

        image = house.plan.fetch("image")
        render_data({ floor_plan_url: floor_plan_url(house), width_px: image["width_px"], height_px: image["height_px"] }, status: :created)
      end
    end
  end
end
