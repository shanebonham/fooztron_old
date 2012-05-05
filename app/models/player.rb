class Player < ActiveRecord::Base
  has_many :played_positions
  has_many :games, :through => :played_positions

  attr_accessible :name, :hidden

end
