# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

players = Player.create([{ name: 'Shane' }, { name: 'Etienne' }, { name: 'Beau' }, { name: 'Benson' }])
game = Game.create(white_score: 1, blue_score: 10)
PlayedPosition.create([{game_id: game.id, player_id: players[0].id, position: :white_defense},
                       {game_id: game.id, player_id: players[1].id, position: :blue_offense},
                       {game_id: game.id, player_id: players[2].id, position: :white_offense},
                       {game_id: game.id, player_id: players[3].id, position: :blue_defense}
                      ])
