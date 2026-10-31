# 집기(가구·가전·기타). 치수는 정수 mm (R-01, R-07).
class Fixture < ApplicationRecord
  KINDS = %w[furniture appliance etc].freeze
  COLOR_FORMAT = /\A#\h{6}\z/

  enum :kind, KINDS.index_by(&:itself), validate: true

  # 폼의 "현재 이미지 삭제" 체크박스. 저장되지 않는 가상 속성이며 purge 는 컨트롤러가 한다.
  attribute :remove_image, :boolean, default: false

  # 집기 삭제 시 placements.fixture_id 는 DB 의 FK ON DELETE SET NULL 로만 비워진다.
  # (Placement 는 불변이라 모델 콜백으로 건드리지 않는다, R-11)
  has_many :placements
  IMAGE_CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  IMAGE_MAX_BYTES = 5.megabytes

  # 정면 이미지. texture 변형(512 px)을 3D 박스의 정면(+z) 텍스처로 쓴다 (설계서 Section 2.1).
  has_one_attached :image do |attachable|
    attachable.variant :texture, resize_to_limit: [ 512, 512 ]
  end

  validates :name, presence: true, length: { maximum: 100 }
  validates :width_mm, :depth_mm, numericality: { only_integer: true, in: 10..10_000 }
  validates :height_mm, numericality: { only_integer: true, in: 10..5_000 }
  validates :clearance_mm, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :color, format: { with: COLOR_FORMAT }
  validate :image_is_acceptable

  private

  # 새로 올리는 파일만 검사한다 (이미 저장된 blob 은 올릴 때 검사됐다).
  def image_is_acceptable
    change = attachment_changes["image"]
    return unless change.is_a?(ActiveStorage::Attached::Changes::CreateOne)
    return unless change.attachable.respond_to?(:original_filename)

    check = Attachments::Check.call(change.attachable, content_types: IMAGE_CONTENT_TYPES, max_bytes: IMAGE_MAX_BYTES)
    check.errors.each { |message| errors.add(:image, message) }
  end
end
