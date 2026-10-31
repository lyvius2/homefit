# frozen_string_literal: true

module Geometry
  # 볼록 사각형(OBB) 간 분리축 정리(SAT) 교차 판정. 설계서 Section 3.
  # 접촉(겹침이 ε 이하)은 교차로 보지 않는다.
  module Sat
    EPSILON = 1e-6

    module_function

    def intersect?(a, b)
      corners_a = a.corners
      corners_b = b.corners

      (a.axes + b.axes).all? do |axis|
        min_a, max_a = project(corners_a, axis)
        min_b, max_b = project(corners_b, axis)
        overlap = [ max_a, max_b ].min - [ min_a, min_b ].max
        overlap > EPSILON
      end
    end

    # 꼭짓점들을 축에 투영한 [min, max]
    def project(corners, axis)
      ux, uy = axis
      values = corners.map { |x, y| x * ux + y * uy }
      [ values.min, values.max ]
    end
  end
end
