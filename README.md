keystone-rest
=============

Expose keystone lists via REST api.


Documentation
-------------
[http://danielpquinn.github.io/keystone-rest](http://danielpquinn.github.io/keystone-rest)


Usage
-----

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


    // Register User
    User.register();


    // Expose User model via REST api
    keystoneRest.addRoutes(User, 'get post put delete');

    User.register();

    // Add routes to app
    keystoneRest.registerRoutes(app);