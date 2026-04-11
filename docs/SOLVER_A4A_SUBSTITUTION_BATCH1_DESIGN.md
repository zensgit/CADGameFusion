## Scope

Implement the first safe substitution/pre-elimination batch for the solver in:

- `core/src/solver.cpp`

Do not implement sparse Jacobian work, tolerance changes, or any new analytical-gradient formulas in this packet.

## Goal

Reduce solver dimensionality before Jacobian construction by collapsing only true alias-style equality relationships:

- `equal`
- `coincident`
- `concentric`

This packet must preserve current solve behavior for all other constraint kinds.

## Design

### 1. Add a substitution builder

Introduce a small local result type in `solver.cpp`:

```cpp
struct SubstitutionResult {
    std::vector<ConstraintSpec> reduced;
    std::unordered_map<std::string, std::string> redirect;
};
```

Add:

```cpp
static SubstitutionResult build_substitutions(const std::vector<ConstraintSpec>& constraints);
```

The function should:

- scan the expanded constraint list
- union only canonical alias relationships
- produce a redirect map from non-canonical var refs to canonical var refs
- remove the alias constraints that were consumed by substitution

### 2. Supported substitution patterns

Only consume these patterns in this batch:

- `equal`: `vars[0] == vars[1]`
- `coincident`:
  - when expanded x-row: `vars[0] == vars[2]`
  - when expanded y-row: `vars[1] == vars[3]`
- `concentric`:
  - same x/y mapping as `coincident`

### 3. Explicit non-goals

Do not substitute:

- `horizontal`
- `vertical`
- `distance`
- `parallel`
- `perpendicular`
- `angle`
- `tangent`
- `point_on_line`
- `midpoint`
- `symmetric`
- `fixed_point`

Reason: those carry additional diagnostics semantics or are not pure alias constraints.

### 4. Use stable canonicalization

Use a simple union-find keyed by formatted var refs.

Canonical representative rule:

- deterministic
- stable across runs
- prefer lexical minimum key

That keeps baseline output deterministic and avoids test noise.

### 5. Apply substitutions in solver entrypoints

Apply the substitution result at the start of:

- `MinimalSolver::solveWithBindings(...)`
- `DogLegSolver::solveWithBindings(...)`
- `BFGSSolver::solveWithBindings(...)`

Expected flow:

1. expand x/y split constraints as today
2. call `build_substitutions(...)`
3. replace the working expanded list with `sub.reduced`
4. route variable reads through redirected canonical vars

### 6. Redirect reads only in this batch

Use a redirected getter:

```cpp
auto redirected_get = [&](const VarRef& v, bool& ok) -> double { ... };
```

This batch does not need a redirected setter, because eliminated aliases should no longer appear in the reduced constraint list.

### 7. Diagnostics and safety

Keep this packet conservative:

- if a constraint does not match the exact supported alias pattern, leave it untouched
- if redirect lookup fails, read the original var
- do not change `ConstraintValidationReport`
- do not change residual formulas
- do not change Jacobian analysis code in this packet

## Invariants

- Public solver API stays unchanged.
- Unsupported constraints behave exactly as before.
- Solver should still accept mixed supported/unsupported constraint sets.
- No behavior change is allowed for non-alias constraints.
- No change to analytical Jacobian batch A formulas or fallback semantics.

## Expected Files

- `core/src/solver.cpp`
- optionally focused tests under `tests/core/`

## Suggested Test Coverage

Add focused tests for:

- chained `equal` substitutions: `a=b, b=c`
- expanded `coincident` x/y elimination
- expanded `concentric` x/y elimination
- mixed alias + non-alias constraints
- ensuring unsupported constraints remain in the reduced list

