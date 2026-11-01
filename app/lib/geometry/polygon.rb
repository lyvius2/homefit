# frozen_string_literal: true

module Geometry
  # 볼록 다각형. Sat.intersect? 가 요구하는 corners / axes 를 제공한다 (Obb 와 호환).
  # corners: [[x, y], ...] 꼭짓점을 둘레 순서로. axes: 각 변의 단위 법선.
  # 순수 Ruby. app/frontend/lib/geometry.ts 의 Polygon 과 같아야 한다.
  Polygon = Data.define(:corners) do
    def axes
      corners.each_index.map do |i|
        (x1, y1) = corners[i]
        (x2, y2) = corners[(i + 1) % corners.size]
        ex = x2 - x1
        ey = y2 - y1
        length = Math.sqrt(ex * ex + ey * ey)
        [ -ey / length, ex / length ]
      end
    end
  end
end
