const Task = require('data.task')

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

co.wrap = function (fn) {
  createPromise.__generatorFunction__ = fn;
  return createPromise;
  function createPromise() {
    return co.call(this, fn.apply(this, arguments));
  }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 *
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

function co(gen) {
  var ctx = this;
  var args = slice.call(arguments, 1)

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  return new Task(function(resolve, reject) {
    if (typeof gen === 'function') gen = gen.apply(ctx, args);
    if (!gen || typeof gen.next !== 'function') return resolve(gen);

    onFulfilled();

    /**
     * @param {Mixed} res
     * @return {Promise}
     * @api private
     */

    function onFulfilled(res) {
      var ret;
      try {
        ret = gen.next(res);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * @param {Error} err
     * @return {Promise}
     * @api private
     */

    function onRejected(err) {
      var ret;
      try {
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }
      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     *
     * @param {Object} ret
     * @return {Promise}
     * @api private
     */

    function next(ret) {
      if (ret.done) return resolve(ret.value);
      var value = toTask.call(ctx, ret.value);
      if (value && isTask(value)) return value.fork(onRejected, onFulfilled);
      return onRejected(new TypeError('You may only yield a function, task, promise, generator, array, or object, '
        + 'but the following object was passed: "' + String(ret.value) + '"'));
    }
  });
}

function promiseToTask(obj) {
  return new Task((rej, res) => obj.then(res, rej))
}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

function toTask(obj) {
  if (!obj) return obj;
  if (isTask(obj)) return obj;
  if (isPromise(obj)) return promiseToTask.call(this, obj)
  if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
  if ('function' == typeof obj) return thunkToTask.call(this, obj);
  if (Array.isArray(obj)) return arrayToTask.call(this, obj);
  if (isObject(obj)) return objectToTask.call(this, obj);
  return obj;
}

/**
 * Convert a thunk to a promise.
 *
 * @param {Function}
 * @return {Promise}
 * @api private
 */

function thunkToTask(fn) {
  var ctx = this;
  return new Task(function (reject, resolve) {
    fn.call(ctx, function (err, res) {
      if (err) return reject(err);
      if (arguments.length > 2) res = slice.call(arguments, 1);
      resolve(res);
    });
  });
}

function taskAll(arr) {
  var results = [];

  var merged = arr.reduce(
    (acc, obj) => acc.chain(() => obj).map(r => results.push(r)),
    Task.of());

  return merged.map(() =>  results);
}

/**
 * Convert an array of "yieldables" to a task.
 * Uses `taskAll` internally.
 *
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

function arrayToTask(obj) {
  return taskAll(obj.map(toTask, this))
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

function objectToTask(obj){
  var results = new obj.constructor();
  var keys = Object.keys(obj);
  var tasks = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var task = toTask.call(this, obj[key]);
    if (task && isTask(task)) defer(task, key);
    else results[key] = obj[key];
  }
  return taskAll(tasks).map(function () {
    return results;
  });

  function defer(task, key) {
    // predefine the key in the result
    results[key] = undefined;
    tasks.push(task.map(function (res) {
      results[key] = res;
    }));
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return 'function' == typeof obj.then;
}


/**
 * Check if `obj` is a task.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isTask(obj) {
  return 'function' == typeof obj.fork
  // return obj instanceof Task;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */
function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return Object == val.constructor;
}
