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

var Group = Queue.Group = function(length, callback) {
    this.callback = callback;
    this.length = length;
    this.results = [];
};
Group.prototype.push = function(res) {
    this.length--;
    this.results.push(res);
    
    if(!this.length)
        process.nextTick((function() {
            this.callback(this.results);
        }).bind(this));
};

// Queue Mode. Aggregate results and emit in 'end' event
Queue.prototype.push = function(tt, meta, callback) {
    var self = this;
    if(typeof meta === 'function') {
        callback = meta;
        meta = undefined;
    }

    if (typeof tt === 'undefined') {
        if (!this.tasks.length && !this.running && !this.paused) {
            this.emit('end', this.results);
            this.clear();
        }

        return;
    }

    if (!Array.isArray(tt))
        tt = [ tt ];
    
    // Work group. Callback when all of it's tasks are complete
    var group;
    if(typeof callback === 'function')
        group = new Group(tt.length, callback);
        
    tt.forEach(function(t) {
        self.tasks.push({
            data : t,
            meta : meta,
            group : group
        });
    });

    process.nextTick(reactor.bind(this));
    if(this.tasks.length >= this.flood) {
        this.flooded = true;
        return false;
    }
    return true;
};

// Buffer Mode. Return result in task-local callback
Queue.prototype.buffer = function(task, callback, meta, worker) {
    this.tasks.push({
        data : task,
        callback : callback,
        meta : meta,
        worker : worker
    });

    process.nextTick(reactor.bind(this));
    if(this.tasks.length >= this.flood) {
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
        var worker = task.worker || self.worker;
        worker(task.data, function(err, res) {
            if (called) // Only call once
                return;
            called = true;

            // Return result to task-callback
            if (typeof task.callback === 'function') {
                process.nextTick(function() {
                    task.callback(err, res);
                });
            }

            // Create result container
            var result = {
                task : task.data,
                result : res,
                error : err
            };
            
            if (task.group) { // Group
                task.group.push(result);
            } else if (self.collect) { // Or Global
                self.results.push(result);
            }

            self.running--;
            reactor.call(self); // Replace myself 1-1
        }, task.meta);
    });

    reactor.call(this); // Spawn until fully saturated
}
