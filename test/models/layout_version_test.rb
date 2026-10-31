require "test_helper"

class LayoutVersionTest < ActiveSupport::TestCase
  test "can be created once" do
    version = layouts(:main).layout_versions.create!(version_no: 3, memo: "세 번째")

    assert version.persisted?
    assert version.readonly?
  end

  test "is read-only after creation (R-09)" do
    version = layout_versions(:main_v1)

    assert version.readonly?
    assert_raises(ActiveRecord::ReadOnlyRecord) { version.update!(memo: "변경") }
    assert_raises(ActiveRecord::ReadOnlyRecord) { version.destroy! }
    assert_equal "첫 저장", version.reload.memo
  end

  test "version_no is unique per layout and at least 1" do
    duplicate = LayoutVersion.new(layout: layouts(:main), version_no: 1)
    assert_not duplicate.valid?
    assert_includes duplicate.errors.attribute_names, :version_no

    assert_raises(ActiveRecord::RecordNotUnique) do
      LayoutVersion.insert_all!([ { layout_id: layouts(:main).id, version_no: 1, created_at: Time.current } ])
    end

    zero = LayoutVersion.new(layout: layouts(:main), version_no: 0)
    assert_not zero.valid?
  end

  test "memo is at most 200 characters" do
    version = LayoutVersion.new(layout: layouts(:main), version_no: 9, memo: "a" * 201)
    assert_not version.valid?
  end
end
