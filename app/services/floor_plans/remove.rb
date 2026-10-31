module FloorPlans
  # 도면 이미지 제거. 첨부를 지우고 plan.image 를 null 로, plan_status 는 draft 로 되돌린다.
  class Remove
    def self.call(house) = new(house).call

    def initialize(house)
      @house = house
    end

    def call
      House.transaction do
        @house.floor_plan.purge_later if @house.floor_plan.attached?
        @house.update!(plan: @house.plan.merge("image" => nil), plan_status: "draft")
      end
      @house
    end
  end
end
