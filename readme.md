Decent Injection provides a scope object that manages services that
can then be injected into other services using a "require"-style
service locator API, constructor injection, or property injection.
It has no external runtime dependency.

Getting started
---------------

### Installing the package

To install the package, do a `npm install decent-injection --save`.

### Creating a scope

Scope is a mix-in that can be applied to an existing object.
For example, it is possible to "scope-ify" a request from an Express
middleware:

```js
app.get('/foo/bar', function (req, res, next) {
  var scope = require('decent-injection');
  scope('request', req);
  // ... Do stuff
  next();
}
```

The first parameter is the name of the scope, that services can refer
to when specifying their scope, as we'll see below.
The second parameter is the object that must be made a scope.

Scope can take an additional parameter that is a list of services,
and another one that is a parent scope:

```js
scope('request', req, shell.services, shell);
```

Those two additional parameters are rarely used however, because
there is a specific helper method to create a sub-scope.
If `shell` is itself a scope, the request object can be made a child
scope as follows:

```js
shell.makeSubScope('request', req);
```

This initializes `req` with its parent's services, and is equivalent
to the previous sample.

### Writing a service

The simplest way to build a service is to build a class that takes
the scope as its constructor parameter.
That class is what you export from the file.

```js
function MyService(scope) {
  this.scope = scope;
}
module.exports = MyService;
```

The service should also declare to what scope its lifetime should be
bound:

```js
MyService.scope = 'request';
```

Services can also declare that they should be "scope singletons",
which means that there should be only one instance of them for their
scope.
If a service is not declared as a scope singleton, it is transient:
its scope will still be what it asked for in its declaration, but it
will be instantiated anew every time it is required.

```js
MyService.isScopeSingleton = true;
```

#### Static services

While most services are built as classes, some services can be better
built as completely static API.
This is done by either setting a `isStatic` flag to true on the class,
or by not declaring a class at all, but instead building the service
as a plain JavaScript object.

```js
var StaticService = {
  staticMethod: function staticMethod(scope, options, callback) {
    // Do some async task
  }
};
module.exports = StaticService;
```

Methods of such a static service should in general get all the data
and objects they need from their parameters, so that the object
itself remains stateless.
Mixing scopes and stateful static objects is a recipe for hard to
find bugs, where state can easily leak between scopes.
Static methods can still get dependencies by requiring them from a
scope passed as a parameter.

### Registering services

Services can be registered at scoping time, or later.
To register at scoping time, pass the list of services as an object
that has the service names as property keys, and an array of service
constructors as the value:

```js
scope('shell', shell, {
  cache: [FirstLevelCache, SecondLevelCache],
  localization: [PoLocalizationProvider]
});
```

Services can also be added after the scope has been created, using
the `register` method:

```js
shell.register('localization', DbLocalizationProvider);
```

The name passed as the first parameter is what services would require
from the scope.

### Requiring services

Services can require other services in three different ways: using
`scope.require`, using constructor injection, or using property
injection.

#### Using `scope.require`

In order to use this way of obtaining service instances, you need a
reference to the scope.
This can have been provided as a constructor parameter, or can have
been passed into the method being run.

Obtaining an instance of a service is then as simple as calling
require:

```js
scope.require('cache');
```

Some services may require options, that can be passed as a second
parameter, but this should be rare, and limited to transient
services.

This pattern has the advantages that the API is very similar to the
normal pattern of requiring dependencies in Node, and that injection
is done close to usage.

One disadvantage is that it's more difficult to discover all the
dependencies of a service.

Another downside is that the dependency on the framework is obvious.
Typically, it's quite visible that a service that uses `require`
has been written with Decent Injection, even if it could in theory
be used elsewhere.
That's not a huge problem if the service has been built as part of a
coherent set to build an application.

For example, DecentCMS uses `require`, because most services in a CMS
are only going to be useful in the context of the CMS.
In the cases where a service is so generic that it would make sense
to use it outside the CMS, it should be written as a generic Node.js
library, and then used as a regular npm dependency in a DecentCMS
module, or it may want to favor constructor injection.


#### Constructor injection

The dependencies of a service can be injected as constructor
parameters.
In order for the scope to know what services to inject, they must be
specified in order, on an `inject` property of the service class:

```js
function SearchEngine(indexProvider, naturalLanguageParser) {
  this.indexProvider = indexProvider;
  this.naturalLanguageParser = naturalLanguageParser;
}
SearchEngine.inject = ['index-provider', 'natural-language-parser'];
```

#### Property injection

Dependencies can be injected as properties, on both class-based, and
static services, by specifying them on an `injectProperties` object:

```js
var SearchEngine = {
  search: function search(query) {
    var parsedQuery = SearchEngine.naturalLanguageParser.parse(query);
    var results = SearchEngine.indexProvider.find(parsedQuery);
    return results;
  },
  injectProperties: {
    indexProvider: 'index-provider',
    naturalLanguageParser: 'natural-language-parser'
  }
};
```

