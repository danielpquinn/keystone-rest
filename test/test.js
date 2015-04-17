/*
** test.js
**
** Implements the keystone-rest module test.
*/

/*global describe, it, beforeEach, afterEach */

'use strict';

/*
** Program Dependencies and Configuration
*/

var assert       = require('assert');
var request      = require('supertest');
var keystone     = require('keystone');
var keystoneRest = require('../index');
var app;
var mongoose;
var Post;
var User;

// Initialize keystone for testing
keystone.init({
  'name': 'Keystone Rest Test',
  'favicon': 'public/favicon.ico',
  'less': 'public',
  'static': 'public',
  'views': 'templates/views',
  'view engine': 'jade',
  'mongo': 'mongodb://localhost/keystone-rest-test',
  'session': true,
  'auth': true,
  'user model': 'User',
  'cookie secret': '(your secret here)'
});

User = require('./models/users');
Post = require('./models/posts');

keystone.app;
mongoose = keystone.mongoose;

// Create dummy objects
var setupDb = function (done) {
  var self = this;

  var createUser = function (name, cb) {
    var post = new Post.model({ title: 'Test Post', hidden: 'xxxxxxxx', body: 'Test post body.'});
    post.save(function (err, post) {
      /*jslint unparam: true */
      var user = new User.model({ name: name, password: 'xxxxxxxx', token: 'xxxxxxxx', posts: [post._id] });
      user.save(function (err, doc) {
        self.user = doc;
        cb();
      });
    });
  };

  createUser('Test User 1', function () {
    createUser('Test User 2', function () {
      done();
    });
  });
};

// Remove dummy objects
var cleanupDb = function () {
  mongoose.connection.collections.users.drop();
  mongoose.connection.collections.posts.drop();
  this.user = undefined;
};

// Add user api endpoints
keystoneRest.addRoutes(User, 'list show create update delete', {
  list: [function (req, res, next) { /*jslint unparam: true */ res.header('list middleware', 'executed'); next(); }],
  show: [function (req, res, next) { /*jslint unparam: true */ res.header('show middleware', 'executed'); next(); }],
  create: [function (req, res, next) { /*jslint unparam: true */ res.header('create middleware', 'executed'); next(); }],
  update: [function (req, res, next) { /*jslint unparam: true */ res.header('update middleware', 'executed'); next(); }],
  delete: [function (req, res, next) { /*jslint unparam: true */ res.header('delete middleware', 'executed'); next(); }]
}, 'posts');

// Add post api endpoints
keystoneRest.addRoutes(Post, 'show', {}, null);

// Start server
keystone.start();

// Register rest api routes with app
keystoneRest.registerRoutes(keystone.app);

/**
 * Integration tests
 */

// Test list
describe('GET /api/users', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Contains one user object', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body.length !== 2) { return 'Incorrect response object length'; }
      })
      .end(done);
  });

  it('Has a name property', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body[0].name !== 'Test User 1') { return 'Incorrect response object name'; }
      })
      .end(done);
  });

  it('Does not show hidden field', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body[0].password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Has a populated field', function (done) {
    request(keystone.app)
      .get('/api/users?populate=posts')
      .expect(function (res) {
        if (!res.body[0].posts[0].title) { return 'User does not have a populated post'; }
      })
      .end(done);
  });

  it('Does not show hidden field on populated relationship', function (done) {
    request(keystone.app)
      .get('/api/users?populate=posts')
      .expect(function (res) {
        if (res.body[0].posts[0].hidden) { return 'Relationship should not contain \'hidden\' field'; }
      })
      .end(done);
  });

  it('Can be queried', function (done) {
    request(keystone.app)
      .get('/api/users?name=Test%20User%201')
      .expect(function (res) {
        if (res.body[0].name !== 'Test User 1' || res.body.length > 1) { return 'Incorrect response object name or response too long'; }
      })
      .end(done);
  });

  it('Executes middleware', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.headers['list middleware'] !== 'executed') { return 'List middleware was not executed'; }
      })
      .end(done);
  });
});

// Test show
describe('GET /api/users/:_id', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Responds with 404 if no document is found', function (done) {
    request(keystone.app)
      .get('/api/users/0')
      .expect(404, done);
  });

  it('Contains one user object', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id)
      .expect(function (res) {
        if (res.body.name !== 'Test User 2') { return 'Could not find user'; }
      })
      .end(done);
  });

  it('Does not show hidden field', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id)
      .expect(function (res) {
        if (res.body.password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Has a populated field', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id + '?populate=posts')
      .expect(function (res) {
        if (!res.body.posts[0].title) { return 'User does not have a populated post'; }
      })
      .end(done);
  });

  it('Does not show hidden field on populated relationship', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id + '?populate=posts')
      .expect(function (res) {
        if (res.body.posts[0].hidden) { return 'Relationship should not contain \'hidden\' field'; }
      })
      .end(done);
  });

  it('Executes middleware', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id)
      .expect(function (res) {
        if (res.headers['show middleware'] !== 'executed') { return 'Show middleware was not executed'; }
      })
      .end(done);
  });
});

