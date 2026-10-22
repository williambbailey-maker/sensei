// Menu platforms, keyed by the `provider` column in `stores`. Each module
// exports { name, enabled, needsBrowser (flag or fn(store)), fields,
// scrape(ctx, store) } and
// returns { products, meta } in the shared `products` row shape (plus an
// optional raw `sample` item, printed by a dry run).
//
// A store whose provider isn't listed here, or whose module has
// `enabled: false`, is skipped by a normal run (logged, not counted as a
// failure). DRY_RUN=1 runs disabled modules too, so a new platform can be
// tested on one store before it's switched on.
import dutchie from './dutchie.mjs'
import dispense from './dispense.mjs'
import carrot from './carrot.mjs'
import jane from './jane.mjs'
import blaze from './blaze.mjs'

export const PROVIDERS = { dutchie, dispense, carrot, jane, blaze }
