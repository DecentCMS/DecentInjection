// Decent Injection (c) 2014-2015 Bertrand Le Roy, under MIT. See LICENSE.txt for licensing details.
'use strict';

// TODO: enable global require for indecent dependencies, so we can load them only once, save on memory and ramp-up times. Should be fine for common libraries such as async.

var util = require('util');

/**
 * @description
 * Constructs an instance of the class passed in.
 * If the class is static, the same object is always returned.
 * Otherwise, a new instance is created on each call.
 * Don't call this directly, it should only be internally used by scope methods.
 * @param {object} scope The scope.
 * @param {Function} ServiceClass The class to instantiate. This constructor must always take a scope as its first argument. It can also take an optional 'options' argument, unless it's a shell singleton.
 * @param {object} [options] Options to pass into the service's constructor.
 * @returns {object} An instance of the service, or null if it wasn't found.
 */
function construct(scope, ServiceClass, options) {
  if (!ServiceClass) return null;
  var instance = null;
  if (typeof ServiceClass === 'function' && !ServiceClass.isStatic) {
    if (ServiceClass.inject) {
      var constructorArguments = ServiceClass.inject
        .map(function requireDependency(dependency) {
          return scope.require(dependency);
        });
      if (options) constructorArguments.push(options);
      var BoundConstructor = function BoundConstructor() {
        return ServiceClass.apply(this, constructorArguments);
      };
      BoundConstructor.prototype = ServiceClass.prototype;
      instance = new BoundConstructor();
    }
    else {
      instance = new ServiceClass(scope, options);
    }
  }
  else {
    instance = ServiceClass;
  }
  if (ServiceClass.injectProperties) {
    Object.getOwnPropertyNames(ServiceClass.injectProperties)
      .forEach(function injectProperty(propertyName) {
        instance[propertyName] =
          scope.require(ServiceClass.injectProperties[propertyName]);
      });
  }
  return instance;
}

/**
 * @description
 * Gets the instance for a singleton service.
 * This should not be called, except by scope methods.
 * @param {object} scope The scoped object.
 * @param {string} service The service name.
 * @param {number} index The index at which the service is to be cached.
 * @param {object} [options] The options to pass into the service constructor.
 * @returns {object} The singleton instance.
 */
function getSingleton(scope, service, index, options) {
  var serviceClasses = scope.services[service];
  // Get or build the instance cache
  var instances = scope.instances[service];
  if (!instances) {
    instances = scope.instances[service] = new Array(serviceClasses.length);
  }
  // Try to get the instance from the cache
  var instance = instances[index];
  if (instance) return instance;
  // if scope is not current, walk parent scopes to find the current one
  var serviceClass = serviceClasses[index];
  var currentScope = scope;
  if (serviceClass.scope) {
    while (currentScope && (currentScope.scopeName !== serviceClass.scope)) {
      currentScope = currentScope.parentScope;
    }
    // Note: currentScope might be null at this point, which will make the object
    // scope-less. Not necessarily a problem, but probably not very useful.
    if (currentScope && scope != currentScope) {
      var currentScopeServiceClasses = currentScope.services[service];
      var currentScopeIndex = currentScopeServiceClasses.indexOf(serviceClass);
      if (currentScopeIndex !== -1) {
        var currentScopeInstances = currentScope.instances[service];
        if (!currentScopeInstances) {
          currentScopeInstances = currentScope.instances[service] =
            new Array(currentScopeServiceClasses.length);
        }
        instance = currentScopeInstances[currentScopeIndex];
        if (instance) {
          return instances[index] = instance;
        }
        return currentScopeInstances[currentScopeIndex]
          = instances[index]
          = construct(currentScope, serviceClass, options);
      }
    }
    // At this point, if the scope is not currentScope, it's an error case:
    // the service's scope is incompatible with the scope chain or the available
    // services on the scopes.
    if (scope.scopeName !== serviceClass.scope) {
      throw new Error(
        util.format(
          "Couldn't find an instance of %s on scope %s.",
          service, serviceClass.scope));
    }
  }
  return instances[index] = construct(scope, serviceClass, options);
}

/**
 * @description
 * Initializes a service by calling its init method, and wiring up
 * its static events.
 * @param {object} scope The scope.
 * @param {Function} ServiceClass The service class to initialize.
 */
