module Layouts
  # S-07 버전 아카이브. 행을 누르면 S-06 이 해당 버전을 읽기 전용으로 연다.
  class VersionsController < ApplicationController
    def index
      @layout = Layout.with_latest_version.includes(:house).find(params[:layout_id])
      @versions = @layout.layout_versions.with_placements_count.order(version_no: :desc)
    end
  end
end
