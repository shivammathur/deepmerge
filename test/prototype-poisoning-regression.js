var test = require('tape')

var implementations = {
	source: require('../index'),
	commonjs: require('../dist/cjs'),
	umd: require('../dist/umd'),
}

function payload() {
	return JSON.parse('{ "__proto__": { "polluted": true }, "safe": true }')
}

function checkPrototype(t, value) {
	t.equal(Object.getPrototypeOf(value), Object.prototype, 'the result keeps its normal prototype')
	t.equal(value.polluted, undefined, 'the result does not inherit attacker-controlled values')
	t.notOk(Object.prototype.hasOwnProperty.call(value, '__proto__'), 'the forbidden key is omitted')
	t.equal({}.polluted, undefined, 'unrelated objects remain unaffected')
	t.equal(value.safe, true, 'ordinary properties are preserved')
}

Object.keys(implementations).forEach(function(name) {
	var merge = implementations[name]

	test(name + ': rejects __proto__ with a null-prototype target', function(t) {
		checkPrototype(t, merge(Object.create(null), payload()))
		t.end()
	})

	test(name + ': rejects __proto__ with non-object placeholders', function(t) {
		;[null, undefined, false, 0, ''].forEach(function(value) {
			checkPrototype(t, merge({ session: value }, { session: payload() }).session)
		})
		t.end()
	})

	test(name + ': rejects an own __proto__ key in either operand', function(t) {
		checkPrototype(t, merge(payload(), {}))
		checkPrototype(t, merge(payload(), payload()))
		t.end()
	})

	test(name + ': rejects nested __proto__ keys in arrays and merge.all', function(t) {
		checkPrototype(t, merge({ list: [] }, { list: [payload()] }).list[0])
		checkPrototype(t, merge.all([{ session: null }, { session: payload() }]).session)
		t.end()
	})

	test(name + ': skips forbidden getters before reading either operand', function(t) {
		var object = { safe: true }
		var reads = 0
		Object.defineProperty(object, '__proto__', {
			enumerable: true,
			get: function() {
				reads += 1
				return { polluted: true }
			},
		})
		checkPrototype(t, merge(object, {}))
		checkPrototype(t, merge(Object.create(null), object))
		t.equal(reads, 0, 'forbidden getters are never evaluated')
		t.end()
	})
})
