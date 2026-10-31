require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
  test "unauthenticated request is redirected to login and returns after signing in" do
    get houses_path
    assert_redirected_to new_session_path

    post session_path, params: { email_address: users(:one).email_address, password: "password" }
    assert_redirected_to houses_url

    follow_redirect!
    assert_response :success
  end

  test "signed in user can access houses" do
    sign_in_as users(:one)

    get houses_path
    assert_response :success
  end

  test "health check does not require authentication" do
    get rails_health_check_path
    assert_response :success
  end
end
