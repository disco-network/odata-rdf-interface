var connect = require('connect');
var fs = require('fs')
var abnfTokenizer = require('../abnfjs/tokenizer');
var abnfParser = require('../abnfjs/parser');
var abnfInterpreter = require('../abnfjs/interpreter');
var queries = require('./queries');
var database = require('./database');
var ast2query = require('./ast2query');

var config = {
	port: 52999,
	path: '/',
};

var db = new database.Database();

function handleEntitySetRequest(lastPartOfUrl, req, res, next) {
	res.end('The EntitySet is called ' + firstPartOfUrl + '. After it, you wrote: ' + lastPartOfUrl);
}
	
var abnf = fs.readFileSync('./odata.abnf', 'utf8');
var tokens = abnfTokenizer.tokenize(abnf);
var grammar = abnfParser.parse(tokens);
var interpreter = new abnfInterpreter.Interpreter(grammar);

var app = connect();

app.use(config.path, function(req, res, next) {
	//TODO: check if something important changes when config.path != '/'
	var url = req.url.substr(1);
  
  var ast = interpreter.getCompleteMatch(interpreter.getPattern('odataRelativeUri'), url);
  
  query = ast2query.getQueryFromSyntaxTree(ast, db.getSchema());
	
	query.run(db);
	query.sendResults(res);
});

function getQueryFromSyntaxTree(ast) {
  if(ast.type !== 'alternative') throw new Error('expected ast.type === "alternative", got ' + ast.type);
  if(ast.value.type !== 'sequence' ) throw new Error('expected ast.value.type === "sequence", got ' + ast.value.type);
  
  var sequence = ast.value.sequence;
  if(sequence.length === 0) throw new Error('huh? unexpected empty sequence');
  switch(sequence[0].result.type) {
    case 'string':
      return new queries.UnsupportedQuery('$metadata not yet supported');
    case 'identifier':
      if(sequence[0].name !== 'resourcePath') throw new Error('resourcePath expected');
    default: throw new Error('something went wrong! position #32fkde');
  }
    var resourcePath = sequence[0].result;
}

function getQueryFromSelector(req, selector) {
	if(!selector)
		return new queries.UnsupportedQuery('parse error');
	else if(selector.expression instanceof tokenizer.MetadataSelectorExpr) {
		return new queries.UnsupportedQuery('metadata not yet supported');
	}
	else if(selector.expression instanceof tokenizer.EntitySelectorExpr) {
		entitySelector = selector.expression;
		if(entitySelector.expression instanceof tokenizer.SingleEntitySelectorExpr) {
			if(req.method == 'GET') return new queries.GetSingleEntityQuery(entitySelector.expression);
			else return new queries.UnsupportedQuery('unsupported method');
		}
		else if(entitySelector.expression instanceof tokenizer.SingleEntityPropertySelectorExpr) {
			if(req.method == 'GET') return new queries.GetSingleEntityPropertyQuery(entitySelector.expression);
			else return new queries.UnsupportedQuery('unsupported method');
		}
		else if(entitySelector.expression instanceof tokenizer.ManyEntitiesSelectorExpr) {
			if(req.method == 'GET') return new queries.GetManyEntitiesQuery(entitySelector.expression);
			else return new queries.UnsupportedQuery('unsupported method');
		}
		else {
			return new queries.UnsupportedQuery('this type of entity query is not supported');
		}
	}
	else {
		return new queries.UnsupportedQuery();
	}
}

app.listen(config.port)
console.log('server is listening on port ' + config.port);