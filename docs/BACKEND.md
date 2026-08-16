# Backend — architecture notes

## Why NestJS instead of plain Express

Nest runs on Express underneath, so nothing here needed a different runtime —
what it buys is the structure I'd otherwise have to hand-roll: a module
system with real dependency injection, guards for auth/permission checks that
compose declaratively (`@UseGuards`, `@RequirePermissions`), pipes for
request validation, and a consistent place to put cross-cutting concerns
(exception filters, interceptors). For an app with seven-plus feature modules
and a real permission system, that structure isn't overhead — it's the thing
that keeps auth/RBAC/validation consistent across every route instead of
re-implemented per-controller.

## Modular monolith

One deployable app, but organized as isolated feature modules — auth, users,
products, cart, wishlist, orders, roles. The rule I held to: a module talks
to another module's data only through that module's exported service, never
by importing its Mongoose model directly. Concretely, `CartModule` never
touches the `User` schema — it goes through `UsersService.getCart(userId)`,
same as `OrdersModule` resolves customer info through `UsersService`, not by
querying the users collection itself. That's what makes this a *modular*
monolith rather than just one big Nest app with everything visible to
everything — each module's internals could change without any other module
noticing, the same property microservices give you, without the operational
cost of actually running separate services for an app this size.

## Repository pattern

Every service depends on an abstract repository class (used as both the
TypeScript interface and the Nest DI token), never on the Mongoose model
directly:

```ts
export abstract class ProductsRepository {
  abstract findById(id: string): Promise<ProductDocument | null>;
  ...
}
// bound in the module:
{ provide: ProductsRepository, useClass: MongooseProductsRepository }
```
This buys two things: the persistence layer is swappable without touching
business logic, and unit tests mock the repository interface instead of
standing up a real database — OrdersService's checkout logic, for example,
is tested entirely against mocked repositories/services, which is what made
it fast enough to actually catch the stock-compensation bug during
development instead of only in an e2e run.
The most important value that this pattern gave me while developing is the decoupling, which if you take a look closer at the code, u will find that the controller is made for only request and response, it does not know anything about the business logic, it just calls the business logic services, and the business logic services also does know or care which databse/orm i've used like mongo or mongoose, which later i can for example change from mongoose to any orm while still maintainging the same code in the services,dtos,controllers,strategies,etc.... i only change the repository code which is the real gain here (the decoupling and abstraction).


## DTOs and validation

Every request goes through a DTO validated by class-validator, under a
global ValidationPipe configured with whitelist: true and
forbidNonWhitelisted: true — any field not declared on the DTO is rejected
outright, not silently dropped. Responses go through DTOs with static mapper
methods (ProductResponseDto.fromDocument(...)) rather than returning
Mongoose documents directly, so passwordHash and raw internals
(__v, Mongoose's _id type) never reach a client by accident

## Error handling

Domain-specific exceptions extend Nest's HTTP exception classes —
ProductNotFoundException, InsufficientStockException,
RefreshTokenReuseException, InsufficientPermissionsException, and so on —
each carrying a precise message. A single global exception filter turns any
of these into a consistent error envelope (statusCode, message, error,
timestamp, path), and logs unexpected 500s server-side without leaking
internals into the response body.

## Authentication

Password hashing is bcrypt. Login returns a short-lived access token in the
response body and sets a longer-lived refresh token as an httpOnly, Secure,
SameSite cookie — the access token is what the client attaches to API
requests, the refresh token is never visible to JavaScript at all. Every
refresh call rotates the token: the old one is marked revoked and a new one
issued in the same family. If an already-rotated (i.e. already-used) refresh
token is presented again, that's a replay — the entire token family is
revoked, forcing re-login on every session descended from that token.

This is stronger than a single long-lived token because a stolen access
token expires quickly regardless of what happens to it, and a stolen refresh
token is only useful once — using it after the legitimate client already
rotated it past that point immediately signals the theft and kills every
session in that lineage, not just the one that got replayed.

## RBAC

Roles hold a permissions: string[]; users reference a role by id.
Permissions are resolved from the database on every request (in the JWT
strategy's validate(), not baked into the access token), so revoking a
permission — or reassigning a user to a different role — takes effect on
their very next request instead of waiting for their current token to
expire.

Role-mutation endpoints (create/update-permissions/delete) are gated on the
literal admin role name, not on the roles:manage permission. If
roles:manage alone were sufficient, a role holding it could grant itself
every other permission — RBAC gating role management with a role-management
permission is circular and self-defeating. Built-in roles (admin,
customer) are marked isSystem and the mutation endpoints reject changes
to them outright, so there's always at least one account that can administer
the system.

## Avoiding N+1 queries

A few concrete spots where this mattered:

Checkout batches product lookups for every cart line with a single findByIds ($in query) rather than one findById per line.
Stock decrement at checkout claims every line with one conditional findOneAndUpdate per line rather than a loop of read-then-write calls — and deliberately not a single bulkWrite, because bulkWrite only reports an aggregate modifiedCount; if a checkout partially fails, the compensation logic needs to know exactly which lines it actually claimed to restore only those, not a count.
Admin order listing resolves the placing customer's name/email for a whole page of orders with one batched UsersService.findByIds call, not a query per order row.
Admin users listing attaches each user's role the same way — one batched RolesService.findManyByIds for the page, not per user.

## Testing

Unit tests with mocked repositories cover the logic with real risk of a
subtle bug — refresh token rotation/reuse detection, checkout's stock-claim
and compensation logic, RBAC permission checks. These run fast with no
database and are where I actually caught the two real bugs in checkout (see
AI-USAGE.md for how). Module-scoped e2e tests run against
mongodb-memory-server and hit the real HTTP layer with supertest, covering
things a mocked unit test can't — validation pipe behavior, actual Mongo
index/uniqueness enforcement, guard composition across a real request. The
split exists because they catch different classes of bug: unit tests for
business-logic correctness, e2e tests for "does the whole request pipeline
actually behave the way the unit tests assume."
