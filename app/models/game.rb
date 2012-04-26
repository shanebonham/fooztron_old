class Game < ActiveRecord::Base
  belongs_to :white_offense
  belongs_to :white_defense
  belongs_to :blue_offense
  belongs_to :blue_defense
  # attr_accessible :title, :body
end
