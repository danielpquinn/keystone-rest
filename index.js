var keystone = require('keystone');

keystone.set('restRoutes', []);

module.exports = function (keystoneList, methods) {

  // Handle errors
  var sendError = function (err, res) {
    res.status(400);
    res.json(err);
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
          res.json(response);
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
          res.json(response);
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

        updateHandler.process(req.body, function (err, response) {
          if (err) { sendError(err, res); return; }
          res.json(item);
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

          updateHandler.process(req.body, function (err, response) {
            if (err) { sendError(err, res); return; }

            // Not sure if it's possible to populate mongoose models after
            // save, so get the document again and populate it.
            keystoneList.model.findById(req.params.id).populate(populate).exec(function (err, item) {
              if (err) { sendError(err, res); return; }
              res.json(item);
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

  if (methods.indexOf('get') > -1) { addGet(); }
  if (methods.indexOf('post') > -1) { addPost(); }
  if (methods.indexOf('put') > -1) { addPut(); }
  if (methods.indexOf('delete') > -1) { addDelete(); }
};