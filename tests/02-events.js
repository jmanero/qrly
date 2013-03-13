var Assert = require('assert');
var Queue = require('../index');

describe("Events", function() {
	var flood = 16;
	var drain = 5;

	var queue = new Queue({
		paused : true,
		flood : flood,
		drain : drain
	});

	queue.worker = function(task, done) {
		done(null, {
			sum : task.a + task.b
		});
	};

	var tasks = [], count = 500, shouldBe = 0;
	for ( var i = 0; i < count; i++) {
		tasks.push({
			a : Math.floor(Math.random() * 6) + 1,
			b : Math.floor(Math.random() * 6) + 1
		});
	}

	describe("Setup", function() {
		it("new queue has correct initial values", function() {
			Assert.ok(queue.paused, "Not paused");
			Assert.equal(queue.flood, flood, "Wrong flood threshold")
			Assert.equal(queue.drain, drain, "Wrong drain threshold");
		});
		it(count + " test tasks have been generated", function() {
			Assert.equal(tasks.length, count);
		});
	});

	describe("Event: flooded", function() {
		it("emmits 'flooded' event after the backlog equals " + flood, function(done) {
			var to = setTimeout(function() {
				done(new Error("Timeout"));
			}, 1000);

			queue.once('flooded', function() {
				clearTimeout(to);
				try {
					Assert.equal(queue.tasks.length, flood, "Backlog is not equal to flood: " + queue.tasks.length);
					done();
				} catch (e) {
					done(e);
				}
			});

			queue.push(tasks.splice(0, flood - 1));
			queue.push(tasks.shift());
		});
	});

	describe("Event: drained", function() {
		it("emits 'drained' event after the backlog falls below " + drain, function(done) {
			var to = setTimeout(function() {
				done(new Error("Timeout"));
			}, 1000);

			queue.once('drained',
					function() {
						queue.pause();
						clearTimeout(to);
						try {
							Assert.equal(queue.tasks.length, drain - 1, "Backlog is not equal to drain: "
									+ queue.tasks.length);
							done();
						} catch (e) {
							done(e);
						}
					});

			queue.resume();
		});
	});

	describe.skip("Event: flushed", function() {
		it("emits 'flushed' after all tasks complete", function() {

		});
		it("doesn't emit 'flushed' when flushable is false", function() {

		});
	});
});
