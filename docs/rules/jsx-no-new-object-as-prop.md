# Prevent `{...}` as JSX prop values (jsx-no-new-object-as-prop)

Prevent Objects that are local to the current method from being used as values of JSX props

## Rule Details

The following patterns are considered warnings:

```jsx
// Object literals
<Item config={{}} />
<Item config={{foo: 123}} />

// Object constructor
<Item config={new Object()} />
<Item config={Object()} />

// Any new expressions (built-in objects)
<Item config={new Date()} />
<Item config={new Promise(() => {})} />

// Custom classes
class Bar {}
<Item config={new Bar()} />

// In function scopes
function Component() {
  class Bar2 {}
  const foo = new Bar2()
  return <Item config={foo} />
}

// Conditional expressions
<Item config={this.props.config || {}} />
<Item config={this.props.config ? this.props.config : {}} />

// Style objects
<div style={{display: 'none'}} />
```

The following patterns are not considered warnings:

```jsx
// Static configurations
<Item config={staticConfig} />

// Memoized objects
<Item config={useMemo(() => new Date(), [])} />
<Item config={useMemo(() => new Promise(), [])} />
<Item config={useMemo(() => new Bar(), [])} />

// Other memoization functions
<Item config={useCallback(() => new Date(), [])} />
<Item config={React.useMemo(() => new Date(), [])} />
```
