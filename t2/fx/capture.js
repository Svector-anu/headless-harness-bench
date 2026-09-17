const http=require("http"),fs=require("fs");
const port=parseInt(process.env.CAP_PORT,10);
const log=[];
const srv=http.createServer((req,res)=>{
  let body="";req.on("data",c=>body+=c);
  req.on("end",()=>{
    log.push({method:req.method,url:req.url,ct:req.headers["content-type"],body:body.slice(0,6000)});
    fs.writeFileSync(process.env.CAP_OUT,JSON.stringify(log,null,2));
    if(req.method==="GET" && req.url.includes("/models")){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify({object:"list",data:[
        {id:"qwen/qwen3.7-flash",object:"model",name:"qwen3.7-flash",
         context_window:131072,max_tokens:16384,maxOutputTokens:16384,
         supports_tool_use:true,supportsToolUse:true}]}));
      return;
    }
    // chat: return an OpenAI-style completion (may be wrong; we just want to capture the request)
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({id:"c1",object:"chat.completion",created:Math.floor(Date.now()/1000),
      model:"qwen/qwen3.7-flash",
      choices:[{index:0,message:{role:"assistant",content:"PONG_OK"},finish_reason:"stop"}],
      usage:{prompt_tokens:11,completion_tokens:3,total_tokens:14}}));
  });
});
srv.listen(port,"127.0.0.1",()=>console.log("cap on "+port));
