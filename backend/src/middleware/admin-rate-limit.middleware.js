// Local process protection; deployment-wide throttling remains a separate task.
export function createAdminMutationLimit({max=30,windowMs=60000,now=Date.now}={}) {
 const attempts=new Map();
 return (request,response,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(request.method))return next();
  const key=request.auth.userId;const time=now();let entry=attempts.get(key);
  if(!entry||time>=entry.until)entry={count:0,until:time+windowMs};
  entry.count++;attempts.set(key,entry);
  if(attempts.size>10000){for(const [id,item] of attempts)if(time>=item.until)attempts.delete(id);while(attempts.size>10000)attempts.delete(attempts.keys().next().value);}
  if(entry.count>max)return response.set('Retry-After',String(Math.max(1,Math.ceil((entry.until-time)/1000)))).status(429).json({success:false,message:'Too many Admin changes. Please wait before trying again.'});
  next();
 };
}
