module Plans
  # Plan JSON → 외곽 바운딩 박스 (Geometry::Bounds 의 얇은 래퍼). 벽이 없으면 nil.
  class Bounds
    Box = Geometry::Bounds::Box

    def self.call(plan)
      Geometry::Bounds.call((plan || {}).fetch("walls", []))
    end
  end
end
