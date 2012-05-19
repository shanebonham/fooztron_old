class Player < ActiveRecord::Base
  has_many :played_positions
  has_many :games, :through => :played_positions

  attr_accessible :name, :hidden

  def win_percentage
    win_count = 0
    played_positions.each do |played_position|
      win_count += 1 if played_position.winner?
    end
    if total_games_played > 0
      wins = win_count.to_f / total_games_played.to_f * 100.00
    else
      wins = 0
    end
  end

  def total_games_played
    played_positions.count
  end
end
