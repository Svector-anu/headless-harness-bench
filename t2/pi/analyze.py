import json,sys
def load(p):
    out=[]
    for l in open(p):
        l=l.strip()
        if not l: continue
        try: out.append(json.loads(l))
        except: out.append({"_parse_error":l[:120]})
    return out
def analyze(p):
    evs=load(p)
    types=[e.get('type','?') for e in evs]
    text=None; usage=None; tools=[]; stop=None; errmsg=None; toolresults=[]
    for e in evs:
        t=e.get('type')
        if t=='message_end' and e.get('message',{}).get('role')=='assistant':
            m=e['message']
            for c in m.get('content',[]):
                if c.get('type')=='text': text=c.get('text')
                if c.get('type')=='toolCall': tools.append({'name':c.get('name'),'input':c.get('input')})
            if 'usage' in m: usage=m['usage']
            stop=m.get('stopReason'); errmsg=m.get('errorMessage')
        if t=='message_update': usage=e.get('usage',usage)
        if t=='turn_end':
            for tr in (e.get('toolResults') or []):
                toolresults.append(tr)
        if t in ('agent_end',) and e.get('willRetry') is not None:
            pass
    print(f"--- {p.split('/')[-1]} ({len(evs)} events) ---")
    from collections import Counter
    print("event types:", dict(Counter(types)))
    print("stopReason:", stop, "| errorMessage:", (errmsg[:200] if errmsg else None))
    print("final text:", repr(text)[:300])
    print("tool calls (ordered):", [(t['name'], (json.dumps(t['input'])[:80] if t['input'] else None)) for t in tools])
    if usage: print("usage: input=%s output=%s total=%s cost.total=%s"%(usage.get('input'),usage.get('output'),usage.get('totalTokens'),usage.get('cost',{}).get('total')))
    else: print("usage: NONE")
    # tool results text (first 200 ch)
    for i,tr in enumerate(toolresults):
        s=json.dumps(tr)
        print(f"  toolResult[{i}]:", s[:220])
    print()
for f in sys.argv[1:]:
    try: analyze(f)
    except Exception as e: print("ERR",f,e)
