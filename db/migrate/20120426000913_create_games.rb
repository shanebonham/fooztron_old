class CreateGames < ActiveRecord::Migration
  def change
    create_table :games do |t|
      t.references :white_offense
      t.references :white_defense
      t.references :blue_offense
      t.references :blue_defense

      t.timestamps
    end
    add_index :games, :white_offense_id
    add_index :games, :white_defense_id
    add_index :games, :blue_offense_id
    add_index :games, :blue_defense_id
  end
end
