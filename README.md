Qrly
====
A highly extensible buffer/queue with properly implemented asynchronicity. Based, in part, upon the inner-workings of `queue` in the `async` library.

### tl;dr; Usage
Qlry implements a simple asynchronous loop with both buffer and queue semantics.

__Setup__

    var queue = new Queue({
      concurrency : 32,
      flood : 64,
      drain : 32
    });
    queue.worker = function(task, complete) {
      var r = {};
      try {
        r.foo = task.a + task.b;
        complete(null, r);
      } catch(e) {
        complete(e);
      }
    };

__As a queue__

    queue.on('flushed', function(results) { ... });
    queue.push([ { a : 1, b : 2 }, { a : 4, b : 0 }, null, { a : "A", b : null } ]);
The arguments passed to `complete(...)` in the worker will be pushed onto the `results` array in an object with the original task entity:

    results.push({
      task : { a : 1, b : 2 },
      result : { foo : 3 },
      error : null // Hopefully...
    });

When the queue's task list (backlog) is emptied, and all tasks completed, a `flush` event will be emitted with the results array as payload.

__As a buffer__

    queue.flushable = false;
    queue.collect = false;
    queue.buffer({ "data" : [1, 2, 34, 4]}, function(err, res) { // Do Things; });
Setting `collect` to `false` keeps results from being saved internally. Setting `flushable` to `false` suppresses the `flushed` event. Only one task at a time can be passed to `buffer(...)`. The second argument (a function) will be called by `complete(...)` in the worker, above, when it finishes processing the the respective task.

When the queue's backlog becomes longer than the `flood` attribute a `flood` event will be emitted. When the length drops below the `drain` attribute, a `drain` event will be emitted.

### Tests
Run `bin/test.js` with mocha:

    mocha -R spec bin/test.js

### Theory
_For those unfamiliar with event loops. No hisses form the Java programmers please..._

Consider traditional synchronous loops (`while`, `for`, `each`, ...): A common code body is executed serially while a condition is true, or for each element in a set. The next iteration _cannot_ begin until the previous has completed (e.g. it blocks). This is generally a good thing if you want to, say, maintain consistent state within your program, know WTF your code is doing at any given time, or, maybe, do processor-intensive work.

But... What if you have I/O-intensive work? File access? REST requests? Database transactions? Synchronous interfaces will leave your processor idling while the program waits for a response. Asynchronous I/O is, fundamentally, intended to allow a program to use that idle time to do useful things... like making more async requests.

`Node.JS` gives us asynchronous I/O primitives. Good start; how would you go about making concurrent HTTP calls to an array of `N` URLs?

    var HTTP = require('http');
    var urls = [ "http://www.yahoo.com",
                 "http://www.linkedin.com",
                 "http://www.google.com",
                 "http://www.facebook.com" ];

    urls.forEach(function(u) {
      HTTP.get(u, function(res) {
        console.log("I got a response for " + u);
      });
    });

    console.log("I'm Out!");

Alright, that works. Try running it a couple times. _Hint: the order of responses probably changed. That's because the requests execute asynchronously._

"But `Array.forEach(...)` is synchronous! You said..." 

Yes, you're right. `forEach(...)` did block and execute the requests in the order that they appear in the array, but `HTTP.get(...)` is asynchronous, and returns before its respective HTTP transaction completes, allowing all of the requests to be "in flight" at the same time. The order in which the callbacks are called depends mainly upon how fast the remote web servers can pony up bytes to complete their responses. In fact, _none_ of the callbacks can be executed until the loop completes _and_ the code after it returns. Functions are still atomic!

"Now... I want to execute something once all of those requests have called back. Oh, and I have 10,000 URLs to query. Only do 10 at a time so I don't exhaust my server's TCP socket resources." Umm, #@&*^Á.

And we've found the problem: our good old synchronous control structures have no semantics for handling asynchronous flow. Clearly, we need something to do that... like a queue...

### API
 * `Constructor(options)` Supported `options` include the following and map to similarly named attributes, below.
  * `paused` When truthy, sets the initial state of the queue to paused.
  * `flushable`
  * `collect`
  * `cleanup`
  * `concurrency`
  * `flooded`
  * `drained`

#### Readonly Attributes
 * `runnning: Number` Count of tasks that have been shifted off of the backlog queue, but have not yet called back
 * `tasks: Array[Object]` Backlog of tasks that have not been started
 * `results: Array[Result]` Aggregation of `Results` returned by completed tasks. The `results` array will be returned as the payload of `flushed` events.
 * `flooded: Boolean` State flag to indicate that the queue's backlog length is longer than the `flood` attribute. Set `true` _internally_ before `flooded` events are emitted, and `false` before `drained` events.

#### Mutable Attributes
 * `worker: Function(task, callback, meta)` The default work function for the queue. `callback` is passed a function that accepts two arguments: `error` and `result`. It must be called before the work function returns. `mata` is an optional value that was passed into the queue with tasks in `push(...)` or `buffer(...)`. It's primary use-case is to share a resource (e.g. database connection) between a block of tasks passed to `push(...)`.
 * `paused: Boolean` Same as `pause()` method, below. Once the queue has been instantiated, use of the `pause()` and `resume()` methods is preferred over setting the value of `paused`.
 (default `false`)
 * `flushable: Boolean` If true, `flushed` events will be emitted when the backlog is emptied and all tasks completed. Useful if tasks are streamed in chunks with a terminating `end` event: set to false to keep the queue from flushing before all tasks have been received (default `true`)
 * `collect: Boolean` Save results and errors in the `results` array (default `true`)
 * `cleanup: Boolean` Empty the `results` array after every `flushed` event (default `true`)
 * `concurrency: Number` How many tasks to keep in-flight (default `1`)
 * `flood: Number` Upper threshold at which the `flooded` event is emitted (default `256`)
 * `drain: Number` Lower threshold at which the `drained` event is emitted (default `1`)

#### Methods
 * `push(task[, meta[, worker]])` Add a task (or array of tasks) to the queue. 
  * `meta` is an optional value that will be passed to the worker with the respective task(s) being queued by tat call to `push(...)`
  * Similarly, `worker` can be passed a function (that accepts the same arguments as that of the `worker` attribute, above) with a task, or block of tasks, to override the default worker for the respective task(s).
 * `buffer(task, callback(err, result)[, meta[, worker]])` Accepts a single task with a callback to be bound to that task.
  * `callback(err, res)` Must accept two arguments: `error` and `result`. Will be called after the work function calls its `complete(...)` callback.
  * See `push(...)` for `meta` and `worker` usages.
 * `clear()` Empty the results array
 * `pause()` Set the `paused` attribute to `true`. This will cause the internal loop to cease to start new tasks. It will complete all running tasks. Calling `pause()` is preferred over setting the `paused` attribute directly. Safe to call repeatedly.
 * `resume()` Set the `paused` attribute to false and restart the internal loop. Safe to call repeatedly.

#### Events
 * `flushed: function([Result])` Emitted when the backlog is emptied and all tasks completed. Payload contains an array of result and error entities returned by workers (if `collect` is `true`)
 * `flooded: function()` Emitted when the backlog length becomes greater than the `flood` attribute
 * `drained: function()` Emitted when the backlog length becomes less than the `drain` attribute

### MIT License
Copyright (c) 2013 John Manero, Dynamic Network Services

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.