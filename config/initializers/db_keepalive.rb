# DB keepalive 스레드 시작 (app/lib/db_keepalive.rb). 간격은 config.x.db_keepalive_interval (0 이면 끔).
# rake 작업(db:prepare 등)과 테스트에서는 띄우지 않는다. Puma 를 cluster 모드로 바꾸면 fork 뒤에 다시 띄운다.
Rails.application.config.after_initialize do
  next unless Rails.configuration.x.db_keepalive_interval.to_i.positive?
  next if defined?(::Rake) && ::Rake.respond_to?(:application) && ::Rake.application.top_level_tasks.any?

  DbKeepalive.start
  ActiveSupport::ForkTracker.after_fork { DbKeepalive.start }
end
