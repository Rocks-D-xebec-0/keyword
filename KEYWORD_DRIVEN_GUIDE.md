# Keyword-Driven Testing with Playwright (TypeScript): Guide for QA Engineers

This guide explains the keyword-driven pattern using the working proof of concept in this folder, which tests https://www.saucedemo.com. It describes only what the code does. Where it gives opinions or trade-offs, it says so.

Important: **Playwright has no native keyword-driven support.** Playwright gives you a browser automation API and a test runner (`@playwright/test`). Everything described here (the keyword registry, the JSON scenarios, the engine) is a thin framework written on top of it, about 170 lines of TypeScript in `engine/` (94 lines) and `keywords/` (73 lines). Playwright's own tools (codegen, trace viewer, UI mode, VS Code extension) do not understand keywords.

Current state of the PoC: 7 scenarios, 16 keywords, 4 locator files, Chromium only. All 7 scenarios passed on the last run.

---

## 1. What keyword-driven testing is

A test is written as a list of **steps**. Each step names a **keyword** (a reusable action such as `login` or `assertText`) plus its arguments. The test logic lives in data, not in code. A small **engine** reads the data and calls the TypeScript function registered under each keyword name.

Two kinds of people can then work on different layers:

- **Scenario authors** write steps (JSON here), using the vocabulary.
- **Automation engineers** write keywords (TypeScript) and locators.

### A scenario in this project (`testdata/06-checkout.json`)

```json
{
  "name": "Full checkout end to end",
  "tags": ["smoke", "e2e"],
  "steps": [
    { "keyword": "login" },
    { "keyword": "addToCart", "item": "addBackpack" },
    { "keyword": "openCart" },
    { "keyword": "checkout" },
    { "keyword": "assertUrl", "value": "checkout-complete" },
    { "keyword": "assertText", "target": "checkout.complete", "value": "Thank you for your order!" }
  ]
}
```

### Flow of one run

```
 npx playwright test
        |
        v
 tests/keyword.spec.ts
   loadScenarios()  ----reads----> testdata/*.json  (one file = one scenario)
   for each scenario:
     SCENARIO_TAG set and tag not in scenario.tags?  --> skip
     test(title, async ({ page }) => ...)            <-- a normal Playwright test
        |
        v
 engine/runner.ts  runSteps(new Context(page), steps)
   for each step i:
     1. registry[step.keyword]  (keywords/index.ts)
        not found -> throw "unknown keyword ... Available keywords: ..."
     2. ctx.interpolate(args)   replace ${var} from ctx.vars
        undefined var -> throw
     3. test.step("i. keyword (args)")  <-- shows in the HTML report
        |
        v
 keywords/*.ts   fn(ctx, step)
   ui.ts          open click fill select press store
   assertions.ts  assertVisible assertNotVisible assertText assertUrl assertCount
   saucedemo.ts   login addToCart openCart checkout logout
        |   (composite keywords call the basic ones: login = open + fill + fill + click)
        v
 engine/context.ts  ctx.locator("login.username")
   "page.name"  -> looked up in locators/<page>.json -> CSS selector
   anything else -> used as a raw selector
        |
        v
 Playwright page API  (page.locator(...).click(), expect(...).toBeVisible(), ...)
```

---

## 2. Project structure walkthrough

```
saucedemo-keyword-poc/
  package.json            scripts: test, test:smoke, report
  playwright.config.ts    testDir ./tests, list + html reporter, baseURL, trace
  tsconfig.json           strict TypeScript
  tests/
    keyword.spec.ts       the ONLY spec file: loops over scenarios, one test() each
  engine/                 the framework (rarely changes)
    loader.ts             reads testdata/*.json into Scenario objects
    runner.ts             runSteps(): lookup keyword, interpolate, wrap in test.step
    context.ts            Context: page, variables, ${var} interpolation, locator lookup
  keywords/               the vocabulary (grows over time)
    index.ts              registry = { ...ui, ...assertions, ...saucedemo }
    ui.ts                 generic actions
    assertions.ts         generic checks
    saucedemo.ts          business-level keywords for this app
  locators/               page name -> element name -> selector
    login.json  inventory.json  cart.json  checkout.json
  testdata/               the scenarios (what QA authors write)
    login.json  02-locked-out.json  03-invalid-password.json  04-add-one-item.json
    05-add-multiple.json  06-checkout.json  07-logout.json
```

### File by file

