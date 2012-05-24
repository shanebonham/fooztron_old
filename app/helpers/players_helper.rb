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
end
