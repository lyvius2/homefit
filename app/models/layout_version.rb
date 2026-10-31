# 배치도의 저장 스냅샷. 생성 후 수정·삭제 불가 (R-09).
class LayoutVersion < ApplicationRecord
  belongs_to :layout
  has_many :placements

  validates :version_no, numericality: { only_integer: true, greater_than_or_equal_to: 1 },
                         uniqueness: { scope: :layout_id }
  validates :memo, length: { maximum: 200 }

  # 목록용: 배치 수를 서브쿼리로 붙인다 (placements_count)
  scope :with_placements_count, -> {
    select("layout_versions.*", "(SELECT COUNT(*) FROM placements p WHERE p.layout_version_id = layout_versions.id) AS placements_count")
  }

  # 저장된 레코드는 update/destroy 시 ActiveRecord::ReadOnlyRecord 를 던진다.
  def readonly? = persisted?
end
