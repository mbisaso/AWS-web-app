# Project Rules & Context

## Coding Conventions

- TypeScript strict mode, no any. Use unknown + narrowing, generics, or proper interfaces. If any is truly unavoidable, it must be commented with a reason and ideally wrapped in a named type alias, not left bare.

- Shared types are the contract. Product, Sale, User, Business, etc. are defined once per folder (Backend, Frontend, Landing-Page, Stock-nest-admin & Stock-nest-mobile-app) and imported everywhere — never redefined per-screen "just to get it working."

- No business logic in UI components. Components render. Hooks fetch/mutate. Stores hold client state. If a component has more than a couple of if branches around data shape, that logic belongs in a hook or a pure utility function.

- No direct fetch/axios calls in components or hooks ad hoc. All server access goes through the typed API client and React Query hooks built on top of it.

- Every PR-sized unit of work compiles and typechecks before it's considered done. Not "at the end of the week" — after each meaningful change.

- Brainstorm → approve → build, same as our working style elsewhere: for any non-trivial feature, get the AI to lay out the approach first, review it, then let it write code

For caching, strictly use React Query,,, NO LOCAL STORAGE from now on
