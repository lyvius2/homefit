module LayoutVersions
  # 새 버전 저장 (R-08, R-09, R-11): 판정 → 채번(SELECT ... FOR UPDATE on layout) → 스냅샷 복사 → insert_all. 전부 한 트랜잭션.
  # Spring 비유: @Transactional 서비스 메서드 하나. 잠금은 같은 배치도에 동시에 저장할 때 version_no 충돌을 막는다.
  class Create
    Result = Data.define(:version, :error_code, :message, :details) do
      def ok? = error_code.nil?
    end

    def self.call(layout:, placements:, memo: nil) = new(layout:, placements:, memo:).call

    def initialize(layout:, placements:, memo: nil)
      @layout = layout
      @placements = placements
      @memo = memo.presence
    end

    def call
      Layout.transaction do
        layout = Layout.lock.find(@layout.id)
        validation = Placements::Validate.call(house: layout.house, placements: @placements)

        if validation.missing_fixture_ids.any?
          return failure("fixture_missing", "삭제된 집기가 있어 저장할 수 없습니다.", fixture_ids: validation.missing_fixture_ids)
        end
        unless validation.valid?
          return failure("collision", "겹침·벽 침범·외곽 이탈이 있어 저장할 수 없습니다.", violations: validation.violations)
        end

        version_no = (layout.layout_versions.maximum(:version_no) || 0) + 1
        version = layout.layout_versions.build(version_no:, memo: @memo)
        return failure("invalid_params", version.errors.full_messages.join(" "), errors: version.errors.to_hash) unless version.save

        rows = @placements.map { |p| snapshot_row(version, p, validation.fixtures.fetch(p[:fixture_id])) }
        Placement.insert_all!(rows) if rows.any?

        Result.new(version:, error_code: nil, message: nil, details: nil)
      end
    end

    private

    def snapshot_row(version, placement, fixture)
      {
        layout_version_id: version.id,
        fixture_id: fixture.id,
        name: fixture.name, kind: fixture.kind, color: fixture.color,
        width_mm: fixture.width_mm, depth_mm: fixture.depth_mm, height_mm: fixture.height_mm,
        clearance_mm: fixture.clearance_mm,
        x_mm: placement[:x_mm], y_mm: placement[:y_mm], z_mm: placement[:z_mm], rotation_deg: placement[:rotation_deg]
      }
    end

    def failure(code, message, details)
      Result.new(version: nil, error_code: code, message:, details:)
    end
  end
end
