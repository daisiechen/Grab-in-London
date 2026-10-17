import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const runtime=process.env.CODEX_BUSINESS_RUNTIME || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies');
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const {Workbook,SpreadsheetFile,Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const output=path.join(root,'outputs/business-2026-10-17');
const build=path.join(root,'build/business-2026-10-17');
await fs.mkdir(output,{recursive:true});await fs.mkdir(build,{recursive:true});
const inputs=JSON.parse(await fs.readFile('docs/business/model-inputs.json','utf8'));
const wb=Workbook.create();
const sheets=['商家模型','个人服务','市场边界','敏感性'].map(n=>wb.worksheets.add(n));
const font='PingFang SC';
for(const s of sheets){s.getRange('A1:F45').format.font={name:font,size:11};s.getRange('A:A').format.columnWidth=34;s.getRange('B:D').format.columnWidth=22;s.getRange('E:F').format.columnWidth=40;s.getRange('A1:F45').format.rowHeight=25;}
const merchant=sheets[0];
merchant.getRange('A1:D2').values=[['商家经济模型 · GBP/年','小试点','局部基准','城市扩展'],['全部商业输入为假设；稳定年，非爬坡预测',null,null,null]];
const fields=[['付费活动商家数','merchants'],['每商家每月活动','events_per_month'],['每场可收费到店','attendees'],['每到店费 GBP','fee'],['每场人工成本 GBP','labor_per_event'],['每到店其他成本 GBP','other_per_attendee'],['年度固定成本 GBP','fixed'],['单商家获客成本 GBP','merchant_cac'],['商家获客摊销年数','merchant_cac_years'],['年付费渠道新增用户','new_paid_users'],['单用户获客成本 GBP','user_cac']];
for(let i=0;i<fields.length;i++)merchant.getRange(`A${i+4}:D${i+4}`).values=[[fields[i][0],...inputs.cases.map(c=>c[fields[i][1]])]];
merchant.getRange('B4:D14').format.font={color:'#2563EB'};
const labels={17:'年活动场次',18:'年可收费到店人次',19:'年平台收入 GBP',20:'年变动服务成本 GBP',21:'年获客成本 GBP',22:'获客前经营贡献 GBP',23:'获客后经营贡献 GBP',24:'每场贡献 GBP',25:'覆盖固定及获客所需年场次'};
for(const [r,l] of Object.entries(labels))merchant.getRange(`A${r}`).values=[[l]];
for(const c of ['B','C','D']){
 const f={17:`=${c}4*${c}5*12`,18:`=${c}17*${c}6`,19:`=${c}18*${c}7`,20:`=${c}17*${c}8+${c}18*${c}9`,21:`=${c}4*${c}11/${c}12+${c}13*${c}14`,22:`=${c}19-${c}20-${c}10`,23:`=${c}22-${c}21`,24:`=${c}6*(${c}7-${c}9)-${c}8`,25:`=IF(${c}24>0,(${c}10+${c}21)/${c}24,"单场亏损")`};
 for(const[r,v]of Object.entries(f))merchant.getRange(`${c}${r}`).formulas=[[v]];
}
merchant.getRange('A28:D31').values=[['边界','不含融资、税费、爬坡现金流',null,null],['全部情景参数','作者假设，不是竞品经营数据',null,null],['222 官方定价参照','餐厅 $3/人；非英国费率',null,null],['来源','https://partners.222.place/',null,null]];
const personal=sheets[1];
personal.getRange('A1:C1').values=[['个人服务 · GBP/月','输入/输出','所有输入为假设']];
const pRows=[['活跃用户',1000],['付费比例',0.03],['月包价格',10],['每付费用户成本',3],['每免费用户成本',0.2]];
personal.getRange('A4:B8').values=pRows;personal.getRange('B4:B8').format.font={color:'#2563EB'};personal.getRange('B5').setNumberFormat('0.0%');
for(const[r,l,f]of [[11,'付费人数','=B4*B5'],[12,'月收入','=B11*B6'],[13,'付费用户成本','=B11*B7'],[14,'免费用户成本','=(B4-B11)*B8'],[15,'月贡献（固定及获客前）','=B12-B13-B14'],[16,'达到变动成本平衡的付费率','=IF(B6-B7+B8>0,B8/(B6-B7+B8),"无解")']]){personal.getRange(`A${r}`).values=[[l]];personal.getRange(`B${r}`).formulas=[[f]];}
personal.getRange('B16').setNumberFormat('0.0%');personal.getRange('A19:C21').values=[['用途','训练包/按次验证后再考虑订阅',null],['未计','个人线固定成本、获客、税费',null],['来源','作者假设；无已验证付费数据',null]];
const market=sheets[2];
market.getRange('A1:D1').values=[['市场边界 · 人数','下限情景','中间情景','上限情景']];
market.getRange('A4:D6').values=[['伦敦人口（约数）',9100000,9100000,9100000],['年度需求人口占比（假设）',0.02,0.05,0.1],['可服务比例（假设）',0.1,0.2,0.3]];
market.getRange('A8').values=[['年度可服务人数情景']];market.getRange('A10:D11').values=[['每活跃用户年出席（假设）',4,4,4],['可收费出席比例（假设）',0.5,0.5,0.5]];
market.getRange('A13').values=[['商家情景所需年活跃用户']];
for(const c of ['B','C','D']){market.getRange(`${c}8`).formulas=[[`=${c}4*${c}5*${c}6`]];market.getRange(`${c}13`).formulas=[[`='商家模型'!${c}18/${c}10/${c}11`]];}
market.getRange('B5:D6').setNumberFormat('0%');market.getRange('B11:D11').setNumberFormat('0%');
market.getRange('A16:D19').values=[['来源','GLA State of London，2026-07',null,null],['链接','https://data.london.gov.uk/blog/state-of-london',null,null],['解释','不是测得的 TAM/SAM/SOM，不是预测',null,null],['人口占比','含成人需求，未再乘年龄；不混入游客或学生',null,null]];
const sens=sheets[3];sens.getRange('A1:D1').values=[['基准每场贡献敏感性 GBP','到店费 £3','到店费 £4','到店费 £5']];sens.getRange('B3:D3').values=[[3,4,5]];sens.getRange('A4:A6').values=[[8],[12],[20]];
for(let r=4;r<=6;r++)for(const c of ['B','C','D'])sens.getRange(`${c}${r}`).formulas=[[`=$A${r}*(${c}$3-'商家模型'!$C$9)-'商家模型'!$C$8`]];
sens.getRange('A9:D11').values=[['说明','行是每场到店人数，列是单价',null,null],['成本来源','商家模型局部基准人工及其他成本',null,null],['边界','固定与获客前；非原生What-If数据表',null,null]];
for(const s of sheets){s.getRange('A1:D1').format={fill:'#153F35',font:{name:font,color:'#FFFFFF',bold:true}};s.getRange('B4:D25').setNumberFormat('#,##0.00');}
personal.getRange('B5').setNumberFormat('0.0%');personal.getRange('B16').setNumberFormat('0.0%');market.getRange('B5:D6').setNumberFormat('0%');market.getRange('B11:D11').setNumberFormat('0%');
// Verify actual dependency changes before the final recalculation.
merchant.getRange('C7').values=[[5]];
const changed=merchant.getRange('C19').values[0][0];
if(Math.abs(Number(changed)-43200)>0.01)throw Error('Revenue input change did not propagate: '+changed);
merchant.getRange('C7').values=[[4]];
personal.getRange('B7').values=[[6]];
if(Number(personal.getRange('B15').values[0][0])>=0)throw Error('Cost sensitivity failed');
personal.getRange('B7').values=[[3]];
wb.recalculate();
const checks={merchant:merchant.getRange('B23:D23').values,personal:personal.getRange('B15').values,market:market.getRange('B8:D8').values};
if(Math.abs(Number(checks.merchant[0][1])+27624)>0.01)throw Error('Base mismatch');
await fs.writeFile(path.join(build,'workbook-checks.json'),JSON.stringify(checks,null,2));
for(const [i,s]of sheets.entries()){const b=await wb.render({sheetName:s.name,range:i===0?'A1:D25':i===1?'A1:C16':i===2?'A1:D13':'A1:D11',scale:1.5,format:'png'});await fs.writeFile(path.join(build,`sheet-${i+1}.png`),new Uint8Array(await b.arrayBuffer()));}
await(await SpreadsheetFile.exportXlsx(wb)).save(path.join(output,'economic-model.xlsx'));

const slides=[
 ['让想去体验的人，找到一起的人','Fancy 商业评估与合作提案','从伦敦约饭切入。\n短期验证商家收入，长期研究个人 Agent 的持续服务价值。\n2026.10 · 品牌暂定 · 尚无真实经营业绩',[]],
 ['城市体验丰富，同伴却不一定有空','问题：从想去，到实际成行','有想吃的餐厅，也有想看的剧和展。\n阻力可能是找不到人、协调麻烦、不了解同桌或交流语境。\n创始人观察需要访谈与真实赴约验证。',['S4']],
 ['先服务愿意见面、缺同伴的人','用户：按阻力细分','核心：缺同伴，或会交流但不爱组织。\n供给：愿意发起、需要招募的人。\nAI候选：有具体跨语言、文化参与需求的人。\n留学生与校友是种子渠道，不是市场边界。',[]],
 ['伦敦有试点空间，客户总量仍待测','市场：人口背景不等于需求','910 万居民，是人口背景。\n英国成人 25% 经常或有时孤独，不是伦敦约饭需求率。\n家庭消费和外食数据不能换算个人 AI 支付能力。',['S1','S3','S8']],
 ['已有付费组桌，也有免费带客','竞争：必须证明增量价值','Meetable：伦敦 £12/次，餐饮另付。\n商家免佣金及平台费。\n222：餐厅公开 $3/人，策展票佣 10%。\n美元条款不是英国成交价，也不证明本项目收费成立。',['S5','S6','S7']],
 ['从自由约饭验证选择与成行','方案：让用户保留决定权','看餐厅、时间、预算与公开同桌资料。\n自主发起和申请，小组公开场所见面。\nAI按需支持表达、语境理解与协调。\n当前 Demo 预约支付均为模拟。',[]],
 ['Agent 从反复出现的任务中生长','AI：先验证具体帮助','优先：真实饭局前练习、文化解释、饭后复盘。\n对照：现有免费工具与通用 AI。\n长期：可靠服务与可控记忆能否建立适度信任？\n聊天时长不代表付费价值或幸福感。',['S11','S12']],
 ['商家收入优先，个人付费单独验证','商业：付款对应明确交付','商家：按场服务，或核实到店收费，二选一。\n个人：基础约饭免费，具体训练或代办先按次测试。\n会员：有重复需求后再测试额度包。\n不售卖“高质量人”，不把安全设为会员权益。',[]],
 ['低额引流费，需要很大的履约规模','经济：三个稳定年情景','小试点：10 家，年收入 £2,880。\n局部基准：30 家，年收入 £34,560。\n城市扩展：300 家，年收入 £1.44m。\n全部是作者假设，含不同活动频次与人数，非增长预测。',[]],
 ['计入人工和获客后，基准仍亏损','经济：经营贡献而非净利润','局部基准：每场贡献 £15.80。\n每年 720 场，获客后贡献约 −£27,624。\n按当前成本约需 2,469 场覆盖固定与获客。\n扩展情景贡献 £378,000，但要求 288,000 可收费人次。',[]],
 ['安全是基础能力，也是成本','责任：不能承诺保证安全','成年人、小组、营业公共场所。\n最小化资料、核验边界、举报和人工处置。\n按实际角色评估在线及活动组织义务。\n法律、保险和响应资源需在上线前落实。',['S15','S16','S17']],
 ['先做有限试点，再决定加大投入','建议：商业验证与科研独立','8–12 周，现金上限建议 £5,000，工时另计。\n验证赴约、组织、商家实际付款与第二次购买。\n最后 4 场至少 3 场人工后贡献为正，是建议门槛。\n科研需导师、伦理审批和对照；不能把试点直接当论文样本。',[]],
 ['合作一场，核实价值，再谈长期','商家合作附页','共同选择时段、菜单和人数边界。\n平台负责约定招募协调；商家负责场地与餐饮。\n提前约定归因、取消、报价和支持范围。\n按付款、核实到店、商家复购评估，不承诺填满。',[]],
 ['投入跟随证据，而不是跟随热度','结论与资源需求','当前：可交互 Demo、需求规格与公开研究。\n下一步：场所伙伴、运营支持及研究合作。\n成立再扩张；经济性弱则调整或停，研究价值可独立延续。\n团队、融资与收入只使用后续核实的真实材料。',[]]
];
const sourceText=await fs.readFile('docs/business/business-assessment.zh-CN.md','utf8');
const sourceLines=Object.fromEntries([...sourceText.matchAll(/^\| (S\d+) \| (.+)$/gm)].map(m=>[m[1],m[2]]));
const pres=Presentation.create({slideSize:{width:1280,height:720}});
pres.theme.defaultFont=font;
function txt(slide,text,x,y,w,h,size,color='#153F35',bold=false){const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});s.text=text;s.text.style={typeface:font,fontSize:size,color,bold};return s;}
for(const [i,[title,sub,body,refs]]of slides.entries()){
 const s=pres.slides.add();s.background.fill=i===0?'#153F35':'#F8F5ED';
 const color=i===0?'#F8F5ED':'#153F35';
 txt(s,sub,64,48,1120,44,20,i===0?'#D4E3B0':'#67756D');
 txt(s,title,64,132,1140,132,i===0?52:44,color,true);
 if(i===8){
   txt(s,'年收入，单位：千英镑\n不同经营规模，非增长预测\n\n全部输入为作者假设\n详见经济模型',68,310,420,260,25,color);
   const chart=s.charts.add('bar',{position:{left:550,top:285,width:640,height:320},categories:['小试点','局部基准','城市扩展'],series:[{name:'收入 £k',values:[2.88,34.56,1440],fill:'#153F35'}],hasLegend:false,dataLabels:{showValue:true,position:'outEnd'},yAxis:{textStyle:{typeface:font}},xAxis:{textStyle:{typeface:font}}});
 }else if(i===5){
   const steps=[['发现','餐厅 · 时间 · 预算'],['了解','同桌 · 氛围 · 期待'],['确认','申请 · 审核 · 安排'],['见面','公开场所 · 小组']];
   steps.forEach(([a,b],j)=>{txt(s,a,70+j*295,320,260,60,35,color,true);txt(s,b,70+j*295,400,260,90,22,color);if(j<3)txt(s,'→',320+j*295,340,40,50,30,'#B45F38');});
   txt(s,'AI 按需支持表达与语境理解。当前 Demo 预约支付均为模拟。',70,560,1100,60,22,color);
 }else txt(s,body,68,300,1110,310,28,color);
 txt(s,`${String(i+1).padStart(2,'0')}  /  ${slides.length}`,64,660,300,24,14,i===0?'#D4E3B0':'#67756D');
 if(refs.length)txt(s,`来源：${refs.join('、')}，详见备注及完整报告`,580,660,620,24,14,'#67756D');
 s.speakerNotes.text=`${sub}\n${refs.map(r=>`${r}: ${sourceLines[r]}`).join('\n')}\n测算输入和公式见 economic-model.xlsx 与 business-assessment.zh-CN.md。商业数字均为作者假设，非业绩。`;
 const png=await pres.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
const skill=process.env.CODEX_BUSINESS_PRESENTATIONS_SKILL || path.join(os.homedir(),'.codex/plugins/cache/openai-primary-runtime/presentations/26.1011.11113/skills/presentations');
const draft=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(pres)).save(draft);
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const finalized=await finalizePresentation({materializeLiteralChartWorkbooks:true,workspaceDir:root,candidatePath:draft,finalPath:path.join(output,`validated-${Date.now()}.pptx`),pythonExecutable:runtime+'/python/bin/python3',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(build,`pitch-validation-${Date.now()}.json`)});
const candidates=(await fs.readdir(output)).filter(n=>/^validated-\d+\.pptx$/.test(n)).sort();
await fs.copyFile(path.join(output,candidates.at(-1)),path.join(output,'pitch.zh-CN.pptx'));
await fs.rm(path.join(output,candidates.at(-1)));
await fs.rm(path.join(output,'economic-model.xlsx.inspect.ndjson'),{force:true});
console.log(JSON.stringify({output,slides:slides.length,checks}));
