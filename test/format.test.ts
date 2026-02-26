import {expect} from 'chai'

import {formatAsToon} from '../src/format.js'

describe('format', () => {
  describe('formatAsToon', () => {
    it('returns empty string for null data', () => {
      expect(formatAsToon(null)).to.equal('')
    })

    it('returns empty string for undefined data', () => {
      const val = undefined
      expect(formatAsToon(val)).to.equal('')
    })

    it('encodes data as TOON', () => {
      const data = {key: 'value'}
      const result = formatAsToon(data)
      expect(result).to.be.a('string')
      expect(result.length).to.be.greaterThan(0)
    })

    it('returns empty string for 0', () => {
      expect(formatAsToon(0)).to.equal('')
    })

    it('returns empty string for empty string', () => {
      expect(formatAsToon('')).to.equal('')
    })

    it('returns empty string for false', () => {
      expect(formatAsToon(false)).to.equal('')
    })

    it('encodes an array', () => {
      const result = formatAsToon([1, 2, 3])
      expect(result).to.be.a('string')
      expect(result.length).to.be.greaterThan(0)
    })

    it('encodes nested objects', () => {
      const data = {outer: {inner: {deep: 'value'}}}
      const result = formatAsToon(data)
      expect(result).to.be.a('string')
      expect(result).to.include('deep')
      expect(result).to.include('value')
    })

    it('encodes a string value', () => {
      const result = formatAsToon('hello')
      expect(result).to.be.a('string')
      expect(result.length).to.be.greaterThan(0)
    })

    it('encodes a number value', () => {
      const result = formatAsToon(42)
      expect(result).to.be.a('string')
      expect(result.length).to.be.greaterThan(0)
    })

    it('encodes boolean true', () => {
      const result = formatAsToon(true)
      expect(result).to.be.a('string')
      expect(result.length).to.be.greaterThan(0)
    })
  })
})
