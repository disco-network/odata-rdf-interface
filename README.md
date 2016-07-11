# odata-rdf-interface [![Build status](https://travis-ci.org/disco-network/odata-rdf-interface.svg)](https://travis-ci.org/disco-network/odata-rdf-interface)
This project is supposed to become a Node.js-based OData endpoint working on top of an RDF store.

# dependencies
This project depends on various packages.
 * the popular "connect" package,
 * [abnfjs](https://github.com/datokrat/abnfjs), a GitHub project parsing and interpreting ABNF specifications, and 
 * [rdfstore-js](https://github.com/disco-network/rdfstore-js). 

For development purposes you need several other packages, especially gulp, see package.json.
 
To install them in your working directory, please use NPM:

    $ npm install

# how to use
To start the server, run:

    $ node dist/src/server.js

... or - if you already installed gulp -

    $ gulp server

Possible queries are at the moment:

 * /Posts
 * /Posts?$expand=Content

# development
To develop this project, please use NPM to install further development dependencies, especially gulp.

To compile TypeScript, use the following command:

    $ gulp build

To compile all and run the tests (based on jasmine), run:

    $ gulp specs

# what's missing?

 * $filter queries
 * querying of optional properties
 * navigation properties with many values
 * $batch queries
 * POST, UPDATE etc.