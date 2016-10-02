Software engineers always make implicit assumptions about the architecture and about the future.
Maybe it helps to be conscious about them:

## /odata/schema.ts

* The properties of an Entity have stringifiable names by which they can be distinguished.
* All EntityTypes have a unique stringifiable name.
* EntityTypes start with "Edm." if and only if it's an elementary type.
