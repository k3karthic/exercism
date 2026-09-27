# PetSearchCriteria

## Properties

| Name        | Type                                   |
| ----------- | -------------------------------------- |
| `name`      | string                                 |
| `status`    | [Array&lt;PetStatus&gt;](PetStatus.md) |
| `tags`      | Array&lt;string&gt;                    |
| `sortBy`    | string                                 |
| `sortOrder` | string                                 |

## Example

```typescript
import type { PetSearchCriteria } from "";

// TODO: Update the object below with actual values
const example = {
  name: null,
  status: null,
  tags: null,
  sortBy: null,
  sortOrder: null,
} satisfies PetSearchCriteria;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PetSearchCriteria;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
