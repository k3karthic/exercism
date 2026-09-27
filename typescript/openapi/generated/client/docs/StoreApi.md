# StoreApi

All URIs are relative to _http://localhost_

| Method                                       | HTTP request                      | Description |
| -------------------------------------------- | --------------------------------- | ----------- |
| [**deleteOrder**](StoreApi.md#deleteorder)   | **DELETE** /store/order/{orderId} |             |
| [**getInventory**](StoreApi.md#getinventory) | **GET** /store/inventory          |             |
| [**getOrderById**](StoreApi.md#getorderbyid) | **GET** /store/order/{orderId}    |             |
| [**placeOrder**](StoreApi.md#placeorder)     | **POST** /store/order             |             |
| [**searchOrders**](StoreApi.md#searchorders) | **POST** /store/order/search      |             |

## deleteOrder

> object deleteOrder(orderId)

### Example

```ts
import { Configuration, StoreApi } from "";
import type { DeleteOrderRequest } from "";

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new StoreApi(config);

  const body = {
    // number
    orderId: 56,
  } satisfies DeleteOrderRequest;

  try {
    const data = await api.deleteOrder(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name        | Type     | Description | Notes                     |
| ----------- | -------- | ----------- | ------------------------- |
| **orderId** | `number` |             | [Defaults to `undefined`] |

### Return type

**object**

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Ok          | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getInventory

> { [key: string]: number; } getInventory()

### Example

```ts
import { Configuration, StoreApi } from "";
import type { GetInventoryRequest } from "";

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new StoreApi(config);

  try {
    const data = await api.getInventory();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**{ [key: string]: number; }**

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Ok          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## getOrderById

> Order getOrderById(orderId)

### Example

```ts
import { Configuration, StoreApi } from "";
import type { GetOrderByIdRequest } from "";

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new StoreApi(config);

  const body = {
    // number
    orderId: 56,
  } satisfies GetOrderByIdRequest;

  try {
    const data = await api.getOrderById(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name        | Type     | Description | Notes                     |
| ----------- | -------- | ----------- | ------------------------- |
| **orderId** | `number` |             | [Defaults to `undefined`] |

### Return type

[**Order**](Order.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Ok          | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## placeOrder

> Order placeOrder(order)

### Example

```ts
import {
  Configuration,
  StoreApi,
} from '';
import type { PlaceOrderRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new StoreApi(config);

  const body = {
    // Order
    order: ...,
  } satisfies PlaceOrderRequest;

  try {
    const data = await api.placeOrder(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name      | Type              | Description | Notes |
| --------- | ----------------- | ----------- | ----- |
| **order** | [Order](Order.md) |             |       |

### Return type

[**Order**](Order.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Ok          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## searchOrders

> OrderSearchResults searchOrders(orderSearchCriteria, page, pageSize)

### Example

```ts
import {
  Configuration,
  StoreApi,
} from '';
import type { SearchOrdersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new StoreApi(config);

  const body = {
    // OrderSearchCriteria
    orderSearchCriteria: ...,
    // number (optional)
    page: 56,
    // number (optional)
    pageSize: 56,
  } satisfies SearchOrdersRequest;

  try {
    const data = await api.searchOrders(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                    | Type                                          | Description | Notes                         |
| ----------------------- | --------------------------------------------- | ----------- | ----------------------------- |
| **orderSearchCriteria** | [OrderSearchCriteria](OrderSearchCriteria.md) |             |                               |
| **page**                | `number`                                      |             | [Optional] [Defaults to `1`]  |
| **pageSize**            | `number`                                      |             | [Optional] [Defaults to `20`] |

### Return type

[**OrderSearchResults**](OrderSearchResults.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Ok          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
