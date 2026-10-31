# frozen_string_literal: true

module Geometry
  # 벽 목록 → 외곽 바운딩 박스. 벽 끝점 ± 두께/2 를 정수 mm 로 감싼다 (설계서 Section 2.3, 3).
  # 순수 Ruby. app/frontend/lib/collisions.ts 의 boundsOfWalls 와 같아야 한다.
  module Bounds
    Box = Data.define(:min_x, :min_y, :max_x, :max_y) do
      def width_mm = max_x - min_x
      def height_mm = max_y - min_y
    end

    module_function

    # walls: [{ "id", "a" => [x, y], "b" => [x, y], "thickness_mm" }] (문자열 키). 벽이 없으면 nil.
    def call(walls)
      return nil if walls.nil? || walls.empty?

      min_x = min_y = Float::INFINITY
      max_x = max_y = -Float::INFINITY

      walls.each do |wall|
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
