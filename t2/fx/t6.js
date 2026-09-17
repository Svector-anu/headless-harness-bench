const {spawn,execSync}=require("child_process");
const BASE=process.env.BASE,H2=process.env.H2;
const fx=spawn("fx",["ask","--json","--yolo","--no-save",
  "Use your shell tool to run the command `sleep 60` and wait for it to complete, then say done."],
  {cwd:BASE+"/fixture",env:{...process.env,HOME:H2}});
let out="";fx.stdout.on("data",d=>out+=d);
fx.on("exit",(c,s)=>console.log("[fx exit] code="+c+" signal="+s+" at +"+(Date.now()-t0)+"ms"));
const t0=Date.now();
// exact-cmdline match: only the real child whose full argv == "sleep 60"
const realSleep=()=>{try{return execSync("pgrep -x -f 'sleep 60'").toString().trim()}catch(e){return""}};
let detectedAt=0,killed=false;
const iv=setInterval(()=>{
  const el=Date.now()-t0;
  const child=realSleep();
  if(child && !detectedAt){detectedAt=el;console.log("[+"+el+"ms] REAL sleep 60 child pid(s): "+child.replace(/\n/g,","));}
  // operator cancels ~5s after the sleep actually starts (no --timeout flag exists)
  if(detectedAt && !killed && el>=detectedAt+5000){
    killed=true;fx.kill("SIGKILL");
    console.log("[+"+el+"ms] SIGKILL fx (pid "+fx.pid+") ~5s after sleep began");
    setTimeout(()=>{
      const after=realSleep();
      console.log("[orphan check +2s] sleep 60 still alive? "+(after?("YES ORPHAN -> "+after.replace(/\n/g,",")):"NO (clean kill)"));
      try{execSync("pkill -x -f 'sleep 60'")}catch(e){}
      clearInterval(iv);process.exit(0);
    },2000);
  }
  if(el>50000){console.log("[timeout] no real sleep child in 50s; out="+out.slice(0,150));fx.kill("SIGKILL");try{execSync("pkill -x -f 'sleep 60'")}catch(e){}clearInterval(iv);process.exit(0);}
},400);
