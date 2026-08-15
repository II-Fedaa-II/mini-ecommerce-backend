# Database — design notes

> **Write this section yourself, in your own words.** The assessment explicitly asks for
> these rationale docs to be written manually with no AI assistance. The headings and
> prompts below are only a checklist of what the evaluators asked you to cover — delete
> the prompts as you replace them with your own explanation.

## Why MongoDB

<!-- Why a document database for this project rather than a relational one? What made it
     a good fit for a catalogue with per-product variants? -->

## Collections

<!-- Walk through each collection and why it exists:
     - products
     - users
     - roles
     - refreshtokens
     - orders -->

## Why cart and wishlist are embedded on the user

<!-- Each user has exactly one cart and one wishlist. Explain the trade-off you made by
     embedding them as arrays on the user document instead of giving them their own
     collections, and when you would change that decision. -->

## Why refresh tokens are their own collection

<!-- These have a lifecycle of their own — rotation, revocation, expiry — independent of
     the user. Explain why that earns a separate collection when the cart did not. -->

## Why permissions are strings on the role

<!-- Permissions are plain keys like `products:write` with no attributes of their own.
     Explain why you did not build a separate permissions collection with a join. -->

## Stock modelling

<!-- Stock is a single number per product, not per variant combination. Explain that
     choice and what would need to change to support per-variant inventory. -->

## Indexes

<!-- Which fields are indexed and why (login by email, role lookups, product lookups). -->
