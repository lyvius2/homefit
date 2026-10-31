class LayoutsController < ApplicationController
  # 전체 배치도 목록. M2 5단계에서 채운다.
  def index
    @layouts = Layout.includes(:house).order(:name)
  end

  # S-06 배치 에디터 페이지. React 섬(LayoutEditor)은 M5 에서 등록된다.
  def show
    @layout = Layout.includes(:house).find(params[:id])
  end
end
