class Team

  attr_accessor :offense, :defense

  def initialize(attrs = {})
    attrs.each do |k,v|
      self.send "#{k}=", v
    end
  end

  def self.all
    games = Game.all
    teams = []
    games.each do |game|
      white_team = {}
      blue_team = {}
      white_team_offense = {}
      white_team_defense = {}
      blue_team_offense = {}
      blue_team_defense = {}
      game.played_positions.each do |played_position|
        case played_position.position
        when :white_offense
          white_team_offense = {:offense => played_position.player}
        when :white_defense
          white_team_defense = {:defense => played_position.player}
        when :blue_offense
          blue_team_offense = {:offense => played_position.player}
        when :blue_defense
          blue_team_defense = {:defense => played_position.player}
        end
      end
      white_team = white_team_offense.merge white_team_defense
      blue_team = blue_team_offense.merge blue_team_defense
      teams << white_team
      teams << blue_team
    end
    teams.uniq
  end
end
