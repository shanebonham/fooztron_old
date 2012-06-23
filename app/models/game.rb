class Game < ActiveRecord::Base
  has_many :played_positions, :dependent => :destroy
  has_many :players, :through => :played_positions
  has_many :team_games
  has_many :teams, :through => :team_games

  attr_accessible :white_score, :blue_score, :played_positions_attributes

  accepts_nested_attributes_for :played_positions

  validates :white_score, :blue_score, :presence => true
  validate :one_score_must_be_ten

  before_save do
    white = Team.find_or_create_by_offense_id_and_defense_id(played_positions[0].player.id, played_positions[1].player.id)
    blue = Team.find_or_create_by_offense_id_and_defense_id(played_positions[2].player.id, played_positions[3].player.id)
    self.team_games << TeamGame.new(:game => self, :team => white, :side => :white)
    self.team_games << TeamGame.new(:game => self, :team => blue, :side => :blue)
  end

  def winner
    white_score > blue_score ? 'white' : 'blue'
  end

  def spread
    (white_score - blue_score).abs
  end

  def one_score_must_be_ten
    if white_score != 10 && blue_score != 10
      self.errors[:base] << 'One score must be 10'
    elsif white_score == blue_score
      self.errors[:base] << "Scores can't be the same"
    end
  end

  def winning_team
    team = Team.new
    if winner == 'white'
      team.offense = played_positions.where(:position_cd => 0).first.player
      team.defense = played_positions.where(:position_cd => 1).first.player
    else
      team.offense = played_positions.where(:position_cd => 2).first.player
      team.defense = played_positions.where(:position_cd => 3).first.player
    end
    team
  end
end
