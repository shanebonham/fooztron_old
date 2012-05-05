module GamesHelper

  def white_offense_player_name(game)
    played_position = PlayedPosition.find_by_position_cd_and_game_id(0, game.id)
    played_position.player.name
  end

  def white_defense_player_name(game)
    played_position = PlayedPosition.find_by_position_cd_and_game_id(1, game.id)
    played_position.player.name
  end

  def blue_offense_player_name(game)
    played_position = PlayedPosition.find_by_position_cd_and_game_id(2, game.id)
    played_position.player.name
  end

  def blue_defense_player_name(game)
    played_position = PlayedPosition.find_by_position_cd_and_game_id(3, game.id)
    played_position.player.name
  end
end
