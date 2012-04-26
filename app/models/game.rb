class Game < ActiveRecord::Base
  belongs_to :white_offense, :class_name => 'Player'
  belongs_to :white_defense, :class_name => 'Player'
  belongs_to :blue_offense, :class_name => 'Player'
  belongs_to :blue_defense, :class_name => 'Player'

end
