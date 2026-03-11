# Type Safety - Runbook: Fix Type Errors

Step-by-step guide to fixing common TypeScript type safety errors.

## Common Errors & Fixes

### Error 1: "Type 'X' is not assignable to type 'Y'"

**What It Means**: You're trying to use a value of one type where a different type is expected.

```typescript
// ❌ Error
const count: number = "5"; // string is not assignable to number
```

**Fixes**:

Option 1: Convert the value:

```typescript
const count: number = parseInt("5", 10);
```

Option 2: Change the type:

```typescript
const count: string = "5";
```

Option 3: Use union type if both are valid:

```typescript
const count: number | string = "5"; // Now valid
```

---

### Error 2: "Cannot find name 'X'"

**What It Means**: You're using a variable, function, or type that doesn't exist or isn't imported.

```typescript
// ❌ Error
console.log(userData); // userData is not defined
```

**Fixes**:

Option 1: Declare the variable:

```typescript
const userData = await fetchUser();
console.log(userData);
```

Option 2: Import from elsewhere:

```typescript
import { userData } from "./api";
console.log(userData);
```

Option 3: Check spelling:

```typescript
// If you meant different spelling:
console.log(userdata); // Check capitalization
```

---

### Error 3: "Property 'X' does not exist on type 'Y'"

**What It Means**: The object type doesn't have that property.

```typescript
// ❌ Error
interface User {
  name: string;
}

const user: User = { name: "John" };
console.log(user.age); // age doesn't exist on User
```

**Fixes**:

Option 1: Add the property to the type:

```typescript
interface User {
  name: string;
  age: number; // Added
}
```

Option 2: Check the object before accessing:

```typescript
if ("age" in user) {
  console.log(user.age);
}
```

Option 3: Use optional property if it's not always present:

```typescript
interface User {
  name: string;
  age?: number; // Optional
}

if (user.age !== undefined) {
  console.log(user.age);
}
```

---

### Error 4: "Implicit 'any' parameter"

**What It Means**: Function parameter type is not specified and can't be inferred.

```typescript
// ❌ Error
function process(data) {
  // data has implicit any type
  return data.transform();
}
```

**Fix**: Add explicit type annotation:

```typescript
// Option 1: Specific type
function process(data: UserData) {
  return data.transform();
}

// Option 2: Generic
function process<T>(data: T): T {
  return data;
}

// Option 3: unknown (for external data)
function process(data: unknown) {
  const validated = mySchema.parse(data);
  return validated.transform();
}
```

---

### Error 5: "Argument of type 'X' may be undefined"

**What It Means**: A value might be undefined, but the function expects a non-undefined value.

```typescript
// ❌ Error
const item = array.find((x) => x.id === "123"); // item is T | undefined
processItem(item); // Argument may be undefined
```

**Fixes**:

Option 1: Check before passing:

```typescript
const item = array.find((x) => x.id === "123");
if (item !== undefined) {
  processItem(item);
}
```

Option 2: Use non-null assertion (if you're sure):

```typescript
const item = array.find((x) => x.id === "123")!; // ! asserts non-null
processItem(item);
```

Option 3: Use optional chaining:

```typescript
processItem(item?.id);
```

Option 4: Change function to accept optional:

```typescript
function processItem(item?: Item) {
  // Handle case where item is undefined
}
```

---

### Error 6: "Cannot read property 'X' of undefined"

**What It Means**: Runtime error. You're accessing a property on a value that might be undefined.

```typescript
// ❌ Runtime Error
const user = getUserById(id); // Could be undefined
console.log(user.name); // CRASH if user is undefined
```

**Fixes**:

Option 1: Check before accessing:

```typescript
const user = getUserById(id);
if (user !== undefined) {
  console.log(user.name);
}
```

Option 2: Use optional chaining:

```typescript
const user = getUserById(id);
console.log(user?.name); // undefined if user is undefined
```

Option 3: Provide default:

```typescript
const user = getUserById(id) || { name: "Unknown" };
console.log(user.name);
```

Option 4: Use non-null assertion (if certain):

```typescript
const user = getUserById(id)!;
console.log(user.name);
```

---

### Error 7: "No overload matches this call"

**What It Means**: The function signature doesn't match the arguments you're passing.

```typescript
// Function definition
function greet(name: string): void {}

// ❌ Error
greet(123); // Argument of type 'number' is not assignable to parameter of type 'string'
```

**Fix**: Pass the correct type:

```typescript
greet("John"); // ✅ Correct

// Or convert first
greet(String(123));
```

---

## Type Error Fixing Strategy

### Step 1: Read the Error Message

```
src/api/users.ts:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.
```

This tells you:

- **File**: `src/api/users.ts`
- **Line**: 45
- **Column**: 12
- **Error Code**: TS2322 (type mismatch)
- **Details**: string → number mismatch

### Step 2: Find the Exact Line

Open the file and go to that line:

```typescript
45:    const age: number = "25"; // ← Error is here (column 12)
```

### Step 3: Understand the Mismatch

Ask yourself:

- What type am I providing? (string "25")
- What type is expected? (number)
- Why the mismatch? (parsing not done)

### Step 4: Choose a Fix Strategy

- **Type the value correctly**: `parseInt("25")`
- **Change the type**: `const age: string = "25"`
- **Add validation**: `const age = ageSchema.parse("25")`
- **Make it optional**: `age?: number`

### Step 5: Test the Fix

```bash
bun typecheck
# If no errors: ✅ Fixed
# If still errors: Repeat steps 1-4
```

---

## Category-Based Quick Reference

### String/Number Mismatches

```typescript
// ❌ Wrong
const age: number = getUserAge(); // May return string

// ✅ Correct
const age: number = parseInt(getUserAge(), 10);
```

### Array Access Safety

```typescript
// ❌ Wrong
const first = items[0].id; // items[0] could be undefined

// ✅ Correct
const first = items[0]?.id;
```

### Optional Values

```typescript
// ❌ Wrong
const user: User = getUser(); // Might return null

// ✅ Correct
const user: User | null = getUser();
```

### Function Returns

```typescript
// ❌ Wrong
function getValue() {
  // Implicit any return
  return data.value;
}

// ✅ Correct
function getValue(): string {
  return data.value;
}
```

### External Data

```typescript
// ❌ Wrong
const data = await fetch("/api").then((r) => r.json());
// data is any, could be anything

// ✅ Correct
const data = await fetch("/api").then((r) => r.json());
const validated = mySchema.parse(data); // Now typed
```

---

## Prevention Tips

### 1. Enable Strict Mode

Ensure `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 2. Use IDE IntelliSense

Let your IDE help:

```typescript
const user = getUser();
//    ^ Hover here to see type
user.// ← IDE shows available properties
```

### 3. Validate External Data

```typescript
// External data: unknown
const data: unknown = await fetch().then((r) => r.json());

// Validate immediately
const validated = schema.parse(data);

// Now safe to use
processData(validated);
```

### 4. Check Function Signatures

Before calling a function:

```typescript
// Check what parameters it expects
declare function processUser(user: User): void;

// Before calling:
const user: User = {
  /* ... */
}; // Ensure correct type
processUser(user); // ✅ Safe
```

---

## When You're Stuck

If you can't figure out the type error:

1. **Read the full error message** — It often contains the fix
2. **Check the type definition** — See what the function expects
3. **Try hovering in IDE** — See inferred types
4. **Use `satisfies` operator** - Verify type without changing variable type:
   ```typescript
   const user = { name: "John" } satisfies User;
   ```
5. **Ask for help** — Post the error + context to team

---

Last Updated: 2026-03-11
