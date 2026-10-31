module Api
  module V1
    # GET /api/v1/fixtures?kind= — 배치 화면의 집기 라이브러리
    class FixturesController < ApiController
      def index
        fixtures = Fixture.with_attached_image.order(:name)
        fixtures = fixtures.where(kind: params[:kind]) if Fixture.kinds.key?(params[:kind])
        render_data(fixtures.map { |f| fixture_json(f) })
      end
    end
  end
end
