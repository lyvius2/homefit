# 로그인 계정. 회원가입 없이 시드(HOMEFIT_SEED_USERS)로만 만든다 (설계서 Section 6).
class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
end
