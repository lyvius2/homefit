require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "downcases and strips email_address" do
    user = User.new(email_address: " DOWNCASED@EXAMPLE.COM ")
    assert_equal("downcased@example.com", user.email_address)
  end
end

class UserValidationTest < ActiveSupport::TestCase
  test "requires a unique, well-formed email address" do
    assert_not User.new(email_address: "not-an-email", password: "secret12").valid?
    assert_not User.new(email_address: users(:one).email_address, password: "secret12").valid?
    assert User.new(email_address: "new@example.com", password: "secret12").valid?
  end
end
