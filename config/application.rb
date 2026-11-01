require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Homefit
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # 표시 시간대 (JDBC serverTimezone=Asia/Seoul 요구에 대응). DB 에는 UTC 로 저장한다.
    config.time_zone = "Seoul"

    # DB keepalive(SELECT 1) 주기(초). 0 이면 끔. production 은 기본 10 (environments/production.rb), 그 외 0.
    # app/lib/db_keepalive.rb, initializers/db_keepalive.rb
    config.x.db_keepalive_interval = Integer(ENV.fetch("HOMEFIT_DB_KEEPALIVE_SECONDS", "0"))
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
