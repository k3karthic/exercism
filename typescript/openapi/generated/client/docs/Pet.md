
# Pet


## Properties

Name | Type
------------ | -------------
`id` | number
`name` | string
`photoUrls` | Array&lt;string&gt;
`category` | [Category](Category.md)
`tags` | [Array&lt;Tag&gt;](Tag.md)
`status` | [PetStatus](PetStatus.md)

## Example

```typescript
import type { Pet } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "photoUrls": null,
  "category": null,
  "tags": null,
  "status": null,
} satisfies Pet

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Pet
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
