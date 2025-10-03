(function(global){
  function toNumber(value, fallback){
    var n=Number(value);
    if(!isFinite(n)) return fallback;
    return n;
  }

  function sanitizePrev(value){
    return toNumber(value, 0);
  }

  function sanitizeCurrent(value){
    var n=toNumber(value, 1);
    if(n<=0){
      return 1;
    }
    return n;
  }

  var FibonacciDamage={
    initial:function(){
      return { prev:0, current:1 };
    },
    next:function(prev,current){
      var prevSafe=sanitizePrev(prev);
      var currentSafe=sanitizeCurrent(current);
      var nextValue=prevSafe+currentSafe;
      if(!isFinite(nextValue)||nextValue<=0){
        nextValue=1;
      }
      return { prev:currentSafe, next:nextValue };
    }
  };

  if(global){
    global.FibonacciDamage=FibonacciDamage;
  }
  if(typeof module!=='undefined' && module.exports){
    module.exports=FibonacciDamage;
  }
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null);