The scope will require the value of each property of the
`injectProperties` object, and copy it to a property of the service
that has the same name as the `injectProperty` object's property.

#### Using multiple implementations of a service

In many cases, there will be more than one implementation of a
service active under the same scope, and you'll want to use all of
them.

An example of that is `shape-handler` services in DecentCMS: there
are many implementations, that each know how to handle a specific
type or category of shape.
Shapes in DecentCMS are data objects that are processed in order to
be rendered.
You can think of shapes as bits of view models.
The system broadcasts to all shape handlers that a shape needs to be
handled, and each handler may have something to do, or pass.
This is a scenario similar to that of an event bus (and in fact,
early versions of DecentCMS were using an event bus for this).

There are several methods on scopes that you can call to use all
implementations of a service at once.

```js
var shapeHandlers = scope.getServices('shape-handler');
shapeHandlers.forEach(function doSomethingWithTheHandler(shapeHandler) {
  // ...
});
```

`getServices` behaves like a multiple `require`, or rather, `require`
returns the last registered service implementation for the provided
name.

The services are returned in the order they were registered.

If all you want to do is call the same method, with the same options,
on all implementations of a service, you can use `callService`:

```js
scope.callService('shape-handler', 'handle', options, function carryOn(err) {
  // Further processing after all implementations of handle have run
});
```

For this to work, the service method being called must be
asynchronous, and take an options object as its first parameter, and
a callback as its second parameter.

The callback function takes a single error parameter, following the
Node convention.

The service methods are called asynchronously and serially.

The last way you can use multiple service implementations at once is
`lifecycle`.
The `lifecycle` method takes a variable number of parameters that it
uses to build a new function that can be called to execute the life
cycle.
This API is used in a two step process: first prepare the life cycle,
then execute it.
When the life cycle is executed, service methods are being called
serially and asynchronously with the same options object that can be
used both to provide parameters to services, and to aggregate
results.

Let's look at an abridged example, taken from DecentCMS' content
renderer service:

```js
  var lifecycle = scope.lifecycle(
    'placement-strategy', 'placeShapes',
    'shape-handler', 'handle',
    function registerMetaStyleAndScript(options, done) {
      // Do some registration work
      done();
    },
    'rendering-strategy', 'render'
  );
  lifecycle({
    scope: scope,
    shape: layout,
    shapes: shapes,
    renderStream: renderStream
  }, function contentRenderingDone(err) {
    if (err) {
      log.error('Error during content rendering', err);
      pageBuilt(err);
      return;
    }
    // Tear down
    renderStream.end();
    pageBuilt();
  });
```

The lifecycle is built from service methods, and from one ad-hoc
processing function. Such ad-hoc functions can be inserted at any
point of a life cycle to inject logic that doesn't justify its own
service.

In the second step, a context object is provided to the life cycle,
as well as a callback function that will be called once the whole
cycle has run, or when any of the steps called back with an error.

Service discovery
-----------------

Service discovery is not a responsibility of the scope.
The scope needs services to be handed to it when scoping, and later
through registration.

It is the responsibility of the application to discover services to
be registered to the scope.
A reference implementation of service discovery can be found in
DecentCMS, under `modules/core/multi-tenancy/lib/module-discovery.js`.

Service configuration
---------------------

Service configuration is also not a responsibility of the scope.

A reference implementation of scopes loading themselves and exposing
configuration to its services can be found in DecentCMS, under
`modules/core/multi-tenancy/lib/shell/js`.

Testing services
----------------

Mocking dependencies is very easy.
One way you can do it is by creating a new scope, then registering
fake or mock dependencies with it, then using this scope with the
service you're testing.

```js
var testScope = scope('the-scope', {}, {
  serviceA: MockServiceA,
  serviceB: MockServiceB,
  'service-being-tested': ServiceBeingTested
});

var objectBeingTested = testScope.require('service-being-tested');
// Perform tests on the service, and serviceA and serviceB will be
// implemented by the provided mock implementations.
```

It is even possible to remove the dependency of test code on the
Decent Injection scope itself, by building a fake scope.
For example, if the service is only using `require` to get its
dependencies, you can do something like this:

```js
var mocks = {
  serviceA: new MockServiceA(),
  serviceB: new MockServiceB();
};
var fakeScope = {
  require: function(service) {return mocks[service];}
};

var objectBeingTested = new ObjectBeingTested(fakeScope);
```

If the tested service is using constructor injection, testing gets
even easier, and you may not even need a scope, fake or otherwise:

```js
var objectBeingTested = new ObjectBeingTested(new MockServiceA(), new MockServiceB());
```

Failing gracefully
------------------

If no implementation of a service exists, `require` will return
`null`.
Because service registration and injection happen at runtime, and are
usually largely a result of application configuration, missing
services should not result in catastrophic errors.

