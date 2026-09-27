# OrderSearchCriteria

## Properties

| Name            | Type                                       |
| --------------- | ------------------------------------------ |
| `orderId`       | number                                     |
| `petId`         | number                                     |
| `status`        | [Array&lt;OrderStatus&gt;](OrderStatus.md) |
| `complete`      | boolean                                    |
| `dateRange`     | [DateRange](DateRange.md)                  |
| `quantityRange` | [QuantityRange](QuantityRange.md)          |
| `sortBy`        | string                                     |
| `sortOrder`     | string                                     |

## Example

```typescript
import type { OrderSearchCriteria } from "";

// TODO: Update the object below with actual values
const example = {
  orderId: null,
  petId: null,
  status: null,
  complete: null,
  dateRange: null,
  quantityRange: null,
  sortBy: null,
  sortOrder: null,
} satisfies OrderSearchCriteria;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as OrderSearchCriteria;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
