var keystone = require('keystone'),
  Types = keystone.Field.Types;

var User = new keystone.List('User');

User.add({
  name: { type: Types.Text, required: true, initial: true },
  token: { type: Types.Text, restEditable: false },
  password: { type: Types.Password, required: true, initial: true, restSelected: false },
  posts: { type: Types.Relationship, ref: 'Post', many: true }
});


// Register User
User.register();

module.exports = exports = User;