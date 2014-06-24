var _ = require('underscore'),
  keystone = require('keystone');


/**
  <p>Example usage</p>
  <pre>
  var keystone = require('keystone'),
    Types = keystone.Field.Types,
    keystoneRest = require('keystone-rest');

  var User = new keystone.List('User');

  // Add 'restSelected: false' to hide from api
  // Add 'restEditable: false' to disallow editing field via PUT
  User.add({
    name: { type: Types.Name, required: true, index: true },
    password: { type: Types.Password, initial: true, required: false, restSelected: false },
    token: { type: String, restEditable: false }
  });


  // Expose User model via REST api
  keystoneRest.addRoutes(User, 'get post put delete');

  User.register();

  // Add routes to app
  keystoneRest.registerRoutes(app);
  </pre>

   @constructor
 */
function KeystoneRest() {
  'use strict';

  var self = this;

  /**
   * Array containing routes and handlers
   * @type {Array}
   */
  this.routes = [];


  /**
   * Send an error response
   * @param {Object} err Error response object
   * @param {Object} res Express response
   */
  var _sendError = function (err, res) {
    /*jslint unparam: true */
    res.status(400);
    res.json(err);
  };


  /**
   * Remove omitted fields from response
   * @param {Object} model   Plain model object or mongoose instance
   * @param {Array} omitted Array of fields to omit
   * @return {Object} Plain object representation of model with removed fields
   */
  var _omit = function (model, omitted) {
    var object;

    // If model is a mongoose model instance, change it
    // into a plain object so it's properties can be
    // deleted.
    object = model.toObject ? model.toObject() : model;

    // Remove anything not in the schema
    delete object.__v;

    if (!omitted) { return object; }
    return _.omit(object, omitted);
  };


  /**
   * Convert fields that are relationships to _ids
   * @param {Object} model instance of mongoose model
   */
  var _flattenRelationships = function (model, body) {
    _.each(body, function (field, key) {
      var schemaField = model.schema.paths[key];

      // return if value is a string
      if (typeof field === 'string' || !schemaField) { return; }

      if (schemaField.options.ref) {
        body[key] = field._id;
      }

      if (_.isArray(schemaField.options.type)) {
        if (schemaField.options.type[0].ref) {
          _.each(field, function (value, i) {
            if (typeof value === 'string') { return; }
            body[key][i] = value._id;
          });
        }
      }
    });
  };


  /**
   * Get list of selected fields based on options in schema
   * @param {Schema} schema Mongoose schema
   */
  var _getSelected = function (schema) {
    var selected = [];

    _.each(schema.paths, function (path) {
      if (path.path === '__v') { return; }
      if (path.options.restSelected !== false) {
        selected.push(path.path);
      }
    });
    
    return selected.join(' ');
  };


  /**
   * Get Uneditable
   * @param {Schema} schema Mongoose schema
   */
  var _getUneditable = function (schema) {
    var uneditable = [];

    _.each(schema.paths, function (path) {
      if (path.options.restEditable === false) { uneditable.push(path.path); }
    });

    return uneditable;
  };


  /**
   * Get name of reference model
   * @param {List} keystoneList Keystone list
   * @param {String} path Ref path to get name from
   */
  var _getRefName = function (keystoneList, path) {
    var options = keystoneList.model.schema.paths[path].options;
    
    if (options.ref) {
      return options.ref;
    }

    return type[0].ref;
  };


  /**
   * Add get route
   * @param {List} keystoneList Keystone list
   * @param {String} selected String passed to mongoose "select" method
   * @param {Array} relationships Array of strings that will be used to identify fields to expose
   */
  var _addGet = function (keystoneList, selected, relationships) {
    var key = keystoneList.get('autokey') ? keystoneList.get('autokey').path : '_id';

    // Get a list of items
    self.routes.push({
      method: 'get',
      route: '/api/' + keystoneList.model.collection.name,
      handler: function (req, res, next) {
        var populated = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.find().count(function (err, count) {
          if (err) { return _sendError(err, res); }

          var query = keystoneList.model.find()
            .skip(req.query.skip)
            .limit(req.query.limit)
            .sort(req.query.sort)
            .select(selected);

          // Only respond with selected fields
          _.each(populated, function (path) {
            query.populate({
              path: path,
              select: _getSelected(keystone.mongoose.model(_getRefName(keystoneList, path)).schema)
            });
          });

          query.exec(function (err, response) {
              if (err) { return _sendError(err, res); }

              response = _.map(response, function (item) {
                return item;
              });

              // Make total total accessible via response headers
              res.setHeader('total', count);
              res.json(response);
            });
        });
      }
    });


    // Get one item by id
    self.routes.push({
      method: 'get',
      route: '/api/' + keystoneList.model.collection.name + '/:key',
      handler: function (req, res, next) {
        var populated = req.query.populate ? req.query.populate.split(',') : '',
          criteria = {},
          query;

        criteria[key] = req.params.key;

        query = keystoneList.model.findOne(criteria).select(selected);

        // Only respond with selected fields
        _.each(populated, function (path) {
          query.populate({
            path: path,
            select: _getSelected(keystone.mongoose.model(_getRefName(keystoneList, path)).schema)
          });
        });

        query.exec(function (err, response) {
          if (err) { return _sendError(err, res); }
          if (!response) {
            res.status(404);
            return res.json({
              status: 'missing',
              message: 'Could not find ' + keystoneList.key.toLowerCase() + ' with ' + key + ' ' + req.params.key
            });
          }
          res.json(response);
        });
      }
    });


    // Get a list of relationships
    if (relationships) {
      _.each(relationships, function (relationship) {
        self.routes.push({
          method: 'get',
          route: '/api/' + keystoneList.model.collection.name + '/:key/' + relationship,
          handler: function (req, res, next) {
            var criteria = {};

            criteria[key] = req.params.key;

            keystoneList.model.findOne(criteria).exec(function (err, result) {
              if (err) { return _sendError(err, res); }
              if (!result) {
                res.status(404);
                return res.json({
                  status: 'missing',
                  message: 'Could not find ' + keystoneList.key.toLowerCase() + ' with ' + key + ' ' + req.params.key
                });
              }
              if (!result[relationship]) {
                res.status(404);
                return res.json({
                  status: 'missing',
                  message: keystoneList.key.toLowerCase() + ' has no ' + relationship
                });
              }

              var total = result[relationship].length;

              keystoneList.model.findOne(criteria)
                .populate({
                  path: relationship,
                  limit: req.query.limit,
                  skip: req.query.skip,
                  sort: req.query.sort,
                  select: selected
                }).exec(function (err, response) {
                  if (err) { return _sendError(err, res); }

                  // Make total accessible via response headers
                  res.setHeader('total', total);
                  res.json(response[relationship]);
                });
            });
          }
        });
      });
    }
  };


  /**
   * Add post route
   * @param {List} keystoneList Keystone list
   * @param {Array}  uneditable Array of fields to remove from post
   * @param {String} selected   String passed to mongoose "select" method
   */
  var _addPost = function (keystoneList, uneditable, selected) {

    // Create a new item
    self.routes.push({
      method: 'post',
      route: '/api/' + keystoneList.model.collection.name,
      handler: function (req, res, next) {
        var item = new keystoneList.model(),
          updateHandler = item.getUpdateHandler(req),
          query;

        _flattenRelationships(keystoneList.model, req.body);
        req.body = _omit(req.body, uneditable);

        updateHandler.process(req.body, function (err) {
          if (err) { return _sendError(err, res); }

          query = keystoneList.model.findById(item._id);

          query.select(selected);

          query.exec(function (err) {
            if (err) { return _sendError(err, res); }
            res.json(item);
          });
        });
      }
    });
  };


  /**
   * Add put route
   * @param {List} keystoneList Keystone list
   * @param {Array} uneditable Array of fields to remove from post
   * @param {String} selected   String passed to mongoose "select" method
   */
  var _addPut = function (keystoneList, uneditable, selected) {
    var key = keystoneList.get('autokey') ? keystoneList.get('autokey').path : '_id';

    // Update an item having a given key
    self.routes.push({
      method: 'put',
      route: '/api/' + keystoneList.model.collection.name + '/:key',
      handler: function (req, res, next) {
        var populated = req.query.populate ? req.query.populate.split(',') : '',
          criteria = {},
          query;

        criteria[key] = req.params.key;

        _flattenRelationships(keystoneList.model, req.body);
        req.body = _omit(req.body, uneditable);

        keystoneList.model.findOne(criteria).exec(function (err, item) {
          if (err) { return _sendError(err, res); }
          var updateHandler = item.getUpdateHandler(req);

          updateHandler.process(req.body, function (err) {
            if (err) { return _sendError(err, res); }

            // Not sure if it's possible to populate mongoose models after
            // save, so get the document again and populate it.
            query = keystoneList.model.findOne(criteria).select(selected);

            // Only respond with selected fields
            _.each(populated, function (path) {
              query.populate({
                path: path,
                select: _getSelected(keystone.mongoose.model(_getRefName(keystoneList, path)).schema)
              });
            });

            query.exec(function (err, item) {
              if (err) { return _sendError(err, res); }
              res.json(item);
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
    var key = keystoneList.get('autokey') ? keystoneList.get('autokey').path : '_id';

    // Delete an item having a given id
    self.routes.push({
      method: 'delete',
      route: '/api/' + keystoneList.model.collection.name + '/:key',
      handler: function (req, res, next) {
        var criteria = {};

        criteria[key] = req.params.key;

        // First find so middleware hooks (pre,post) will execute
        keystoneList.model.findOne(criteria, function (err, result) {
          if (err) { return _sendError(err, res); }

          result.remove(function (err) {
            if (err) { return _sendError(err, res); }
            res.json({
              message: 'Successfully deleted ' + keystoneList.key.toLowerCase()
            });
          });
        });
      }
    });
  };

 /**
 * Registers routes
 * @param {Object} app Keystone application instance
 */
  this.registerRoutes = function (app) {
    _.each(this.routes, function (route) {
      app[route.method](route.route, route.handler);
    });
  };

  /**
   * Expose routes
   * @param  {KeystoneList} keystoneList         A keystone list
   * @param {String} methods Methods to expose eg: 'get post put delete'
   * @param {Array} relationships An array of relted field names to expose GET routes for
   */
  this.addRoutes = function (keystoneList, methods, relationships) {
    var selected = _getSelected(keystoneList.model.schema);
    var uneditable = _getUneditable(keystoneList.model.schema);

    methods = methods.split(' ');
    relationships = relationships ? relationships.split(' ') : [];

    if (methods.indexOf('get') !== -1) { _addGet(keystoneList, selected, relationships); }
    if (methods.indexOf('post') !== -1) { _addPost(keystoneList, uneditable, selected); }
    if (methods.indexOf('put') !== -1) { _addPut(keystoneList, uneditable, selected); }
    if (methods.indexOf('delete') !== -1) { _addDelete(keystoneList); }
  };
}


// Export instance of keystoneRest
module.exports = new KeystoneRest();