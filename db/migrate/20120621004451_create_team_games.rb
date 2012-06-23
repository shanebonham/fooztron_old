class CreateTeamGames < ActiveRecord::Migration
  def change
    create_table :team_games do |t|
      t.references :team
      t.references :game
      t.integer :side_cd

      t.timestamps
    end
    add_index :team_games, :team_id
    add_index :team_games, :game_id
  end
end
