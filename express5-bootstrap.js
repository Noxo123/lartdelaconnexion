const expressPath=require.resolve('express');
const express=require(expressPath);
if(!express.__express5WildcardPatched){
  const original=express;
  const wrapped=function(...args){
    const app=original(...args);
    const get=app.get.bind(app);
    app.get=function(...routeArgs){
      if(routeArgs.length>1&&routeArgs[0]==='*')routeArgs[0]='/{*splat}';
      return get(...routeArgs);
    };
    return app;
  };
  Object.assign(wrapped,express);
  wrapped.__express5WildcardPatched=true;
  require.cache[expressPath].exports=wrapped;
}
