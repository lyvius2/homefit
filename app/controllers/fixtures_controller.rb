class FixturesController < ApplicationController
  # S-04 집기 목록. M2 4단계에서 채운다.
  def index
    @fixtures = Fixture.order(:name)
  end
end
