var Assert = require('assert');
var Queue = require('../index');

describe("Control", function() {
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
	
	describe("Concurrency", function() {
		var concurrency = 16;
		queue.concurrency = concurrency;
		
		it("should run " + concurrency + " concurrent tasks", function(done) {
			queue.push(tasks.splice(0, 64));
			queue.resume();
			
			process.nextTick(function() {
				Assert.equal(queue.running, concurrency);
				done();
			});
		});
	});
	
	describe("Buffer Callbacks", function() {
		it("should call the task's callback", function(done) {
			queue.buffer(tasks.shift(), function(err, res) {
				if(err) {
					done(err);
					return;
				}
				
				done();
			});
		});
	});
	
	describe("Buffer Worker", function() {
		it("should use an overriding work functon", function(done) {
			queue.buffer(tasks.shift(), function(err, res) {
				if(err) {
					done(err);
					return;
				}
				
				try {
					Assert.notEqual(typeof res.diff, "undefined");
					done();
				} catch(e) {
					done(e);
				}
			}, null, function(task, done) {
				done(null, {
					diff : task.a - task.b
				});
			});
		});
	});
});
