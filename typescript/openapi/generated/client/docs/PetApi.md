# PetApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addPet**](PetApi.md#addpet) | **POST** /pet |  |
| [**deletePet**](PetApi.md#deletepet) | **DELETE** /pet/{petId} |  |
| [**findPetsByStatus**](PetApi.md#findpetsbystatus) | **GET** /pet/findByStatus |  |
| [**findPetsByTags**](PetApi.md#findpetsbytags) | **GET** /pet/findByTags |  |
| [**getPetById**](PetApi.md#getpetbyid) | **GET** /pet/{petId} |  |
| [**searchPets**](PetApi.md#searchpets) | **POST** /pet/search |  |
| [**updatePet**](PetApi.md#updatepet) | **PUT** /pet |  |
| [**updatePetWithForm**](PetApi.md#updatepetwithform) | **POST** /pet/{petId} |  |
| [**uploadPetImage**](PetApi.md#uploadpetimage) | **POST** /pet/{petId}/uploadImage |  |



## addPet

> Pet addPet(pet)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { AddPetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // Pet
    pet: ...,
  } satisfies AddPetRequest;

  try {
    const data = await api.addPet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pet** | [Pet](Pet.md) |  | |

### Return type

[**Pet**](Pet.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePet

> object deletePet(petId)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { DeletePetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // number
    petId: 56,
  } satisfies DeletePetRequest;

  try {
    const data = await api.deletePet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **petId** | `number` |  | [Defaults to `undefined`] |

### Return type

**object**

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## findPetsByStatus

> Array&lt;Pet&gt; findPetsByStatus(status)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { FindPetsByStatusRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // PetStatus (optional)
    status: ...,
  } satisfies FindPetsByStatusRequest;

  try {
    const data = await api.findPetsByStatus(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **status** | `PetStatus` |  | [Optional] [Defaults to `undefined`] [Enum: available, pending, sold] |

### Return type

[**Array&lt;Pet&gt;**](Pet.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## findPetsByTags

> Array&lt;Pet&gt; findPetsByTags(tags)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { FindPetsByTagsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // Array<string> (optional)
    tags: ...,
  } satisfies FindPetsByTagsRequest;

  try {
    const data = await api.findPetsByTags(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tags** | `Array<string>` |  | [Optional] |

### Return type

[**Array&lt;Pet&gt;**](Pet.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getPetById

> Pet getPetById(petId)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { GetPetByIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // number
    petId: 56,
  } satisfies GetPetByIdRequest;

  try {
    const data = await api.getPetById(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **petId** | `number` |  | [Defaults to `undefined`] |

### Return type

[**Pet**](Pet.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## searchPets

> PetSearchResults searchPets(petSearchCriteria, limit, offset)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { SearchPetsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // PetSearchCriteria
    petSearchCriteria: ...,
    // number (optional)
    limit: 56,
    // number (optional)
    offset: 56,
  } satisfies SearchPetsRequest;

  try {
    const data = await api.searchPets(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **petSearchCriteria** | [PetSearchCriteria](PetSearchCriteria.md) |  | |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **offset** | `number` |  | [Optional] [Defaults to `0`] |

### Return type

[**PetSearchResults**](PetSearchResults.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePet

> Pet updatePet(pet)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { UpdatePetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // Pet
    pet: ...,
  } satisfies UpdatePetRequest;

  try {
    const data = await api.updatePet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **pet** | [Pet](Pet.md) |  | |

### Return type

[**Pet**](Pet.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePetWithForm

> object updatePetWithForm(petId, name, status)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { UpdatePetWithFormRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // number
    petId: 56,
    // string (optional)
    name: name_example,
    // PetStatus (optional)
    status: ...,
  } satisfies UpdatePetWithFormRequest;

  try {
    const data = await api.updatePetWithForm(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **petId** | `number` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `PetStatus` |  | [Optional] [Defaults to `undefined`] [Enum: available, pending, sold] |

### Return type

**object**

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadPetImage

> ModelApiResponse uploadPetImage(petId, additionalMetadata, body)



### Example

```ts
import {
  Configuration,
  PetApi,
} from '';
import type { UploadPetImageRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure API key authorization: api_key
    apiKey: "YOUR API KEY",
  });
  const api = new PetApi(config);

  const body = {
    // number
    petId: 56,
    // string (optional)
    additionalMetadata: additionalMetadata_example,
    // Blob (optional)
    body: BINARY_DATA_HERE,
  } satisfies UploadPetImageRequest;

  try {
    const data = await api.uploadPetImage(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **petId** | `number` |  | [Defaults to `undefined`] |
| **additionalMetadata** | `string` |  | [Optional] [Defaults to `undefined`] |
| **body** | `Blob` |  | [Optional] |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[api_key](../README.md#api_key)

### HTTP request headers

- **Content-Type**: `application/octet-stream`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Ok |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
