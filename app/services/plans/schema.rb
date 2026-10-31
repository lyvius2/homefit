module Plans
  # Plan JSON(v1) 의 구조 검증. app/schemas/plan_v1.json 을 json_schemer 로 적용한다.
  # 의미 검증(축척·벽 개수·오차, R-04~06)은 Plans::Validate(M3) 가 맡는다.
  #
  # Spring 비유: 상태 없는 @Service 빈 하나. 스키마 객체는 클래스 수준에서 한 번만 만들어 재사용한다.
  class Schema
    PATH = Rails.root.join("app/schemas/plan_v1.json")

    # errors: [{ path: "/walls/0/a", message: "..." }, ...]
    Result = Data.define(:errors) do
      def ok? = errors.empty?
    end

    def self.call(plan) = new.call(plan)

    def self.schemer
      @schemer ||= JSONSchemer.schema(PATH)
    end

    def call(plan)
      # 심볼 키·ActionController::Parameters 등을 JSON 과 같은 문자열 키 구조로 맞춘다.
      instance = plan.as_json
      errors = self.class.schemer.validate(instance).map do |error|
        { path: error.fetch("data_pointer"), message: error.fetch("error") }
      end
      Result.new(errors:)
    end
  end
end
