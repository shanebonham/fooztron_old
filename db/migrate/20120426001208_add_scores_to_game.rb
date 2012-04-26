class AddScoresToGame < ActiveRecord::Migration
  def change
    add_column :games, :blue_score, :number
    add_column :games, :white_score, :number
  end
end
