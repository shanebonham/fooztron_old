module PlayersHelper

  def sorted_by_number_of_games(players)
    players.sort!{ |x, y| y.games.count <=> x.games.count }
  end
end