function initializeService(scope, ServiceClass) {
  if (!ServiceClass) return;
  if (ServiceClass.init) {
    ServiceClass.init(scope);
  }
  // Wire up declared static event handlers
  if (ServiceClass.on) {
    Object.keys(ServiceClass.on).forEach(function forEachEvent(eventName) {
      scope.on(eventName, function handleEvent(payload) {
        ServiceClass.on[eventName](scope, payload);
      })
    });
  }
}

/**
 * @description
 * Initialize services for this scope. This is called automatically if the scope was built
 * with a set of services. Otherwise, it must be called manually.
 * @returns {object} The scope.
 */
function scope$initialize() {
  if (this.services) {
    // Initialize all services except those that are scoped to some other scope
    for (var serviceName in this.services) {
      var serviceClasses = this.services[serviceName];
      if (!serviceClasses) continue;
      for (var i = 0; i < serviceClasses.length; i++) {
        var ServiceClass = serviceClasses[i];
        if (!ServiceClass.scope || ServiceClass.scope === this.scopeName) {
          initializeService(this, ServiceClass);
        }
      }
    }
    this._scopeInitialized = true;
  }
  return this;
}

/**
 * @description
 * Registers a service into the scope's registry, making it available for require and
 * getServices. This will initialize the service if the scope is already initialized.
 * @param {string} name The service name implemented by ServiceClass.
 * @param {Function} ServiceClass The service constructor, or the static service object to register.
 * @returns {object} The scope.
 */
function scope$register(name, ServiceClass) {
  if (!this.services[name]) {
    this.services[name] = [ServiceClass];
  }
  else {
    this.services[name].push(ServiceClass);
  }
  if (this._scopeInitialized) {
    // Scope has already initialized its services, so any new one that gets added
    // must also be initialized.
    if (!ServiceClass.hasOwnProperty('scope')
      || ServiceClass.scope === this.scopeName) {
      initializeService(this, ServiceClass);
    }
  }
  return this;
}

/**
 * @description
 * Returns an instance of a service implementing the named contract passed as a parameter.
 * If more than one service exists for that contract, one instance that
 * has dependencies on any other service for that contract is returned. Do not
 * count on any particular service being returned if that is the case among the ones
 * that have the most dependencies.
 * A new instance is returned every time the function is called, unless the service
 * is static, or if it is a scope singleton.
 *
 * @param {String} service  The name of the contract for which a service instance is required.
 * @param {object} [options] Options to pass into the service's constructor.
 * @returns {object} An instance of the service, or null if it wasn't found.
 */
function scope$require(service, options) {
  var services = this.services[service];
  var ServiceClass = services && services.length > 0 ?
    services[services.length - 1] : null;
  if (!ServiceClass) return null;
  if (!ServiceClass.transient) {
    return getSingleton(this, service, services.length - 1, options);
  }
  return construct(this, ServiceClass, options);
}

/**
 * @description
 * Returns a list of service instances that are implementing the named contract passed as a parameter.
 * The services are returned in order of dependency: if service A has a dependency
 * on service B, B is guaranteed to appear earlier in the list.
 * New instances are returned every time the function is called.
 *
 * @param {String} service The name of the contract for which service instances are required.
 * @param {object} [options] Options to pass into the services' constructors.
 * @returns {Array} An array of instances of the service.
 */
function scope$getServices(service, options) {
  var self = this;
  if (!(service in self.services)) return [];
  return self.services[service].map(
    function getServiceInstance(ServiceClass, index) {
      if (!ServiceClass.transient) {
        return getSingleton(self, service, index, options);
      }
      return construct(self, ServiceClass, options);
    }
  );
}

/**
 * @description
 * Calls a method on each registered service of the specified name,
 * asynchronously.
 * @param {string} service The name of the service.
 * @param {string} method The name of the method.
 * @param {object} [options] The parameter to pass to the method.
 * @param {Function} done The function to call when all service methods have returned.
 * @returns {object} The scope.
 */
