class CreateGamePlayers < ActiveRecord::Migration
  def change
    create_table :game_players do |t|
      t.references :player
      t.references :game
      t.integer :position

      t.timestamps
    end
    add_index :game_players, :player_id
    add_index :game_players, :game_id
  end
end
