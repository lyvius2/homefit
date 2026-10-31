class CreateLayouts < ActiveRecord::Migration[8.1]
  def change
    create_table :layouts do |t|
      t.references :house, null: false, foreign_key: { on_delete: :cascade }
      t.string     :name, limit: 100, null: false

      t.timestamps
    end
  end
end
