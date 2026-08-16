# Database — design notes

## Why MongoDB

The data here is document-shaped, not relational. A product with a variable number of variants (`Size`, `Color`, sometimes neither), a cart that's really just "this user's current line items," an order that needs to freeze a snapshot of price/title at purchase time — none of that needs joins, and forcing it into normalized tables would mean assembling the same document back together on every read. Mongo lets the shape on disk match the shape the API actually returns.

The one place a relational database's guarantees would be genuinely missed is multi-document transactions (e.g. atomically writing the order and decrementing stock). I didn't reach for Mongo transactions for that — instead checkout claims stock with a single conditional update per line
(`findOneAndUpdate` guarded by `stock: { $gte: amount }`) and compensates if the order write fails afterward. That's a narrower guarantee than a transaction, but it's enough for this write pattern and avoids pulling in session/transaction machinery for one call path.

## Collections

- **products** — title, description, price, stock, variants, imageUrl,
  version. One document per catalogue item.
- **users** — email, passwordHash, name, roleId, plus embedded `cart` and
  `wishlist` arrays (see below).
- **roles** — name, permissions (string array), isSystem flag.
- **refreshtokens** — one document per issued refresh token: hash, userId,
  familyId, revoked, expiresAt.
- **orders** — userId, a frozen snapshot of line items (title/price/quantity
  at the time of purchase, not a live reference), total, optional
  idempotencyKey.

## Why cart and wishlist are embedded on the user

Very important note if u might ask why i did not create cart and whishlist as collections.
Every user has exactly one cart and one wishlist — there's no scenario where
a user has many of either, so there's no real "collection" of them to model.
Embedding them as arrays on the `User` document means reading or updating a
cart is a single document operation, not a join. The trade-off is that the
`User` document grows with cart size and every cart mutation rewrites (part
of) the user record — fine at this scale, but if carts routinely held
hundreds of lines or needed independent indexing/querying, I'd split them
into their own collection keyed by userId.

## Why refresh tokens are their own collection

Unlike cart/wishlist, a refresh token has a lifecycle independent of the
user: it's created at login, rotated on every refresh, explicitly revoked on
reuse detection or logout, and expires on its own schedule. A user can also
hold several at once (one per active session/device). That's a real
one-to-many relationship with its own state machine, which is exactly the
case embedding is wrong for — it earns its own collection where cart/wishlist
don't.

## Why permissions are strings on the role

`Role.permissions` is a plain `string[]` like `["products:write",
"orders:read"]`, not a separate `Permission` collection with a join table. A
permission here has no attributes of its own — no description, no metadata,
nothing that would justify it being a first-class document. It's a key that
either gates a route or doesn't. Modeling it as its own collection would add
a lookup with nothing to look up. The actual catalogue of valid permission
strings lives in code (`permissions.ts`), because a permission is only
meaningful if some route actually checks for it — a permission a database
could invent that no code enforces would do nothing.

## Stock modelling

`stock` is a single number per product, not tracked per variant combination
(e.g. "size M in black" doesn't have its own count). The brief's data doesn't
call for per-variant inventory, and modelling it would mean a
combinatorial stock document per variant combination for every product,
most of which would sit at whatever the catalogue-wide number already
represents. If this needed real per-variant inventory, `variants` would need
its own stock field per option combination, and the checkout stock-claim
logic (currently keyed by productId) would need to key by product+variant
instead.

## Indexes

- `Product.title` — indexed for the duplicate-title check on create/update
  and for the title-search filter on the listing endpoint.
- `User.email` — indexed (implicitly unique via the login lookup path) since
  every login and registration does an exact-match lookup by email.
- `Order` has a compound partial unique index on `{ userId, idempotencyKey }`
  — partial because orders placed without a key shouldn't collide with each
  other on `null`, and unique so a replayed checkout request with the same
  key can never create a second order even under a race.
- `RefreshToken.userId` and the token hash are queried on every refresh
  request, so both are indexed.
