class PopulateTeams < ActiveRecord::Migration
  def up
    games = Game.all
    games.each do |game|
      game.save
    end
  end

  def down
    Team.delete_all
    TeamGame.delete_all
  end
end
