# odata-rdf-interface [![Build status](https://travis-ci.org/disco-network/odata-rdf-interface.svg)](https://travis-ci.org/disco-network/odata-rdf-interface)
This project is supposed to become a Node.js-based OData endpoint working on top of an RDF store.

# dependencies
This project depends on a copy of [abnfjs](https://github.com/datokrat/abnfjs) located at "./abnfjs", my GitHub project parsing and interpreting ABNF specifications. Apart of this, the dependencies are:
 * the popular "connect" package
 * [rdfstore-js](https://github.com/disco-network/rdfstore-js).

# examples
At the moment, the database content is hardcoded in ./database.js, so you can test the features simply by running the server:

    $ node src/server.js

Possible queries are:

 * /Posts
 * /Posts?$expand=Content
