# S-04 집기 목록(종류 필터), S-05 집기 등록/수정.
class FixturesController < ApplicationController
  before_action :set_fixture, only: %i[ show edit update destroy ]

  def index
    @kind = Fixture.kinds.key?(params[:kind]) ? params[:kind] : nil
    @counts = Fixture.group(:kind).count
    @fixtures = Fixture.with_attached_image.order(:name)
    @fixtures = @fixtures.where(kind: @kind) if @kind
  end

  # 목록에서 선택하면 수정 화면으로 (S-04 → S-05)
  def show
    redirect_to edit_fixture_path(@fixture)
  end

  def new
    @fixture = Fixture.new
  end

  def create
    @fixture = Fixture.new(fixture_params)
    if @fixture.save
      redirect_to fixtures_path, notice: "집기를 등록했습니다."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @fixture.update(fixture_params)
      @fixture.image.purge_later if @fixture.remove_image && @fixture.image.attached?
      redirect_to fixtures_path, notice: "저장했습니다."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @fixture.destroy!
    redirect_to fixtures_path, notice: "집기를 삭제했습니다. 과거 배치 버전의 스냅샷은 유지됩니다.", status: :see_other
  end

  private

  def set_fixture
    @fixture = Fixture.find(params[:id])
  end

  def fixture_params
    params.expect(fixture: [ :name, :kind, :width_mm, :depth_mm, :height_mm, :clearance_mm, :color, :image, :remove_image, :notes ])
  end
end
