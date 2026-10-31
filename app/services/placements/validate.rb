module Placements
  # 배치 목록의 집기 간 겹침·벽 침범·외곽 이탈 판정 (R-08). 기하는 Geometry::Collisions 가 한다.
  # placements: [{ fixture_id:, x_mm:, y_mm:, z_mm:, rotation_deg: }] (정수). 삭제된 집기는 "fixture_missing".
  class Validate
    Result = Data.define(:violations, :missing_fixture_ids, :fixtures) do
      def valid? = violations.empty?
    end

    def self.call(house:, placements:, fixtures: nil) = new(house:, placements:, fixtures:).call

    def initialize(house:, placements:, fixtures: nil)
      @house = house
      @placements = placements
      @fixtures = fixtures
    end

    def call
      fixtures = @fixtures || Fixture.where(id: @placements.map { |p| p[:fixture_id] }.uniq).index_by(&:id)

      present = []   # [[footprint, original_index], ...]
      missing = []
      @placements.each_with_index do |p, i|
        fixture = fixtures[p[:fixture_id]]
        if fixture
          present << [ { x: p[:x_mm], y: p[:y_mm], width: fixture.width_mm, depth: fixture.depth_mm, rotation_deg: p[:rotation_deg] }, i ]
        else
          missing << i
        end
      end

      index_map = present.map(&:last)
      geometry = Geometry::Collisions.check(walls: @house.walls, footprints: present.map(&:first))
      violations = geometry.map do |v|
        {
          placement_index: index_map.fetch(v[:placement_index]),
          reasons: v[:reasons].map { |r| r.sub(/\Aoverlap:(\d+)\z/) { "overlap:#{index_map.fetch(Regexp.last_match(1).to_i)}" } }
        }
      end
      violations.concat(missing.map { |i| { placement_index: i, reasons: [ "fixture_missing" ] } })

      Result.new(
        violations: violations.sort_by { |v| v[:placement_index] },
        missing_fixture_ids: missing.map { |i| @placements[i][:fixture_id] }.uniq,
        fixtures:
      )
    end
  end
end
