# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

players = Player.create([{ name: 'Shane' }, { name: 'Etienne' }, { name: 'Beau' }, { name: 'Benson' }])
Game.create(white_offense_id: players[1].id,
            white_defense_id: players[3].id,
            blue_offense_id: players[2].id,
            blue_defense_id: players[0].id,
            white_score: 1,
            blue_score: 10
            )