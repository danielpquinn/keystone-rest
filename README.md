keystone-rest
=============

Expose keystone lists via REST api.


Usage
-----

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

    // Add routes to app
    _.each(keystoneRest.routes, function (route) {
      app[route.method](route.route, route.handler);
    });