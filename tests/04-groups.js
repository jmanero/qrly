var Assert = require('assert');
var Queue = require('../index');

describe("Groups", function() {
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

    describe("Grouped Callbacks", function() {
        it("should return the right number of results", function(done) {
            var shouldBe = 128;
            queue.push(tasks.splice(0, shouldBe), function(res) {
                Assert.equal(res.length, shouldBe, "Group didn't return the right number of results")
                done();
            });
            queue.resume();
        });
    });
});
