# 도면 1장으로 만들어진 공간. 벽 집합(plan JSON) + 천장고.
class House < ApplicationRecord
  # MySQL JSON 컬럼은 리터럴 DEFAULT 를 허용하지 않아 모델에서 기본값을 채운다 (설계서 Section 2.1, 2.3).
  # 키는 DB 왕복 후와 같은 문자열 키로 둔다.
  DEFAULT_PLAN = {
    "schema" => 1,
    "unit" => "mm",
    "image" => nil,
    "scale" => { "px_per_mm" => nil, "measured_mm" => nil, "verify" => nil },
    "walls" => [],
    "openings" => []
  }.freeze

  # Rails enum: DB 에는 문자열을 저장하고 `house.dimension_basis_clear?` 같은 조회 메서드와 스코프를 만든다.
  # prefix 를 붙이는 이유: `valid?` 는 Active Record 검증 메서드와 충돌한다.
  enum :dimension_basis, { centerline: "centerline", clear: "clear" }, prefix: true, validate: true
  enum :plan_status, { draft: "draft", valid: "valid" }, prefix: true, validate: true

  attribute :plan, default: -> { DEFAULT_PLAN.deep_dup }

  has_many :layouts, dependent: :destroy

  # 도면 이미지. editor: 에디터 배경(긴 변 2,200 px), thumb: 목록 카드. 변형은 요청 시 생성된다.
  has_one_attached :floor_plan do |attachable|
    attachable.variant :editor, resize_to_limit: [ 2200, 2200 ]
    attachable.variant :thumb, resize_to_limit: [ 480, 480 ]
  end

  validates :name, presence: true, length: { maximum: 100 }
  validates :ceiling_height_mm, numericality: { only_integer: true, in: 2000..4000 }
  validates :plan, presence: true
  validate :plan_matches_schema

  def walls = plan.fetch("walls", [])

  # 외곽 바운딩 박스(Plans::Bounds::Box) 또는 벽이 없으면 nil
  def bounds = Plans::Bounds.call(plan)

  private

  def plan_matches_schema
    return if plan.blank?

    Plans::Schema.call(plan).errors.each do |error|
      errors.add(:plan, "#{error[:path].presence || '/'}: #{error[:message]}")
    end
  end
end
