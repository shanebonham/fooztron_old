class Player < ActiveRecord::Base
  has_many :games
  attr_accessible :name, :hidden
end
