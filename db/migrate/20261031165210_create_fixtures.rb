class CreateFixtures < ActiveRecord::Migration[8.1]
  def change
    create_table :fixtures do |t|
      t.string  :name, limit: 100, null: false
      t.string  :kind, limit: 20, null: false
      t.integer :width_mm, null: false
      t.integer :depth_mm, null: false
      t.integer :height_mm, null: false
      t.integer :clearance_mm, null: false, default: 0
      t.string  :color, limit: 7, null: false, default: "#8c8f94"
      t.text    :notes

      t.timestamps

      t.check_constraint "width_mm BETWEEN 10 AND 10000", name: "fixtures_width_mm_range"
      t.check_constraint "depth_mm BETWEEN 10 AND 10000", name: "fixtures_depth_mm_range"
      t.check_constraint "height_mm BETWEEN 10 AND 5000", name: "fixtures_height_mm_range"
      t.index :kind
    end
  end
end
