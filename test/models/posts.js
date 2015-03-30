var keystone = require('keystone'),
  Types = keystone.Field.Types;

var Post = new keystone.List('Post', {
  autokey: { path: 'slug', from: 'title', unique: true }
});

Post.add({
  title: { type: Types.Text, required: true, initial: true },
  body: { type: Types.Text, required: true, initial: true },
  hidden: { type: Types.Text, required: true, initial: true, restSelected: false }
});

// Register Post
Post.register();

module.exports = exports = Post;