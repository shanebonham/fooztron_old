class CreatePlayedPositions < ActiveRecord::Migration
  def change
    create_table :played_positions do |t|
      t.references :game
      t.references :player
      t.integer :position

      t.timestamps
    end
    add_index :played_positions, :game_id
    add_index :played_positions, :player_id
  end
end
