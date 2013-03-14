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
			Assert.equal(queue.flood, flood, "Wrong flood threshold");
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
							shouldBe = drain - 1;
							done();
						} catch (e) {
							done(e);
						}
					});

			queue.resume();
		});
	});

	describe("Event: flushed", function() {
		it("emits 'flushed' with results after all tasks complete", function(done) {
			queue.pause();
			queue.clear();
			queue.flushable = true;
			queue.collect = true;
			queue.cleanup = true;
			queue.push(tasks.splice(0, 48));
			shouldBe += 48;
			
			queue.resume();
			
			queue.once('flushed', function(res) {
				try {
					Assert.equal(queue.tasks, 0, "Tasks are still backlogged");
					Assert.equal(queue.running, 0, "Tasks are still running");
					Assert.equal(res.length, shouldBe, "Didn't return the right results: " + res.length);
					shouldBe = 0;
					done();
				} catch(e) {
					done(e);
				}
			});
		});
		
		it("clears the results list when cleanup is true", function() {
			Assert.equal(queue.results.length, 0);
		});
		
		it("doesn't save resutls when collect is false", function(done) {
			queue.pause();
			queue.clear();
			queue.flushable = true;
			queue.collect = false;
			queue.push(tasks.splice(0, 48));
			shouldBe += 48;
			
			queue.resume();
			
			queue.once('flushed', function(res) {
				try {
					Assert.equal(queue.tasks, 0, "Tasks are still backlogged");
					Assert.equal(queue.running, 0, "Tasks are still running");
					Assert.equal(queue.results.length, 0, "Didn't return the right results: " + queue.results.length);
					shouldBe = 0;
					done();
				} catch(e) {
					done(e);
				}
			});
		});
		
		it("doesn't emit 'flushed' when flushable is false", function(done) {
			queue.pause();
			queue.clear();
			queue.flushable = false;
			queue.collect = true;
			queue.push(tasks.splice(0, 48));
			shouldBe += 48;
			
			queue.resume();
			
			var to = setTimeout(function() {
				try {
					Assert.equal(queue.tasks, 0, "Tasks are still backlogged");
					Assert.equal(queue.running, 0, "Tasks are still running");
					Assert.equal(queue.results.length, shouldBe, "Wrong number of results: " + queue.results.length);
					shouldBe = 0;
					
					done();
				} catch(e) {
					done(e);
				}
			}, 24);
			
			queue.once('flushed', function() {
				clearTimeout(to);
				done(new Error("Flushed anyway..."));
			});
		});
	});
});
