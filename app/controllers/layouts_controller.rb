# 배치도: 전체 목록, 주택 아래 생성, S-06 에디터 페이지(섬 자리), S-08 설정(이름 변경·삭제).
class LayoutsController < ApplicationController
  before_action :set_layout, only: %i[ show edit update destroy ]
  before_action :set_house, only: %i[ new create ]

  def index
    @layouts = Layout.with_latest_version.includes(:house).order(:name)
    @by_house = @layouts.group_by(&:house).sort_by { |house, _| house.name }
  end

  # S-06 배치 에디터 페이지. React 섬(LayoutEditor)은 M5 에서 등록된다.
  def show
  end

  def new
    @layout = @house.layouts.build(name: "배치 #{@house.layouts.count + 1}")
  end

  def create
    @layout = @house.layouts.build(layout_params)
    if @layout.save
      redirect_to layout_path(@layout), notice: "배치도를 만들었습니다."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @layout.update(layout_params)
      redirect_to layout_path(@layout), notice: "저장했습니다."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  # 버전·배치는 DB 의 FK ON DELETE CASCADE 로 함께 지워진다 (R-09)
  def destroy
    house = @layout.house
    @layout.destroy!
    redirect_to house_path(house), notice: "배치도와 모든 버전을 삭제했습니다.", status: :see_other
  end

  private

  def set_layout
    @layout = Layout.with_latest_version.includes(:house).find(params[:id])
  end

  def set_house
    @house = House.find(params[:house_id])
  end

  def layout_params
    params.expect(layout: [ :name ])
  end
end
