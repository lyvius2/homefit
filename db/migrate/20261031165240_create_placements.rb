class CreatePlacements < ActiveRecord::Migration[8.1]
  def change
    # 불변 테이블: timestamps 없음. name~color 는 저장 시점 집기 스냅샷 (설계서 Section 2.1, R-11)
    create_table :placements do |t|
      t.references :layout_version, null: false, foreign_key: { on_delete: :cascade }
      t.references :fixture, null: true, foreign_key: { on_delete: :nullify }
      t.string     :name, limit: 100, null: false
      t.string     :kind, limit: 20, null: false
      t.integer    :width_mm, null: false
      t.integer    :depth_mm, null: false
      t.integer    :height_mm, null: false
      t.integer    :clearance_mm, null: false, default: 0
      t.string     :color, limit: 7, null: false
      t.integer    :x_mm, null: false
      t.integer    :y_mm, null: false
      t.integer    :z_mm, null: false, default: 0
      t.integer    :rotation_deg, null: false, default: 0

      t.check_constraint "rotation_deg BETWEEN 0 AND 359", name: "placements_rotation_deg_range"
    end
  end
end
