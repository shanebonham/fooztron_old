module Side

  def self.blue_win_percentage
    games = Game.all
    total_games = games.count
    blue_win_count = 0
    games.each do |game|
      blue_win_count += 1 if game.winner == 'blue'
    end
    blue_win_count / total_games.to_f
  end
end