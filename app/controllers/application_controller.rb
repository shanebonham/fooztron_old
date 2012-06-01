class ApplicationController < ActionController::Base
  protect_from_forgery

  helper_method :current_user

  def set_destination
    session[:destination] = request.url
  end

  def current_user
    @_current_user ||= User.find_by_monk_authentication_token(session[:monk_authentication_token])
  end

  def login(user)
    if user.login!
      session[:monk_authentication_token] = user.monk_authentication_token
    end
  end
end