| File | Role | Notes taken from the code |
|---|---|---|
| `tests/keyword.spec.ts` | Bridge to Playwright | Generates one `test()` per scenario at load time. Title is `name @tag @tag`. Honors env var `SCENARIO_TAG` (exact match against a scenario's `tags`). |
| `engine/loader.ts` | Scenario loading | Reads every `*.json` in `testdata/`, sorted by filename. Throws if `steps` is not an array. Does not validate keyword names or arguments. |
| `engine/runner.ts` | Execution | For each step: finds the function in `registry`, interpolates `${var}` in every argument except `keyword`, runs it inside `test.step(...)`. The step title is `N. keyword (arg=value, ...)`. |
| `engine/context.ts` | Shared state | `ctx.page` (the Playwright page), `ctx.vars` (variables), `ctx.interpolate()`, `ctx.selector()`, `ctx.locator()`. Loads all `locators/*.json` once per `Context`. |
| `keywords/ui.ts` | Basic actions | `open`, `click`, `fill`, `select`, `press`, `store` (saves an element's text into a variable, referenced later as `${name}`). |
| `keywords/assertions.ts` | Basic checks | `assertVisible`, `assertNotVisible`, `assertText` (contains by default, `"exact": true` for exact), `assertUrl` (value is a regex), `assertCount`. All use Playwright's auto-retrying `expect`. |
| `keywords/saucedemo.ts` | Business keywords | `login`, `addToCart`, `openCart`, `checkout`, `logout`. Each composes basic keywords. They carry defaults (user `standard_user`, item `addBackpack`, checkout name `Test User`, postal code `12345`). |
| `locators/*.json` | Selector store | Example: `"loginButton": "[data-test='login-button']"`. Referenced as `login.loginButton`. |
| `playwright.config.ts` | Runner config | `trace: 'retain-on-failure'`, HTML reporter with `open: 'never'`, Chromium desktop only. |

Two behaviors worth knowing:

- Any `.json` file dropped into `testdata/` becomes a test automatically. No registration is needed.
- If a target does not look like `page.name` or the page file is unknown, it is treated as a raw selector. That is convenient but means a typo in a page name (for example `logn.username`) is silently treated as a CSS selector and fails later at the Playwright level, not with a "locator not found" message. A typo in the element name of a known page (`login.usernme`) does give a clear error listing the available names.

---

## 3. When you NEED it

Keyword-driven testing pays off in specific situations. If none of these apply to you, see section 8.

1. **Non-coders must author or maintain tests.** Manual testers, business analysts or domain experts can compose scenarios from a fixed vocabulary without writing TypeScript. In this PoC they edit JSON; in a real setup you would usually put a friendlier front end (spreadsheet, form) over the same engine (see below).
2. **Large, repetitive regression suites.** When hundreds of scenarios are variations of the same actions (login, add item, pay), keeping the logic in one keyword means a UI change is fixed once. Here `login` is defined once in `keywords/saucedemo.ts` and used by all seven scenarios.
3. **Business-readable steps.** Stakeholders or auditors want to read `login`, `addToCart`, `checkout`, not `page.locator(...).click()`. The step names also appear verbatim in the Playwright HTML report via `test.step`.
4. **A shared vocabulary across teams.** Several teams (or several apps) can agree on keyword names and semantics (`login`, `assertText`), while each owns its own implementation and locators.
5. **Test cases already live outside code.** If cases are authored in Excel, Jira, TestLink or similar, a keyword model gives them a natural target: each row is `keyword + arguments`. In this PoC the scenarios are JSON. **The code does not read Excel, Jira or TestLink.** To use those sources you would add a converter or change `engine/loader.ts` to produce the same `Scenario` objects (`name`, `tags`, `steps`). The runner would not need to change.
6. **Same flow, many data sets, authored by others.** A QA lead can add scenarios by adding files, with no spec changes and no engineering ticket (as long as the needed keywords already exist).

---

## 4. Why: the problem it solves

Plain test code mixes three concerns in one place: *what* is being verified (the business intent), *how* the UI is driven (clicks and selectors), and *which data* is used. When those are tangled:

- Only people who can code can write or review tests.
- A selector change touches many tests.
- Repeated flows are copy-pasted, then drift apart.
- The test reads as implementation, so intent is hard to review.

Keyword-driven testing separates them into three layers, each with its own owner and rate of change:

| Layer | In this PoC | Changes when | Owner |
|---|---|---|---|
| Scenario (what) | `testdata/*.json` | Requirements change | QA / analysts |
| Keyword (how) | `keywords/*.ts` | A flow or vocabulary changes | Automation engineers |
| Locator (where) | `locators/*.json` | The UI markup changes | Automation engineers |

---

## 5. Benefits

Each benefit below is tied to something visible in the code. Whether you realize it depends on how disciplined the keyword library is kept.

- **Scenarios need no TypeScript.** `testdata/04-add-one-item.json` is 3 steps of readable JSON.
- **Reuse.** The `login` keyword is one implementation shared by all seven scenarios. A change to the login flow is a one-place edit.
- **Selectors are separated from logic.** Selector changes go in `locators/*.json`, and no scenario or keyword changes.
- **Cheap to add scenarios.** Adding a file in `testdata/` adds a test. No spec edit.
- **Readable reports.** Each step is a `test.step` named `N. keyword (args)`, so the HTML report reads like the scenario.
- **Helpful errors for authors.** An unknown keyword fails with the list of valid keywords. An unknown locator name lists the valid names on that page. An undefined `${var}` lists known variables.
- **Still real Playwright underneath.** Auto-waiting, `expect` retries, traces, parallelism and projects all still apply, because the engine runs inside a normal `test()`.
- **Tag filtering.** `SCENARIO_TAG=smoke` selects a subset without changing code.
- **Portable scenarios.** Because scenarios are data, the same list of steps could in principle be run by another engine. This is a property of the pattern, not something the PoC demonstrates.

---

## 6. Honest drawbacks

Treat these as costs you pay in exchange for section 5.

- **Debuggability is worse.** A failure points into `engine/runner.ts` or a keyword, with the scenario step only visible in the `test.step` title. A stack trace does not point at a line in the JSON. You cannot set a breakpoint "on a step" without debugging the engine. Playwright's `--debug` / Inspector steps through engine code, not scenario rows.
- **Playwright tooling does not map onto it.**
  - Codegen (`npx playwright codegen`) produces plain Playwright code, not keyword steps. You would translate by hand.
  - The trace viewer works (the config keeps traces on failure), and `test.step` groups actions under each keyword. Even so, the actions shown are the Playwright calls made inside the keywords, not the JSON lines.
  - There is no IDE support for scenario JSON in this PoC: no autocomplete for keyword names, no argument hints, no "go to definition" from a step to its function.
- **Weak typing.** `Step` is `{ keyword: string; [arg: string]: any }`. Argument names (`target`, `value`, `item`, `user`) are not checked at compile time. A misspelled argument key is not rejected. For example, `{"keyword": "assertText", "targt": "..."}` fails at runtime inside the keyword. Even a misspelled keyword is only caught when that step is reached, after earlier steps have already run, because the loader does not validate keyword names.
- **Keyword sprawl.** Without discipline the vocabulary grows into hundreds of near-duplicates (`loginAsAdmin`, `loginAsAdminWithMfa`, ...). Business keywords like `checkout` embed defaults and hidden behavior that scenario readers cannot see.
- **Indirection.** To know what `checkout` does you open `keywords/saucedemo.ts`; to know which selector it clicks you open `locators/checkout.json`. Three hops (JSON, keyword, locator JSON) versus one in a plain spec.
- **Limited expressiveness.** The engine has no loops, no conditionals, no reusable sub-scenarios and no setup/teardown concept in scenario files. Those would have to be built (or pushed into keywords in TypeScript). Variables exist only via `store` and `${var}` (strings only).
- **You own the framework.** The engine is small, but you maintain it: validation, parallel-safety, reporting, upgrades. Nobody outside your team knows it, so onboarding costs more than for a standard Playwright spec.
- **No dedicated reporting at the scenario level beyond what Playwright provides.** The report is Playwright's standard HTML report. That is good, but there are no keyword-level metrics or business-level traceability unless you build them.
- **Locator lookup is simplistic.** Raw selectors fall through silently (see section 2). Selectors are CSS strings in JSON, so you lose Playwright's recommended `getByRole`/`getByLabel` locators unless you put them in a keyword in TypeScript, or extend `ctx.locator`.
- **Heavier than needed for small suites.** For 10 tests written by developers, the indirection is pure overhead.

---

## 7. Comparison with other patterns

Ratings are relative, for a typical team, and reflect judgment rather than measurement. "Plain" means ordinary `@playwright/test` specs.

| Pattern | Setup cost | Readability for non-coders | Maintainability | Debugging | Flexibility | Best for |
|---|---|---|---|---|---|---|
| **Plain Playwright specs** | Lowest. Install and write. | Low. Code. | Poor as the suite grows (duplication, scattered selectors). | Best. Native codegen, trace, UI mode, breakpoints in the real test. | Highest. Full TypeScript. | Small suites, developer-written tests, quick checks, spikes. |
| **Page Object Model (POM)** | Low to medium. | Low. Still code, but tidier. | Good. Selectors and page actions in one class per page. | Very good. Normal code, normal stack traces. | High. | Dev/SDET teams with a growing UI suite; the de facto Playwright pattern. |
| **Fixtures-based** (Playwright `test.extend`) | Low to medium. | Low. | Good. Setup, auth and data injected consistently. | Very good. | High. | Shared setup/teardown, logged-in state, API seeding; usually combined with POM. |
| **Data-driven** (one test body, many data rows) | Low. | Medium. Data tables are easy to read, the test body is code. | Good for input variations only. | Good. | Medium. Same steps, different data. | Same flow with many inputs (login matrix, validation rules). |
| **BDD / Cucumber (Gherkin)** | Medium to high. Feature files, step definitions, runner integration. | High. Given/When/Then in plain language. | Medium. Step definitions can sprawl and regex matching is brittle. | Medium. Indirection through step definitions. | Medium. | Teams that want business-readable specs and a shared language with product owners, with real collaboration on them. |
| **Keyword-driven (this PoC)** | Medium. Build engine, keyword library, locator store. | High, but only for steps already in the vocabulary. | Good if keyword discipline holds; poor if keywords sprawl. | Weaker. Indirection plus tooling gaps (section 6). | Medium. Limited to the vocabulary; new needs mean new code. | Non-coder authors, large repetitive suites, test cases sourced from external tools. |
| **Hybrid** (keywords on top of POM, optional fixtures and data-driven) | Highest. Two layers to build. | High at the scenario level. | Best at scale: selectors in page objects, flows in keywords. | Medium. Keyword layer still adds indirection; POM layer is debuggable. | High. Complex logic stays in TypeScript. | Mixed teams that need both non-coder authoring and developer-grade internals. |

Notes on the comparison:

- BDD and keyword-driven are close relatives. BDD uses natural-language sentences matched to code by pattern; keyword-driven uses a structured name plus arguments. BDD reads more like prose; keyword-driven is stricter and simpler to parse.
- Data-driven and keyword-driven are not exclusive. In this PoC scenarios are data, and a keyword scenario can itself be run over a data set if you extend the engine.
- POM and fixtures are not alternatives to keyword-driven; they are implementation techniques you can put underneath it.

---

## 8. When NOT to use it, and a decision checklist

### When NOT to use it

- Everyone writing tests is comfortable with TypeScript, and nobody else needs to read or write them.
- The suite is small (roughly under 30 to 50 tests) or short-lived.
- Tests are complex and exploratory: heavy network mocking, conditional flows, custom waiting, multi-tab/multi-context logic. Scenarios would degrade into one-off keywords.
- You depend heavily on Playwright codegen, UI mode, or the VS Code extension for productivity.
- Nobody will own the keyword library and keep it tidy.
- Your goal is mostly "readable specs for product owners" and they will actually engage with Gherkin; BDD tools have more ecosystem support for that.

### Decision checklist

Answer honestly. The more "yes" answers in the first block, the stronger the case.

Reasons for:
- [ ] Will people who do not write code author or edit test steps?
- [ ] Do we expect 100+ scenarios built mainly from the same 10 to 30 actions?
- [ ] Do test cases originate in Excel, Jira, TestLink or another non-code source we want to execute?
- [ ] Do stakeholders need to read the steps in business language?
- [ ] Do multiple teams need one shared vocabulary?

Reasons against:
- [ ] Do we have at least one engineer who will own the engine and keyword library for the long term?
- [ ] Can we accept slower debugging and no native codegen for scenario steps?
- [ ] Is our team ready to review new keywords for duplication before merging them?

Rough reading: if you answered "yes" to at least two of the "for" questions and all three of the "against" questions, keyword-driven is justified. If you only answered "yes" to the first reasons loosely, start with POM plus fixtures and revisit later.

---

## 9. How to use it

### Run

```bash
npm install
npx playwright install chromium     # first time only
npm test                            # all scenarios
npm run test:smoke                  # SCENARIO_TAG=smoke, scenarios tagged "smoke"
SCENARIO_TAG=negative npx playwright test
npx playwright test -g "checkout"   # filter by title (standard Playwright)
npx playwright test --headed        # watch the browser
npm run report                      # open the HTML report
```

Tags currently used in `testdata/`: `smoke`, `negative`, `cart`, `e2e`. Note that `SCENARIO_TAG` accepts one tag only.

### Read the report

1. Run `npm run report` (opens `playwright-report/index.html`).
2. Each scenario appears as one test titled `Scenario name @tag`.
3. Open it. Steps are listed as `1. login`, `2. addToCart (item=addBackpack)`, and so on. Nested Playwright actions appear under each step (`Click locator(...)`, `Fill ...`).
4. On failure the failing step is highlighted, with the error message and, because of `trace: 'retain-on-failure'`, an attached trace you can open to see the DOM snapshots and network around the failed action.
5. Typical engine-level failures give explicit messages: `unknown keyword 'x'. Available keywords: ...`, `Locator 'login.foo' not found. Available in login: ...`, `Variable '${x}' is not defined. Known: ...`.

### Add a scenario (no code)

Create `testdata/08-sort-products.json`:

```json
{
  "name": "Products page shows six items after login",
  "tags": ["smoke"],
  "steps": [
    { "keyword": "login" },
    { "keyword": "assertCount", "target": "inventory.items", "value": 6 }
  ]
}
```

Run `npx playwright test -g "six items"`. It is picked up automatically (the loader reads every `.json` in `testdata/`).

To reuse a value from the page, store it and reference it:

```json
{ "keyword": "store", "target": "inventory.firstItemName", "as": "firstName" },
{ "keyword": "assertText", "target": "inventory.firstItemName", "value": "${firstName}" }
```

### Add a keyword (needs TypeScript)

1. **Add locators if needed** in `locators/<page>.json`, for example in `locators/cart.json`:
   ```json
   "removeBackpack": "[data-test='remove-sauce-labs-backpack']"
   ```
2. **Add the keyword** in the right file. Generic actions go to `keywords/ui.ts`; generic checks to `keywords/assertions.ts`; app-specific flows to `keywords/saucedemo.ts`. For example in `keywords/saucedemo.ts`:
   ```ts
   removeFromCart: async (ctx) => {
     await ui.click(ctx, { keyword: 'click', target: 'cart.removeBackpack' });
   },
   ```
   A keyword is `async (ctx, step) => { ... }`. Read arguments from `step` (`step.item`, `step.value`) and use `ctx.locator('page.name')` to find elements.
3. **No registration step.** `keywords/index.ts` spreads `ui`, `assertions` and `saucedemo` into `registry`, so a new key in any of those objects is available immediately. If you create a new keyword file, add it to the spread in `keywords/index.ts`.
4. **Use it** in a scenario: `{ "keyword": "removeFromCart" }`.
5. **Keep names unique.** The registry is a plain object spread; if two files define the same name, the later spread silently wins (`saucedemo` over `assertions` over `ui`).

Conventions that keep the vocabulary healthy: verbs for actions (`addToCart`), `assert...` for checks, arguments over new keywords (use `item` instead of `addBackpack`/`addBikeLight` keywords), and a review step before merging new keywords.

---

## 10. Recommended hybrid: POM underneath keywords

In this PoC the keywords call `ctx.locator('login.username')` and Playwright directly. That is fine at PoC size. In a real project the stronger arrangement is three layers:

```
 Scenarios (JSON / Excel / Jira export)         <- non-coders write these
        |
 Keywords (thin: parse args, call a page object)  <- vocabulary, one line or few lines each
        |
 Page Objects (LoginPage, InventoryPage, ...)     <- selectors + page actions, typed, debuggable
        |
 Playwright API (getByRole, expect, fixtures)
```

Why this is better than either alone:

- Selectors and page logic live in typed classes with IDE navigation, instead of strings in JSON.
- Keywords become small and uniform, which limits sprawl: `login: (ctx, s) => ctx.pages.login.loginAs(s.user, s.password)`.
- Developers can write and debug plain Playwright specs against the same page objects (codegen, UI mode, breakpoints all work), while non-coders use keywords.
- You can use Playwright fixtures to supply the `page`, a pre-authenticated state, or API-seeded data to the `Context`.
- Playwright's recommended locators (`getByRole`, `getByLabel`) can be used inside page objects.

What it would take, relative to this PoC (none of this exists yet):

1. Create `pages/LoginPage.ts`, `pages/InventoryPage.ts`, etc., with methods that wrap the current selectors.
2. Give `Context` a `pages` object (or a factory), and change keywords in `keywords/saucedemo.ts` to delegate to them.
3. Keep `locators/*.json` only if non-engineers must edit selectors; otherwise move selectors into the page objects.
4. Optionally tighten typing: a discriminated union per keyword instead of `[arg: string]: any`, or a JSON schema for scenarios, so that editors and the loader can reject typos early.
5. If tests come from Excel, Jira or TestLink, add a loader that converts them to the existing `Scenario` shape. The runner stays unchanged.

Suggested adoption path: start with plain Playwright plus POM and fixtures. Introduce the keyword layer only when a concrete need from section 3 appears (non-coder authors, external test-case sources, very large repetitive suites). That way you pay the indirection cost only when you are getting something for it.
