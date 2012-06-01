class User < ActiveRecord::Base
  attr_accessible :monk_authentication_token, :email, :password
  attr_accessor :password

  def login!
    res = MonkId.login!(email: email, password: password)
    if res['success']
      update_attributes(:monk_authentication_token => res['user']['authentication_token'])
    else
      self.errors.add(:base, res['message'])
    end
  end

  def logout!
    res = MonkId.logout!(authentication_token: monk_authentication_token)
    res['success']
  end

end
