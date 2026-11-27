(function(global){
 "use strict";
 function isTrackable(value){
  if(!value||typeof value!=="object")return false;
  const prototype=Object.getPrototypeOf(value);
  return Array.isArray(value)||prototype===Object.prototype||prototype===null;
 }
 function createStore(initialState){
  const listeners=new Set();
  const proxies=new WeakMap();
  const paths=new WeakMap();
  function notify(change){for(const listener of [...listeners]){try{listener(change,rootProxy)}catch(error){console.error("WAYPOINT store subscriber failed:",error)}}}
  function wrap(target,path=[]){
   if(!isTrackable(target))return target;
   if(proxies.has(target))return proxies.get(target);
   const proxy=new Proxy(target,{
    get(object,key,receiver){
     const value=Reflect.get(object,key,receiver);
     return isTrackable(value)?wrap(value,path.concat(String(key))):value;
    },
    set(object,key,value){
     const previous=object[key];
     const next=isTrackable(value)?value:value;
     if(Object.is(previous,next))return true;
     const success=Reflect.set(object,key,next);
     if(success)notify({type:"set",path:path.concat(String(key)),previous,value:next});
     return success;
    },
    deleteProperty(object,key){
     if(!Object.prototype.hasOwnProperty.call(object,key))return true;
     const previous=object[key],success=Reflect.deleteProperty(object,key);
     if(success)notify({type:"delete",path:path.concat(String(key)),previous});
     return success;
    }
   });
   proxies.set(target,proxy);paths.set(proxy,path);return proxy;
  }
  const rootProxy=wrap(initialState);
  return {
   getState(){return rootProxy},
   subscribe(listener){if(typeof listener!=="function")throw new TypeError("listener must be a function");listeners.add(listener);return()=>listeners.delete(listener)},
   setState(patch){if(!patch||typeof patch!=="object")throw new TypeError("patch must be an object");Object.assign(rootProxy,patch)},
   getSubscriberCount(){return listeners.size}
  };
 }
 global.WaypointStore=Object.freeze({createStore});
})(window);
