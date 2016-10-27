# co with Task

> *This is an experiment to refactor the uber-cool library [co](https://github.com/tj/co) to use `data.Task` instead of Promises for its API.*

## Example

```js
'use strict'

const co = require('co')
const Task = require('data.task')

const task = co(function* (id) {
  // Yield tasks
  console.log(yield Task.of('task'))

  // Yield promises
  console.log(yield Promise.resolve('promise'))

  // Yield an array of yieldables
  console.log(yield [Task.of('task'), Promise.resolve('promise')])

  // Yield an object of yieldables
  console.log(yield {
    a: Task.of('task'),
    b: Promise.resolve('promise'),
  })
  return 'end'
})


task.fork(console.error, console.log)
```
