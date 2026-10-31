# S-01 주택 목록, S-02 주택 상세(기본 정보 폼·도면·배치도). 컨트롤러는 파라미터 정리 → 모델/서비스 → 응답만.
class HousesController < ApplicationController
  before_action :set_house, only: %i[ show edit update destroy ]

  def index
    @houses = House.with_attached_floor_plan.includes(:layouts).order(:name)
  end

  def show
    @layouts = @house.layouts.includes(:layout_versions).order(:name)
  end

  def new
    @house = House.new
  end

  def create
    @house = House.new(house_params)
    if @house.save
      redirect_to @house, notice: "주택을 만들었습니다."
    else
      render :new, status: :unprocessable_entity
    end
  end

  # 상세 화면이 폼을 겸한다 (S-02)
  def edit
    redirect_to @house
  end

  def update
    if @house.update(house_params)
      redirect_to @house, notice: "저장했습니다."
    else
      @layouts = @house.layouts.includes(:layout_versions).order(:name)
      render :show, status: :unprocessable_entity
    end
  end

  def destroy
    @house.destroy!
    redirect_to houses_path, notice: "주택과 배치도를 삭제했습니다.", status: :see_other
  end

  private

  def set_house
    @house = House.find(params[:id])
  end

  def house_params
    params.expect(house: [ :name, :ceiling_height_mm, :dimension_basis, :notes ])
  end
end
