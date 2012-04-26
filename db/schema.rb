# encoding: UTF-8
# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended to check this file into your version control system.

ActiveRecord::Schema.define(:version => 20120426001208) do

  create_table "games", :force => true do |t|
    t.integer  "white_offense_id"
    t.integer  "white_defense_id"
    t.integer  "blue_offense_id"
    t.integer  "blue_defense_id"
    t.datetime "created_at",       :null => false
    t.datetime "updated_at",       :null => false
    t.decimal  "blue_score"
    t.decimal  "white_score"
  end

  add_index "games", ["blue_defense_id"], :name => "index_games_on_blue_defense_id"
  add_index "games", ["blue_offense_id"], :name => "index_games_on_blue_offense_id"
  add_index "games", ["white_defense_id"], :name => "index_games_on_white_defense_id"
  add_index "games", ["white_offense_id"], :name => "index_games_on_white_offense_id"

  create_table "players", :force => true do |t|
    t.string   "name"
    t.datetime "created_at", :null => false
    t.datetime "updated_at", :null => false
  end

end
