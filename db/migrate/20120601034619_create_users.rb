class CreateUsers < ActiveRecord::Migration
  def change
    create_table :users do |t|
      t.string  :email
      t.string  :monk_authentication_token
      t.boolean :admin

      t.timestamps
    end
  end
end
