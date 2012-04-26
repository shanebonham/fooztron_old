class Game < ActiveRecord::Base
  has_many :game_players
  has_many :players, :through => :game_players

  attr_accessible :white_score, :blue_score
end
