class Player < ActiveRecord::Base
  has_many :played_positions
  has_many :games, :through => :played_positions

  attr_accessible :name, :hidden

  def record(position = nil)
    win_count = 0
    played_positions.each do |played_position|
      if position
        win_count += 1 if played_position.winner? && played_position.position == position
      else
        win_count += 1 if played_position.winner?
      end
    end
    if total_games_played(position) > 0
      wins = win_count.to_f / total_games_played(position).to_f
    else
      wins = 0
    end
  end

  def average_winning_spread
    count = 0
    played_positions.each do |played_position|
      count += played_position.game.spread if played_position.winner?
    end
    if total_games_won > 0
      average = count / total_games_won.to_f
    else
      average = 0
    end
  end

  def average_losing_spread
    count = 0
    played_positions.each do |played_position|
      count += played_position.game.spread if !played_position.winner?
    end
    if total_games_lost > 0
      average = count / total_games_lost.to_f
    else
      average = 0
    end
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

  def total_games_played_as_defender
    total = 0
    played_positions.map { |x| total += 1 unless x.offense?}
    total
  end

  def total_games_won
    total_wins = 0
    played_positions.map{ |x| total_wins +=1 if x.winner? }
    total_wins
  end

  def total_games_lost
    total_games_played - total_games_won
  end

  def total_points_allowed(defender = false)
    total = 0
    if defender
      played_positions.map { |x| total += x.points_allowed unless x.offense? }
    else
      played_positions.map { |x| total += x.points_allowed }
    end
    total
  end

  def total_points_scored
    total = 0
    played_positions.map { |x| total += x.points_scored }
    total
  end

  def average_points_allowed(defender = false)
    if total_games_played_as_defender > 0
      total_points_allowed(true) / total_games_played_as_defender.to_f
    else
      0
    end
  end
end
