import { describe, expect, it } from 'vitest'
import {
  applyInvariants,
  coerceValue,
  IniParseError,
  parseIni,
  renderValue,
  serializeIni,
} from './settings-ini.js'

// Fixture mirrors the real DefaultPalWorldSettings.ini shape: one
// section header, one giant OptionSettings tuple, quoted strings with
// commas/parens inside.
const FIXTURE = `[/Script/Pal.PalGameWorldSettings]
OptionSettings=(Difficulty=None,DayTimeSpeedRate=1.000000,ExpRate=1.000000,DeathPenalty=All,bEnableInvaderEnemy=True,DropItemMaxNum=3000,ServerName="My Server, with (parens) and commas",ServerDescription="",AdminPassword="secret123",ServerPassword="",PublicPort=8211,RCONEnabled=False,RCONPort=25575,RESTAPIEnabled=True,RESTAPIPort=8212,Region="",bUseAuth=True,BanListURL="https://api.palworldgame.com/api/banlist.txt",SomeFutureKey=WeDontKnowThis,SupplyDropSpan=180)
`

describe('parseIni / serializeIni', () => {
  it('round-trips byte-identical with no changes', () => {
    const parsed = parseIni(FIXTURE)
    expect(serializeIni(parsed)).toBe(FIXTURE)
  })

  it('keeps quoted commas and parens as one token', () => {
    const parsed = parseIni(FIXTURE)
    expect(parsed.entries.get('ServerName')).toBe('"My Server, with (parens) and commas"')
  })

  it('preserves unknown keys verbatim', () => {
    const parsed = parseIni(FIXTURE)
    expect(parsed.entries.get('SomeFutureKey')).toBe('WeDontKnowThis')
    parsed.entries.set('ExpRate', '2.000000')
    const out = serializeIni(parsed)
    expect(out).toContain('SomeFutureKey=WeDontKnowThis')
    expect(out).toContain('ExpRate=2.000000')
    // Everything else untouched.
    expect(out).toContain('ServerName="My Server, with (parens) and commas"')
  })

  it('only rewrites the changed key', () => {
    const parsed = parseIni(FIXTURE)
    parsed.entries.set('DropItemMaxNum', '5000')
    const out = serializeIni(parsed)
    expect(out).toBe(FIXTURE.replace('DropItemMaxNum=3000', 'DropItemMaxNum=5000'))
  })

  it('throws on garbage', () => {
    expect(() => parseIni('no tuple here')).toThrow(IniParseError)
    expect(() => parseIni('OptionSettings=(unclosed')).toThrow(IniParseError)
  })
})

describe('coerceValue / renderValue', () => {
  it('coerces each kind', () => {
    expect(coerceValue('bool', 'True')).toBe(true)
    expect(coerceValue('bool', 'False')).toBe(false)
    expect(coerceValue('int', '3000')).toBe(3000)
    expect(coerceValue('float', '1.500000')).toBe(1.5)
    expect(coerceValue('string', '"hello"')).toBe('hello')
    expect(coerceValue('enum', 'All')).toBe('All')
  })

  it('renders floats in UE 6-decimal style when the file did', () => {
    expect(renderValue('float', 2, '1.000000')).toBe('2.000000')
    expect(renderValue('float', 2.5, '1')).toBe('2.5')
    expect(renderValue('bool', true)).toBe('True')
    expect(renderValue('int', 42.9)).toBe('42')
    expect(renderValue('string', 'abc')).toBe('"abc"')
  })

  it('refuses strings containing double quotes', () => {
    expect(() => renderValue('string', 'a"b')).toThrow(IniParseError)
  })
})

describe('applyInvariants', () => {
  it('forces the panel control channel on every write', () => {
    const parsed = parseIni(
      FIXTURE.replace('RESTAPIEnabled=True', 'RESTAPIEnabled=False').replace(
        'RCONEnabled=False',
        'RCONEnabled=True',
      ),
    )
    applyInvariants(parsed, 8212)
    expect(parsed.entries.get('RESTAPIEnabled')).toBe('True')
    expect(parsed.entries.get('RCONEnabled')).toBe('False')
    expect(parsed.entries.get('RESTAPIPort')).toBe('8212')
    // Existing password untouched.
    expect(parsed.entries.get('AdminPassword')).toBe('"secret123"')
  })

  it('generates an AdminPassword when missing or empty', () => {
    const parsed = parseIni(FIXTURE.replace('AdminPassword="secret123"', 'AdminPassword=""'))
    applyInvariants(parsed, 8212)
    const pw = parsed.entries.get('AdminPassword')!
    expect(pw.length).toBeGreaterThan(10)
    expect(pw.startsWith('"')).toBe(true)
  })
})
