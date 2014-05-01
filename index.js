var _ = require('underscore'),
  keystone = require('keystone');


/**
 * Exposes keystone lists via rest api
 * @constructor
 */
function KeystoneRest() {
  this.exposedRoutes = [];
}


/**
 * Expose routes
 * @param  {List} keystoneList A keystone list
 * @param  {Object} options      Arrays containing methods and omitted fields
 */
KeystoneRest.prototype.exposeRoutes = function(keystoneList, options) {
  if (!options) { return console.log('No methods provided'); }
  if (!options.methods) { return console.log('No methods provided'); }

  if (!options.omit) { options.omit = {}; }

  if (options.methods.indexOf('get') > -1) { this.addGet(keystoneList, options.omit['get']); }
  if (options.methods.indexOf('post') > -1) { this.addPost(keystoneList, options.omit['post']); }
  if (options.methods.indexOf('put') > -1) { this.addPut(keystoneList, options.omit['put']); }
  if (options.methods.indexOf('delete') > -1) { this.addDelete(keystoneList, options.omit['delete']); }
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
 * @param {Array} omitted     Array of fields to omit
 */
KeystoneRest.prototype.addGet = function (keystoneList, omitted) {
  var self = this;

  self.exposedRoutes.push({
    method: 'get',
    route: '/api/' + keystoneList.key.toLowerCase(),
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '';

      keystoneList.model.find().populate(populate).exec(function (err, response) {
        if (err) { self.sendError(err, res); return; }
        response = _.map(response, function (item) {
          return self.removeOmitted(item, omitted);
        });
        res.json(self.removeOmitted(response, omitted));
      });
    }
  });
  self.exposedRoutes.push({
    method: 'get',
    route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '';

      keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, response) {
        if (!response) { return self.sendError({ message: 'Could not find ' + keystoneList.key.toLowerCase() }, res); }
        if (err) { self.sendError(err, res); return; }
        res.json(self.removeOmitted(response, omitted));
      });
    }
  });
};

KeystoneRest.prototype.addPost = function (keystoneList, omitted) {
  var self = this;

  self.exposedRoutes.push({
    method: 'post',
    route: '/api/' + keystoneList.key.toLowerCase(),
    handler: function (req, res) {
      var item = new keystoneList.model(),
        updateHandler = item.getUpdateHandler(req, res);

      updateHandler.process(req.body, function (err, response) {
        if (err) { self.sendError(err, res); return; }
        res.json(self.removeOmitted(item, omitted));
      });
    }
  });
};


/**
 * Add put route
 * @param {List} keystoneList Keystone list
 * @param {Array} omitted     Array of fields to omit
 */
KeystoneRest.prototype.addPut = function (keystoneList, omitted) {
  var self = this;

  self.exposedRoutes.push({
    method: 'put',
    route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
    handler: function (req, res) {
      var populate = req.query.populate ? req.query.populate.split(',') : '';

      keystoneList.model.findById(req.params.id).exec(function (err, item) {
        if (err) { self.sendError(err, res); return; }
        var updateHandler = item.getUpdateHandler(req);

        updateHandler.process(req.body, function (err, response) {
          if (err) { self.sendError(err, res); return; }

          // Not sure if it's possible to populate mongoose models after
          // save, so get the document again and populate it.
          keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, item) {
            if (err) { self.sendError(err, res); return; }
            res.json(self.removeOmitted(item, omitted));
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
KeystoneRest.prototype.addDelete = function (keystoneList) {
  var self = this;

  self.exposedRoutes.push({
    method: 'delete',
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