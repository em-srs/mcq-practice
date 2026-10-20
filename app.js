const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "drillroom-lite-v1";
const starterSets = (window.BUNDLED_QUESTION_BANKS || []).map((bank) => ({
  id: bank.id || ("bank-" + bank.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
  name: bank.name, icon: bank.icon || "▤", description: bank.description || "",
  questions: (bank.questions || []).map((raw, index) => normaliseQuestion({...raw, id: raw.id || (bank.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-q" + (index + 1))}, index)).filter(Boolean)
})).filter(set => set.questions.length);
if (!starterSets.length) starterSets.push({ id:"demo-oops", name:"OOPs — Demo Set", icon:"⌘", description:"Sample questions to explore the app", questions:[
  {q:"Which OOP concept bundles data and methods and controls access to internal state?",opts:["A. Inheritance","B. Encapsulation","C. Polymorphism","D. Recursion"],ans:"B",explanation:"Encapsulation groups data and related operations and controls how internal state is accessed.",topic:"OOP foundations"}
]});
let state = loadState();
let testConfig = null, timerHandle = null, timerDeadline = 0, questionDeadline = 0;
let activeSet = null, session = [], answers = {}, currentIndex = 0, sessionMode = "learn", pendingConfig = null, lastResults = null;

function loadState(){
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const savedSets = Array.isArray(parsed.sets) ? parsed.sets : [];
    // Add newly bundled banks to existing browser data without duplicating sets by name.
    const sets = [...savedSets];
    for (const saved of sets) if (/^Operating Systems\s*[—-]\s*Set 1$/i.test(saved.name)) saved.name = "Operating Systems";
    for (const bundled of starterSets) {
      if (!sets.some(s => String(s.name).toLowerCase() === bundled.name.toLowerCase())) sets.push(bundled);
    }
    return {sets:sets.length?sets:starterSets, progress:parsed.progress||{}, bookmarks:parsed.bookmarks||[], mistakes:parsed.mistakes||[], theme:parsed.theme||"light"};
  } catch { return {sets:starterSets,progress:{},bookmarks:[],mistakes:[],theme:"light"}; }
}
function saveState(){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{toast("Browser storage is full. Export a backup and remove some question sets.");} }
function uid(){return "q"+Math.random().toString(36).slice(2,10)+Date.now().toString(36);}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function detectCodeLanguage(code, hinted=""){
  if(hinted) return hinted.toLowerCase();
  if(/\b(SELECT|FROM|WHERE|JOIN|INSERT INTO|CREATE TABLE|GROUP BY|ORDER BY)\b/i.test(code)) return "sql";
  if(/#include\s*[<"]|std::|cout\s*<<|cin\s*>>|\b(public|private|protected):|\bclass\s+\w+\s*(?::|\{)/i.test(code)) return "cpp";
  if(/\b(public|private|protected|static)\s+(class|void|int|String|boolean)\b|System\.out\.print|new\s+\w+\(/.test(code)) return "java";
  if(/\b(def|elif|print)\b|:\s*$|^\s*#|range\(/m.test(code)) return "python";
  if(/\b(function|const|let|var)\b|console\.log|=>/.test(code)) return "javascript";
  return "pseudo";
}
function highlightCode(code, hinted=""){
  const lang=detectCodeLanguage(code,hinted);
  const tokenRx=/(\/\/[^\n]*|#(?!include\b)[^\n]*|\/\*[\s\S]*?\*\/|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\b(?:class|struct|public|private|protected|virtual|override|static|const|void|int|float|double|char|bool|boolean|string|String|new|return|if|else|elif|for|while|do|break|continue|switch|case|default|try|catch|throw|def|function|print|SELECT|FROM|WHERE|JOIN|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|GROUP|BY|ORDER|LIMIT|AND|OR|NOT|NULL|true|false|True|False|None|using|namespace|include|import|from|as|extends|implements|this|super|cout|cin|endl|std)\b|\b\d+(?:\.\d+)?\b)/gi;
  let out="", last=0, m;
  while((m=tokenRx.exec(code))){
    out+=escapeHtml(code.slice(last,m.index));
    const t=m[0]; let cls="tok-operator";
    if(/^(\/\/|#|\/\*)/.test(t)) cls="tok-comment";
    else if(/^['"`]/.test(t)) cls="tok-string";
    else if(/^\d/.test(t)) cls="tok-number";
    else if(/^(true|false|True|False|None|null|NULL)$/.test(t)) cls="tok-literal";
    else if(/^(SELECT|FROM|WHERE|JOIN|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|GROUP|BY|ORDER|LIMIT|AND|OR|NOT|NULL)$/i.test(t) && lang==="sql") cls="tok-keyword";
    else if(/^(class|struct|public|private|protected|virtual|override|static|const|void|int|float|double|char|bool|boolean|string|String|new|return|if|else|elif|for|while|do|break|continue|switch|case|default|try|catch|throw|def|function|print|using|namespace|include|import|from|as|extends|implements|this|super|cout|cin|endl|std)$/i.test(t)) cls="tok-keyword";
    out+=`<span class="${cls}">${escapeHtml(t)}</span>`;last=tokenRx.lastIndex;
  }
  out+=escapeHtml(code.slice(last));
  const label={cpp:"C++",javascript:"JavaScript",pseudo:"Pseudocode"}[lang]||lang.toUpperCase();
  return `<pre class="code-window" data-language="${lang}"><div class="code-window-head"><span class="code-dot"></span><span class="code-dot"></span><span class="code-dot"></span><span class="code-language">${label}</span></div><code>${out}</code></pre>`;
}
function looksLikeCode(block){
  const lines=block.split("\n").filter(x=>x.trim());
  if(lines.length<2) return false;
  const indicators=/(#include|using namespace|cout\s*<<|cin\s*>>|System\.out|console\.log|function\s+\w+|def\s+\w+|print\s*\(|\bclass\s+\w+|public:|private:|virtual\s+~?\w+|^\s*(if|else|elif|for|while)\b|^\s*(int|float|double|char|string|bool|return)\b|SELECT\s+.+FROM|^\s*\w+\s*=\s*.+;?$)/i;
  return lines.filter(line=>indicators.test(line)).length>=Math.min(2,lines.length);
}
function renderText(s){
  const str=String(s??"");
  const fenced=/```([a-zA-Z+#]*)\s*\n?([\s\S]*?)```/g;
  let out="",last=0,m;
  while((m=fenced.exec(str))){
    out+=renderPlainOrAutoCode(str.slice(last,m.index));
    out+=highlightCode(m[2].replace(/^\n|\n$/g,""),m[1]);
    last=fenced.lastIndex;
  }
  out+=renderPlainOrAutoCode(str.slice(last));
  return out;
}
function renderInlineCode(text){
  // Explicit backticks in question banks are authoritative: always syntax-highlight their contents.
  return text.split(/(`[^`]+`)/g).map(part=>{
    if(part.startsWith("`") && part.endsWith("`") && part.length>2){
      const code=part.slice(1,-1);
      const lang=detectCodeLanguage(code);
      const highlighted=highlightCode(code,lang).replace(/^<pre[^>]*><div class="code-window-head">[\s\S]*?<\/div><code>/," ").replace(/<\/code><\/pre>$/," ").trim();
      return `<code class="syntax-inline" data-language="${lang}">${highlighted}</code>`;
    }
    return escapeHtml(part).replace(/\n/g,"<br>");
  }).join("");
}
function renderPlainOrAutoCode(text){
  const blocks=text.split(/\n{2,}/);
  return blocks.map(block=>{
    const trimmed=block.trim();
    if(!trimmed)return "";
    if(looksLikeCode(trimmed)) return highlightCode(trimmed);
    // Many placement banks store code as a single un-fenced line inside a question.
    const singleLineCode = trimmed.length>24 && /(#include|\bcout\s*<<|\bSystem\.out|\bconsole\.log|\bclass\s+[A-Za-z_]\w*|\bfunction\s+\w+|\bdef\s+\w+|\bSELECT\b.+\bFROM\b|\bvirtual\s+~?\w+|\bint\s+main\s*\()/i.test(trimmed);
    if(singleLineCode && !/[?]$/.test(trimmed)) return highlightCode(trimmed);
    return renderInlineCode(trimmed);
  }).join("<br>");
}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600);}
function notify(msg){const el=$("notice");el.hidden=false;el.textContent=msg;}
function hideNotice(){$("notice").hidden=true;}
function normaliseQuestion(raw,index){
  const q=raw.q??raw.question??raw.prompt;
  let rawOpts=raw.opts??raw.options;
  let opts=[];
  if(Array.isArray(rawOpts)) opts=rawOpts.map((option)=>{
    if(option && typeof option==="object") {
      const label=String(option.label??"").trim();
      const text=String(option.text??option.value??"").trim();
      return label ? `${label}. ${text}` : text;
    }
    return String(option);
  });
  else if(rawOpts&&typeof rawOpts==="object") opts=Object.entries(rawOpts).map(([k,v])=>`${k}. ${v}`);
  const answerRaw=raw.ans??raw.answer??raw.correctAnswer;
  let ans=String(answerRaw??"").trim().toUpperCase();
  if(["A","B","C","D"].includes(ans)){}
  else if(/^[0-3]$/.test(ans)) ans="ABCD"[Number(ans)];
  else if(typeof answerRaw==="number"&&answerRaw>=1&&answerRaw<=4) ans="ABCD"[answerRaw-1];
  else {
    const match=String(answerRaw??"").match(/^\s*([A-D])(?:[.)\s]|$)/i);
    if(match) ans=match[1].toUpperCase();
  }
  if(!q||opts.length!==4||!["A","B","C","D"].includes(ans)||!raw.explanation) return null;
  opts=opts.map((o,i)=>String(o).replace(/^\s*[A-D][.)]\s*/i,"").trim());
  return {id:String(raw.id??uid()),q:String(q),opts,ans,explanation:String(raw.explanation),topic:String(raw.topic??raw.category??"General"),sourceIndex:index};
}
function parseSet(data,fileName){
  let arr=Array.isArray(data)?data:(data.questions??data.items??data.data);
  if(!Array.isArray(arr)) throw new Error("Expected a JSON array, or an object with a questions array.");
  const questions=arr.map(normaliseQuestion).filter(Boolean);
  if(!questions.length) throw new Error("No valid questions found. Each question needs q, opts (4 options), ans (A–D), and explanation.");
  return {id:uid(),name:String(data.name??data.title??fileName.replace(/\.json$/i,"")),icon:"▤",description:"Imported question bank",questions,createdAt:new Date().toISOString(),invalid:arr.length-questions.length};
}
function allQuestions(set){return set.questions.map((q,i)=>({...q,setId:set.id,setName:set.name,globalId:`${set.id}:${q.id||i}`}));}
function getProgress(setId){return state.progress[setId]||{attempted:0,correct:0};}
function renderDashboard(){
  $("dashboardView").hidden=false;$("practiceView").hidden=true;$("resultsView").hidden=true;
  const term=$("searchInput").value.trim().toLowerCase();
  const sets=state.sets.filter(s=>`${s.name} ${s.description||""}`.toLowerCase().includes(term));
  $("totalQuestions").textContent=state.sets.reduce((n,s)=>n+s.questions.length,0);
  $("subjectCount").textContent=`${state.sets.length} set${state.sets.length===1?"":"s"}`;
  const grid=$("subjectsGrid");grid.innerHTML="";
  if(!sets.length){grid.innerHTML=`<div class="empty-state">No matching sets. Import a JSON question bank to get started.</div>`;}
  for(const set of sets){
    const p=getProgress(set.id), pct=p.attempted?Math.round(p.correct/p.attempted*100):0;
    const card=document.createElement("button");card.className="subject-card";card.innerHTML=`<div class="subject-top"><span class="subject-icon">${escapeHtml(set.icon||"▤")}</span><span class="card-arrow">↗</span></div><h3>${escapeHtml(set.name)}</h3><span class="sub-count">${set.questions.length} questions${set.description?` · ${escapeHtml(set.description)}`:""}</span><div class="mini-track"><div style="width:${pct}%"></div></div><div class="subject-foot"><span>${p.correct} correct recorded</span><span>${pct}%</span></div>`;
    card.addEventListener("click",()=>openConfig({kind:"set",setId:set.id,name:set.name,questions:allQuestions(set)}));grid.appendChild(card);
  }
}
function openConfig(config){
  pendingConfig=config;testConfig=null;resetConfigUI();$("modalTitle").textContent=config.name||"Mixed practice";$("modalDescription").textContent=`${config.questions.length} question${config.questions.length===1?"":"s"} available. Choose a session size and mode.`;$("amountSelect").innerHTML="";
  const amounts=[10,20,30,50].filter(n=>n<config.questions.length);
  amounts.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=`${n} questions`; $("amountSelect").appendChild(o);});
  const all=document.createElement("option");all.value="all";all.textContent=`All ${config.questions.length} questions`;$("amountSelect").appendChild(all);
  $("amountSelect").value=String(Math.min(10,config.questions.length));if(!amounts.includes(10))$("amountSelect").value="all";
  $("modalBackdrop").hidden=false;
}
function openMockTest(){
  pendingConfig={kind:"mock-test",name:"CS Fundamentals Mock Test",questions:state.sets.flatMap(allQuestions)};testConfig={kind:"mock-test"};
  $("modalTitle").textContent="Create mock test";$("modalDescription").textContent="Build a placement-style assessment from your question banks.";
  $("modeSelect").value="test";$("modeSelect").disabled=true;$("amountSelect").hidden=true;$("shuffleCheck").closest("label").hidden=true;$("mockTestFields").hidden=false;
  const choices=$("subjectChoices");choices.innerHTML="";state.sets.forEach(set=>{const label=document.createElement("label");label.className="subject-choice";label.innerHTML=`<input type="checkbox" value="${escapeHtml(set.id)}" checked> <span>${escapeHtml(set.name)} <small>(${set.questions.length})</small></span>`;choices.appendChild(label);});
  $("startSessionBtn").textContent="Start mock test →";$("modalBackdrop").hidden=false;
}
function resetConfigUI(){if(!$("modeSelect"))return;$("modeSelect").disabled=false;$("amountSelect").hidden=false;$("shuffleCheck").closest("label").hidden=false;$("mockTestFields").hidden=true;$("startSessionBtn").textContent="Start practice →";}
function closeConfig(){$("modalBackdrop").hidden=true;pendingConfig=null;resetConfigUI();}
function startConfigured(){
 if(!pendingConfig)return;const isMock=pendingConfig.kind==="mock-test";let pool;
 if(isMock){const selected=[...$("subjectChoices").querySelectorAll("input:checked")].map(x=>x.value);if(!selected.length){toast("Choose at least one subject.");return;}pool=state.sets.filter(s=>selected.includes(s.id)).flatMap(allQuestions).sort(()=>Math.random()-.5);const count=$("testQuestionCount").value;session=count==="all"?pool:pool.slice(0,Number(count));testConfig={timing:$("timeMode").value,minutes:Math.max(1,Math.min(300,Number($("timeAmount").value)||30))};}
 else{pool=[...pendingConfig.questions];if(pendingConfig.kind==="mistakes")pool=pool.filter(q=>state.mistakes.includes(q.globalId));if(pendingConfig.kind==="bookmarks")pool=pool.filter(q=>state.bookmarks.includes(q.globalId));if($("shuffleCheck").checked)pool.sort(()=>Math.random()-.5);const amount=$("amountSelect").value;session=amount==="all"?pool:pool.slice(0,Number(amount));testConfig=null;}
 if(!session.length){closeConfig();toast("No questions available for this session.");return;}answers={};currentIndex=0;sessionMode=isMock?"strict-test":$("modeSelect").value;activeSet=isMock?{name:"CS Fundamentals Mock Test"}:pendingConfig;closeConfig();
 if(testConfig&&testConfig.timing!=="none"){let sec=testConfig.timing==="total"?testConfig.minutes*60:testConfig.minutes*60;timerDeadline=Date.now()+sec*1000;questionDeadline=Date.now()+sec*1000;startTimer();}else stopTimer();renderQuestion();
}
function startTimer(){stopTimer();$("testTimerBar").hidden=false;tickTimer();timerHandle=setInterval(tickTimer,250);}
function stopTimer(){if(timerHandle)clearInterval(timerHandle);timerHandle=null;$("testTimerBar").hidden=true;$("testTimerBar").classList.remove("urgent");}
function tickTimer(){if(!testConfig||testConfig.timing==="none")return;const deadline=testConfig.timing==="total"?timerDeadline:questionDeadline;const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));$("testTimerLabel").textContent=testConfig.timing==="total"?"Test time remaining":"Question time remaining";$("testTimer").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");$("testTimerBar").classList.toggle("urgent",remaining<=30);if(remaining<=0){if(testConfig.timing==="per-question")advanceStrict();else finishSession(true);}}
function advanceStrict(){if(currentIndex<session.length-1){currentIndex++;if(testConfig&&testConfig.timing==="per-question")questionDeadline=Date.now()+testConfig.minutes*60*1000;renderQuestion();}else finishSession();}
function openMixed(){
  const qs=state.sets.flatMap(allQuestions);
  if(!qs.length){toast("Import a question set first.");return;}
  openConfig({kind:"mixed",name:"Mixed practice",questions:qs});
}
function openMistakes(){
  const qs=state.sets.flatMap(allQuestions).filter(q=>state.mistakes.includes(q.globalId));
  if(!qs.length){toast("No recorded mistakes yet. Complete a practice session first.");return;}
  openConfig({kind:"mistakes",name:"Review mistakes",questions:qs});
}
function renderQuestion(){
  document.body.classList.toggle("strict-test",sessionMode==="strict-test");
  $("dashboardView").hidden=true;$("practiceView").hidden=false;$("resultsView").hidden=true;
  const q=session[currentIndex], selected=answers[q.globalId];
  $("sessionName").textContent=activeSet.name||"Practice session";$("sessionCounter").textContent=`Question ${currentIndex+1} of ${session.length}`;
  $("progressBar").style.width=`${((currentIndex+1)/session.length)*100}%`;
  $("topicPill").textContent=q.topic||"General";$("questionText").innerHTML=renderText(q.q);
  const isBookmarked=state.bookmarks.includes(q.globalId);$("bookmarkBtn").classList.toggle("saved",isBookmarked);$("bookmarkBtn").innerHTML=isBookmarked?"★ <span>Saved</span>":"☆ <span>Save</span>";
  const options=$("optionsList");options.innerHTML="";
  q.opts.forEach((opt,i)=>{
    const letter="ABCD"[i],btn=document.createElement("button");btn.className="option";btn.disabled=(sessionMode==="test"||sessionMode==="strict-test")&&answers[q.globalId]!==undefined;
    if(selected===letter)btn.classList.add("selected");
    if(selected!==undefined&&sessionMode==="learn"){if(letter===q.ans)btn.classList.add("correct");else if(letter===selected)btn.classList.add("wrong");btn.disabled=true;}
    btn.innerHTML=`<span class="option-letter">${letter}</span><span>${renderText(opt)}</span>`;
    btn.addEventListener("click",()=>chooseAnswer(letter));options.appendChild(btn);
  });
  const feedback=$("feedback");feedback.hidden=true;feedback.className="feedback";
  if(selected!==undefined&&sessionMode==="learn"){
    feedback.hidden=false;feedback.classList.add(selected===q.ans?"is-correct":"is-wrong");
    feedback.innerHTML=`<strong>${selected===q.ans?"Correct answer ✓":"Not quite — correct answer: "+q.ans}</strong>${renderText(q.explanation)}`;
  }
  $("answeredLabel").textContent=selected===undefined?"Choose an answer":(selected===q.ans?"Answer recorded ✓":"Answer recorded");
  $("prevBtn").disabled=currentIndex===0||sessionMode==="strict-test";$("nextBtn").textContent=sessionMode==="strict-test"?(currentIndex===session.length-1?"Submit test ✓":(selected===undefined?"Skip & continue →":"Next question →")):(currentIndex===session.length-1?"Finish session ✓":"Next question →");
  updateSessionSidebar();
}
function chooseAnswer(letter){
  const q=session[currentIndex];if(answers[q.globalId]!==undefined)return;
  answers[q.globalId]=letter;
  const correct=letter===q.ans;
  const p=state.progress[q.setId]||{attempted:0,correct:0};p.attempted++;if(correct)p.correct++;state.progress[q.setId]=p;
  if(correct)state.mistakes=state.mistakes.filter(id=>id!==q.globalId);else if(!state.mistakes.includes(q.globalId))state.mistakes.push(q.globalId);
  saveState();if(sessionMode==="strict-test"){if(testConfig&&testConfig.timing==="per-question")questionDeadline=Date.now()+testConfig.minutes*60*1000;advanceStrict();}else renderQuestion();
}
function updateSessionSidebar(){
  const done=Object.keys(answers).length;$("sideProgress").textContent=`${done}/${session.length}`;$("sideProgressBar").style.width=`${done/session.length*100}%`;
  const map=$("questionMap");map.innerHTML="";
  session.forEach((q,i)=>{const b=document.createElement("button");b.className="map-item";b.disabled=sessionMode==="strict-test";if(i===currentIndex)b.classList.add("current");if(answers[q.globalId]!==undefined)b.classList.add(answers[q.globalId]===q.ans?"done":"wrong");b.textContent=i+1;b.title=`Question ${i+1}`;b.addEventListener("click",()=>{currentIndex=i;renderQuestion();});map.appendChild(b);});
}
function finishSession(timeExpired=false){
  stopTimer();
  const correct=session.filter(q=>answers[q.globalId]===q.ans).length;
  const wrong=session.filter(q=>answers[q.globalId]!==undefined&&answers[q.globalId]!==q.ans).length;
  const skipped=session.length-correct-wrong;lastResults={correct,wrong,skipped,session:[...session],answers:{...answers}};
  $("dashboardView").hidden=true;$("practiceView").hidden=true;$("resultsView").hidden=false;
  const pct=session.length?Math.round(correct/session.length*100):0;const cDeg=session.length?correct/session.length*360:0,wDeg=session.length?wrong/session.length*360:0;$("resultPie").style.background=`conic-gradient(#31b987 0deg ${cDeg}deg,#f06464 ${cDeg}deg ${cDeg+wDeg}deg,#9aa4b5 ${cDeg+wDeg}deg 360deg)`;$("pieTotal").textContent=session.length;$("scorePercent").textContent=pct+"%";$("scoreSummary").textContent=`${correct} out of ${session.length} correct`;$("scoreMessage").textContent=(timeExpired?"Time is up. ":"")+(pct>=80?"Great work — keep practising to make it stick.":pct>=50?"Good effort. Review the explanations and try again.":"Use the review below to strengthen the basics.");
  $("correctCount").textContent=correct;$("wrongCount").textContent=wrong;$("skippedCount").textContent=skipped;
  $("retryWrongBtn").hidden=wrong===0;
  const review=$("reviewList");review.innerHTML="<h2>Review answers</h2>";
  session.forEach((q,i)=>{const ans=answers[q.globalId];if(ans===q.ans)return;const div=document.createElement("div");div.className="review-item";div.innerHTML=`<h3>${i+1}. ${renderText(q.q)}</h3><p>Your answer: <span class="review-answer">${ans?ans+". "+escapeHtml(q.opts["ABCD".indexOf(ans)]):"Not answered"}</span></p><p>Correct answer: <span class="review-answer">${q.ans}. ${escapeHtml(q.opts["ABCD".indexOf(q.ans)])}</span></p><p>${renderText(q.explanation)}</p>`;review.appendChild(div);});
  window.scrollTo({top:0,behavior:"smooth"});
}
function exportBackup(){
  const blob=new Blob([JSON.stringify({version:1,sets:state.sets,progress:state.progress,bookmarks:state.bookmarks,mistakes:state.mistakes},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="grinder-backup.json";a.click();URL.revokeObjectURL(a.href);
}
function importFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{try{
    const data=JSON.parse(reader.result);
    if(data && data.version===1 && Array.isArray(data.sets)){
      if(!confirm("Restore this Grinder backup? It will replace the current question sets and progress on this browser.")) return;
      state.sets=data.sets;state.progress=data.progress||{};state.bookmarks=data.bookmarks||[];state.mistakes=data.mistakes||[];
      saveState();renderDashboard();hideNotice();toast("Backup restored.");return;
    }
    const set=parseSet(data,file.name);
    const existing=state.sets.findIndex(s=>s.name.toLowerCase()===set.name.toLowerCase());
    if(existing>=0){if(!confirm(`A set named "${set.name}" already exists. Replace it?`))return;state.sets[existing]=set;}else state.sets.push(set);
    saveState();renderDashboard();hideNotice();toast(`Imported ${set.questions.length} questions${set.invalid?`; skipped ${set.invalid} invalid entries`:""}.`);
  }catch(e){notify(e.message||"Could not read this JSON file.");}};
  reader.readAsText(file);
}
function applyTheme(){document.body.classList.toggle("light",state.theme==="light");}
$("importBtn").addEventListener("click",()=>$("fileInput").click());
$("exportBtn").addEventListener("click",exportBackup);
$("fileInput").addEventListener("change",e=>{importFile(e.target.files[0]);e.target.value="";});
$("searchInput").addEventListener("input",renderDashboard);
$("mixedBtn").addEventListener("click",openMixed);$("createTestBtn").addEventListener("click",openMockTest);$("mistakesBtn").addEventListener("click",openMistakes);
$("startSessionBtn").addEventListener("click",startConfigured);$("modalClose").addEventListener("click",closeConfig);
$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeConfig();});
$("backBtn").addEventListener("click",renderDashboard);$("dashboardBtn").addEventListener("click",renderDashboard);$("endBtn").addEventListener("click",finishSession);
$("prevBtn").addEventListener("click",()=>{if(sessionMode!=="strict-test"&&currentIndex>0){currentIndex--;renderQuestion();}});
$("nextBtn").addEventListener("click",()=>{if(sessionMode==="strict-test"){advanceStrict();return;}if(currentIndex<session.length-1){currentIndex++;renderQuestion();}else finishSession();});
$("bookmarkBtn").addEventListener("click",()=>{const id=session[currentIndex].globalId;if(state.bookmarks.includes(id))state.bookmarks=state.bookmarks.filter(x=>x!==id);else state.bookmarks.push(id);saveState();renderQuestion();});
$("retryWrongBtn").addEventListener("click",()=>{const qs=lastResults.session.filter(q=>lastResults.answers[q.globalId]!==undefined&&lastResults.answers[q.globalId]!==q.ans);openConfig({kind:"retry",name:"Incorrect answers",questions:qs});});
$("themeBtn").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";saveState();applyTheme();});
$("homeLink").addEventListener("click",e=>{e.preventDefault();renderDashboard();});
$("onlineStatus").textContent=navigator.onLine?"● Online":"● Offline";window.addEventListener("online",()=>{$("onlineStatus").textContent="● Online";});window.addEventListener("offline",()=>{$("onlineStatus").textContent="● Offline";});
document.addEventListener("keydown",e=>{if($("practiceView").hidden)return;if(["1","2","3","4"].includes(e.key))chooseAnswer("ABCD"[Number(e.key)-1]);if(sessionMode!=="strict-test"&&e.key==="ArrowRight"&&currentIndex<session.length-1){currentIndex++;renderQuestion();}if(sessionMode!=="strict-test"&&e.key==="ArrowLeft"&&currentIndex>0){currentIndex--;renderQuestion();}});
applyTheme();renderDashboard();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
