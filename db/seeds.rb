# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

players = Player.create([{ name: 'Shane' }, { name: 'Etienne' }, { name: 'Beau' }, { name: 'Benson' }])
Game.create(white_offense_id: players[1],
            white_defense_id: players[3],
            blue_offense_id: players[2],
            blue_defense_id: players[0]
            )