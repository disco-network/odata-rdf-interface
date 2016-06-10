var schema = new (require('../src/odata/schema').Schema)();

describe('schema', function() {
  it('should give me the entity type schema of Post', function() {
    expect(schema.getEntityType('Post')).toBeDefined();
  })
})
