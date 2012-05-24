module PlayersHelper

  def sorted_by_number_of_games(players)
    players.sort{ |x, y| y.games.count <=> x.games.count }
  end

  def sorted_by_record(players)
    players.sort{ |x, y| y.record <=> x.record }
  end

  def sorted_by_wins(players)
    players.sort{ |x, y| y.total_games_won <=> x.total_games_won }
  end

  def sorted_by_wins(players)
    players.sort{ |x, y| y.total_games_won <=> x.total_games_won }
  end

  def sorted_by_winning_spread(players)
    players.sort{ |x, y| y.average_winning_spread <=> x.average_winning_spread }
  end

  def sorted_by_average_points_allowed(players)
    no_zeros = players.reject{ |x| x.average_points_allowed == 0 }
    no_zeros.sort{ |x, y| x.average_points_allowed <=> y.average_points_allowed }
  end

  def sorted_by_losing_spread(players)
    no_zeros = players.reject{ |x| x.average_losing_spread == 0 }
    no_zeros.sort{ |x, y| x.average_losing_spread <=> y.average_losing_spread }
  end

  def sorted_by_points_scored(players)
    players.sort{ |x, y| y.total_points_scored <=> x.total_points_scored }
  end

  def sorted_by_points_allowed(players)
    players.sort{ |x, y| y.total_points_allowed <=> x.total_points_allowed }
  end
end
