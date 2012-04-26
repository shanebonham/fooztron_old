class GamePlayer < ActiveRecord::Base
  belongs_to :player
  belongs_to :game

  attr_accessible :game_id, :player_id, :position
end
