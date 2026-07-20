import { describe, expect, it } from 'vitest'
import { parseSystemdTimestamp } from './game-control.real.js'
import { decideSteamcmdOutcome } from './steamcmd.real.js'

describe('parseSystemdTimestamp', () => {
  it('parses the --timestamp=unix form (@epoch seconds → ms)', () => {
    expect(parseSystemdTimestamp('@1721445605')).toBe(1721445605_000)
  })

  it('parses the human UTC form via explicit ISO conversion', () => {
    expect(parseSystemdTimestamp('Sat 2026-07-20 03:20:05 UTC')).toBe(
      Date.parse('2026-07-20T03:20:05Z'),
    )
  })

  it('returns null for unset/empty/n/a', () => {
    expect(parseSystemdTimestamp('')).toBeNull()
    expect(parseSystemdTimestamp(undefined)).toBeNull()
    expect(parseSystemdTimestamp('0')).toBeNull()
    expect(parseSystemdTimestamp('n/a')).toBeNull()
  })

  it('returns null for garbage rather than a wrong number', () => {
    expect(parseSystemdTimestamp('not a date')).toBeNull()
  })
})

describe('decideSteamcmdOutcome', () => {
  it('trusts a Success! line even when the process exits non-zero (benign self-update)', () => {
    expect(decideSteamcmdOutcome({ code: 7, sawSuccess: true, sawError: false, lastErrorLine: null })).toEqual({
      ok: true,
    })
  })

  it('fails on an Error! line even when the process exits 0', () => {
    const out = decideSteamcmdOutcome({
      code: 0,
      sawSuccess: false,
      sawError: true,
      lastErrorLine: "Error! App '2394010' state is 0x606 after update job.",
    })
    expect(out).toEqual({ ok: false, message: "Error! App '2394010' state is 0x606 after update job." })
  })

  it('falls back to exit 0 = success when nothing definitive was printed', () => {
    expect(decideSteamcmdOutcome({ code: 0, sawSuccess: false, sawError: false, lastErrorLine: null })).toEqual({
      ok: true,
    })
  })

  it('fails on a non-zero exit with no success marker', () => {
    expect(
      decideSteamcmdOutcome({ code: 1, sawSuccess: false, sawError: false, lastErrorLine: null }),
    ).toMatchObject({ ok: false })
  })
})
