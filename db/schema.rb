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

ActiveRecord::Schema.define(:version => 20120623032701) do

  create_table "games", :force => true do |t|
    t.integer   "white_score"
    t.integer   "blue_score"
    t.timestamp "created_at",  :null => false
    t.timestamp "updated_at",  :null => false
  end

  create_table "played_positions", :force => true do |t|
    t.integer   "game_id"
    t.integer   "player_id"
    t.integer   "position_cd"
    t.timestamp "created_at",  :null => false
    t.timestamp "updated_at",  :null => false
  end

  add_index "played_positions", ["game_id"], :name => "index_played_positions_on_game_id"
  add_index "played_positions", ["player_id"], :name => "index_played_positions_on_player_id"

  create_table "players", :force => true do |t|
    t.string    "name"
    t.boolean   "hidden"
    t.timestamp "created_at", :null => false
    t.timestamp "updated_at", :null => false
  end

  create_table "team_games", :force => true do |t|
    t.integer  "team_id"
    t.integer  "game_id"
    t.integer  "side_cd"
    t.datetime "created_at", :null => false
    t.datetime "updated_at", :null => false
  end

  add_index "team_games", ["game_id"], :name => "index_team_games_on_game_id"
  add_index "team_games", ["team_id"], :name => "index_team_games_on_team_id"

  create_table "teams", :force => true do |t|
    t.integer  "offense_id"
    t.integer  "defense_id"
    t.datetime "created_at", :null => false
    t.datetime "updated_at", :null => false
  end

  create_table "users", :force => true do |t|
    t.string    "email"
    t.string    "monk_authentication_token"
    t.boolean   "admin"
    t.timestamp "created_at",                :null => false
    t.timestamp "updated_at",                :null => false
  end

end
