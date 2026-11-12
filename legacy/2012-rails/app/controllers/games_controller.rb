class GamesController < ApplicationController
  before_filter :authenticate_user!, :only => [:edit, :update, :destroy]
  before_filter :set_destination

  def index
    @games = Game.find(:all, :order => 'created_at DESC')
    @games.each do |g|
      g.played_positions.sort_by! { |p| p.position_cd }
    end

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @games }
    end
  end

  def show
    @game = Game.find(params[:id])
    @game.played_positions.sort_by! { |p| p.position_cd }

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @game }
    end
  end

  def new
    @game = Game.new
    @players = Player.all
    4.times.each do |position|
      @game.played_positions.build :position_cd => position
    end

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @game }
    end
  end

  def edit
    @game = Game.find(params[:id])
    @game.played_positions.sort_by! { |p| p.position_cd }
    @players = Player.all
  end

  def create
    @game = Game.new(params[:game])
    @players = Player.all

    respond_to do |format|
      if @game.save
        format.html { redirect_to @game, notice: 'Game was successfully created.' }
        format.json { render json: @game, status: :created, location: @game }
      else
        format.html { render action: 'new' }
        format.json { render json: @game.errors, status: :unprocessable_entity }
      end
    end
  end

  def update
    @game = Game.find(params[:id])

    respond_to do |format|
      if @game.update_attributes(params[:game])
        format.html { redirect_to @game, notice: 'Game was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: 'edit' }
        format.json { render json: @game.errors, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @game = Game.find(params[:id])
    @game.destroy

    respond_to do |format|
      format.html { redirect_to games_url }
      format.json { head :no_content }
    end
  end
end
