var dbModule = require('../database');

module.exports = { name: "expand", tests: [
  {name: 'expand-graph-pattern', run: function(tools) {
    var db = new dbModule.Database();
    var res = db.getSingleEntity('Posts', 1);
    if(!res.result) throw new Error('huh?');
    var entities = [ res.result.entity ];

    var expanded = db.expandAndCloneEntities(db.schema.entityTypes.Post, entities, { Children: {} });

    tools.assertTrue(function() { return expanded[0].Children }, JSON.stringify(expanded));
    tools.assertTrue(function() { return expanded[0] != entities[0] }, JSON.stringify(expanded));
  } },
] }
