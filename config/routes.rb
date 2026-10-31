Rails.application.routes.draw do
  resource :session

  resources :houses do
    resource :plan, only: [ :edit ], controller: "houses/plans"                    # S-03 도면 에디터 (React 섬, M4)
    resource :floor_plan, only: [ :create, :destroy ], controller: "houses/floor_plans"  # HTML 도면 업로드/삭제
    resources :layouts, only: [ :new, :create ], shallow: true
  end
  resources :fixtures
  resources :layouts, only: [ :index, :show, :edit, :update, :destroy ]   # index 는 네비용 추가 (ADR 0002)

  root "houses#index"

  # React 섬이 쓰는 JSON API (설계서 Section 4.2)
  namespace :api do
    namespace :v1 do
      resources :houses, only: [] do
        resource :plan, only: [ :show, :update ], controller: "plans" do
          post :validate
        end
        resource :floor_plan, only: [ :create ], controller: "floor_plans"
      end
      resources :fixtures, only: [ :index ]
      resources :layouts, only: [ :show ] do
        resources :versions, only: [ :index, :create ] do
          collection do
            get :latest
            post :validate
          end
        end
        get "versions/:no", to: "versions#show", constraints: { no: /\d+/ }, as: :version
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
