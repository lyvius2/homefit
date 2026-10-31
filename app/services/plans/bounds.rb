module Plans
  # 벽 목록 → 외곽 바운딩 박스 (설계서 Section 2.3, 3). 벽 끝점 ± 두께/2 를 정수 mm 로 감싼다.
  # 충돌 판정의 "외곽"(Placements::Validate, M3)과 S-01 카드의 외곽 크기 표시에 쓴다. 벽이 없으면 nil.
  class Bounds
    Box = Data.define(:min_x, :min_y, :max_x, :max_y) do
      def width_mm = max_x - min_x
      def height_mm = max_y - min_y
    end

    def self.call(plan) = new(plan).call

    def initialize(plan)
      @walls = (plan || {}).fetch("walls", [])
    end

    def call
      return nil if @walls.empty?

      min_x = min_y = Float::INFINITY
      max_x = max_y = -Float::INFINITY

      @walls.each do |wall|
        half = wall.fetch("thickness_mm") / 2.0
        [ wall.fetch("a"), wall.fetch("b") ].each do |(x, y)|
          min_x = [ min_x, x - half ].min
          min_y = [ min_y, y - half ].min
          max_x = [ max_x, x + half ].max
          max_y = [ max_y, y + half ].max
        end
      end

      Box.new(min_x: min_x.floor, min_y: min_y.floor, max_x: max_x.ceil, max_y: max_y.ceil)
    end
  end
end
