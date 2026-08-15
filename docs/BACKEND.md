# Backend — architecture notes

> **Write this section yourself, in your own words.** The assessment explicitly asks for
> these rationale docs to be written manually with no AI assistance. The headings and
> prompts below are only a checklist of what to cover — delete the prompts as you replace
> them with your own explanation.

## Why NestJS instead of plain Express

<!-- Nest runs on Express underneath. Explain what you get for free (module system, DI,
     guards, pipes, validation) and why hand-rolling that structure in Express would have
     been more work for the same result. -->

## Modular monolith

<!-- One deployable app, organised as isolated feature modules: auth, users, products,
     cart, wishlist, orders, roles. Explain the rule you followed — modules talk through
     exported services, never by importing another module's Mongoose model — and give
     the CartModule -> UsersService example. Why not microservices at this scale? -->

## Repository pattern

<!-- Every service depends on an abstract repository class used as the DI token, not on
     the Mongoose model. Explain what this buys: swappable persistence, and unit tests
     that mock the repository instead of standing up a database. -->

## DTOs and validation

<!-- Request DTOs with class-validator + a global ValidationPipe (whitelist,
     forbidNonWhitelisted). Response DTOs with static mappers so `passwordHash` and raw
     Mongoose internals never reach a client. -->

## Error handling

<!-- Domain exceptions (ProductNotFoundException, InsufficientStockException,
     RefreshTokenReuseException, ...) extending Nest's HTTP exceptions, plus one global
     filter producing a consistent error envelope and logging unexpected 500s without
     leaking internals. -->

## Authentication

<!-- Explain the full flow in your own words:
     - bcrypt password hashing
     - short-lived access token returned in the response body
     - refresh token in an httpOnly, Secure, SameSite cookie
     - rotation on every refresh
     - reuse detection: replaying a rotated-out token revokes the whole family
     Why is this stronger than a single long-lived token? -->

## RBAC

<!-- Roles hold a list of permission strings; users reference a role. Explain:
     - why permissions are resolved from the DB on each request rather than baked into
       the JWT
     - why role-mutation endpoints are gated on the literal `admin` role instead of the
       `roles:manage` permission (self-escalation)
     - why built-in roles are locked -->

## Avoiding N+1 queries

<!-- Point at the concrete places: batched findByIds for cart/wishlist/order pricing,
     bulkWrite for stock decrement at checkout, batched role lookup for the users list. -->

## Testing

<!-- Unit tests with mocked repositories for the risky logic (token rotation, cart rules,
     checkout). Module-scoped e2e tests against mongodb-memory-server. Why this split? -->
