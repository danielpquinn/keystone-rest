var _ = require('underscore'),
  keystone = require('keystone');


/**
 * Exposes keystone lists via rest api
 * @constructor
 */
function KeystoneRest() {
  this.routes = [];
}


/**
 * Expose routes
 * @param  {List} keystoneList A keystone list
 * @param  {Object} options      Arrays containing methods and omitted fields
 */
KeystoneRest.prototype.exposeRoutes = function (keystoneList, options) {
  if (!options) { return console.log('No methods provided'); }

  if (options.get) { this.addGet(keystoneList, options.get); }
  if (options.post) { this.addPost(keystoneList, options.post); }
  if (options.put) { this.addPut(keystoneList, options.put); }
  if (options.delete) { this.addDelete(keystoneList, options.delete); }
};


/**
 * Send an error response
 * @param  {Object} err error response object
 * @param  {Object} res Express response
 */
KeystoneRest.prototype.sendError = function (err, res) {
  res.status(400);
  res.json(err);
};


/**
 * Remove omitted fields from response
 * @param  {Object} model   Plain model object or mongoose instance
 * @param  {Array} omitted Array of fields to omit
 * @return {Object}         Plain object representation of model with removed fields
 */
KeystoneRest.prototype.removeOmitted = function (model, omitted) {
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
KeystoneRest.prototype.addGet = function (keystoneList, options) {
  var self = this;
  options = options || {};


  // Get a list of items
  self.routes.push({
    method: 'get',
    allow: options.allow,
    route: '/api/' + keystoneList.key.toLowerCase(),
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '',
        skip = req.query.skip || 0,
        limit = req.query.limit || Infinity;

      keystoneList.model.find().skip(skip).limit(limit).populate(populate).exec(function (err, response) {
        if (err) { self.sendError(err, res); return; }
        response = _.map(response, function (item) {
          return self.removeOmitted(item, options.omit);
        });
        res.json(self.removeOmitted(response, options.omit));
      });
    }
  });


  // Get one item by id
  self.routes.push({
    method: 'get',
    allow: options.allow,
    route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '';

      keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, response) {
        if (err) { self.sendError(err, res); return; }
        res.json(self.removeOmitted(response, options.omit));
      });
    }
  });
};


/**
 * Add post route
 * @param {List} keystoneList Keystone list
 * @param {Object} options    options for this method
 */
KeystoneRest.prototype.addPost = function (keystoneList, options) {
  var self = this;
  options = options || {};


  // Create a new item
  self.routes.push({
    method: 'post',
    allow: options.allow,
    route: '/api/' + keystoneList.key.toLowerCase(),
    handler: function (req, res) {
      var item = new keystoneList.model(),
        updateHandler = item.getUpdateHandler(req, res);

      updateHandler.process(self.removeOmitted(req.body, options.omit), function (err, response) {
        if (err) { self.sendError(err, res); return; }
        res.json(self.removeOmitted(item, options.omit));
      });
    }
  });
};


/**
 * Add put route
 * @param {List} keystoneList Keystone list
 * @param {Object} options    options for this method
 */
KeystoneRest.prototype.addPut = function (keystoneList, options) {
  var self = this;
  options = options || {};


  // Update an item having a given id
  self.routes.push({
    method: 'put',
    allow: options.allow,
    route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '';

      keystoneList.model.findById(req.params.id).exec(function (err, item) {
        if (err) { self.sendError(err, res); return; }
        var updateHandler = item.getUpdateHandler(req);

        updateHandler.process(self.removeOmitted(req.body, options.omit), function (err, response) {
          if (err) { self.sendError(err, res); return; }

          // Not sure if it's possible to populate mongoose models after
          // save, so get the document again and populate it.
          keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, item) {
            if (err) { self.sendError(err, res); return; }
            res.json(self.removeOmitted(item, options.omit));
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
KeystoneRest.prototype.addDelete = function (keystoneList, options) {
  var self = this;
  options = options || {};


  // Delete an item having a given id
  self.routes.push({
    method: 'delete',
    allow: options.allow,
    route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
    handler: function (req, res) {
      keystoneList.model.findByIdAndRemove(req.params.id, function (err, response) {
        if (err) { self.sendError(err, res); return; }
        res.json({
          message: 'Successfully deleted ' + keystoneList.key.toLowerCase()
        });
      });
    }
  });
};


// Export instance of keystoneRest
exports = module.exports = new KeystoneRest();