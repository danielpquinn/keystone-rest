var keystone = require('keystone'),
  Types = keystone.Field.Types,
  keystoneRest = require('../../index');

var Post = new keystone.List('Post');

Post.add({
  title: { type: Types.Text, required: true, initial: true },
  body: { type: Types.Text, required: true, initial: true }
});


// Register Post
Post.register();


// Expose Post model via REST api
keystoneRest.addRoutes(Post, 'get post put delete');

module.exports = exports = Post;