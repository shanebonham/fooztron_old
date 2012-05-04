namespace :db do
  desc "Resets the database when old migrations have changed."
  task :nuke do
    puts 'Deleting schema.rb...'
    File.delete('db/schema.rb')
    puts 'Resetting db via migrations...'
    Rake::Task['db:migrate:reset'].invoke
    puts 'Seeding database...'
    Rake::Task['db:seed'].invoke
    puts 'Database nuked, reset and seeded!'
  end
end
