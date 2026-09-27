# PetSearchResults

## Properties

| Name      | Type                       |
| --------- | -------------------------- |
| `results` | [Array&lt;Pet&gt;](Pet.md) |
| `total`   | number                     |
| `limit`   | number                     |
| `offset`  | number                     |
| `hasMore` | boolean                    |

## Example

```typescript
import type { PetSearchResults } from "";

// TODO: Update the object below with actual values
const example = {
  results: null,
  total: null,
  limit: null,
  offset: null,
  hasMore: null,
} satisfies PetSearchResults;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PetSearchResults;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
