class PlayedPosition < ActiveRecord::Base
  belongs_to :game
  belongs_to :player
  attr_accessible :position, :game_id, :player_id, :position_cd
  as_enum :position, :white_offense => 0,
                     :white_defense => 1,
                     :blue_offense => 2,
                     :blue_defense => 3

  def winner?
    team == game.winner
  end

  def team
    position.to_s.split('_').first
  end
end
