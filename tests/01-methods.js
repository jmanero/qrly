var Assert = require('assert');
var Queue = require('../index');

describe("Methods", function() {
	var queue = new Queue({
		paused : true
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
		});
		it(count + " test tasks have been generated", function() {
			Assert.equal(tasks.length, count);
		});
	});

	describe("push(...)", function() {
		it("adds a task to the backlog", function() {
			queue.push(tasks.pop());
			shouldBe++;

			Assert.equal(queue.tasks.length, shouldBe);
		});

		it("adds an array of tasks to the backlog", function() {
			queue.push(tasks.splice(0, 12));
			shouldBe += 12;

			Assert.equal(queue.tasks.length, shouldBe);
		});

		it("adds tasks to the backlog with a meta value", function() {
			var meta = {
				foo : "bar",
				c : 3
			};
			queue.push(tasks.splice(0, 24), meta);
			shouldBe += 24;

			for ( var i = shouldBe - 24; i < queue.tasks.length; i++) {
				Assert.deepEqual(queue.tasks[i].meta, meta);
			}
		});

		it("adds tasks to the backlog with a custom worker", function() {
			var meta = {
				foo : "bar",
				c : 3
			};
			var work = function(task, done, meta) {
				done(null, {
					sum : task.a + task.b,
					difference : task.a + task.b - meta.c
				});
			};

			queue.push(tasks.splice(0, 24), meta, work);
			shouldBe += 24;

			for ( var i = shouldBe - 24; i < queue.tasks.length; i++) {
				Assert.strictEqual(queue.tasks[i].meta, meta, "Missing meta");
				Assert.strictEqual(queue.tasks[i].worker, work, "Missing worker");
			}
		});
	});

	describe("buffer(...)", function() {
		it("adds a task to the backlog", function() {
			queue.buffer(tasks.shift());
			shouldBe++;

			Assert.equal(queue.tasks.length, shouldBe);
		});

		it("adds a task to the backlog with a callback", function() {
			var callback = function(err, res) {

			};
			queue.buffer(tasks.shift(), callback);
			shouldBe++;

			Assert.strictEqual(queue.tasks[shouldBe - 1].callback, callback);
		});
	});

	describe("resume()", function() {
		it("sets paused to false and starts the internal loop", function(done) {
			queue.resume();
			Assert.ok(!queue.paused, "paused is still true");

			// release the thread to allow the queue to run before testing
			process.nextTick(function() {
				Assert.notEqual(queue.running, 0, "running is still 0");
				done();
			});
		});
	});
	
	describe("pause()", function() {
		it("sets paused to true", function() {
			queue.push(tasks);
			queue.pause();
			
			Assert.ok(queue.paused);
		});
		
		it("causes the internal loop to exit when running tasks complete", function() {
			Assert.notEqual(queue.tasks, 0, "Backlog is empty");
			Assert.equal(queue.running, 0, "Tasks are still running");
		});
	});
	
	describe("clear()", function() {
		it("empties the results array", function() {
			Assert.notEqual(queue.results.length, 0, "Results array is already empty");
			queue.clear();
			Assert.equal(queue.results.length, 0, "Results array is not empty");
		});
	});
});
