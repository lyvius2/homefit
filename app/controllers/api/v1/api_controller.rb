module Api
  module V1
    # React 섬이 쓰는 JSON API 의 공통 베이스 (설계서 Section 4.2).
    # 같은 세션 쿠키로 인증하고 CSRF 토큰은 X-CSRF-Token 헤더로 받는다. 에러 포맷은 render_error 하나만 쓴다.
    class ApiController < ApplicationController
      # 요청 파라미터 형식 오류. placement_params 등에서 던지고 422 invalid_params 로 응답한다.
      class InvalidParams < StandardError; end

      ERROR_STATUS = {
        "not_found" => :not_found,
        "unauthorized" => :unauthorized,
        "invalid_params" => :unprocessable_entity
      }.freeze

      rescue_from ActiveRecord::RecordNotFound do
        render_error("not_found", "찾을 수 없습니다.")
      end

      rescue_from ActionController::ParameterMissing, InvalidParams do |e|
        render_error("invalid_params", e.message)
      end

      private

      # 422 { error: { code, message, details } } — 코드별 기본 상태 코드는 ERROR_STATUS, 나머지는 422
      def render_error(code, message, details: nil, status: nil)
        status ||= ERROR_STATUS.fetch(code, :unprocessable_entity)
        body = { code:, message: }
        body[:details] = details unless details.nil?
        render json: { error: body }, status: status
      end

      # render_data(배열) 또는 render_data(key: value, ...) 둘 다 허용
      def render_data(data = nil, status: :ok, **fields)
        render json: { data: data.nil? ? fields : data }, status: status
      end

      # 미인증은 로그인 페이지로 보내지 않고 401 JSON
      def request_authentication
        render_error("unauthorized", "로그인이 필요합니다.")
      end

      # placements[] 요청 항목을 정수로 정리한다. 형식이 틀리면 InvalidParams → 422 invalid_params
      def placement_params
        raw = params[:placements]
        raise ActionController::ParameterMissing, :placements if raw.nil?
        raise InvalidParams, "placements 는 배열이어야 합니다." unless raw.is_a?(Array)

        raw.map.with_index do |item, i|
          raise InvalidParams, "placements[#{i}] 는 객체여야 합니다." unless item.respond_to?(:permit)

          attrs = item.permit(:fixture_id, :x_mm, :y_mm, :z_mm, :rotation_deg).to_h.symbolize_keys
          {
            fixture_id: integer!(attrs[:fixture_id], "placements[#{i}].fixture_id"),
            x_mm: integer!(attrs[:x_mm], "placements[#{i}].x_mm"),
            y_mm: integer!(attrs[:y_mm], "placements[#{i}].y_mm"),
            z_mm: integer!(attrs.fetch(:z_mm, 0), "placements[#{i}].z_mm"),
            rotation_deg: integer!(attrs.fetch(:rotation_deg, 0), "placements[#{i}].rotation_deg")
          }.tap do |p|
            raise InvalidParams, "placements[#{i}].rotation_deg 는 0–359 여야 합니다." unless (0..359).cover?(p[:rotation_deg])
            raise InvalidParams, "placements[#{i}].z_mm 는 0 이상이어야 합니다." if p[:z_mm].negative?
          end
        end
      end

      def integer!(value, name)
        raise InvalidParams, "#{name} 가 없습니다." if value.nil?
        raise InvalidParams, "#{name} 는 정수여야 합니다." unless value.is_a?(Integer) || value.to_s.match?(/\A-?\d+\z/)

        value.to_i
      end

      # --- JSON 표현 ---

      def house_json(house)
        house.slice(:id, :name, :ceiling_height_mm, :dimension_basis, :plan_status)
      end

      def floor_plan_url(house)
        return nil unless house.floor_plan.attached? && house.floor_plan.representable?

        url_for(house.floor_plan.variant(:editor))
      end

      def fixture_json(fixture)
        fixture.slice(:id, :name, :kind, :width_mm, :depth_mm, :height_mm, :clearance_mm, :color)
               .merge("image_url" => fixture_image_url(fixture))
      end

      def fixture_image_url(fixture)
        return nil unless fixture&.image&.attached? && fixture.image.representable?

        url_for(fixture.image.variant(:texture))
      end

      def version_json(version, placements)
        {
          version_no: version.version_no,
          memo: version.memo,
          created_at: version.created_at.utc.iso8601(3),
          placements: placements.map { |p| placement_json(p) }
        }
      end

      def placement_json(placement)
        placement.slice(:id, :fixture_id, :name, :kind, :width_mm, :depth_mm, :height_mm, :clearance_mm, :color, :x_mm, :y_mm, :z_mm, :rotation_deg)
                 .merge("image_url" => fixture_image_url(placement.fixture))
      end
    end
  end
end
