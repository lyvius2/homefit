Rails.application.routes.draw do
  resource :session

  resources :houses do
    resource :plan, only: [ :edit ], controller: "houses/plans"                    # S-03 도면 에디터 (React 섬, M4)
    resource :floor_plan, only: [ :create, :destroy ], controller: "houses/floor_plans"  # HTML 도면 업로드/삭제
    resources :layouts, only: [ :new, :create ], shallow: true
  end
  resources :fixtures
  resources :layouts, only: [ :index, :show ]

  root "houses#index"

  get "up" => "rails/health#show", as: :rails_health_check
end
