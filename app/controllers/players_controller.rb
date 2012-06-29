class PlayersController < ApplicationController
  before_filter :authenticate_user!, :only => [:new, :create, :edit, :update, :destroy]
  before_filter :set_destination

  def index
    @players = Player.where(:hidden => false)

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @players }
    end
  end

  def hidden
    @players = Player.where(:hidden => true)

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @players }
    end
  end

  def show
    @player = Player.find(params[:id])

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @player }
    end
  end

  def new
    @player = Player.new

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @player }
    end
  end

  def edit
    @player = Player.find(params[:id])
  end

  def create
    @player = Player.new(params[:player])

    respond_to do |format|
      if @player.save
        format.html { redirect_to @player, notice: 'Player was successfully created.' }
        format.json { render json: @player, status: :created, location: @player }
      else
        format.html { render action: 'new' }
        format.json { render json: @player.errors, status: :unprocessable_entity }
      end
    end
  end

  def update
    @player = Player.find(params[:id])

    respond_to do |format|
      if @player.update_attributes(params[:player])
        format.html { redirect_to @player, notice: 'Player was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: 'edit' }
        format.json { render json: @player.errors, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @player = Player.find(params[:id])
    @player.hidden = true
    @player.save

    respond_to do |format|
      format.html { redirect_to players_url }
      format.json { head :no_content }
    end
  end

  def leaderboard
    params[:number] ||= 10
    @teams = []
    @players = []
    @number_of_games = 1
    if params[:number].present?
      @number_of_games = params[:number].to_i
    end
    Team.all.each do |team|
      if team.total_games_played >= @number_of_games / 2
        @teams << team
      end
    end
    Player.all.each do |player|
      if player.total_games_played >= @number_of_games
        @players << player
      end
    end
  end
end