// Test relationship
describe('GET api/users/:_id/posts', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Contains a list of user posts', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id + '/posts')
      .expect(function (res) {
        if (res.body[0].title !== 'Test Post') { return 'Could not list user\'s posts'; }
      })
      .end(done);
  });

  it('Selects fields on user\'s posts', function (done) {
    request(keystone.app)
      .get('/api/users/' + this.user._id + '/posts?select=title')
      .expect(function (res) {
        if (res.body[0].body) { return 'Fields that were not supposed to be selected were present'; }
      })
      .end(done);
  });
});

// Test show
describe('GET api/posts/:slug', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Can be found by field other than _id', function (done) {
    request(keystone.app)
      .get('/api/posts/test-post')
      .expect(function (res) {
        if (res.body.title !== 'Test Post') { return 'Could not find post'; }
      })
      .end(done);
  });

});

// Test create
describe('POST /api/users', function () {

  // Clean up after testing post
  afterEach(cleanupDb);

  it('Creates a new user', function (done) {
    request(keystone.app)
      .post('/api/users')
      .send({ name: 'Test User 1', password: 'xxxxxxxx' })
      .expect(function (res) {
        if (res.body.name !== 'Test User 1') { return 'User was not created'; }
      })
      .end(done);
  });

  it('Does not show hidden field', function (done) {
    request(keystone.app)
      .post('/api/users')
      .send({ name: 'Test User 1', password: 'xxxxxxxx' })
      .expect(function (res) {
        if (res.body.password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Executes middleware', function (done) {
    request(keystone.app)
      .post('/api/users')
      .send({ name: 'Test User 1', password: 'xxxxxxxx' })
      .expect(function (res) {
        if (res.headers['create middleware'] !== 'executed') { return 'Create middleware was not executed'; }
      })
      .end(done);
  });
});

// Test update
describe('PUT /api/users/:_id', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Responds with 404 if no document is found', function (done) {
    request(keystone.app)
      .put('/api/users/0')
      .send({ name: 'Test User Updated'})
      .expect(404, done);
  });

  it('Updates an existing user', function (done) {
    request(keystone.app)
      .put('/api/users/' + this.user._id)
      .send({ name: 'Test User Updated'})
      .expect(function (res) {
        if (res.body.name !== 'Test User Updated') { return 'User was not updated'; }
      })
      .end(done);
  });

  it('Does not show hidden field', function (done) {
    request(keystone.app)
      .put('/api/users/' + this.user._id)
      .send({ name: 'Test User Updated'})
      .expect(function (res) {
        if (res.body.password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Does not update uneditable field', function (done) {
    request(keystone.app)
      .put('/api/users/' + this.user._id)
      .send({ token: 'modifiedtoken'})
      .expect(function (res) {
        if (res.body.token === 'modifiedtoken') { return 'Field that should not be editable was modified'; }
      })
      .end(done);
  });

  it('Executes middleware', function (done) {
    request(keystone.app)
      .put('/api/users/' + this.user._id)
      .send({ name: 'Test User Updated'})
      .expect(function (res) {
        if (res.headers['update middleware'] !== 'executed') { return 'Update middleware was not executed'; }
      })
      .end(done);
  });
});

// Test update
describe('PATCH /api/users/:_id', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Updates an existing user', function (done) {
    request(keystone.app)
      .patch('/api/users/' + this.user._id)
      .send({ name: 'Test User Updated'})
      .expect(function (res) {
        if (res.body.name !== 'Test User Updated') { return 'User was not updated'; }
      })
      .end(done);
  });
});

// Test delete
describe('DELETE /api/users/:_id', function () {

  // Set up database
  beforeEach(setupDb);
  afterEach(cleanupDb);

  it('Responds with 404 if no document is found', function (done) {
    request(keystone.app)
      .delete('/api/users/0')
      .expect(404, done);
  });

  it('Deletes an existing user', function (done) {
    request(keystone.app)
      .delete('/api/users/' + this.user._id)
      .expect(function (res) {
        if (res.body.message !== 'Successfully deleted ' + User.model.collection.name.toLowerCase()) { return 'User was not deleted'; }
      })
      .end(done);
  });

  it('Executes middleware', function (done) {
    request(keystone.app)
      .delete('/api/users/' + this.user._id)
      .expect(function (res) {
        if (res.headers['delete middleware'] !== 'executed') { return 'delete middleware was not executed'; }
      })
      .end(done);
  });
});