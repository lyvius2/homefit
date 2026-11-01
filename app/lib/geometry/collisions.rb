# frozen_string_literal: true

module Geometry
  # 집기 풋프린트 간 겹침, 벽 침범, 문 열림 영역 침범, 외곽 이탈 판정 (설계서 Section 3, R-08).
  # 순수 Ruby. app/frontend/lib/collisions.ts 의 checkCollisions 와 같은 테스트 벡터로 검증한다.
  #
  # footprints: [{ x:, y:, width:, depth:, rotation_deg: }] — 집기 바닥면 중심·치수·회전
  # walls:      [{ "id", "a", "b", "thickness_mm" }] (Plan JSON 의 walls 그대로)
  # openings:   [{ "id", "wall_id", "type", "offset_mm", "width_mm", "swing" }] (Plan JSON 의 openings 그대로, 선택)
  # 반환: [{ placement_index:, reasons: ["overlap:<j>", "wall:<id>", "door:<id>", "out_of_bounds"] }] (위반 있는 것만, index 오름차순)
  module Collisions
    OUT_OF_BOUNDS_TOLERANCE_MM = 1

    module_function

    def check(walls:, footprints:, openings: [])
      boxes = footprints.map { |f| Obb.from_footprint(x: f[:x], y: f[:y], width: f[:width], depth: f[:depth], rotation_deg: f[:rotation_deg]) }
      wall_boxes = walls.map do |w|
        (ax, ay), (bx, by) = w.fetch("a"), w.fetch("b")
        [ w.fetch("id"), Obb.from_segment(ax:, ay:, bx:, by:, thickness: w.fetch("thickness_mm")) ]
      end
      door_zones = door_zones_of(walls, openings)
      bounds = Bounds.call(walls)

      boxes.each_index.filter_map do |i|
        reasons = []
        boxes.each_index { |j| reasons << "overlap:#{j}" if i != j && Sat.intersect?(boxes[i], boxes[j]) }
        wall_boxes.each { |id, wall| reasons << "wall:#{id}" if Sat.intersect?(boxes[i], wall) }
        door_zones.each { |id, zone| reasons << "door:#{id}" if Sat.intersect?(boxes[i], zone) }
        reasons << "out_of_bounds" if bounds && outside?(boxes[i], bounds)
        { placement_index: i, reasons: reasons } unless reasons.empty?
      end
    end

    # [[opening_id, Polygon], ...] 영역이 있는 문만, openings 순서대로
    def door_zones_of(walls, openings)
      by_id = walls.to_h { |w| [ w.fetch("id"), w ] }
      openings.filter_map do |o|
        wall = by_id[o["wall_id"]]
        next unless wall

        zone = DoorZone.call(wall:, opening: o)
        [ o.fetch("id"), zone ] if zone
      end
    end

    def outside?(box, bounds)
      t = OUT_OF_BOUNDS_TOLERANCE_MM
      box.corners.any? do |x, y|
        x < bounds.min_x - t || x > bounds.max_x + t || y < bounds.min_y - t || y > bounds.max_y + t
      end
    end
  end
end
