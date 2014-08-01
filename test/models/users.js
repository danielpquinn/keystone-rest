var keystone = require('keystone'),
  Types = keystone.Field.Types,
  keystoneRest = require('../../index');

var User = new keystone.List('User');

User.add({
  name: { type: Types.Text, required: true, initial: true },
  password: { type: Types.Password, required: true, initial: true, restSelected: false },
  posts: { type: Types.Relationship, ref: 'Post', many: true }
});


// Register User
User.register();


// Expose User model via REST api
keystoneRest.addRoutes(User, 'get post put delete');

module.exports = exports = User;