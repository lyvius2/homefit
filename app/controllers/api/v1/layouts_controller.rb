module Api
  module V1
    # GET /api/v1/layouts/:id
    class LayoutsController < ApiController
      def show
        layout = Layout.with_latest_version.find(params[:id])
        render_data(layout: layout.slice(:id, :house_id, :name), latest_version_no: layout.latest_version_no)
      end
    end
  end
end
