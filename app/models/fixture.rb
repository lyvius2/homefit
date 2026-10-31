# 집기(가구·가전·기타). 치수는 정수 mm (R-01, R-07).
class Fixture < ApplicationRecord
  KINDS = %w[furniture appliance etc].freeze
  COLOR_FORMAT = /\A#\h{6}\z/

  enum :kind, KINDS.index_by(&:itself), validate: true

  # 집기 삭제 시 placements.fixture_id 는 DB 의 FK ON DELETE SET NULL 로만 비워진다.
  # (Placement 는 불변이라 모델 콜백으로 건드리지 않는다, R-11)
  has_many :placements
  has_one_attached :image

  validates :name, presence: true, length: { maximum: 100 }
  validates :width_mm, :depth_mm, numericality: { only_integer: true, in: 10..10_000 }
  validates :height_mm, numericality: { only_integer: true, in: 10..5_000 }
  validates :clearance_mm, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :color, format: { with: COLOR_FORMAT }
end
