var FS = require('fs');
var Path = require('path');

var test_dir = Path.resolve(__dirname, '../tests');
var tests = FS.readdirSync(test_dir);

describe("Qrly", function() {
	tests.forEach(function(t) {
		var test = Path.basename(t, '.js');
		console.log("Loading test " + test);
		require( Path.join(test_dir, test));
	});
});