function scope$callService(service, method, options, done) {
  var services = this.getServices(service);
  function callNthService(n) {
    function nextService(err) {
      if (err) {
        done(err);
        return;
      }
      if (n + 1 < services.length) {
        process.nextTick(function callNextService() {
          callNthService(n + 1);
        });
      }
      else {
        done();
      }
    }
    var service = services[n];
    if (service[method]) {
      service[method](options, function (err) {nextService(err);});
    }
    else {
      nextService();
    }
  }
  if (services.length > 0) {
    callNthService(0);
  }
  else {
    done();
  }
  return this;
}

/**
 * @description
 * Creates a lifecycle function that calls into all the
 * service methods specified in an alternated list of
 * service names, and method names as parameters.
 * It is possible to replace service/method pairs with
 * a function(options, done) that will be called as part
 * of the lifecycle execution.
 *
 * For example:
 *
 *   scope.lifecycle(
 *     'service1', 'methodA',
 *     'service2', 'methodB',
 *     function(options, done) {...},
 *     'service3', 'methodC'
 *   )
 *
 * returns a function that will call methodA on all instances
 * of service1, then methodB on all instances of service2,
 * then the function, then methodC on all instances of service3.
 *
 * @param {string} service The service name.
 * @param {string} method The method name.
 * @returns {Function} A function that takes an options object and a callback as a parameter.
 */
function scope$lifecycle(service, method) {
  var methodArray = [];
  for (var i = 0; i < arguments.length; i++) {
    var serviceName = arguments[i];
    if (typeof(serviceName) === 'function') {
      methodArray.push(serviceName);
      continue;
    }
    var services = this.getServices(serviceName);
    if (!services) continue;
    (function (methodName) {
      Array.prototype.push.apply(
        methodArray,
        services.map(function serviceToMethod(service) {
          return service[methodName].bind(service);
        })
      );
    })(arguments[++i]);
  }
  return function lifecycle(options, done) {
    function executeNthStep(n) {
      function nextStep(err) {
        if (err) {
          done(err);
          return;
        }
        if (n + 1 < methodArray.length) {
          process.nextTick(function callNextStep() {executeNthStep(n + 1);});
        }
        else {
          done();
        }
      }
      var method = methodArray[n];
      method(options, function (err) {nextStep(err);});
    }
    if (methodArray.length > 0) {
      executeNthStep(0);
    }
    else {
      done();
    }
    return this;
  };
}

/**
 * @description
 * Transforms an object into a sub-scope of this scope.
 * @param {string} name The name of the scope.
 * @param {object} subScope The object that must be made a scope.
 * @returns {object} The newly scoped object.
 */
function scope$makeSubScope(name, subScope) {
  scope(name, subScope, this.services, this);
  return subScope;
}

/**
 * @description
 * Transforms an object into a scope. The role of a scope is to manage the lifecycle
 * of required services. This mixin adds initialize, register, require, getServices,
 * callService, and lifecycle methods that can be used to get service instances
 * that are scoped to the object, live and die with it.
 * @mixin
 * @param {string} name The name of the scope.
 * @param {object} objectToScope The object that must be made a scope.
 * @param {object} services A map of the services to be made available from require.
 * @param {object} [parentScope] An optional parent scope that may have valid instances of services to hand down.
 */
function scope(name, objectToScope, services, parentScope) {
  // Leave the object alone if it's already been scoped.
  if (objectToScope.scopeName) return objectToScope;

  if (services) {
    // Shallow copy services so that the service collection is per scope.
    var servicesCopy = objectToScope.services = {};
    Object.getOwnPropertyNames(services).forEach(function copyService(serviceName) {
      servicesCopy[serviceName] = services[serviceName];
    });
  }
  // Register the scope itself as a service:
  objectToScope.services[name] = [objectToScope];
  objectToScope.scopeName = name;
  objectToScope.parentScope = parentScope;

  objectToScope.initialize = scope$initialize;
  objectToScope.register = scope$register;
  objectToScope.require = scope$require;
  objectToScope.getServices = scope$getServices;
  objectToScope.callService = scope$callService;
  objectToScope.lifecycle = scope$lifecycle;
  objectToScope.makeSubScope = scope$makeSubScope;

  objectToScope.instances = {};
  if (services) {
    objectToScope.initialize();
  }

  return objectToScope;
}

module.exports = scope;