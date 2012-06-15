class Game < ActiveRecord::Base
  has_many :played_positions, :dependent => :destroy
  has_many :players, :through => :played_positions

  attr_accessible :white_score, :blue_score, :played_positions_attributes

  accepts_nested_attributes_for :played_positions

  validates :white_score, :blue_score, :presence => true
  validate :one_score_must_be_ten

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
end
