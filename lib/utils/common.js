"use strict";

function createRule(description, errorMessage, isViolation) {
  return {
    meta: {
      docs: {
        description,
        category: "",
        recommended: true,
      },
      schema: [
        {
          additionalProperties: false,
          properties: {
            nativeAllowList: {
              oneOf: [
                {
                  enum: ["all"],
                },
                {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              ],
            },
            allowList: {
              type: "array",
              items: {
                type: "string",
              },
            },
            ignoreComponents: {
              type: "array",
              items: {
                type: "string",
              },
            },
            ignoreSources: {
              type: "array",
              items: {
                oneOf: [
                  { type: "string" },
                  {
                    type: "object",
                    properties: {
                      source: {
                        type: "string",
                      },
                      importNames: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                      },
                    },
                    additionalProperties: false,
                  },
                ],
              },
            },
          },
          type: "object",
        },
      ],
    },

    create: function (context) {
      const { options } = context;
      const { nativeAllowList, allowList, ignoreComponents, ignoreSources } =
        options[0] || {};

      const allowListSet = new Set(allowList ?? []);
      const ignoreComponentsSet = new Set(ignoreComponents ?? []);

      // Pre-compute native allow list for faster lookups
      const nativeAllowAll = nativeAllowList === "all";
      const nativeAllowSet = Array.isArray(nativeAllowList)
        ? new Set(nativeAllowList.map((item) => item.toLowerCase()))
        : null;

      const sourceMap = new Map();

      if (ignoreComponents) {
        ignoreComponents.forEach((component) => {
          ignoreComponentsSet.add(component);
        });
      }
      const ignoreSourcesMap = new Map();

      if (ignoreSources) {
        for (let i = 0; i < ignoreSources.length; i++) {
          const config = ignoreSources[i];
          if (typeof config === "string") {
            ignoreSourcesMap.set(config, true); // ignore all imports from this source
          } else {
            config.importNames.forEach((importName) => {
              let currentSet = ignoreSourcesMap.get(config.source);
              if (!currentSet) {
                currentSet = new Set();
                ignoreSourcesMap.set(config.source, currentSet);
              }
              currentSet.add(importName);
            });
          }
        }
      }

      return {
        ImportDeclaration: function (node) {
          node.specifiers.forEach((specifier) => {
            if (specifier.type === "ImportNamespaceSpecifier") {
              sourceMap.set(specifier.local.name, [
                node.source.value,
                specifier.local.name,
              ]);
            } else if (specifier.type === "ImportDefaultSpecifier") {
              sourceMap.set(specifier.local.name, [
                node.source.value,
                specifier.local.name,
              ]);
            } else {
              sourceMap.set(specifier.local.name, [
                node.source.value,
                specifier.imported.name,
              ]);
            }
          });
        },
        JSXAttribute: function (node) {
          if (!node.value || node.value.type !== "JSXExpressionContainer") {
            return;
          }

          // Cache commonly accessed properties
          const attrName = node.name.name;
          const parentName = node.parent.name;
          const parentNameType = parentName.type;

          // Check native element allow list
          if (parentNameType === "JSXIdentifier") {
            const nodeName = parentName.name;
            const firstChar = nodeName.charAt(0);
            if (firstChar === firstChar.toLowerCase()) {
              if (nativeAllowAll) {
                return;
              }
              if (nativeAllowSet?.has(attrName.toLowerCase())) {
                return;
              }
            }
          }

          if (allowListSet.has(attrName)) {
            return;
          }

          const componentName =
            parentNameType === "JSXIdentifier"
              ? parentName.name
              : parentNameType === "JSXMemberExpression"
              ? parentName.object.name
              : undefined;

          if (ignoreComponentsSet.has(componentName)) {
            return;
          }

          if (ignoreSources) {
            let source;
            let propertyName;

            if (parentNameType === "JSXMemberExpression") {
              const objectName = parentName.object.name;
              propertyName = parentName.property.name;
              const objectSource = sourceMap.get(objectName);

              if (objectSource) {
                // Check for ignore this property name (e.g., Item in <Foo.Item /> where Foo is default import)
                const [sourcePath] = objectSource;
                const sourceConfig = ignoreSourcesMap.get(sourcePath);
                if (sourceConfig === true || sourceConfig?.has(propertyName)) {
                  return;
                }
                source = objectSource;
              }
            } else {
              source = sourceMap.get(parentName.name);
            }

            if (source) {
              const [sourcePath, importName] = source;
              const ignoreConfig = ignoreSourcesMap.get(sourcePath);

              // Check for ignore all imports from this source
              if (ignoreConfig === true) {
                return;
              }

              // Check for ignore this import name from this source
              if (ignoreConfig?.has(importName)) {
                return;
              }

              // For member expressions, also check the property name
              if (
                propertyName &&
                ignoreSourcesMap.get(source[0])?.has(propertyName)
              ) {
                return;
              }

              // Check if source starts with any configured source prefix
              for (const [
                ignoreSource,
                ignoreImportNames,
              ] of ignoreSourcesMap) {
                const prefix = ignoreSource + "/";
                if (sourcePath.startsWith(prefix)) {
                  if (ignoreImportNames === true) {
                    return;
                  }
                  if (ignoreImportNames.has(importName)) {
                    return;
                  }
                  // For member expressions, also check the property name
                  if (propertyName && ignoreImportNames.has(propertyName)) {
                    return;
                  }
                }
              }
            }
          }

          let violationFound = false;
          const relevantNodes = findRelevantNodes(
            context,
            node.value.expression
          );
          for (const relevantNode of relevantNodes) {
            if (isViolation(relevantNode)) {
              violationFound = true;
              context.report(relevantNode, errorMessage);
            }
          }
          return violationFound;
        },
      };
    },
  };
}

function findRelevantNodes(context, node) {
  const nodes = [];
  const sourceCode = context.sourceCode || context.getSourceCode();

  function _findRelevantNodes(node) {
    const nodeType = node.type;

    // Fast path for literals
    if (nodeType === "Literal") {
      return;
    }

    if (nodeType === "Identifier") {
      const scope = sourceCode.getScope
        ? sourceCode.getScope(node)
        : context.getScope();

      const nodeName = node.name;
      const variables = scope.variables;

      // Optimized variable lookup
      for (let i = 0; i < variables.length; i++) {
        if (variables[i].name === nodeName) {
          const references = variables[i].references;
          for (let j = 0; j < references.length; j++) {
            const parent = references[j].identifier.parent;
            if (!parent) continue;

            const parentType = parent.type;
            if (parentType === "AssignmentExpression") {
              nodes.push(parent.right);
            } else if (parentType === "VariableDeclarator") {
              nodes.push(parent.init);
            } else if (parentType === "AssignmentPattern") {
              nodes.push(parent.right);
            }
          }
          break;
        }
      }
      return;
    }

    if (nodeType === "LogicalExpression") {
      _findRelevantNodes(node.left);
      _findRelevantNodes(node.right);
      return;
    }

    if (nodeType === "ConditionalExpression") {
      _findRelevantNodes(node.consequent);
      _findRelevantNodes(node.alternate);
      return;
    }

    nodes.push(node);
  }

  _findRelevantNodes(node);
  return nodes;
}

function checkConstructor(node, className) {
  const nodeType = node.type;
  return (
    (nodeType === "NewExpression" || nodeType === "CallExpression") &&
    node.callee &&
    node.callee.name === className
  );
}

module.exports = {
  createRule,
  checkConstructor,
};
