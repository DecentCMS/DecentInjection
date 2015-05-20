## Globals

* **[mixin:scope](#scope)**
  Transforms an object into a scope.
  The role of a scope is to manage the lifecycle of required
  services.
  This mixin adds initialize, register, require, getServices,
  callService, and lifecycle methods that can be used to get
  service instances that are scoped to the object, live and die
  with it.
* **[construct(scope, ServiceClass, options)](#construct) &implies; `object`**
  Constructs an instance of the class passed in.
  If the class is static, the same object is always returned.
  Otherwise, a new instance is created on each call.
  Don't call this directly, it should only be internally used by
  scope methods.
* **[getSingleton(scope, service, index, options)](#getSingleton) &implies; `object`**
  Gets the instance for a singleton service.
  This should not be called, except by scope methods.
* **[initializeService(scope, ServiceClass)](#initializeService)**
  Initializes a service by calling its init method, and wiring up
  its static events.
* **[scope$initialize()](#scope$initialize) &implies; `object`**
  Initialize services for this scope. This is called automatically
  if the scope was built with a set of services.
  Otherwise, it must be called manually.
* **[scope$register(name, ServiceClass)](#scope$register) &implies; `object`**
  Registers a service into the scope's registry, making it available
  for require and getServices.
  This will initialize the service if the scope is already
  initialized.
* **[scope$require(service, options)](#scope$require) &implies; `object`**
  Returns an instance of a service implementing the named contract
  passed as a parameter.
  If more than one service exists for that contract, one instance
  that has dependencies on any other service for that contract is
  returned.
  Do not count on any particular service being returned if that is
  the case among the ones that have the most dependencies.
  A new instance is returned every time the function is called,
  unless the service is static, or if it is a scope singleton.
* **[scope$getServices(service, options)](#scope$getServices) &implies; `Array`**
  Returns a list of service instances that are implementing the
  named contract passed as a parameter.
  The services are returned in order of dependency: if service A has
  a dependency on service B, B is guaranteed to appear earlier in
  the list.
  New instances are returned every time the function is called.
* **[scope$callService(service, method, options, done)](#scope$callService) &implies; `object`**
  Calls a method on each registered service of the specified name,
  asynchronously.
* **[scope$lifecycle(service, method)](#scope$lifecycle) &implies; `function`**
  Creates a lifecycle function that calls into all the service
  methods specified in an alternated list of service names, and
  method names as parameters.
  It is possible to replace service/method pairs with a function
  (options, done) that will be called as part of the lifecycle
  execution.
* **[scope$makeSubScope(name, subScope)](#scope$makeSubScope) &implies; `object`**
  Transforms an object into a sub-scope of this scope.

<a name=\"scope\"></a>
## mixin: scope

Transforms an object into a scope.
The role of a scope is to manage the lifecycle of required services.
This mixin adds initialize, register, require, getServices,
callService, and lifecycle methods that can be used to get service
instances that are scoped to the object, live and die with it.

| Param         | Type     | Description                           |
| ------------- | -------- | ------------------------------------- |
| name          | `string` | The name of the scope.                |
| objectToScope | `object` | The object that must be made a scope. |
| services      | `object` | A map of the services to be made available from require. |
| [parentScope] | `object` | An optional parent scope that may have valid instances of services to hand down. |

<a name=\"construct\"></a>
## construct(scope, ServiceClass, options) &implies; `object`

Constructs an instance of the class passed in.
If the class is static, the same object is always returned.
Otherwise, a new instance is created on each call.
Don't call this directly, it should only be internally used by scope
methods.

**Returns**: `object` - An instance of the service, or null if it
wasn't found.  

| Param        | Type       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| scope        | `object`   | The scope.                           |
| ServiceClass | `function` | The class to instantiate. This constructor must always take a scope as its first argument. It can also take an optional 'options' argument, unless it's a shell singleton. |
| options      | `object`   | Options to pass into the service's constructor. |

<a name=\"getSingleton\"></a>
## getSingleton(scope, service, index, options) &implies; `object`

Gets the instance for a singleton service.
This should not be called, except by scope methods.

**Returns**: `object` - The singleton instance.  

| Param   | Type     | Description                                 |
| ------- | -------- | ------------------------------------------- |
| scope   | `object` | The scoped object.                          |
| service | `string` | The service name.                           |
| index   | `number` | The index at which the service is to be cached. |
| options | `object` | The options to pass into the service constructor. |

<a name=\"initializeService\"></a>
## initializeService(scope, ServiceClass)

Initializes a service by calling its init method, and wiring up
its static events.

| Param        | Type       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| scope        | `object`   | The scope.                           |
| ServiceClass | `function` | The service class to initialize.     |

<a name=\"scope$initialize\"></a>
## scope$initialize() &implies; `object`

Initialize services for this scope. This is called automatically if
the scope was built with a set of services. Otherwise, it must be
called manually.

**Returns**: `object` - The scope.  

<a name=\"scope$register\"></a>
## scope$register(name, ServiceClass) &implies; `object`

Registers a service into the scope's registry, making it available
for require and getServices. This will initialize the service if the
scope is already initialized.

**Returns**: `object` - The scope.  

| Param        | Type       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| name         | `string`   | The service name implemented by ServiceClass. |
| ServiceClass | `function` | The service constructor, or the static service object to register. |

<a name=\"scope$require\"></a>
## scope$require(service, options) &implies; `object`

Returns an instance of a service implementing the named contract
passed as a parameter.
If more than one service exists for that contract, one instance that
has dependencies on any other service for that contract is returned.
Do not count on any particular service being returned if that is the
case among the ones that have the most dependencies.
A new instance is returned every time the function is called, unless
the service is static, or if it is a scope singleton.

**Returns**: `object` - An instance of the service, or null if it
wasn't found.  

| Param   | Type     | Description                                  |
| ------- | -------- | -------------------------------------------- |
| service | `String` | The name of the contract for which a service instance is required. |
| options | `object` | Options to pass into the service's constructor |

<a name=\"scope$getServices\"></a>
## scope$getServices(service, options) &implies; `Array`

Returns a list of service instances that are implementing the named
contract passed as a parameter.
The services are returned in order of dependency: if service A has a
dependency on service B, B is guaranteed to appear earlier in the
list.
New instances are returned every time the function is called.

**Returns**: `Array` - An array of instances of the service.  

| Param   | Type     | Description                                  |
| ------- | -------- | -------------------------------------------- |
| service | `String` | The name of the contract for which service instances are required. |
| options | `object` | Options to pass into the services' constructors. |

<a name=\"scope$callService\"></a>
## scope$callService(service, method, options, done) &implies; `object`

Calls a method on each registered service of the specified name,
asynchronously.

**Returns**: `object` - The scope.  

| Param   | Type       | Description                               |
| ------- | ---------- | ----------------------------------------- |
| service | `string`   | The name of the service.                  |
| method  | `string`   | The name of the method.                   |
| options | `object`   | The parameter to pass to the method.      |
| done    | `function` | The function to call when all service methods have returned. |

<a name=\"scope$lifecycle\"></a>
## scope$lifecycle(service, method) &implies; `function`

Creates a lifecycle function that calls into all the service methods
specified in an alternated list of service names, and method names
as parameters.
It is possible to replace service/method pairs with a
`function(options, done)` that will be called as part of the
lifecycle execution.

For example:

```js
  scope.lifecycle(
    'service1', 'methodA',
    'service2', 'methodB',
    function(options, done) {...},
    'service3', 'methodC'
  )
```

returns a function that will call methodA on all instances
of service1, then methodB on all instances of service2,
then the function, then methodC on all instances of service3.

**Returns**: `function` - A function that takes an options object
and a callback as a parameter.  

| Param   | Type     | Description       |
| ------- | -------- | ----------------- |
| service | `string` | The service name. |
| method  | `string` | The method name.  |

<a name=\"scope$makeSubScope\"></a>
## scope$makeSubScope(name, subScope) &implies; `object`

Transforms an object into a sub-scope of this scope.

**Returns**: `object` - The newly scoped object.  

| Param    | Type     | Description                           |
| -------- | -------- | ------------------------------------- |
| name     | `string` | The name of the scope.                |
| subScope | `object` | The object that must be made a scope. |

