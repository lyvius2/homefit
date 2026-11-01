# frozen_string_literal: true

module Geometry
  # 여닫이문 열림 영역 (설계서 Section 3).
  #
  # 벽 단위벡터 u, 열리는 면의 법선 n(side: right = (-uy, ux), left = (uy, -ux)).
  # 경첩점 H = 개구부의 hinge 쪽 끝 + n·(t/2) (벽면 위). 열림 방향 d = hinge a ? u : -u.
  # 영역 = 중심 H, 반지름 width 의 90° 부채꼴(d → n)을 SEGMENTS 등분한 볼록 다각형.
  # 꼭짓점 순서: H, 그다음 θ = 0..90° 의 호 위 점 (SEGMENTS + 1 개).
  #
  # 순수 Ruby. app/frontend/lib/geometry.ts 의 doorZone 과 같은 테스트 벡터로 검증한다.
  module DoorZone
    SEGMENTS = 8

    module_function

    # wall: { "a", "b", "thickness_mm" }, opening: { "type", "offset_mm", "width_mm", "swing" } (문자열 키).
    # 문이 아니거나 swing 이 없거나 벽 길이가 0이면 nil.
    def call(wall:, opening:)
      swing = opening["swing"]
      return nil unless opening["type"] == "door" && swing

      (ax, ay), (bx, by) = wall.fetch("a"), wall.fetch("b")
      dx = bx - ax
      dy = by - ay
      length = Math.sqrt(dx * dx + dy * dy)
      return nil if length.zero?

      ux = dx / length
      uy = dy / length
      nx, ny = swing["side"] == "right" ? [ -uy, ux ] : [ uy, -ux ]
      radius = opening.fetch("width_mm").to_f
      hinge_a = swing["hinge"] == "a"
      along = opening.fetch("offset_mm") + (hinge_a ? 0 : radius)
      half_t = wall.fetch("thickness_mm") / 2.0
      hx = ax + ux * along + nx * half_t
      hy = ay + uy * along + ny * half_t
      ddx, ddy = hinge_a ? [ ux, uy ] : [ -ux, -uy ]

      arc = (0..SEGMENTS).map do |k|
        theta = k * Math::PI / 2 / SEGMENTS
        cos = Math.cos(theta)
        sin = Math.sin(theta)
        [ hx + radius * (cos * ddx + sin * nx), hy + radius * (cos * ddy + sin * ny) ]
      end
      Polygon.new(corners: [ [ hx, hy ], *arc ])
    end
  end
end
