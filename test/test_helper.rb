ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require_relative "test_helpers/session_test_helper"

module ActiveSupport
  class TestCase
    # 테스트 DB 가 외부 MySQL 서버라 워커마다 DB 를 만드는 병렬 실행은 끈다 (workers: 1 이면 병렬화하지 않음).
    parallelize(workers: 1)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # 서비스 단위 테스트에서도 fixture_file_upload 를 쓸 수 있게 한다
    include ActionDispatch::TestProcess::FixtureFile
  end
end
