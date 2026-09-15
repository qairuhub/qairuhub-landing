#!/usr/bin/env node
/**
 * Unit checks for the route contract in src/i18n/locale.ts (owned by WP0).
 * Run: `pnpm test:routes` (Node ≥ 22.18 / 23.6 strips the TypeScript types natively).
 */
import assert from 'node:assert/strict'
import { href, parseRoute, switchLocaleHref, stripAccent, fmt } from '../src/i18n/locale.ts'

let passed = 0
function check(name, fn) {
  try {
    fn()
    passed++
  } catch (err) {
    console.error(`FAIL ${name}\n  ${err.message}`)
    process.exitCode = 1
  }
}

const cases = [
  ['/', { locale: 'en', page: 'home', base: '/' }],
  ['/kk', { locale: 'kk', page: 'home', base: '/kk/' }],
  ['/kk/', { locale: 'kk', page: 'home', base: '/kk/' }],
  ['/members', { locale: 'en', page: 'members', base: '/' }],
  ['/members/', { locale: 'en', page: 'members', base: '/' }],
  ['/kk/members', { locale: 'kk', page: 'members', base: '/kk/' }],
  ['/kk/members/', { locale: 'kk', page: 'members', base: '/kk/' }],
  ['/handbook', { locale: 'en', page: 'handbook', base: '/' }],
  ['/kk/handbook', { locale: 'kk', page: 'handbook', base: '/kk/' }],
  ['/nope', { locale: 'en', page: 'notFound', base: '/' }],
  ['/kk/nope', { locale: 'kk', page: 'notFound', base: '/kk/' }],
  // what Cloudflare Pages / static servers may expose
  ['', { locale: 'en', page: 'home', base: '/' }],
  ['/index.html', { locale: 'en', page: 'home', base: '/' }],
  ['/kk/index.html', { locale: 'kk', page: 'home', base: '/kk/' }],
  ['/members.html', { locale: 'en', page: 'members', base: '/' }],
  ['/kk/handbook.html', { locale: 'kk', page: 'handbook', base: '/kk/' }],
  ['/404.html', { locale: 'en', page: 'notFound', base: '/' }],
  ['/kkk', { locale: 'en', page: 'notFound', base: '/' }],
  ['/kk/members/extra', { locale: 'kk', page: 'notFound', base: '/kk/' }],
  ['/book', { locale: 'en', page: 'notFound', base: '/' }],
  ['//members', { locale: 'en', page: 'members', base: '/' }],
]
for (const [path, expected] of cases) {
  check(`parseRoute(${JSON.stringify(path)})`, () => assert.deepEqual(parseRoute(path), expected))
}

const en = (p) => parseRoute(p)
check('href home', () => {
  assert.equal(href(en('/members'), '/'), '/')
  assert.equal(href(en('/kk/members'), '/'), '/kk/')
})
check('href anchors keep the trailing slash', () => {
  assert.equal(href(en('/'), '#offer'), '/#offer')
  assert.equal(href(en('/kk/'), '#offer'), '/kk/#offer')
})
check('href pages', () => {
  assert.equal(href(en('/'), 'members'), '/members')
  assert.equal(href(en('/kk/'), 'members'), '/kk/members')
  assert.equal(href(en('/'), 'handbook'), '/handbook')
  assert.equal(href(en('/kk/handbook'), 'handbook#privacy-on-this-site'), '/kk/handbook#privacy-on-this-site')
})
check('switchLocaleHref keeps page and hash', () => {
  assert.equal(switchLocaleHref(en('/members'), 'kk', '#x'), '/kk/members#x')
  assert.equal(switchLocaleHref(en('/kk/members'), 'en', '#x'), '/members#x')
  assert.equal(switchLocaleHref(en('/'), 'kk', '#offer'), '/kk/#offer')
  assert.equal(switchLocaleHref(en('/kk/'), 'en', 'offer'), '/#offer')
  assert.equal(switchLocaleHref(en('/handbook'), 'kk'), '/kk/handbook')
  assert.equal(switchLocaleHref(en('/kk/handbook'), 'en', ''), '/handbook')
  assert.equal(switchLocaleHref(en('/nope'), 'kk', '#'), '/kk/')
})
check('stripAccent + fmt', () => {
  assert.equal(stripAccent('Start where you *are*.'), 'Start where you are.')
  assert.equal(fmt('{title}, row {n}', { title: 'Ecosystem', n: 2 }), 'Ecosystem, row 2')
})

console.log(`test-routes: ${passed} checks passed${process.exitCode ? ', some FAILED' : ''}`)
