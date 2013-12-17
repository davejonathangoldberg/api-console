RAML.Inspector = (function() {
  'use strict';

  var exports = {};

  var METHOD_ORDERING = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

  // 1) copy common properties and new properties from the new object to the existing object
  // 2) remove properties from the existing
  function mergeObjects(source, target) {
    var targetKeys = Object.keys(target),
        sourceKeys = Object.keys(source);

    var removedKeys = targetKeys.filter(function(targetKey) {
      return !sourceKeys.some(function(sourceKey) {
        return sourceKey === targetKey;
      });
    });

    removedKeys.forEach(function(key) {
      delete target[key];
    });

    sourceKeys.forEach(function(key) {
      var sourceValue = source[key];
      var targetValue = target[key];
      var sourceValueMissing = sourceValue === null || sourceValue === undefined;
      var targetValueMissing = targetValue === null || targetValue === undefined;
      var sourceValueIsNotObject = typeof sourceValue !== 'object';


      if (sourceValueIsNotObject || sourceValueMissing || targetValueMissing) {
        target[key] = sourceValue;
      } else {
        mergeObjects(sourceValue, targetValue);
      }
    });
  }

  function extractResources(basePathSegments, api, securitySchemes) {
    var resources = [], apiResources = api.resources || [];

    apiResources.forEach(function(resource) {
      var resourcePathSegments = basePathSegments.concat(RAML.Client.createPathSegment(resource));
      var overview = exports.resourceOverviewSource(resourcePathSegments, resource);

      overview.methods = overview.methods.map(function(method) {
        return RAML.Inspector.Method.create(method, securitySchemes);
      });


      resources.push(overview);

      if (resource.resources) {
        var extracted = extractResources(resourcePathSegments, resource, securitySchemes);
        extracted.forEach(function(resource) {
          resources.push(resource);
        });
      }
    });

    return resources;
  }

  function groupResources(resources) {
    var currentPrefix, resourceGroups = [];

    (resources || []).forEach(function(resource) {
      if (resource.pathSegments[0].toString().indexOf(currentPrefix) !== 0) {
        currentPrefix = resource.pathSegments[0].toString();
        resourceGroups.push([]);
      }
      resourceGroups[resourceGroups.length-1].push(resource);
    });

    return resourceGroups;
  }

  exports.resourceOverviewSource = function(pathSegments, resource) {
    var clone = RAML.Utils.clone(resource);

    clone.traits = resource.is;
    clone.resourceType = resource.type;
    clone.type = clone.is = undefined;
    clone.pathSegments = pathSegments;

    clone.methods = (resource.methods || []);

    clone.methods.sort(function(a, b) {
      var aOrder = METHOD_ORDERING.indexOf(a.method.toUpperCase());
      var bOrder = METHOD_ORDERING.indexOf(b.method.toUpperCase());

      return aOrder > bOrder ? 1 : -1;
    });

    clone.uriParametersForDocumentation = pathSegments
      .map(function(segment) { return segment.parameters; })
      .filter(function(params) { return !!params; })
      .reduce(function(accum, parameters) {
        for (var key in parameters) {
          var parameter = parameters[key];
          if (parameter) {
            parameter = (parameter instanceof Array) ? parameter : [ parameter ];
          }
          accum[key] = parameter;
        }
        return accum;
      }, {});

    return clone;
  };

  exports.create = function(api) {
    if (api.baseUri) {
      api.baseUri = RAML.Client.createBaseUri(api);
    }

    api.resources = extractResources([], api, api.securitySchemes);
    api.resourceGroups = groupResources(api.resources);

    return api;
  };

  exports.merge = function(source, target) {
    mergeObjects(source, target);
  };

  return exports;
})();
