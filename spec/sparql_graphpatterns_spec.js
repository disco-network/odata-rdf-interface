var schema = new (require('../schema').Schema)();
var queries = require('../queries');
var squeries = require('../queries_sparql');
var mhelper = require('./helpers/sparql_mappings');
var gphelper = require('./helpers/sparql_graphpatterns');

describe('general sparql graph patterns', function() {
  it('should give me its triples', function() {
    var gp = new squeries.GraphPattern();

    expect(gp.getTriples()).toEqual([]);
  })
  it('should integrate other patterns', function() {
    var gp = new squeries.GraphPattern();
    var innerGp = new squeries.GraphPattern();

    innerGp.triples = [['a','b','c']];
    gp.integratePatterns([innerGp]);

    expect(gp.getTriples()).toEqual(innerGp.getTriples());
  })
  it('should integrate optional subpatterns of other patterns', function() {
    var gp = new squeries.GraphPattern();
    var innerGp = new squeries.GraphPattern();

    innerGp.optionalPatterns = [ new squeries.GraphPattern([ 'a','b','c' ]) ];
    gp.integratePatterns([innerGp]);

    expect(gp.getOptionalPatterns()).toEqual(innerGp.getOptionalPatterns());
  })
  it('should integrate patterns as optional', function() {
    var gp = new squeries.GraphPattern();
    var innerGp = new squeries.GraphPattern();

    innerGp.triples = [['a','b','c']];
    gp.integratePatternsAsOptional([innerGp]);

    expect(gp.getOptionalPatterns()[0]).toEqual(innerGp);
  })
})

describe('direct property graph patterns', function() {
  it('should store the direct properties in the mapping', function() {
    var mapping = mhelper.createStructuredMapping();
    var gp = new squeries.DirectPropertiesGraphPattern(schema.getEntityType('Post'), mapping);

    expect(mapping.elementaryPropertyExists('Id')).toEqual(true);
    expect(mapping.elementaryPropertyExists('ParentId')).toEqual(true);
    expect(mapping.elementaryPropertyExists('ContentId')).toEqual(true);
    expect(mapping.elementaryPropertyExists('Parent')).toEqual(false);
    expect(mapping.elementaryPropertyExists('Content')).toEqual(false);
  })
  it('should create the triples corresponding to the direct properties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.DirectPropertiesGraphPattern(schema.getEntityType('Post'), mapping);

    expect(gp.getTriples()).toContain([ '?post', 'disco:id', mapping.getElementaryPropertyVariable('Id') ]);
  })
  it('should create the triples corresponding to the mirrored direct properties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.DirectPropertiesGraphPattern(schema.getEntityType('Post'), mapping);

    expect(gp.getTriples()).toContain([ '?post', 'disco:content', mapping.getComplexProperty('Content').getVariable() ]);
    expect(gp.getTriples()).toContain([ mapping.getComplexProperty('Content').getVariable(), 'disco:id', mapping.getElementaryPropertyVariable('ContentId') ]);
  })
  it('should create optional triples', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.DirectPropertiesGraphPattern(schema.getEntityType('Post'), mapping);

    expect(gp.getOptionalPatterns()[0].getTriples()).toContain([ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ]);
  })
})

describe('expanded property graph patterns', function() {
  it('should create the triples corresponding to the property and its direct subproperties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.ExpandedPropertyGraphPattern(schema.getEntityType('Post'), 'Content', mapping);

    expect(gp.getTriples()).toContain([ '?post', 'disco:content', mapping.getComplexProperty('Content').getVariable() ]);
    expect(gp.getTriples()).toContain([ mapping.getComplexProperty('Content').getVariable(), 'disco:id', mapping.getComplexProperty('Content').getElementaryPropertyVariable('Id') ]);
  })
  it('should create optional triples', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.ExpandedPropertyGraphPattern(schema.getEntityType('Post'), 'Parent', mapping);

    expect(gp.getOptionalPatterns()[0].getTriples()).toContain([ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ]);
  })
})

describe('expand tree graph patterns', function() {
  it('should expand the first depth level', function() {
    var expandTree = { Content: {} };
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.ExpandTreeGraphPattern(schema.getEntityType('Post'), expandTree, mapping);

    expect(mapping.getComplexProperty('Content').elementaryPropertyExists('Id')).toEqual(true);
    expect(gp.getTriples()).toContain([ '?post', 'disco:content', mapping.getComplexProperty('Content').getVariable() ]);
    expect(gp.getTriples()).toContain([ mapping.getComplexProperty('Content').getVariable(), 'disco:id', mapping.getComplexProperty('Content').getElementaryPropertyVariable('Id') ]);
  })
  it('should expand the second depth level', function() {
    var expandTree = { Content: { Content: {} } };
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.ExpandTreeGraphPattern(schema.getEntityType('Post'), expandTree, mapping);

    expect(mapping.getComplexProperty('Content').getComplexProperty('Content').elementaryPropertyExists('Id')).toEqual(true);
  })
  it('should expand the optional properties of the first depth level', function() {
    var expandTree = { Parent: {} };
    var mapping = mhelper.createStructuredMapping('?post');
    var gp = new squeries.ExpandTreeGraphPattern(schema.getEntityType('Post'), expandTree, mapping);

    expect(mapping.getComplexProperty('Parent').elementaryPropertyExists('Id')).toEqual(true);
    expect(gp.getOptionalPatterns().length).toBeGreaterThan(1);
    expect(gp.getOptionalPatterns()[1].getTriples()).toContain(
      [ mapping.getComplexProperty('Parent').getVariable(), 'disco:id', mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id') ])
  })
})
