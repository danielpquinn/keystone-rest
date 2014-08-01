var keystone = require('keystone'),
  keystoneRest = require('../index'),
  assert = require('assert'),
  request = require('supertest'),
  User;


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


// Include user model
User = require('./models/users');
Post = require('./models/posts');


// Register api routes
keystoneRest.registerRoutes(keystone.app);


// Start web server
keystone.start();


var bootstrapUser = function (done) {
  // Create a user for testing
  User.model.remove({}, function (err) {
    Post.model.remove({}, function (err) {
      var post = new Post.model({
        title: 'Post Title',
        body: 'Post body.'
      });
      post.save(function (err, doc) {
        var user = new User.model({
          name: 'Test User',
          password: 'test',
          posts: [doc._id]
        });

        user.save(function (err, doc) {
          user = doc;
          done();
        });
      });
    });
  });
};


// Run tests
describe('KeystoneRest', function () {
  describe('#addRoutes()', function () {
    it('Should throw an error when keystoneList or methods are not supplied', function () {
      assert.throws(keystoneRest.addRoutes, Error, 'List and methods are required');
    });
  });
});


// Test GET list
describe('GET /api/users', function () {

  // Reset user model before each test
  beforeEach(bootstrapUser);

  it('Responds with 200', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(200, done);
  });

  it('Contains one user object', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body.length !== 1) { return 'Incorrect response object length'; }
      })
      .end(done);
  });

  it('Has a name property', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body[0].name !== 'Test User') { return 'Incorrect response object name'; }
      })
      .end(done);
  });

  it('Does not have a password property', function (done) {
    request(keystone.app)
      .get('/api/users')
      .expect(function (res) {
        if (res.body[0].password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Has a populated post', function (done) {
    request(keystone.app)
      .get('/api/users?populate=posts')
      .expect(function (res) {
        if (!res.body[0].posts[0].title) { return 'User does not have a populated post'; }
      })
      .end(done);
  });
});

// Test GET show
describe('GET /api/users/:user', function () {
  var user;

  beforeEach(function (done) {
    var post = new Post.model({
      title: 'Post Title',
      body: 'Post body.'
    });
    post.save(function (err, doc) {
      user = new User.model({
        name: 'Test User',
        password: 'test',
        posts: [doc._id]
      });

      user.save(function (err, doc) {
        done();
      });
    });
  });

  it('Has a name property', function (done) {
    request(keystone.app)
      .get('/api/users/' + user._id)
      .expect(function (res) {
        if (res.body.name !== 'Test User') { return 'Incorrect response object name'; }
      })
      .end(done);
  });

  it('Does not have a password property', function (done) {
    request(keystone.app)
      .get('/api/users/' + user._id)
      .expect(function (res) {
        if (res.body.password) { return 'Response should not contain password'; }
      })
      .end(done);
  });

  it('Has a populated post', function (done) {
    request(keystone.app)
      .get('/api/users/' + user._id + '?populate=posts')
      .expect(function (res) {
        if (!res.body.posts[0].title) { return 'User does not have a populated post'; }
      })
      .end(done);
  });
});