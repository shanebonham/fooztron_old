class Player < ActiveRecord::Base
  has_many :played_positions
  has_many :games, :through => :played_positions

  attr_accessible :name, :hidden

  def win_percentage(position = nil)
    win_count = 0
    played_positions.each do |played_position|
      if position
        win_count += 1 if played_position.winner? && played_position.position == position
      else
        win_count += 1 if played_position.winner?
      end
    end
    if total_games_played(position) > 0
      wins = win_count.to_f / total_games_played(position).to_f * 100.00
    else
      wins = 0
    end
  end

  def win_percentage_weighted_by_side
    win_count = 0
    played_positions.each do |played_position|
      if played_position.game.winner == 'blue'
        win_count += (1 - Side.blue_win_percentage) if played_position.winner?
      else
        win_count += Side.blue_win_percentage if played_position.winner?
      end
    end
    if total_games_played > 0
      wins = win_count.to_f / total_games_played.to_f * 100.00
    else
      wins = 0
    end
  end

  def average_winning_spread
    count = 0
    played_positions.each do |played_position|
      count += played_position.game.spread if played_position.winner?
    end
    average = count / total_games_won.to_f
  end

  def total_games_played(position = nil)
    if position
      game_count = 0
      played_positions.each do |played_position|
        game_count += 1 if played_position.position == position
      end
    else
      game_count = played_positions.count  
    end
    game_count
  end

  def total_games_won
    played_positions.count { |p| p.winner? }
  end
end
