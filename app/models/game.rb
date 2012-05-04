class Game < ActiveRecord::Base
  has_many :played_positions
  has_many :players, :through => :played_positions

  attr_accessible :white_score, :blue_score
end
