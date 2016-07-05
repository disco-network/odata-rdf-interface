import SchemaModule = require('../src/odata/schema');
let schema = new SchemaModule.Schema();

describe('schema', function() {
  it('should give me the entity type schema of Post', function() {
    expect(schema.getEntityType('Post')).toBeDefined();
  })
  it('should assign "Post.Content" the quantity one', function() {
    expect(schema.getEntityType('Post').getProperty('Content').isQuantityOne()).toEqual(true);
  })
})
