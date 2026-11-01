require "test_helper"

class DbKeepaliveTest < ActiveSupport::TestCase
  class MemoryLogger
    attr_reader :lines

    def initialize = @lines = []
    def debug = @lines << [ :debug, yield ]
    def info(line) = @lines << [ :info, line ]
    def warn(line) = @lines << [ :warn, line ]
  end

  teardown { DbKeepalive.stop }

  test "ping runs SELECT 1 through the pool and returns the connection" do
    logger = MemoryLogger.new
    before = ActiveRecord::Base.connection_pool.stat[:busy]

    assert DbKeepalive.ping(logger:)
    assert_equal before, ActiveRecord::Base.connection_pool.stat[:busy], "커넥션을 반납해야 한다"
    assert_equal :debug, logger.lines.last.first
    assert_equal({ "event" => "db_keepalive", "ok" => true, "value" => 1 }, JSON.parse(logger.lines.last.last).slice("event", "ok", "value"))
  end

  test "ping swallows connection errors and logs them as warn" do
    logger = MemoryLogger.new
    dead_pool = Object.new
    def dead_pool.with_connection = raise(ActiveRecord::ConnectionNotEstablished, "MySQL server has gone away")

    assert_not DbKeepalive.ping(logger:, pool: dead_pool)
    level, line = logger.lines.last
    assert_equal :warn, level
    assert_equal({ "ok" => false, "error" => "ActiveRecord::ConnectionNotEstablished", "message" => "MySQL server has gone away" },
                 JSON.parse(line).slice("ok", "error", "message"))
  end

  test "start spawns one named thread per process and interval 0 disables it" do
    assert_nil DbKeepalive.start(interval: 0)
    assert_not DbKeepalive.running?

    thread = DbKeepalive.start(interval: 60, logger: MemoryLogger.new)
    assert_equal "db-keepalive", thread.name
    assert DbKeepalive.running?
    again = DbKeepalive.start(interval: 60, logger: MemoryLogger.new)
    assert_not thread.alive?, "다시 start 하면 이전 스레드는 멈춘다"
    assert again.alive?

    DbKeepalive.stop
    assert_not DbKeepalive.running?
  end
end
