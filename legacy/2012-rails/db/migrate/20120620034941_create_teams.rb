class CreateTeams < ActiveRecord::Migration
  def change
    create_table :teams do |t|
      t.integer :offense_id
      t.integer :defense_id

      t.timestamps
    end
  end
end
