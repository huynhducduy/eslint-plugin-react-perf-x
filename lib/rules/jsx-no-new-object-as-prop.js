"use strict";

const { checkConstructor, createRule } = require("../utils/common");

// Memoization functions that should be allowed
const MEMOIZATION_FUNCTIONS = new Set([
  "useMemo",
  "useCallback",
]);

function isMemoizationCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee &&
    ((node.callee.type === "Identifier" &&
      MEMOIZATION_FUNCTIONS.has(node.callee.name)) ||
      (node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "React" &&
        node.callee.property.type === "Identifier" &&
        MEMOIZATION_FUNCTIONS.has(node.callee.property.name)))
  );
}

module.exports = createRule(
  "Prevent {...} as JSX prop value",
  "JSX attribute values should not contain objects created in the same scope",
  function (node) {
    // Allow memoization calls
    if (isMemoizationCall(node)) {
      return false;
    }

    // Flag any new expression (including built-in objects and custom classes)
    if (node.type === "NewExpression") {
      return true;
    }

    // Keep existing logic for object literals and Object constructor
    return node.type === "ObjectExpression" || checkConstructor(node, "Object");
  }
);
