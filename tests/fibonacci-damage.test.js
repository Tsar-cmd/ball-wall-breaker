const assert=require('assert');
const FibonacciDamage=require('../fibonacci-damage.js');

(function(){
  const init=FibonacciDamage.initial();
  assert.strictEqual(init.prev,0,'initial prev should start at 0');
  assert.strictEqual(init.current,1,'initial damage should start at 1');

  let prev=init.prev;
  let current=init.current;
  const expected=[1,2,3,5,8,13];
  const observed=[];
  for(let i=0;i<expected.length;i++){
    const step=FibonacciDamage.next(prev,current);
    prev=step.prev;
    current=step.next;
    observed.push(current);
  }
  assert.deepStrictEqual(observed,expected,'damage progression should follow Fibonacci numbers');
})();

(function(){
  const result=FibonacciDamage.next('nope',-5);
  assert.strictEqual(result.prev,1,'invalid current should fallback to 1');
  assert.strictEqual(result.next,1,'invalid input should still produce at least 1 damage');
})();

console.log('All Fibonacci damage tests passed.');

