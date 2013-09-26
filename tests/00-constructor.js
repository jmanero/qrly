var Assert = require('assert');
var Queue = require('../index');

describe("Constructor", function() {
	describe("Without options", function() {
		var queue = new Queue();

		it("shouldn't be paused", function() {
			Assert.ok(!queue.paused);
		});

		it("should collect", function() {
			Assert.ok(queue.collect);
		});

		it("should have a concurrency of 1", function() {
			Assert.equal(queue.concurrency, 1);
		});

		it("should have a flood threshold of 256", function() {
			Assert.equal(queue.flood, 256);
		});

		it("should have a drain threshold of 1", function() {
			Assert.equal(queue.drain, 1);
		});
	});

	describe("With options", function() {
		var concurrency = 24;
		var flood = 64;
		var drain = 32;
		var queue = new Queue({
			paused : true,
			flushable : false,
			collect : false,
			cleanup : false,
			concurrency : concurrency,
			flood : flood,
			drain : drain
		});

		it("should be paused", function() {
			Assert.ok(queue.paused);
		});

		it("shouldn't collect", function() {
			Assert.ok(!queue.collect);
		});

		it("should have the correct concurrency", function() {
			Assert.equal(queue.concurrency, concurrency);
		});

		it("should have the correct flood threshold", function() {
			Assert.equal(queue.flood, flood);
		});

		it("should have the correct drain threshold", function() {
			Assert.equal(queue.drain, drain);
		});
	});

});
