# 특정 버전 안의 집기 1개 위치·회전. 집기 치수·이름은 저장 시점 스냅샷 (R-11). 불변 (R-09).
class Placement < ApplicationRecord
  belongs_to :layout_version
  # 원본 집기가 삭제되면 NULL 이 되고 스냅샷만 남는다.
  belongs_to :fixture, optional: true

  validates :name, presence: true, length: { maximum: 100 }
  validates :kind, inclusion: { in: Fixture::KINDS }
  validates :width_mm, :depth_mm, :height_mm, numericality: { only_integer: true, greater_than: 0 }
  validates :clearance_mm, :z_mm, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :x_mm, :y_mm, numericality: { only_integer: true }
  validates :rotation_deg, numericality: { only_integer: true, in: 0..359 }
  validates :color, format: { with: Fixture::COLOR_FORMAT }

  def readonly? = persisted?
end
