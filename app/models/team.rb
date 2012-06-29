class Team < ActiveRecord::Base
  belongs_to :offense, :class_name => 'Player'
  belongs_to :defense, :class_name => 'Player'
  has_many :team_games
  has_many :games, :through => :team_games

  attr_accessible :defense, :offense

  def number_of_wins
    count = 0
    team_games.each do |team_game|
      count += 1 if team_game.side.to_s == team_game.game.winner
    end
    count
  end

  def total_games_played
    games.count
  end

  def record
    number_of_wins / total_games_played.to_f
  end

  def name
    "#{offense.name.upcase} and #{defense.name.upcase}"
  end
end
