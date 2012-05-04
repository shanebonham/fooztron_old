class PlayedPosition < ActiveRecord::Base
  belongs_to :game
  belongs_to :player
  attr_accessible :position, :game_id, :player_id
end
