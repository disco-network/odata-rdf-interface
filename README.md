# odata-rdf-interface [![Build status](https://travis-ci.org/disco-network/odata-rdf-interface.svg)](https://travis-ci.org/disco-network/odata-rdf-interface)
This project is supposed to become a Node.js-based OData engine working on top of an RDF store.

# dependencies
This project depends on various packages.
 * the popular "connect" package,
 * [abnfjs](https://github.com/datokrat/abnfjs), a GitHub project parsing and interpreting ABNF specifications, and 
 * [rdfstore-js](https://github.com/disco-network/rdfstore-js). 

For development purposes you need several other packages, especially gulp, see package.json.
 
To install them in your working directory, please use NPM:

    $ npm install

# how to use
This package does not provide you with an HTTP server and that's why you can't simply start it.

On the other hand, it enables you to combine it with every HTTP server you want! We still don't have docs
but if you want 

GET queries that are currently supported:

 * /Posts
 * /Posts?$expand=Content
 * /Posts?$expand=Parent   //Parent is an optional navigation property
 * /Posts?$expand=Children  //Children is the inverse property of Parent and is an array
 * /Posts?$expand=Children/Parent
 * /Posts?$filter=Id eq 1
 * /Posts?$filter=Content/Id eq 1
 * /Posts?$filter=(Parent/Id eq 1) and (Content/Id eq 2)
 * /Posts?$filter=Children/any(child: child/Id eq 2)
 * /Posts?$filter=Children/any(c1: c1/Children/any(c2: 1 eq 1))

POST queries *should* be supported (experimental because of the lack of deeper test cases).

# development
To develop this project, please use NPM to install dependencies, especially gulp.

To build the NPM package into /build/, use the following command:

    $ gulp build

To compile and run the tests (based on mocha/chai/sinon), run:

    $ gulp specs

# what's missing?

 * $metadata
 * UUID generation support
 * PUT / PATCH / DELETE etc.
 * $batch queries
 * specification conformity... we currently only support some cherry-picked essential features.