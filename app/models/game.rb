class Game < ActiveRecord::Base
  belongs_to :white_offense, :class_name => 'Player'
  belongs_to :white_defense, :class_name => 'Player'
  belongs_to :blue_offense, :class_name => 'Player'
  belongs_to :blue_defense, :class_name => 'Player'

  attr_accessible :white_offense_id, :white_defense_id, :blue_offense_id, :blue_defense_id, :white_score, :blue_score
end
