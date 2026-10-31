# 주택 1개에 속하는 배치 작업 단위. 버전(LayoutVersion)을 쌓는다.
class Layout < ApplicationRecord
  belongs_to :house

  # 버전은 불변(readonly)이라 Rails 의 dependent: :destroy 를 쓸 수 없다.
  # 배치도 삭제 시 버전·배치는 DB 의 FK ON DELETE CASCADE 로만 지워진다 (R-09).
  has_many :layout_versions

  validates :name, presence: true, length: { maximum: 100 }

  def latest_version
    layout_versions.order(version_no: :desc).first
  end
end
