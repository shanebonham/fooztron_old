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

  def offense?
    position == :white_offense || position == :blue_offense
  end

  def points_scored
    if team == "white"
      game.white_score
    else
      game.blue_score
    end
  end

  def points_allowed
    if team == "white"
      game.blue_score
    else
      game.white_score
    end
  end
end
