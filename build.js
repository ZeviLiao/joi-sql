var toCamelCase = require('to-camel-case')

function ifValThen(column, property, value, then) {
	var equal = Array.isArray(value) ? value.some(function(value) { return column[property] === value}) : column[property] === value

	return equal ? then : ''
}

var maxIntValues = {
	tinyint: 255,
	smallint: 65535,
	mediumint: 16777215,
	int: 4294967295,
	bigint: 18446744073709551615
}

function getSignedValue(num) {
	return (num - 1) / 2
}

function decimalLessThan(precision) {
	return Math.pow(10, precision)
}

function unrollEnum(col) {
	return col.COLUMNTYPE.match(/enum\((.+)\)/)[1]
}

var checks = [

	function intCheck(column) {
		var checks = ''
		if (maxIntValues[column.DATATYPE]) {
			checks += '.number().integer()'

			var min = 0
			var max = maxIntValues[column.DATATYPE]
			if (column.COLUMNTYPE.indexOf('unsigned') === -1) {
				max = getSignedValue(max)
				min = -1 * (max + 1)
			}

			checks += '.max(' + max + ').min(' + min + ')'
		}

		return checks
	},

	function dateCheck(column) {
		return ifValThen(column, 'DATATYPE', ['datetime', 'date', 'timestamp'], '.date()')
	},

	function stringCheck(column) {
		return ifValThen(column, 'DATATYPE', ['text', 'varchar', 'char'], '.string().max(' + column.CHARACTERMAXIMUMLENGTH + ')')
	},

	function boolCheck(column) {
		return (column.DATATYPE === 'bit' && column.NUMERICPRECISION == '1') ? '.boolean()' : ''
	},

	function decimalCheck(column) {
		return ifValThen(column, 'DATATYPE', 'decimal', '.number().precision('
			+ column.NUMERICSCALE + ').less(' + decimalLessThan(column.NUMERICPRECISION - column.NUMERICSCALE) + ')')
	},

	function enumCheck(column) {
		if (column.DATATYPE === 'enum') {
			return '.any().valid(' + unrollEnum(column) + ')'
		}
		return ''
	},

	function nullableCheck(column) {
		if (column.ISNULLABLE === 'YES') {
			// return '.allow(null)'
			return ''
		} else if (column.ISNULLABLE === 'NO') {
			// return '.invalid(null)'
			return '.required()'
		}
	}

]

module.exports = function(columns, camelCaseProperties) {
	return 'Joi.object({\n\t' + columns.map(function(column) {
		var property = camelCaseProperties ? toCamelCase(column.COLUMNNAME) : column.COLUMNNAME
		return property + ': Joi' + checks.map(function(check) {
			return check(column)
		}).join('')
	}).join(',\n\t') + '\n})'
}
