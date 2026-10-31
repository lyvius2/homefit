class HousesController < ApplicationController
  # S-01 주택 목록. 카드 내용은 M2 3단계에서 채운다.
  def index
    @houses = House.order(:name)
  end
end
