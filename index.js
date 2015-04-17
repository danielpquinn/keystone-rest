'use strict';

var _ = require('lodash'),
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
    password: { type: Types.Password, initial: true, required: false, restSelected: false },
    token: { type: String, restEditable: false }
  });

  // Add user api endpoints
  keystoneRest.addRoutes(User, 'list show create update delete', {
    list: [listMiddleware],
    show: [showMiddleware],
    create: [createMiddleware],
    update: [updateMiddleware],
    delete: [deleteMiddleware]
  }, 'posts');

  User.register();

  // Make sure keystone is initialized and started before
  // calling registerRoutes
  keystone.init(config);
  keystone.start();

  // Add routes to app
  keystoneRest.registerRoutes(keystone.app);
  </pre>
 */


/**
 * @constructor
 */
function KeystoneRest() {
  var self = this;

  // Mongoose instance attached to keystone object.
  // Assigned in addRoutes
  var mongoose;

  /**
   * Array containing routes and handlers
   * @type {Array}
   */

  self.routes = [];


  /**
   * Send a 404 response
   * @param  {Object} res     Express response
   * @param  {String} message Message
   */
  var _send404 = function (res, message) {
    res.status(404);
    res.json({
      status: 'missing',
      message: message
    });
  };


  /**
   * Send an error response
   * @param {Object} err Error response object
   * @param {Object} res Express response
   */

  var _sendError = function (err, req, res, next) {
    /*jslint unparam: true */
    next(err);
  };


  /**
   * Convert fields that are relationships to _ids
   * @param {Object} model instance of mongoose model
   */

  var _flattenRelationships = function (model, body) {
    _.each(body, function (field, key) {
      var schemaField = model.schema.paths[key];

      // return if value is a string
      if (typeof field === 'string' || !schemaField || _.isEmpty(schemaField)) { return; }

      if (schemaField.options.ref) {
        body[key] = field._id;
      }

      if (_.isArray(schemaField.options.type)) {
        if (schemaField.options.type[0].ref) {
          _.each(field, function (value, i) {
            if (typeof value === 'string' || !value) { return; }
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
      if (path.options.restEditable === false) { uneditable.push(path.path); return; }
      if (path.options.type.constructor.name === 'Array') { if (path.options.type[0].restEditable === false) { uneditable.push(path.path); } }
    });

    return uneditable;
  };


  /**
   * Get name of reference model
   * @param {Model}  Model Mongoose model
   * @param {String} path Ref path to get name from
   */
  var _getRefName = function (Model, path) {
    var options = Model.schema.paths[path].options;

    // One to one relationship
    if (options.ref) {
      return options.ref;
    }

    // One to many relationsihp
    return options.type[0].ref;
  };


  /**
   * Add get route
   * @param {Model}  model      Mongoose Model
   * @param {Mixed}  middleware Express middleware to execute before route handler
   * @param {String} selected   String passed to mongoose "select" method
   */

  var _addList = function (Model, middleware, selected, relationships) {

    // Get a list of items
    self.routes.push({
      method: 'get',
      middleware: middleware,
      route: '/api/' + Model.collection.name.toLowerCase(),
      handler: function (req, res, next) {
        var populated = req.query.populate ? req.query.populate.split(',') : [],
          criteria = _.omit(req.query, ['populate', '_', 'limit', 'skip', 'sort', 'select']),
          querySelect;

        if (req.query.select) {
          querySelect = req.query.select.split(',');
          querySelect = querySelect.filter(function (field) {
            return (selected.indexOf(field) > -1);
          }).join(' ');
        }

        Model.find().count(function (err, count) {
          if (err) { return _sendError(err, req, res, next); }

          var query = Model.find(criteria).skip(req.query.skip)
            .limit(req.query.limit)
            .sort(req.query.sort)
            .select(querySelect || selected);

          populated.forEach(function (path) {
            query.populate({
              path: path,
              select: _getSelected(mongoose.model(_getRefName(Model, path)).schema)
            });
          });

          query.exec(function (err, response) {
            if (err) { return _sendError(err, req, res, next); }

            // Make total total accessible via response headers
            res.setHeader('total', count);
            res.json(response);
          });
        });
      }
    });


    // Get a list of relationships
    if (relationships) {

      _.each(relationships, function (relationship) {
        self.routes.push({
          method: 'get',
          middleware: [],
          route: '/api/' + Model.collection.name.toLowerCase() + '/:id/' + relationship,
          handler: function (req, res, next) {
            Model.findById(req.params.id).exec(function (err, result) {
              var total,
                criteria = _.omit(req.query, ['populate', '_', 'limit', 'skip', 'sort', 'select']),
                ref,
                query,
                querySelect,
                refSelected,
                sortedResults = [];

              if (err && err.type !== 'ObjectId') { return _sendError(err, req, res, next); }
              if (!result) { return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id); }

              total = result[relationship].length;
              ref = Model.schema.paths[relationship].caster.options.ref;

              refSelected = _getSelected(mongoose.model(ref).schema);

              query = mongoose.model(ref)
                .find(criteria)
                .in('_id', result[relationship])
                .limit(req.query.limit)
                .skip(req.query.skip)
                .sort(req.query.sort);

              if (req.query.select) {
                querySelect = req.query.select.split(',');
                querySelect = querySelect.filter(function (field) {
                  return (refSelected.indexOf(field) > -1);
                }).join(' ');
                query.select(querySelect);
              }

              if (req.query.populate && typeof req.query.populate === 'string') {
                query.populate(req.query.populate);
              }

              query.exec(function (err, response) {
                if (err) { return _sendError(err, req, res, next); }

                // Put relationship results into same order
                // that they appear in document
                if (!req.query.sort) {
                  result[relationship].forEach(function (_id, i) {
                    sortedResults[i] = _.findWhere(response, { _id: _id });
                  });
                  response = sortedResults;
                }

                // Make total total accessible via response headers
                res.setHeader('total', total);
                res.json(response);
              });
            });
          }
        });
      });
    }
  };


  /**
   * Add list route
   * @param {Model}  model      Mongoose Model
   * @param {Mixed}  middleware Express middleware to execute before route handler
   * @param {String} selected   String passed to mongoose "select" method
   */

  var _addShow = function (Model, middleware, selected, findBy) {
    var collectionName = Model.collection.name.toLowerCase();
    var paramName = Model.modelName.toLowerCase();

    // Get one item
    self.routes.push({
      method: 'get',
      middleware: middleware,
      route: '/api/' + collectionName + '/:' + paramName,
      handler: function (req, res, next) {
        var populated = req.query.populate ? req.query.populate.split(',') : [];
        var criteria = {};
        var querySelect;

        if (req.query.select) {
          querySelect = req.query.select.split(',');
          querySelect = querySelect.filter(function (field) {
            return (selected.indexOf(field) > -1);
          }).join(' ');
        }

        criteria[findBy] = req.params[paramName];

        var query = Model.findOne(criteria)
          .select(querySelect || selected);

        populated.forEach(function (path) {
          query.populate({
            path: path,
            select: _getSelected(mongoose.model(_getRefName(Model, path)).schema)
          });
        });

        query.exec(function (err, result) {
          if (err && err.type !== 'ObjectId') { return _sendError(err, req, res, next); }
          if (!result) { return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id); }
          res.json(result);
        });
      }
    });
  };


  /**
   * Add post route
   * @param {Model}  Model      Mongoose Model
   * @param {Mixed}  middleware Express middleware to execute before route handler
   * @param {String} selected   String passed to mongoose "select" method
   */

  var _addCreate = function (Model, middleware, selected) {

    // Create a new item
    self.routes.push({
      method: 'post',
      middleware: middleware,
      route: '/api/' + Model.collection.name.toLowerCase(),
      handler: function (req, res, next) {
        var item;

        _flattenRelationships(Model, req.body);

        item = new Model(req.body);

        item.save(function (err, item) {
          if (err) { return _sendError(err, req, res, next); }

          Model.findById(item._id).select(selected).exec(function (err, item) {
            if (err) { return _sendError(err, req, res, next); }
            res.json(item);
          });
        });
      }
    });
  };


  /**
   * Add put route
   * @param {Model}  Model      Mongoose Model
   * @param {Mixed}  middleware Express middleware to execute before route handler
   * @param {String} selected   String passed to mongoose "select" method
   * @param {Array}  uneditable Array of fields to remove from post
   */

  var _addUpdate = function (Model, middleware, uneditable, selected, findBy) {
    var collectionName = Model.collection.name.toLowerCase();
    var paramName = Model.modelName.toLowerCase();
    var versionKey = Model.schema.options.versionKey;

    var handler = function (req, res, next) {
      var populated = req.query.populate ? req.query.populate.split(',') : '';
      var criteria = {};
      var querySelect;

      if (req.query.select) {
        querySelect = req.query.select.split(',');
        querySelect = querySelect.filter(function (field) {
          return (selected.indexOf(field) > -1);
        }).join(' ');
      }

      criteria[findBy] = req.params[paramName];

      _flattenRelationships(Model, req.body);
      req.body = _.omit(req.body, uneditable);

      Model.findOne(criteria).exec(function (err, item) {

        /*jslint unparam: true */
        if (err && err.type !== 'ObjectId') { return _sendError(err, req, res, next); }
        if (!item) { return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id); }

        if (req.body[versionKey] < item[versionKey]) { return _sendError(new mongoose.Error.VersionError(), req, res, next); }

        _.extend(item, req.body);

        item.save(function (err, item) {
          if (err) { return _sendError(err, req, res, next); }

          Model.findOne(criteria).select(querySelect || selected).populate(populated).exec(function (err, item) {
            if (err) { return _sendError(err, req, res, next); }
            res.json(item);
          });
        });
      });
    };

    // Update an item having a given key
    self.routes.push({
      method: 'put',
      middleware: middleware,
      route: '/api/' + collectionName + '/:' + paramName,
      handler: handler
    });

    self.routes.push({
      method: 'patch',
      middleware: middleware,
      route: '/api/' + collectionName + '/:' + paramName,
      handler: handler
    });
  };


  /**
   * Add delete route
   * @param {Model} model      Mongoose Model
   * @param {Mixed} middleware Express middleware to execute before route handler
   */

  var _addDelete = function (Model, middleware, findBy) {
    var collectionName = Model.collection.name.toLowerCase();
    var paramName = Model.modelName.toLowerCase();

    // Delete an item having a given id
    self.routes.push({
      method: 'delete',
      middleware: middleware,
      route: '/api/' + collectionName + '/:' + paramName,
      handler: function (req, res, next) {
        var criteria = {};

        criteria[findBy] = req.params[paramName];

        // First find so middleware hooks (pre,post) will execute
        Model.findOne(criteria, function (err, item) {
          if (err && err.type !== 'ObjectId') { return _sendError(err, req, res, next); }
          if (!item) { return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id); }

          item.remove(function (err) {
            if (err) { return _sendError(err, req, res, next); }
            res.json({
              message: 'Successfully deleted ' + collectionName
            });
          });
        });
      }
    });
  };


  /**
   * Add routes
   * @param {Object} keystoneList  Instance of KeystoneList
   * @param {String} methods       Methods to expose('list show create update delete')
   * @param {Object} middleware    Map containing middleware to execute for each action ({ list: [middleware] })
   * @param {String} relationships Space separated list of relationships to build routes for
   */

  this.addRoutes = function (keystoneList, methods, middleware, relationships) {
    // Get reference to mongoose for internal use
    mongoose = keystone.mongoose;

    var findBy;
    var Model = keystoneList.model;

    if (!Model instanceof mongoose.model) { throw new Error('keystoneList is required'); }
    if (!methods) { throw new Error('Methods are required'); }
    if (!mongoose) { throw new Error('Keystone must be initialized before attempting to add routes'); }

    var selected = _getSelected(Model.schema),
      uneditable = _getUneditable(Model.schema),
      listMiddleware,
      showMiddleware,
      createMiddleware,
      updateMiddleware,
      deleteMiddleware;

    methods = methods.split(' ');

    // Use autoKey to find doc if it exists
    if (keystoneList.options.autokey) {
      findBy = keystoneList.options.autokey.path;
    } else {
      findBy = '_id';
    }

    // Set up default middleware
    middleware = middleware || {};
    listMiddleware = middleware.list || [];
    showMiddleware = middleware.show || [];
    createMiddleware = middleware.create || [];
    updateMiddleware = middleware.update || [];
    deleteMiddleware = middleware.delete || [];

    relationships = relationships ? relationships.split(' ') : [];

    if (methods.indexOf('list') !== -1) { _addList(Model, listMiddleware, selected, relationships); }
    if (methods.indexOf('show') !== -1) { _addShow(Model, showMiddleware, selected, findBy); }
    if (methods.indexOf('create') !== -1) { _addCreate(Model, createMiddleware, selected); }
    if (methods.indexOf('update') !== -1) { _addUpdate(Model, updateMiddleware, uneditable, selected, findBy); }
    if (methods.indexOf('delete') !== -1) { _addDelete(Model, deleteMiddleware, findBy); }
  };


  /**
   * Register routes
   * @param  {Object} app Express app
   */

  this.registerRoutes = function (app) {
    _.each(self.routes, function (route) {
      app[route.method](route.route, route.middleware, route.handler);
    });
  };
}

/*
** Exports
*/

module.exports = new KeystoneRest();