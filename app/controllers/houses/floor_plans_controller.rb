module Houses
  # S-02 도면 이미지 업로드/삭제 (HTML). JSON API 는 M3 의 /api/v1/houses/:id/floor_plan.
  class FloorPlansController < ApplicationController
    before_action :set_house

    def create
      result = FloorPlans::Attach.call(@house, params[:file])
      if result.ok?
        redirect_to @house, notice: "도면을 올렸습니다. 축척은 도면 편집에서 설정합니다."
      else
        redirect_to @house, alert: result.errors.join(" ")
      end
    end

    def destroy
      FloorPlans::Remove.call(@house)
      redirect_to @house, notice: "도면을 삭제했습니다.", status: :see_other
    end

    private

    def set_house
      @house = House.find(params[:house_id])
    end
  end
end
