module Api
  module V1
    # /api/v1/layouts/:layout_id/versions — 목록·조회(latest, :no)·판정·저장 (설계서 Section 4.2)
    class VersionsController < ApiController
      before_action :set_layout

      def index
        versions = @layout.layout_versions.with_placements_count.order(version_no: :desc)
        render_data(versions.map { |v| { version_no: v.version_no, memo: v.memo, created_at: v.created_at.utc.iso8601(3), placements_count: v.placements_count } })
      end

      # R-10: 기본은 최신 버전
      def latest
        version = @layout.layout_versions.order(version_no: :desc).first!
        render_version(version)
      end

      def show
        render_version(@layout.layout_versions.find_by!(version_no: params[:no]))
      end

      # 저장 직전 1회 호출. 드래그 중 판정은 클라이언트 lib/collisions.ts 가 한다.
      def validate
        result = Placements::Validate.call(house: @layout.house, placements: placement_params)
        render_data(valid: result.valid?, violations: result.violations)
      end

      def create
        result = LayoutVersions::Create.call(layout: @layout, memo: params[:memo], placements: placement_params)
        return render_error(result.error_code, result.message, details: result.details) unless result.ok?

        render_data({ version_no: result.version.version_no, created_at: result.version.created_at.utc.iso8601(3) }, status: :created)
      end

      private

      def set_layout
        @layout = Layout.find(params[:layout_id])
      end

      def render_version(version)
        placements = version.placements.includes(fixture: { image_attachment: :blob }).order(:id)
        render_data(version_json(version, placements))
      end
    end
  end
end
