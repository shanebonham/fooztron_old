class CreateGames < ActiveRecord::Migration
  def change
    create_table :games do |t|
      t.integer :white_score
      t.integer :blue_score

      t.timestamps
    end
  end
end
