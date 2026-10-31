# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_31_173201) do
  create_table "active_storage_attachments", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "fixtures", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.string "kind", limit: 20, null: false
    t.integer "width_mm", null: false
    t.integer "depth_mm", null: false
    t.integer "height_mm", null: false
    t.integer "clearance_mm", default: 0, null: false
    t.string "color", limit: 7, default: "#8c8f94", null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["kind"], name: "index_fixtures_on_kind"
    t.check_constraint "`depth_mm` between 10 and 10000", name: "fixtures_depth_mm_range"
    t.check_constraint "`height_mm` between 10 and 5000", name: "fixtures_height_mm_range"
    t.check_constraint "`width_mm` between 10 and 10000", name: "fixtures_width_mm_range"
  end

  create_table "houses", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.integer "ceiling_height_mm", default: 2300, null: false
    t.string "dimension_basis", limit: 20, default: "centerline", null: false
    t.json "plan", null: false
    t.string "plan_status", limit: 20, default: "draft", null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_houses_on_name"
    t.check_constraint "`ceiling_height_mm` between 2000 and 4000", name: "houses_ceiling_height_mm_range"
  end

  create_table "layout_versions", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "layout_id", null: false
    t.integer "version_no", null: false
    t.string "memo", limit: 200
    t.datetime "created_at", null: false
    t.index ["layout_id", "version_no"], name: "index_layout_versions_on_layout_id_and_version_no", unique: true
  end

  create_table "layouts", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "house_id", null: false
    t.string "name", limit: 100, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["house_id"], name: "index_layouts_on_house_id"
  end

  create_table "placements", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "layout_version_id", null: false
    t.bigint "fixture_id"
    t.string "name", limit: 100, null: false
    t.string "kind", limit: 20, null: false
    t.integer "width_mm", null: false
    t.integer "depth_mm", null: false
    t.integer "height_mm", null: false
    t.integer "clearance_mm", default: 0, null: false
    t.string "color", limit: 7, null: false
    t.integer "x_mm", null: false
    t.integer "y_mm", null: false
    t.integer "z_mm", default: 0, null: false
    t.integer "rotation_deg", default: 0, null: false
    t.index ["fixture_id"], name: "index_placements_on_fixture_id"
    t.index ["layout_version_id"], name: "index_placements_on_layout_version_id"
    t.check_constraint "`rotation_deg` between 0 and 359", name: "placements_rotation_deg_range"
  end

  create_table "sessions", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "layout_versions", "layouts", on_delete: :cascade
  add_foreign_key "layouts", "houses", on_delete: :cascade
  add_foreign_key "placements", "fixtures", on_delete: :nullify
  add_foreign_key "placements", "layout_versions", on_delete: :cascade
  add_foreign_key "sessions", "users"
end
