class CreateUsers < ActiveRecord::Migration
  def change
    create_table :users do |t|
      t.string :monk_authentication_token

      t.timestamps
    end
  end
end
