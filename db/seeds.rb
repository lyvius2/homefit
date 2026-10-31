# 예시 데이터. 여러 번 실행해도 같은 결과가 되도록 이름 기준 find_or_create 를 쓴다.
# 좌표계: 도면 좌상단 원점, x 오른쪽 +, y 아래 +, 단위 정수 mm (R-01, R-02).

# --- 로그인 계정 (회원가입 없음, 설계서 Section 6) ---
# .env 의 HOMEFIT_SEED_USERS="a@example.com:비밀번호,b@example.com:비밀번호" 를 읽는다.
# 이미 있는 계정은 건드리지 않는다(비밀번호 변경은 bin/rails console 에서 User#update!(password:)).
seed_users = ENV.fetch("HOMEFIT_SEED_USERS", "").split(",").map(&:strip).reject(&:empty?)
if seed_users.empty?
  puts "seed: HOMEFIT_SEED_USERS 가 없어 계정을 만들지 않습니다 (.env.example 참고)"
else
  seed_users.each do |entry|
    email, password = entry.split(":", 2)
    raise ArgumentError, "HOMEFIT_SEED_USERS 형식 오류: #{entry.inspect} (email:password)" if email.blank? || password.blank?

    User.find_or_create_by!(email_address: email.strip.downcase) { |u| u.password = password }
  end
end

# --- 예시 주택: 59㎡형 비슷한 외곽 9900 × 6300 (벽 중심선 기준) ---
# 외곽 4면(두께 200) + 칸막이(두께 120): 좌상단 침실1(3600×3000), 우상단 침실2(3300×3000),
# 좌하단 욕실(2100×1800). 나머지는 거실·주방.
SAMPLE_PLAN = {
  "schema" => 1,
  "unit" => "mm",
  "image" => nil,
  "scale" => { "px_per_mm" => nil, "measured_mm" => nil, "verify" => nil },
  "walls" => [
    { "id" => "w01", "a" => [ 0, 0 ], "b" => [ 9900, 0 ], "thickness_mm" => 200 },
    { "id" => "w02", "a" => [ 9900, 0 ], "b" => [ 9900, 6300 ], "thickness_mm" => 200 },
    { "id" => "w03", "a" => [ 9900, 6300 ], "b" => [ 0, 6300 ], "thickness_mm" => 200 },
    { "id" => "w04", "a" => [ 0, 6300 ], "b" => [ 0, 0 ], "thickness_mm" => 200 },
    { "id" => "w05", "a" => [ 3600, 0 ], "b" => [ 3600, 3000 ], "thickness_mm" => 120 },
    { "id" => "w06", "a" => [ 0, 3000 ], "b" => [ 3600, 3000 ], "thickness_mm" => 120 },
    { "id" => "w07", "a" => [ 6600, 0 ], "b" => [ 6600, 3000 ], "thickness_mm" => 120 },
    { "id" => "w08", "a" => [ 6600, 3000 ], "b" => [ 9900, 3000 ], "thickness_mm" => 120 },
    { "id" => "w09", "a" => [ 0, 4500 ], "b" => [ 2100, 4500 ], "thickness_mm" => 120 },
    { "id" => "w10", "a" => [ 2100, 4500 ], "b" => [ 2100, 6300 ], "thickness_mm" => 120 }
  ],
  "openings" => [
    { "id" => "o01", "wall_id" => "w03", "offset_mm" => 4200, "width_mm" => 1000, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" },
    { "id" => "o02", "wall_id" => "w06", "offset_mm" => 2400, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" },
    { "id" => "o03", "wall_id" => "w08", "offset_mm" => 600, "width_mm" => 900, "height_mm" => 2100, "sill_mm" => 0, "type" => "door" },
    { "id" => "o04", "wall_id" => "w01", "offset_mm" => 600, "width_mm" => 2400, "height_mm" => 1500, "sill_mm" => 900, "type" => "window" }
  ]
}.freeze

house = House.find_or_create_by!(name: "(예시) 59㎡형 주택") do |h|
  h.ceiling_height_mm = 2300
  h.dimension_basis = "centerline"
  h.plan = SAMPLE_PLAN
  # plan_status 는 Plans::Validate(M3) 결과로만 valid 가 된다. 시드는 draft 로 둔다.
  h.notes = "분양 평면도 기준 예시. 실측 후 벽을 보정할 것."
end

# --- 예시 집기 6개 (실제 제품 치수 근사치, W×D×H mm) ---
FIXTURES = [
  { name: "(예시) 냉장고", kind: "appliance", width_mm: 913, depth_mm: 740, height_mm: 1780, clearance_mm: 50, color: "#d9dde2",
    notes: "4도어 양문형 870L 급" },
  { name: "(예시) 세탁기", kind: "appliance", width_mm: 600, depth_mm: 660, height_mm: 850, clearance_mm: 30, color: "#eceff1",
    notes: "드럼 세탁기 21kg 급" },
  { name: "(예시) 침대", kind: "furniture", width_mm: 1540, depth_mm: 2050, height_mm: 900, clearance_mm: 0, color: "#c9b79c",
    notes: "퀸(Q) 프레임, 헤드보드 포함 높이" },
  { name: "(예시) 소파", kind: "furniture", width_mm: 2200, depth_mm: 900, height_mm: 850, clearance_mm: 0, color: "#6b7280",
    notes: "3인용 패브릭" },
  { name: "(예시) 식탁", kind: "furniture", width_mm: 1400, depth_mm: 800, height_mm: 740, clearance_mm: 600, color: "#a8865f",
    notes: "4인용. clearance 는 의자 빼는 여유" },
  { name: "(예시) TV", kind: "appliance", width_mm: 1449, depth_mm: 290, height_mm: 896, clearance_mm: 0, color: "#1f2937",
    notes: "65인치, 스탠드 포함 깊이·높이" }
].freeze

fixtures_by_name = FIXTURES.to_h do |attrs|
  [ attrs[:name], Fixture.find_or_create_by!(name: attrs[:name]) { |f| f.assign_attributes(attrs) } ]
end

# --- 예시 배치도 + 버전 1 ---
# 버전 생성은 M3 의 LayoutVersions::Create(검증 → 채번 → 스냅샷) 가 맡는다. 시드는 같은 모양으로 직접 만든다.
layout = house.layouts.find_or_create_by!(name: "(예시) 기본 배치")

unless layout.layout_versions.exists?(version_no: 1)
  ActiveRecord::Base.transaction do
    version = layout.layout_versions.create!(version_no: 1, memo: "시드 예시: 거실에 소파·TV, 주방에 냉장고")

    [
      { fixture: fixtures_by_name["(예시) 냉장고"], x_mm: 9300, y_mm: 3700, rotation_deg: 90 },
      { fixture: fixtures_by_name["(예시) 소파"],   x_mm: 5100, y_mm: 5600, rotation_deg: 180 },
      { fixture: fixtures_by_name["(예시) TV"],     x_mm: 5100, y_mm: 3350, rotation_deg: 0 }
    ].each do |p|
      f = p[:fixture]
      version.placements.create!(
        fixture: f,
        name: f.name, kind: f.kind, color: f.color,
        width_mm: f.width_mm, depth_mm: f.depth_mm, height_mm: f.height_mm, clearance_mm: f.clearance_mm,
        x_mm: p[:x_mm], y_mm: p[:y_mm], z_mm: 0, rotation_deg: p[:rotation_deg]
      )
    end
  end
end

puts "seed: users=#{User.count} houses=#{House.count} fixtures=#{Fixture.count} layouts=#{Layout.count} versions=#{LayoutVersion.count} placements=#{Placement.count}"
