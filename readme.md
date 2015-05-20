Decent Injection provides a scope object that manages services that
can then be injected into other services using a "require"-type
service locator, constructor injection, or property injection.

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
Scopes and stateful static objects are a recipe for hard to find
bugs, where state can easily leak between scopes.
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

**Work in progress** below this...

### Requiring services

Services can require other services in three different ways: using
`scope.require`, using constructor injection, or using property
injection.

#### Using `scope.require`

#### Constructor injection

#### Property injection



This library was built for [DecentCMS][decentcms].
DecentCMS is relying heavily on [dependency injection][di] and
[service locators][service-locator]: it is basically a composition
engine, that orchestrates services.
Those services have to use one another, and [dependency injection][di]
is arguably the best pattern to achieve that while keeping coupling
minimal.

Let's go over what dependency injection does, and how it's implemented
in Decent Injection.

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

In Node.js, on which DecentCMS is built, npm and `require` could be
considered like a poor man's dependency injection framework, if you
squint hard.
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
but not longer than that.
Other services are transient, and must yield a completely new
instance each time they are required.


The code in the service's methods can get instances for other
services from their scope:

```js
// Get an instance of the first found implementation of 'other-service'
var otherService = this.scope.require('other-service');

// Get an array of instances for all enabled implementations of 'other-service':
var otherServices = this.scope.getServices('other-services');
```

As you can see, services are required by name.
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

Note that the injection mechanism here is not the traditional
constructor injection (except for the scope), it's also not property
injection, or interface injection.
Instead, services are obtained from the scope on-demand.
That's technically not exactly injection, but it achieves the same
goals.
The advantages of this are that services can be lazily required,
less boilerplate code is necessary for injection, and the API will
be immediately familiar to all Node.js developers.
On the downside, the dependency on the framework is obvious.
Typically, it's quite visible that a service has been written for
DecentCMS, even if it could in theory be used elsewhere.
That's not a huge problem, because most services in a CMS are only
going to be useful in the context of the CMS.
In the cases where a service is so generic that it would make sense
to use it outside the CMS, it should be written as a generic Node.js
library, and then used as a regular npm dependency in a DecentCMS
module.
That's how the flasync library was built, for example: here is a
library that is useful for building asynchronous APIs, despite the
fact ot was built for one very specific usage that doesn't make
sense outside of the CMS: the `render-stream` service that makes
the link between view engines and the http response.

DecentCMS's scopes are a powerful concept that make the
implementation and usage of services very natural and fluid.
The overhead is minimum for the service implementer, and the service
user can keep the acquisition of dependencies close to usage.
Service lifetime is entirely managed by the framework, and requires
only a simple declaration from the service in order to do the right
thing.

  [decentcms]: http://decentcms.org
  [di]: http://en.wikipedia.org/wiki/Dependency_injection
  [service-locator]: http://en.wikipedia.org/wiki/Service_locator_pattern
  [dependency-inversion]: http://en.wikipedia.org/wiki/Dependency_inversion_principle
  [require]: https://weblogs.asp.net/bleroy/some-node-pitfalls-%E2%80%93-1-global-state
  [require-2]: https://weblogs.asp.net/bleroy/namespaces-are-obsolete