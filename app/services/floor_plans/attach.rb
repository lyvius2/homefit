module FloorPlans
  # 도면 이미지 첨부 (설계서 Section 4.3). 검사 → 첨부 → 치수 분석 → plan.image 갱신, plan_status 는 draft 로.
  # 벽은 유지한다(유지 여부를 묻는 흐름은 도면 에디터, M4).
  class Attach
    CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
    MAX_BYTES = 15.megabytes

    Result = Data.define(:house, :errors) do
      def ok? = errors.empty?
    end

    def self.call(house, file) = new(house, file).call

    def initialize(house, file)
      @house = house
      @file = file
    end

    def call
      check = Attachments::Check.call(@file, content_types: CONTENT_TYPES, max_bytes: MAX_BYTES)
      return Result.new(house: @house, errors: check.errors) unless check.ok?

      # attach 는 레코드를 저장하고 커밋 후 업로드한다. 분석은 업로드된 파일을 읽으므로 트랜잭션 밖에서 순서대로 한다.
      @house.floor_plan.attach(@file)
      blob = @house.floor_plan.blob
      blob.analyze unless blob.analyzed?

      @house.update!(
        plan: @house.plan.merge("image" => { "width_px" => blob.metadata.fetch("width"), "height_px" => blob.metadata.fetch("height") }),
        plan_status: "draft"
      )
      Result.new(house: @house, errors: [])
    end
  end
end
