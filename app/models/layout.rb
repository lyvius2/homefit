# 주택 1개에 속하는 배치 작업 단위. 버전(LayoutVersion)을 쌓는다.
class Layout < ApplicationRecord
  belongs_to :house

  # 버전은 불변(readonly)이라 Rails 의 dependent: :destroy 를 쓸 수 없다.
  # 배치도 삭제 시 버전·배치는 DB 의 FK ON DELETE CASCADE 로만 지워진다 (R-09).
  has_many :layout_versions

  validates :name, presence: true, length: { maximum: 100 }

  # 목록용: 버전을 전부 읽지 않고 최신 버전 번호·저장 시각만 서브쿼리로 붙인다 (latest_version_no, latest_saved_at).
  scope :with_latest_version, -> {
    select(
      "layouts.*",
      "(SELECT MAX(v.version_no) FROM layout_versions v WHERE v.layout_id = layouts.id) AS latest_version_no",
      "(SELECT MAX(v.created_at) FROM layout_versions v WHERE v.layout_id = layouts.id) AS latest_saved_at"
    )
  }

  def latest_version
    layout_versions.order(version_no: :desc).first
  end
end
