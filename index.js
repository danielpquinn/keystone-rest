var _ = require('underscore'),
  keystone = require('keystone');

keystone.set('restRoutes', []);

module.exports = function (keystoneList, options) {


  // Handle errors
  var sendError = function (err, res) {
    res.status(400);
    res.json(err);
  };


  // Filter out omitted fields
  var removeOmitted = function (method, model) {
    var object, omitted;

    if (!options.omit) { return model; }
    if (!options.omit[method]) {
      return model;
    } else {
      omitted = options.omit[method];
    }

    // If model is a mongoose model instance, change it
    // into a plain object so it's properties can be
    // deleted.
    object = model.toObject ? model.toObject() : model;

    _.each(omitted, function (field) {
      if (object[field]) { delete object[field]; }
    });
    return object;
  };

  
  // Add get
  var addGet = function () {
    keystone.get('restRoutes').push({
      method: 'get',
      route: '/api/' + keystoneList.key.toLowerCase(),
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.find().populate(populate).exec(function (err, response) {
          if (err) { sendError(err, res); return; }
          response = _.map(response, function (item) {
            return removeOmitted('get', item);
          });
          res.json(removeOmitted('get', response));
        });
      }
    });
    keystone.get('restRoutes').push({
      method: 'get',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, response) {
          if (err) { sendError(err, res); return; }
          res.json(removeOmitted('get', response));
        });
      }
    });
  };
  
  // Add post
  var addPost = function () {
    keystone.get('restRoutes').push({
      method: 'post',
      route: '/api/' + keystoneList.key.toLowerCase(),
      handler: function (req, res) {
        var item = new keystoneList.model(),
          updateHandler = item.getUpdateHandler(req, res);

        updateHandler.process(removeOmitted('post', req.body), function (err, response) {
          if (err) { sendError(err, res); return; }
          res.json(removeOmitted('get', item));
        });
      }
    });
  };
  
  // Add put
  var addPut = function () {
    keystone.get('restRoutes').push({
      method: 'put',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        var populate = req.query.populate ? req.query.populate.split(',') : '';

        keystoneList.model.findById(req.params.id).exec(function (err, item) {
          if (err) { sendError(err, res); return; }
          var updateHandler = item.getUpdateHandler(req);

          updateHandler.process(removeOmitted('put', req.body), function (err, response) {
            if (err) { sendError(err, res); return; }

            // Not sure if it's possible to populate mongoose models after
            // save, so get the document again and populate it.
            keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, item) {
              if (err) { sendError(err, res); return; }
              res.json(removeOmitted('get', item));
            });
          });
        });
      }
    });
  };
  
  // Add delete
  var addDelete = function () {
    keystone.get('restRoutes').push({
      method: 'delete',
      route: '/api/' + keystoneList.key.toLowerCase() + '/:id',
      handler: function (req, res) {
        keystoneList.model.findByIdAndRemove(req.params.id, function (err, response) {
          if (err) { sendError(err, res); return; }
          res.json({
            message: 'Successfully deleted ' + keystoneList.key.toLowerCase()
          });
        });
      }
    });
  };

  if (options.methods.indexOf('get') > -1) { addGet(); }
  if (options.methods.indexOf('post') > -1) { addPost(); }
  if (options.methods.indexOf('put') > -1) { addPut(); }
  if (options.methods.indexOf('delete') > -1) { addDelete(); }
};