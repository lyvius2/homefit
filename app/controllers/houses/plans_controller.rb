module Houses
  # S-03 도면 에디터 페이지. React 섬(PlanEditor)은 M4 에서 등록된다.
  class PlansController < ApplicationController
    def edit
      @house = House.find(params[:house_id])
    end
  end
end
