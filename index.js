var _ = require('underscore'),
  keystone = require('keystone');


/**
  <p>Example usage</p>
  <pre>
  var keystone = require('keystone'),
    Types = keystone.Field.Types,
    keystoneRest = require('keystone-rest');

  var User = new keystone.List('User');

  User.add({
    name: { type: Types.Name, required: true, index: true },
    password: { type: Types.Password, initial: true, required: false }
  });


  // Expose Attribute model via REST api
  keystoneRest.exposeRoutes(User, {
    post: {},
    get: { omit: ['password'] },
    put: { omit: ['password'] },
    delete: {}
  });

  User.register();
  </pre>

   @constructor
 */
function KeystoneRest() {
  var self = this;

  /**
   * Array containing routes and handlers
   * @type {Array}
   */
  this.routes = [];


  /**
   * Send an error response
   * @param  {Object} err Error response object
   * @param  {Object} res Express response
   */
  var _sendError = function (err, res) {
    res.status(400);
    res.json(err);
  };


  /**
   * Remove omitted fields from response
   * @param  {Object} model   Plain model object or mongoose instance
   * @param  {Array} omitted Array of fields to omit
   * @return {Object}         Plain object representation of model with removed fields
   */
  var _removeOmitted = function (model, omitted) {
    var object;

    if (!omitted) { return model; }

    // If model is a mongoose model instance, change it
    // into a plain object so it's properties can be
    // deleted.
    object = model.toObject ? model.toObject() : model;

    _.each(omitted, function (field) {
      if (object[field]) { delete object[field]; }
    });

    return object;
  };


  /**
   * Add get route
   * @param {List} keystoneList Keystone list
   * @param {Object} options    options for this method
   */
  var _addGet = function (keystoneList, options) {
    options = options || {};


    // Get a list of items
    self.routes.push({
      method: 'get',
      route: '/api/' + keystoneList.key.toLowerCase(),
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '',
          skip = req.query.skip || 0,
          limit = req.query.limit || Infinity;

        keystoneList.model.find().skip(skip).limit(limit).populate(populate).exec(function (err, response) {
          if (err) { _sendError(err, res); return; }
          response = _.map(response, function (item) {
            return _removeOmitted(item, options.omit);
          });
          res.json(_removeOmitted(response, options.omit));
        });
      }
    });


    // Get one item by id
    self.routes.push({
      method: 'get',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, response) {
          if (err) { _sendError(err, res); return; }
          res.json(_removeOmitted(response, options.omit));
        });
      }
    });
  };


  /**
   * Add post route
   * @param {List} keystoneList Keystone list
   * @param {Object} options    options for this method
   */
  var _addPost = function (keystoneList, options) {
    options = options || {};


    // Create a new item
    self.routes.push({
      method: 'post',
      route: '/api/' + keystoneList.key.toLowerCase(),
      handler: function (req, res) {
        var item = new keystoneList.model(),
          updateHandler = item.getUpdateHandler(req, res);

        updateHandler.process(_removeOmitted(req.body, options.omit), function (err, response) {
          if (err) { _sendError(err, res); return; }
          res.json(_removeOmitted(item, options.omit));
        });
      }
    });
  };


  /**
   * Add put route
   * @param {List} keystoneList Keystone list
   * @param {Object} options    options for this method
   */
  var _addPut = function (keystoneList, options) {
    options = options || {};


    // Update an item having a given id
    self.routes.push({
      method: 'put',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.findById(req.params.id).exec(function (err, item) {
          if (err) { _sendError(err, res); return; }
          var updateHandler = item.getUpdateHandler(req);

          updateHandler.process(_removeOmitted(req.body, options.omit), function (err, response) {
            if (err) { _sendError(err, res); return; }

            // Not sure if it's possible to populate mongoose models after
            // save, so get the document again and populate it.
            keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, item) {
              if (err) { _sendError(err, res); return; }
              res.json(_removeOmitted(item, options.omit));
            });
          });
        });
      }
    });
  };


  /**
   * Add delete route
   * @param {List} keystoneList Keystone list
   */
  var _addDelete = function (keystoneList) {


    // Delete an item having a given id
    self.routes.push({
      method: 'delete',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        keystoneList.model.findByIdAndRemove(req.params.id, function (err, response) {
          if (err) { _sendError(err, res); return; }
          res.json({
            message: 'Successfully deleted ' + keystoneList.key.toLowerCase()
          });
        });
      }
    });
  };

  /**
   * Expose routes
   * @param  {KeystoneList} keystoneList         A keystone list
   * @param  {Object}       options              Arrays containing methods and omitted fields
   * @param  {Object}       options.get          If present, get is exposed.
   * @param  {Array}        options.get.omitted  Array of fields to omit from get response
   * @param  {Object}       options.post         If present, post is exposed
   * @param  {Array}        options.post.omitted Array of fields to omit from post response
   * @param  {Object}       options.put          If present, put is exposed
   * @param  {Array}        options.put.omitted  Array of fields to omit from put response
   * @param  {Object}       options.delete       If present, delete is exposed
   */
  this.exposeRoutes = function (keystoneList, options) {
    if (!options) { return console.log('No methods provided'); }

    if (options.get) { _addGet(keystoneList, options.get); }
    if (options.post) { _addPost(keystoneList, options.post); }
    if (options.put) { _addPut(keystoneList, options.put); }
    if (options.delete) { _addDelete(keystoneList); }
  };
}


// Export instance of keystoneRest
exports = module.exports = new KeystoneRest();