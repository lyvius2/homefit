module Attachments
  # 업로드 파일의 실제 콘텐츠 타입(Marcel 이 바이트로 판정)과 크기를 검사한다.
  # 확장자·브라우저가 보낸 타입은 믿지 않는다. SVG 는 스크립트 삽입 위험으로 허용 목록에 넣지 않는다 (설계서 Section 2.1).
  class Check
    Result = Data.define(:content_type, :errors) do
      def ok? = errors.empty?
    end

    def self.call(file, content_types:, max_bytes:) = new(file, content_types:, max_bytes:).call

    def initialize(file, content_types:, max_bytes:)
      @file = file
      @content_types = content_types
      @max_bytes = max_bytes
    end

    def call
      return Result.new(content_type: nil, errors: [ "파일을 선택하세요." ]) unless uploaded_file?

      content_type = detect_content_type
      errors = []
      unless @content_types.include?(content_type)
        errors << "허용되지 않는 형식입니다(#{content_type}). #{allowed_label} 만 올릴 수 있습니다."
      end
      errors << "파일이 너무 큽니다(최대 #{@max_bytes / 1.megabyte} MB)." if io.size > @max_bytes

      Result.new(content_type:, errors:)
    end

    private

    def uploaded_file?
      @file.present? && @file.respond_to?(:original_filename) && io.respond_to?(:read)
    end

    # ActionDispatch::Http::UploadedFile / Rack::Test::UploadedFile 모두 tempfile 을 가진다
    def io
      @io ||= @file.respond_to?(:tempfile) ? @file.tempfile : @file
    end

    def detect_content_type
      io.rewind
      Marcel::MimeType.for(io, name: @file.original_filename, declared_type: @file.content_type)
    ensure
      io.rewind
    end

    def allowed_label
      @content_types.map { |t| t.delete_prefix("image/").upcase.sub("JPEG", "JPEG") }.join("·")
    end
  end
end
