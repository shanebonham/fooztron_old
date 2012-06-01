class UsersController < ApplicationController
  
  def new
    @user = User.new
  end

  def signin
    @user = User.new(params[:user])
    if login(@user)
      flash[:notice] = "User signed in with Monk!"
      redirect_to session[:destination]
    else
      flash[:notice] = "There was a problem logging in: #{@user.errors.full_messages.join(' ')}"
      render :new
    end
  end

  def signout
    @user = current_user
    if @user.logout!
      session[:monk_authentication_token] = nil
      flash[:notice] = "User signed out with Monk!"
      redirect_to :root
    else
      flash[:notice] = "Error signing out your user: #{@user.errors.full_messages}"
      redirect_to :back
    end
  end

end