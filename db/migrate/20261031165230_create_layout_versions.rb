class CreateLayoutVersions < ActiveRecord::Migration[8.1]
  def change
    # 불변 테이블: updated_at 없음 (설계서 Section 2.1)
    create_table :layout_versions do |t|
      t.references :layout, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer    :version_no, null: false
      t.string     :memo, limit: 200
      t.datetime   :created_at, null: false

      t.index [ :layout_id, :version_no ], unique: true
    end
  end
end