For that reason, it is recommended that services fail gracefully when
a service is missing.
What this means is that service code should expect the result of a
`require` call to be null.
When it is null, the service should either do nothing, or it should
surface a meaningful message to the user, or into the logs, so that
somebody who can actually fix the problem can know about it.

If the absence of a service is really considered catastrophic, an
exception can be thrown, but great care should be taken when writing
the error message so that it is actionable by the person receiving it.

Background
----------

This library was built for [DecentCMS][decentcms].
DecentCMS is relying heavily on [dependency injection][di] and
[service locators][service-locator]: it is basically a composition
engine, that orchestrates services.
Those services have to use one another, and [dependency injection][di]
is arguably the best pattern to achieve that while keeping coupling
minimal.

Let's go over what dependency injection does, and how it's
implemented in Decent Injection.

[Dependency injection][di] frameworks typically solve the following
problems:

1. **Loose coupling**: components ask for implementations of a
   contract rather than for a specific implementation (that's
   [dependency inversion][dependency-inversion]).
   This way, an implementation can easily be substituted for another,
   which among other things makes unit testing the components easier.
2. **Component registry**: components can be registered against the
   framework, explicitly through code, configuration, or through a
   discovery and harvesting process based on some convention.
3. **Lifetime management**: the framework instantiates components,
   and decides how to re-use them, and when to destroy them.
   Components don't need to care about the lifetime of their
   dependencies, but just about how to use them.

In Node.js, npm and `require` could be considered like a poor man's
dependency injection framework, if you squint hard.
The `require` function can get you an implementation based on a
service name (although if you're a little too specific, you can
require a specific JavaScript file).
The installed modules (found in `node_modules`) can be considered a
crude component registry.
Lifetime management is where it fails the hardest as a dependency
injection container (which it was never intended to be): [required
components are basically singletons (although you can implement
them as factories or constructors of components that are not)][require].
The [simplicity of the `require` function][require-2] is very
compelling, however, and Decent Injection remains close to its spirit,
which also adds familiarity to the API.

Decent Injection is built around the concept of a scope.
`Scope` is a mix-in that can be added in principle to any object,
that adds API to register and to retrieve services.

In DecentCMS, scope is used first to isolate sites in a multi-tenant
installation of the CMS: the available services, and their
configuration, must be per site.
The second scope that DecentCMS uses is the request: many services
that deal with the lifecycle of a request must only persist for its
duration.
Because Node processes requests asynchronously, and several requests
may be ongoing at the same time, such services must be able to
maintain state that is attached and specific to one request.
This is easily done if those services can specify that they must be
scoped to the request.
Let's look at this in more details.

When DecentCMS first spins up, it scans module and theme directories
for js files in `services` subdirectories.
That's the convention it uses for automatically discovered services.
Once the list of available services has been built, the server spins
up one `shell` object per site in the system, and hands it the list
of services.
The shell then looks up its configuration file to figure out what
services are enabled on the site they are representing.

A shell is a scope, in the sense that the scope mix-in has been
applied on it.
As such, a shell can resolve and instantiate services as necessary.

When a request comes in, the server will ask each shell if it can
handle it.
The shell that has chosen to handle the request will then apply the
scope mix-in to the request object, making it a scope itself.
It also passes its list of services in, and declares itself as the
parent scope for the request.

The reason for this hierarchy of scopes is that not all services will
live for the same amount of time.
For example, a caching service must be scoped to the shell, because
it needs to persist from request to request to be of any use at all.
A service that composes the HTML for the page on the other hand,
will have state that must remain for the duration of the request,
but no longer than that.
Other services are transient, and must yield a completely new
instance each time they are required.

Services are required by name.
The service name really represents the contract.
If you're used to other platforms that use interfaces to resolve
service implementations, this might seem imprecise, but we're working
with a dynamic language here, so we're allowed to relax a little
about that sort of thing: this is really very similar to type safety.
Just let it go, you'll be fine.
One advantage here is that we don't need to reference the module that
would define the interface, which contributes to further reduce
coupling.

Let's summarize what we have so far.
The service name is the contract by which service implementations are
required, which implements loose coupling.
Scopes are the component registries in the system, and they also
represent and handle the life cycles of the services they manage.

Decent Injection's scopes are a powerful concept that make the
implementation and usage of services very natural and fluid.
The overhead is minimum for the service implementer, the service
user can keep the acquisition of dependencies close to usage, and
service lifetime is entirely managed by the framework, and requires
only a simple declaration from the service in order to do the right
thing.

  [decentcms]: http://decentcms.org
  [di]: http://en.wikipedia.org/wiki/Dependency_injection
  [service-locator]: http://en.wikipedia.org/wiki/Service_locator_pattern
  [dependency-inversion]: http://en.wikipedia.org/wiki/Dependency_inversion_principle
  [require]: https://weblogs.asp.net/bleroy/some-node-pitfalls-%E2%80%93-1-global-state
  [require-2]: https://weblogs.asp.net/bleroy/namespaces-are-obsolete