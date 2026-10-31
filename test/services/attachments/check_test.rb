require "test_helper"

module Attachments
  class CheckTest < ActiveSupport::TestCase
    IMAGE_TYPES = %w[image/jpeg image/png image/webp].freeze

    test "accepts a png by content, not by declared type" do
      file = fixture_file_upload("floor_plan.png", "application/octet-stream")
      result = Attachments::Check.call(file, content_types: IMAGE_TYPES, max_bytes: 1.megabyte)

      assert result.ok?, result.errors.inspect
      assert_equal "image/png", result.content_type
    end

    test "rejects svg even when declared as png" do
      file = fixture_file_upload("evil.svg", "image/png")
      result = Attachments::Check.call(file, content_types: IMAGE_TYPES, max_bytes: 1.megabyte)

      assert_not result.ok?
      assert_equal "image/svg+xml", result.content_type
      assert_match(/허용되지 않는 형식/, result.errors.first)
    end

    test "rejects text files and oversized files" do
      text = Attachments::Check.call(fixture_file_upload("note.txt", "text/plain"), content_types: IMAGE_TYPES, max_bytes: 1.megabyte)
      assert_not text.ok?

      big = Attachments::Check.call(fixture_file_upload("floor_plan.png", "image/png"), content_types: IMAGE_TYPES, max_bytes: 10)
      assert_not big.ok?
      assert_match(/너무 큽니다/, big.errors.first)
    end

    test "rejects a missing file" do
      result = Attachments::Check.call(nil, content_types: IMAGE_TYPES, max_bytes: 1.megabyte)
      assert_not result.ok?
      assert_equal [ "파일을 선택하세요." ], result.errors
    end
  end
end
