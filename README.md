keystone-rest
=============

Expose keystone lists via REST api.


Documentation
-------------
[http://danielpquinn.github.io/keystone-rest](http://danielpquinn.github.io/keystone-rest/KeystoneRest.html)


Usage
-----

    var keystone = require('keystone'),
      Types = keystone.Field.Types,
      keystoneRest = require('keystone-rest');

    var User = new keystone.List('User');

    User.add({
      name: { type: Types.Name, required: true, index: true },
      password: { type: Types.Password, initial: true, required: false, restSelected: false },
      token: { type: String, restEditable: false }
    });

    User.register();

    // Add user api endpoints
    keystoneRest.addRoutes(User, 'list show create update delete', {
      list: [listMiddleware],
      show: [showMiddleware],
      create: [createMiddleware],
      update: [updateMiddleware],
      delete: [deleteMiddleware]
    }, 'posts');

    // Make sure keystone is initialized and started before
    // calling registerRoutes
    keystone.init(config);
    keystone.start();

    // Add routes to app
    keystoneRest.registerRoutes(keystone.app);
