module Plans
  # Plan JSON 의 저장 가능 여부: 스키마 + R-04(축척) + R-05(검증 오차 3%) + R-06(벽 3개 이상) + 참조 무결성.
  # 결과 violations 는 [{ code, message, path }]. 저장 여부 판단은 호출자(API)가 한다.
  class Validate
    MAX_SCALE_ERROR_PCT = 3.0
    MIN_WALLS = 3

    Violation = Data.define(:code, :message, :path)
    Result = Data.define(:violations) do
      def valid? = violations.empty?
    end

    def self.call(plan) = new(plan).call

    def initialize(plan)
      @plan = plan.as_json
    end

    def call
      schema = Plans::Schema.call(@plan)
      unless schema.ok?
        return Result.new(violations: schema.errors.map { |e| Violation.new(code: "schema", message: e[:message], path: e[:path].presence) })
      end

      violations = []
      check_walls(violations)
      check_openings(violations)
      check_scale(violations)
      Result.new(violations:)
    end

    private

    def walls = @plan.fetch("walls")

    def check_walls(violations)
      if walls.size < MIN_WALLS
        violations << Violation.new(code: "walls_min", message: "벽은 #{MIN_WALLS}개 이상이어야 합니다 (현재 #{walls.size}개).", path: "/walls")
      end

      walls.map { |w| w["id"] }.tally.select { |_, n| n > 1 }.each_key do |id|
        violations << Violation.new(code: "wall_id_duplicate", message: "벽 id 가 중복됩니다: #{id}", path: "/walls")
      end

      walls.each_with_index do |wall, i|
        next unless wall["a"] == wall["b"]

        violations << Violation.new(code: "wall_zero_length", message: "길이가 0인 벽입니다: #{wall['id']}", path: "/walls/#{i}")
      end
    end

    # 참조 무결성 → 벽 길이 안에 들어가는지 → 같은 벽의 개구부끼리 겹치지 않는지 → swing 은 문에만.
    def check_openings(violations)
      by_id = walls.index_by { |w| w["id"] }
      openings = @plan.fetch("openings")

      openings.each_with_index do |opening, i|
        wall = by_id[opening["wall_id"]]
        unless wall
          violations << Violation.new(code: "opening_wall_missing", message: "개구부 #{opening['id']} 가 가리키는 벽 #{opening['wall_id']} 이 없습니다.", path: "/openings/#{i}/wall_id")
          next
        end

        if opening["offset_mm"] + opening["width_mm"] > wall_length(wall)
          violations << Violation.new(code: "opening_outside_wall", message: "개구부 #{opening['id']} 가 벽 #{wall['id']} 길이(#{wall_length(wall)} mm)를 벗어납니다.", path: "/openings/#{i}/offset_mm")
        end

        if opening["type"] == "window" && opening["swing"]
          violations << Violation.new(code: "swing_on_window", message: "창 #{opening['id']} 에는 열림 방향(swing)을 둘 수 없습니다.", path: "/openings/#{i}/swing")
        end
      end

      openings.each_with_index do |opening, i|
        earlier = openings.first(i).find { |o| o["wall_id"] == opening["wall_id"] && ranges_overlap?(o, opening) }
        next unless earlier

        violations << Violation.new(code: "opening_overlap", message: "개구부 #{opening['id']} 가 같은 벽의 #{earlier['id']} 와 겹칩니다.", path: "/openings/#{i}")
      end
    end

    def wall_length(wall)
      (ax, ay), (bx, by) = wall["a"], wall["b"]
      Math.hypot(bx - ax, by - ay).round
    end

    # 벽을 따라 [offset, offset+width) 구간이 겹치는지. 맞닿는 것(간격 0)은 겹침이 아니다.
    def ranges_overlap?(o1, o2)
      o1["offset_mm"] < o2["offset_mm"] + o2["width_mm"] && o2["offset_mm"] < o1["offset_mm"] + o1["width_mm"]
    end

    # R-04: 도면 이미지를 쓰면 축척이 있어야 한다. R-05: 검증 측정 오차는 서버가 다시 계산해 3% 초과면 거부.
    def check_scale(violations)
      scale = @plan.fetch("scale")
      if @plan["image"] && scale["px_per_mm"].nil?
        violations << Violation.new(code: "scale_required", message: "도면 이미지를 쓰려면 축척(px_per_mm)을 설정해야 합니다.", path: "/scale/px_per_mm")
      end

      verify = scale["verify"]
      return if verify.nil?

      error_pct = (verify["got_mm"] - verify["measured_mm"]).abs * 100.0 / verify["measured_mm"]
      return if error_pct <= MAX_SCALE_ERROR_PCT

      violations << Violation.new(
        code: "scale_error",
        message: "검증 측정 오차가 #{error_pct.round(1)}% 로 #{MAX_SCALE_ERROR_PCT.to_i}% 를 넘습니다. 도면 왜곡이거나 축척이 틀렸습니다.",
        path: "/scale/verify"
      )
    end
  end
end
