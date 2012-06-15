class ApplicationController < ActionController::Base
  protect_from_forgery

  helper_method :current_user

  def authenticate_user!
    session[:destination] = request.url
    user_status = MonkId.status(authentication_token: session[:monk_authentication_token])
    if !user_status['success'] || !user_status['user']['signed_in'] || current_user.blank?
      session[:monk_authentication_token] = nil
      flash[:alert] = 'You must be logged in to continue.'
      redirect_to :users_login
    end
  end

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
