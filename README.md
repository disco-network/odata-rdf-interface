# nodejs-odata-server
This project is supposed to become kind of a lightweight, customizable odata server powered by Node.js.

# dependencies
This project depends on a copy of [abnfjs](https://github.com/datokrat/abnfjs) located at "../abnfjs", my GitHub project parsing and interpreting ABNF specifications. Apart of this, the only dependencies are the popular "connect" package and the lightweight database "diskdb" for database connection testing purposes (see package.json).

# examples
At the moment, the database content is hardcoded in ./database.js, so you can test the features simply by running the server:

    $ node server.js

Possible queries are:

 * /Posts
 * /Posts(1)
 * /Children  (this is a navigation property which contains all entities whose Parent is the base entity)
 * /Parent
 * /Posts?$filter=Id eq 1 and 1 eq 2
 * /Posts?$filter=Children/$count eq 1
 * /Posts?$expand=Parent,Children,Parent/Children
 * /Posts?$filter=Id eq 1&$expand=Children
