class CreateHouses < ActiveRecord::Migration[8.1]
  def change
    create_table :houses do |t|
      t.string  :name, limit: 100, null: false
      t.integer :ceiling_height_mm, null: false, default: 2300
      t.string  :dimension_basis, limit: 20, null: false, default: "centerline"
      # MySQL JSON 은 리터럴 DEFAULT 를 허용하지 않으므로 기본값은 House 모델이 채운다 (설계서 Section 2.1)
      t.json    :plan, null: false
      t.string  :plan_status, limit: 20, null: false, default: "draft"
      t.text    :notes

      t.timestamps

      t.check_constraint "ceiling_height_mm BETWEEN 2000 AND 4000", name: "houses_ceiling_height_mm_range"
      t.index :name
    end
  end
end
