module GamesHelper

  def winner_class(game, color)
    'winner' if game.winner == color
  end
end
