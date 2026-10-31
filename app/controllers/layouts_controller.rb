class LayoutsController < ApplicationController
  # 전체 배치도 목록. M2 5단계에서 채운다.
  def index
    @layouts = Layout.includes(:house).order(:name)
  end
end
