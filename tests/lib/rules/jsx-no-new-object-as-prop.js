"use strict";
const { testRule}  = require("../utils/common");

var invalidObjectExpressions = [
  { code: "<Item prop={{foo: 123}} />", line: 1, column: 13 }
].map(function({ code, line, column }) {
  return {
    code,
    errors: [
      {
        line,
        column,
        type: "ObjectExpression"
      }
    ]
  };
});

var invalidNewExpressions = [
  { code: "<Item prop={new Object} />", line: 1, column: 13 },
  { code: "<Item prop={new Object()} />", line: 1, column: 13 },
  { code: "<Item prop={new Date()} />", line: 1, column: 13 },
  { code: "<Item prop={new Promise(() => {})} />", line: 1, column: 13 },
  {
    code: "class CustomClass {}; <Item prop={new CustomClass()} />",
    line: 1,
    column: 35,
  },
].map(function ({ code, line, column }) {
  return {
    code,
    errors: [
      {
        line,
        column,
        type: "NewExpression",
      },
    ],
  };
});

var invalidCallExpressions = [
  { code: "<Item prop={Object()} />", line: 1, column: 13 },
].map(function ({ code, line, column }) {
  return {
    code,
    errors: [
      {
        line,
        column,
        type: "CallExpression",
      },
    ],
  };
});

var validMemoizedExpressions = [
  { code: "const foo = useMemo(() => new Date(), []); <Item prop={foo} />" },
  {
    code: "const foo = useMemo(() => new Promise(() => {}), []); <Item prop={foo} />",
  },
  {
    code: "class CustomClass {}; const foo = useMemo(() => new CustomClass(), []); <Item prop={foo} />",
  },
  {
    code: "const foo = useCallback(() => new Date(), []); <Item prop={foo} />",
  },
  {
    code: "const foo = React.useMemo(() => new Date(), []); <Item prop={foo} />",
  },
  {
    code: "const foo = React.useCallback(() => new Date(), []); <Item prop={foo} />",
  },
];

module.exports = testRule(
  "../../../lib/rules/jsx-no-new-object-as-prop",
  "jsx-no-new-object-as-prop",
  "JSX attribute values should not contain objects created in the same scope",
  "{}",
  "ObjectExpression",
  [].concat(
    invalidObjectExpressions,
    invalidNewExpressions,
    invalidCallExpressions
  ),
  validMemoizedExpressions
);
