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
	
var abnf = fs.readFileSync('./odata4-mod.abnf', 'utf8');
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

app.listen(config.port)
console.log('server is listening on port ' + config.port);