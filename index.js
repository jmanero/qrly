/**
 * Copyright (c) 2012 John Manero, Dynamic Network Services Inc.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

var Queue = module.exports = function(options) {
    options = options || {};
    EventEmitter.call(this);

    this.running = 0;
    this.tasks = [];
    this.results = [];
    this.flooded = false;

    // Default false
    this.paused = !!options.paused;

    // Default True
    this.collect = (typeof options.collect === 'undefined') ? true : !!options.collect;

    this.concurrency = options.concurrency || 1;
    this.flood = options.flood || 256;
    this.drain = options.drain || 1;

    // Default Work Mapper. Override Plz.
    this.worker = function(t, c) {
        c(null, t);
    };
};
Util.inherits(Queue, EventEmitter);

var Task = Queue.Task = function(params, meta, group) {
    this.params = params;
    this.meta = meta;
    this.group = group;
    this.status = "queued";
};

Task.prototype.complete = function(error, result) {
    if (error) {
        this.status = "error";
        this.error = error;
        return;
    }

    this.status = "complete";
    this.result = result;
};

Task.prototype.toJSON = function() {
    var json = {
        status : this.status,
        params : this.params,
        meta : this.meta
    };

    if (this.result)
        json.result = this.result;
    if (this.error)
        json.error = this.error;

    return json;
};

var Group = Queue.Group = function(callback) {
    EventEmitter.call(this);

    this.callback = callback;
    this.tasks = [];
    this.complete = 0;
};
Util.inherits(Group, EventEmitter);

Group.prototype.push = function(task) {
    this.tasks.push(task);
};

Group.prototype.pop = function() {
    this.complete++;

    // Done
    if (this.complete == this.tasks.length)
        process.nextTick((function() {
            this.emit('end', this);
            this.callback(this);
        }).bind(this));
};

Group.prototype.isComplete = function() {
    return this.complete == this.tasks.length;
};

Group.prototype.toJSON = function() {
    return ({
        status : this.status,
        tasks : this.tasks
    });
};

// Queue Mode. Aggregate results and emit in 'end' event
Queue.prototype.push = function(tasks, meta, callback, worker) {
    var self = this;
    if (typeof meta === 'function') {
        callback = meta;
        meta = undefined;
    }

    if (typeof tasks === 'undefined') {
        if (!this.tasks.length && !this.running && !this.paused) {
            this.emit('end', this.results);
            this.clear();
        }

        return;
    }

    // Work group. Callback when all of it's tasks are complete
    var group = (typeof callback === 'function') ? new Group(callback) : undefined;

    // Create task objects from params
    tasks = (Array.isArray(tasks) ? tasks : [ tasks ]).map(function(params) {
        task = new Task(params, meta, group);
        task.worker = worker || self.worker; // Default

        if (group)
            group.push(task);
        return task
    });

    // Enqueue
    Array.prototype.push.apply(this.tasks, tasks);

    // Check for flood
    process.nextTick(reactor.bind(this));
    if (this.tasks.length >= this.flood) {
        this.flooded = true;
        return group || false;
    }
    return group || true;
};

// Buffer Mode. Return result in task-local callback
Queue.prototype.buffer = function(params, callback, meta, worker) {
    var task = new Task(params, meta);
    task.worker = worker || this.worker;
    task.callback = callback;

    // Enqueue
    this.tasks.push(task);

    process.nextTick(reactor.bind(this));
    if (this.tasks.length >= this.flood) {
        this.flooded = true;
        return false;
    }
    return true;
};

// Free stored results
Queue.prototype.clear = function() {
    this.results = [];
};

// Don't start new tasks. Allow running tasks to complete.
Queue.prototype.pause = function() {
    this.paused = true;
};

// Restart processing
Queue.prototype.resume = function() {
    this.paused = false;
    process.nextTick(reactor.bind(this));
};

// PRIVATE: Idempotent non-blocking work loop (as non-blocking as the supplied
// worker function)
function reactor() {
    var self = this;
    if (this.running >= this.concurrency) // Fully saturated
        return;

    if (this.paused) // Paused
        return;

    if (!this.tasks.length) { // Nothing else to do
        if (!this.running) { // This is the last one
            this.emit('end', this.results);
            this.clear();
        }

        return;
    }

    this.running++;
    var task = this.tasks.shift();

    if (this.tasks.length < this.drain) {
        this.flooded = false;
        this.emit('drain');
    }

    process.nextTick(function() {
        // Protect against multiple calls of callback by bad user-supplied
        // work function
        var called = false;

        // Worker function. Either supplied by task, or global
        task.status = "running";
        task.worker(task.params, function(err, res) {
            if (called) // Only call once
                return;
            called = true;

            // Return result to task-callback
            if (typeof task.callback === 'function') {
                process.nextTick(function() {
                    task.callback(err, res);
                });
            }

            task.complete(err, res);

            if (task.group) { // Group
                task.group.pop();

            } else if (self.collect) { // Or Global
                self.results.push(task);

            }

            self.running--;
            reactor.call(self); // Replace myself 1-1
        }, task.meta);
    });

    reactor.call(this); // Spawn until fully saturated
}
