module Api
  module V1
    # GET/PUT /api/v1/houses/:house_id/plan, POST .../plan/validate
    class PlansController < ApiController
      before_action :set_house

      def show
        render_data(house: house_json(@house), plan: @house.plan, floor_plan_url: floor_plan_url(@house))
      end

      # R-04~06 통과 시에만 저장하고 plan_status 를 valid 로 올린다. 실패하면 아무것도 바꾸지 않는다.
      def update
        plan = normalized_plan
        result = Plans::Validate.call(plan)
        return render_error("plan_invalid", "도면을 저장할 수 없습니다.", details: result.violations.map(&:to_h)) unless result.valid?

        @house.update!(plan: plan, plan_status: "valid")
        render_data(plan: @house.plan, plan_status: @house.plan_status)
      end

      def validate
        result = Plans::Validate.call(normalized_plan)
        render_data(valid: result.valid?, violations: result.violations.map(&:to_h))
      end

      private

      def set_house
        @house = House.find(params[:house_id])
      end

      # 클라이언트가 보낸 plan 에서 image 는 믿지 않는다. 실제 첨부 상태(blob 분석값)로 덮어쓴다.
      def normalized_plan
        plan = params.require(:plan)
        raise InvalidParams, "plan 은 객체여야 합니다." unless plan.respond_to?(:to_unsafe_h)

        plan.to_unsafe_h.deep_stringify_keys.merge("image" => current_image)
      end

      def current_image
        return nil unless @house.floor_plan.attached?

        blob = @house.floor_plan.blob
        blob.analyze unless blob.analyzed?
        { "width_px" => blob.metadata["width"], "height_px" => blob.metadata["height"] }
      end
    end
  end
end
