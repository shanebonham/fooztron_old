#!/usr/bin/env rake
# Add your own tasks in files placed in lib/tasks ending in .rake,
# for example lib/tasks/capistrano.rake, and they will automatically be available to Rake.

require File.expand_path('../config/application', __FILE__)

Fooztron::Application.load_tasks

namespace :db do
  task :nuke do
    puts 'Deleting schema.rb...'
    File.delete('db/schema.rb')
    puts 'Resetting db via migrations...'
    Rake::Task['db:migrate:reset'].invoke
    puts 'Database nuked and reset!'
  end
end