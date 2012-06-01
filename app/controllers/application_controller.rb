class ApplicationController < ActionController::Base
  protect_from_forgery

  def login(user)
    if user.login!
      session[:monk_authentication_token] = user.monk_authentication_token
    end
  end
end
