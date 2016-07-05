# odata-rdf-interface [![Build status](https://travis-ci.org/disco-network/odata-rdf-interface.svg)](https://travis-ci.org/disco-network/odata-rdf-interface)
This project is supposed to become a Node.js-based OData endpoint working on top of an RDF store.

# dependencies
This project depends on various packages.
 * the popular "connect" package,
 * [abnfjs](https://github.com/datokrat/abnfjs), a GitHub project parsing and interpreting ABNF specifications, and 
 * [disco-network/rdfstore-js](https://github.com/disco-network/rdfstore-js) located at "./rdfstore-js". To install them in your working directory, run:

To install all the packages, please use NPM:
    $ npm install

# examples
At the moment, the database content is hardcoded in ./database.js, so you can test the features simply by running the server:

    $ node src/server.js

Possible queries are:

 * /Posts
 * /Posts?$expand=Content

#development
To develop this project, please use NPM to install further development dependencies, especially gulp.

To compile TypeScript, use the following command:

    $ gulp build

To compile all and run the tests (based on jasmine), run:

    $ gulp specs

# what's missing?

 * $filter queries
 * navigation properties with many values
 * $batch queries
