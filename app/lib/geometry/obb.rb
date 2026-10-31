# frozen_string_literal: true

module Geometry
  # 회전된 사각형(Oriented Bounding Box). 설계서 Section 3.
  #
  # - 좌표계: 도면 좌상단 원점, x 오른쪽 +, y 아래 + (R-02)
  # - 회전 deg: 위에서 봤을 때 시계방향. y 가 아래로 + 인 좌표계에서는 표준 회전행렬
  #   [cos -sin; sin cos] 이 그대로 시계방향이 된다.
  # - 꼭짓점 순서는 (-hw,-hd), (+hw,-hd), (+hw,+hd), (-hw,+hd) 를 회전한 것. TS 구현과 같아야 한다.
  #
  # 순수 Ruby. Rails 에 의존하지 않는다 (app/frontend/lib/geometry.ts 와 같은 테스트 벡터로 검증).
  Obb = Data.define(:cx, :cy, :hw, :hd, :deg) do
    # 집기 풋프린트: 중심 (x, y), 반폭 W/2, 반깊이 D/2, 회전 θ
    def self.from_footprint(x:, y:, width:, depth:, rotation_deg:)
      new(cx: x, cy: y, hw: width / 2.0, hd: depth / 2.0, deg: rotation_deg)
    end

    # 벽 풋프린트: 선분 a→b, 두께 t → 중심 (a+b)/2, 변 (L + t) × t, 회전 atan2(b−a).
    # 끝단을 t/2 씩 연장해 모서리 틈을 막는다.
    def self.from_segment(ax:, ay:, bx:, by:, thickness:)
      dx = bx - ax
      dy = by - ay
      length = Math.sqrt(dx * dx + dy * dy)
      new(
        cx: (ax + bx) / 2.0,
        cy: (ay + by) / 2.0,
        hw: (length + thickness) / 2.0,
        hd: thickness / 2.0,
        deg: Math.atan2(dy, dx) * 180.0 / Math::PI
      )
    end

    def radians = deg * Math::PI / 180.0

    # [[x, y], ...] 4개
    def corners
      cos = Math.cos(radians)
      sin = Math.sin(radians)
      [ [ -hw, -hd ], [ hw, -hd ], [ hw, hd ], [ -hw, hd ] ].map do |lx, ly|
        [ cx + lx * cos - ly * sin, cy + lx * sin + ly * cos ]
      end
    end

    # SAT 분리축 후보: 변 방향 단위벡터 2개
    def axes
      cos = Math.cos(radians)
      sin = Math.sin(radians)
      [ [ cos, sin ], [ -sin, cos ] ]
    end
  end
end
