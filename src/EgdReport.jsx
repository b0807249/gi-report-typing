import { useState, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FORREST-SPECIFIC FINDING TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════
const FORREST_FINDING = {
  "Ia":(d,loc,idx)=>`${idx>0?"Another":"A"} ${d}ulcer with active spurting bleeding was noticed at ${loc}.`,
  "Ib":(d,loc,idx)=>`${idx>0?"Another":"A"+(d?" "+d:"n")} ulcer with active oozing was noticed at ${loc}.`,
  "IIa":(d,loc,idx)=>`${idx>0?"Another":"A"+(d?" "+d:"n")} ulcer with a non-bleeding visible vessel was noticed at ${loc}.`,
  "IIb":(d,loc,idx)=>`${idx>0?"Another":"A"+(d?" "+d:"n")} ulcer with adherent clots was noticed at ${loc}.`,
  "IIc":(d,loc,idx)=>`${idx>0?"Another":"A"+(d?" "+d:"n")} ulcer with flat pigmented spots was noticed at ${loc}.`,
  "III":(d,loc,idx)=>`${idx>0?"Another":"A"+(d?" "+d:"n")} ulcer with clean base was noticed at ${loc}.`,
};
const FORREST_FINDING_LC = {
  "Ia":(d,loc,idx)=>`${idx>0?"another":"a"} ${d}ulcer with active spurting bleeding was noticed at ${loc}.`,
  "Ib":(d,loc,idx)=>`${idx>0?"another":"a"+(d?" "+d:"n")} ulcer with active oozing was noticed at ${loc}.`,
  "IIa":(d,loc,idx)=>`${idx>0?"another":"a"+(d?" "+d:"n")} ulcer with a non-bleeding visible vessel was noticed at ${loc}.`,
  "IIb":(d,loc,idx)=>`${idx>0?"another":"a"+(d?" "+d:"n")} ulcer with adherent clots was noticed at ${loc}.`,
  "IIc":(d,loc,idx)=>`${idx>0?"another":"a"+(d?" "+d:"n")} ulcer with flat pigmented spots was noticed at ${loc}.`,
  "III":(d,loc,idx)=>`${idx>0?"another":"a"+(d?" "+d:"n")} ulcer with clean base was noticed at ${loc}.`,
};

const ALL_ULCER_PROCS = ["clo","biopsy_a","biopsy_b","biopsy_c","biopsy_d","hemoclip","epi_inj","bipolar","apc"];
const mkLoc=(p,def)=>p.locTo&&p.locTo!==p.loc?`${p.loc||def} to ${p.locTo}`:(p.loc||def);
const mkD=(p)=>p.ulcerDepth&&p.ulcerDepth!=="none"?p.ulcerDepth:"";

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSIS CATALOG
// ═══════════════════════════════════════════════════════════════════════════
const DIAGNOSIS_CATALOG = {
  esophagus:{label:"Esophagus",items:[
    {id:"re_a",label:"RE, LA-A",diagText:"Reflux esophagitis, LA grade A",finding:"there are mucosal breaks < 5 mm above the Z-line.",procedures:["clo","biopsy_a","biopsy_b"]},
    {id:"re_b",label:"RE, LA-B",diagText:"Reflux esophagitis, LA grade B",finding:"there are mucosal breaks > 5 mm above the Z-line, but not continuous between two mucosal folds.",procedures:["clo","biopsy_a","biopsy_b"]},
    {id:"re_c",label:"RE, LA-C",diagText:"Reflux esophagitis, LA grade C",finding:"continuous mucosal breaks crossing over 2 mucosal folds and involve < 75% of the esophageal circumference.",procedures:["clo","biopsy_a","biopsy_b"]},
    {id:"re_d",label:"RE, LA-D",diagText:"Reflux esophagitis, LA grade D",finding:"there are mucosal breaks involving > 75% of esophageal circumference.",procedures:["clo","biopsy_a","biopsy_b"]},
    {id:"gefv",label:"GEFV",
      diagTextFn:(p)=>`GEFV, Hill grade ${p.hill||"I"}`,
      findingFn:(p)=>({"I":"the gastroesophageal flap valve (GEFV) is snug to the endoscope.","II":"GEFV is less tightly apposed to the endoscope, with brief opening on inspiration, closing promptly at rest.","III":"Lax GEFV with incomplete closure of the EGJ around the endoscope.","IV":"The GEFV is absent with wide-open diaphragmatic hiatus."})[p.hill||"I"],
      hasHillParam:true},
    {id:"hh",label:"Hiatal hernia",diagText:"Hiatal hernia",finding:"hiatal sac is present."},
    {id:"ev",label:"EV",diagText:"Esophageal varices, {evF}{evColor}{evLoc}, RCS ({evRcs})",isEV:true,procedures:["evl"],
      findingByF:{"F1":"some flat varices were noticed over lower esophagus","F2":"some engorged varices were noticed over lower esophagus","F3":"large tortuous varices were noticed over lower esophagus","F0-1":"small flat varices were noticed over lower esophagus","F1-2":"some engorged varices were noticed over lower esophagus","F2-3":"large engorged to tortuous varices were noticed over lower esophagus"},
      findingRcs:{"+": ", with red color signs.","-":", without red color signs."}},
    {id:"no_ev",label:"No EV",diagText:"No esophageal varices",finding:"no esophageal varices were observed."},
    {id:"eso_candida",label:"Candidiasis",
      diagTextFn:(p)=>{const loc=p.candidaLoc&&p.candidaLoc!=="none"?`, ${p.candidaLoc} esophagus`:"";return `Suspected esophageal candidiasis${loc}, Kodsi classification grade ${p.kodsi||"II"}`;},
      findingFn:(p)=>{const loc=p.candidaLoc&&p.candidaLoc!=="none"?`${p.candidaLoc} `:"";return `whitish plaque-like lesions were noticed over ${loc}esophageal mucosa, compatible with esophageal candidiasis.`;},
      hasCandidaLoc:true,hasKodsiParam:true,kodsiDefault:"II",procedures:["biopsy_a","biopsy_b"]},
    {id:"barrett",label:"Barrett's esophagus",
      diagTextFn:(p)=>{const t=p.barrettType||"SSBE";return `Suspected ${t==="LSBE"?"long-segment":"short-segment"} Barrett's esophagus (${t}), Prague C${p.barrettC||"1"}M${p.barrettM||"1"}`;},
      findingFn:(p)=>"Multiple irregular tongue-like and island-like salmon colored lesions were noted above the Z-line.",
      hasBarrettParam:true,procedures:["biopsy_a","biopsy_b"]},
    {id:"eso_stricture",label:"Eso stricture",
      diagTextFn:(p)=>`Esophageal stricture, around ${p.strictureCm||"25"}cm from incisors`,
      findingFn:(p)=>`Esophageal stricture was noticed around ${p.strictureCm||"25"}cm from incisors.`,
      hasStrictureCm:true,procedures:["biopsy_a","biopsy_b"]},
    {id:"glycogenic",label:"Glycogenic acanthosis",diagText:"Glycogenic acanthosis",finding:"Multiple tiny, whitish, slightly elevated plaques with smooth surface were seen in the esophagus, compatible with glycogenic acanthosis."},
    {id:"ge_prolapse",label:"GE prolapse",diagText:"Gastroesophageal prolapse",finding:"transient herniation of the gastric cardia into the esophagus noted during emesis."},
    {id:"sentinel_polyp",label:"Sentinel polyp",diagText:"Sentinel polyp",finding:"Villiform hyperplastic change was noticed below EGJ.",procedures:["biopsy_a"]},
    {id:"eso_dieulafoy",label:"Dieulafoy's",diagText:"Suspected Dieulafoy's lesion, distal esophagus, with protruding visible vessel",finding:"A prominent visible vessel without an obvious ulcer base was noticed at lower esophagus, highly suspicious of Dieulafoy's lesion.",procedures:["hemoclip","epi_inj"],allowMultiple:true},
    {id:"eso_mass",label:"Eso mass",
      diagTextFn:(p)=>{const d=p.massCm?`, approximately ${p.massCmFrom||"27"}-${p.massCm||"33"}cm from incisors`:"";return `Esophageal mass lesion${d}`;},
      findingFn:(p)=>{const d=p.massCm?` between ${p.massCmFrom||"27"}-${p.massCm||"33"}cm from incisors`:"";return `An ulcerative mass lesion was noticed at esophagus${d}.`;},
      hasMassCm:true,procedures:["biopsy_a","biopsy_b"]},
    {id:"eso_flat_nbi",label:"Eso flat lesion (NBI)",diagText:"Esophageal flat lesion, lower esophagus",finding:"On NBI, brownish area was observed.\nNo ulcerative or fungating lesion could be identified.",procedures:["biopsy_a","biopsy_b"]},
    {id:"neg_fb",label:"Negative for foreign body",diagText:"Negative for esophageal foreign body",finding:"No foreign body was visualized in the whole esophagus."},
  ]},
  stomach:{label:"Stomach",items:[
    {id:"gu",label:"Gastric ulcer",isGU:true,
      diagTextFn:(p)=>{const n=p.ulcerNum==="multiple"?"Multiple gastric":"Gastric";const d=mkD(p);const dd=d?` ${d}`:"";const loc=mkLoc(p,"antrum");return `${n}${dd} ulcer${p.ulcerNum==="multiple"?"s":""}, ${loc}, Forrest ${p.forrest||"III"}`;},
      findingFn:(p,idx)=>{const loc=mkLoc(p,"antrum");const d=mkD(p);const f=p.forrest||"III";const n=p.ulcerNum==="multiple";if(n)return `Multiple ${d?d+" ":""}ulcers were noticed at ${loc}.`;const fn=FORREST_FINDING[f];return fn?fn(d?d+" ":"",loc,idx||0):`An ulcer was noticed at ${loc}.`;},
      procedures:ALL_ULCER_PROCS,hasLocMap:"stomach",hasForrest:true,forrestDefault:"III",locDefault:"antrum beside pylorus",allowMultiple:true},
    {id:"gastric_erosion",label:"Gastric erosion",
      diagTextFn:(p)=>`Gastric erosion${p.loc&&p.loc!=="antrum"?", "+p.loc:"s, antrum"}`,
      findingFn:(p)=>`small erosions are observed over ${p.loc||"antrum"}.`,
      hasLocParam:true,locOptions:["antrum","lower body","lower body and antrum","antrum and angularis","body","fundus"],locDefault:"antrum",procedures:["clo"],allowMultiple:true},
    {id:"erythematous_gastritis",label:"Erythematous gastritis",diagText:"Erythematous gastritis",finding:", and hyperemic mucosa is noted over lower body and antrum.",procedures:["clo"],appendToMucusLake:true},
    {id:"hemorrhagic_gastritis",label:"Hemorrhagic gastritis",diagText:"Hemorrhagic gastritis",finding:"\nMarked prominence of the areae gastricae, with areas of erythema and subepithelial hemorrhage.",procedures:["biopsy_a"]},
    {id:"atrophic_gastritis",label:"Atrophic gastritis",diagText:"Atrophic gastritis",finding:"\nMarked vascular visibility on both lesser and greater curvature of the corpus, compatible with atrophic change."},
    {id:"antral_swelling",label:"Antral mucosal swelling",diagText:"Antral mucosal swelling with focal hyperplastic change",finding:"\nAntral mucosal swelling with focal hyperplastic change was noticed.",procedures:["biopsy_a"]},
    {id:"pyloric_deformity",label:"Pyloric deformity",diagText:"Pyloric deformity",finding:"\nThe pylorus appears deformed/tortuous."},
    {id:"gv_gov1",label:"GV, GOV1",diagText:"Gastric varices, GOV1, RCS(−)",finding:"\nmultiple gastric varices were noticed at LC side of cardia.",procedures:["histoacryl"]},
    {id:"gv_gov2",label:"GV, GOV2",diagText:"Gastric varices, GOV2",finding:"\ngastric varices (GOV2) were noticed at fundus.",procedures:["histoacryl"]},
    {id:"no_gv",label:"No GV",diagText:"No gastric varices",finding:"\nno gastric varices were observed."},
    {id:"phg",label:"PHG",diagText:"c/w portal hypertensive gastropathy",finding:"\nSnake-skin mucosal pattern in the gastric body and fundus, with red spots but without active bleeding."},
    {id:"im",label:"Intestinal metaplasia",diagText:"Suspected intestinal metaplasia, {loc}",finding:"\nPatchy whitish, slightly elevated, and granular areas were observed. Light blue crest sign(+) was noticed under NBI.",hasLocParam:true,locOptions:["incisura angularis to middle body","antrum","angularis","lower body","antrum and angularis"],locDefault:"incisura angularis to middle body",procedures:["biopsy_a","biopsy_b"]},
    {id:"st_polyp",label:"Gastric polyp",diagText:"Gastric polyp, {loc}",finding:"\nA polyp was noticed at {loc}.",hasLocParam:true,locOptions:["fundus","upper body","middle body","lower body","antrum"],locDefault:"fundus",procedures:["biopsy_a","polypectomy","emr"],allowMultiple:true},
    {id:"st_thick_folds",label:"Thickened folds",diagText:"Thickened gastric folds with poor distensibility, {loc}",finding:"\nAsymmetrical thickened gastric folds with poor distensibility was noticed at {loc}.",hasLocParam:true,locOptions:["LC side of cardia to upper body","upper body","middle body","body"],locDefault:"LC side of cardia to upper body",procedures:["biopsy_a","biopsy_b"]},
    {id:"st_smt",label:"SMT",diagText:"Gastric submucosal tumor, {loc}",finding:"\nA submucosal tumor was noticed at {loc}.",hasLocParam:true,locOptions:["fundus","upper body","middle body","lower body","antrum","cardia"],locDefault:"upper body",procedures:["biopsy_a"]},
  ]},
  duodenum:{label:"Duodenum",items:[
    {id:"du",label:"Duodenal ulcer",isDU:true,
      diagTextFn:(p)=>{const n=p.ulcerNum==="multiple"?"Multiple duodenal":"Duodenal";const d=mkD(p);const dd=d?` ${d}`:"";const loc=mkLoc(p,"AW of bulb");return `${n}${dd} ulcer${p.ulcerNum==="multiple"?"s":""}, ${loc}, Forrest ${p.forrest||"III"}`;},
      findingFn:(p,idx)=>{const loc=mkLoc(p,"AW of bulb");const d=mkD(p);const f=p.forrest||"III";const n=p.ulcerNum==="multiple";if(n)return `multiple ${d?d+" ":""}ulcers were noticed at ${loc}.`;const fn=FORREST_FINDING_LC[f];return fn?fn(d?d+" ":"",loc,idx||0):`an ulcer was noticed at ${loc}.`;},
      procedures:ALL_ULCER_PROCS,hasLocMap:"duodenum",hasForrest:true,forrestDefault:"III",locDefault:"AW of bulb",allowMultiple:true},
    {id:"duo_erosion",label:"Duodenal erosion",
      diagTextFn:(p)=>`Duodenal erosion${p.loc&&p.loc!=="bulb"?", "+p.loc:"s, bulb"}`,
      findingFn:(p)=>`some small erosions are observed over ${p.loc||"bulb"}.`,
      hasLocParam:true,locOptions:["bulb","2nd portion","bulb and 2nd portion"],locDefault:"bulb",allowMultiple:true},
    {id:"du_stricture",label:"Duo stricture",diagText:"Duodenal stricture, {loc}",finding:"Prominent luminal stricture was noticed at {loc}, with erosive mucosal pattern noticed meanwhile.",hasLocParam:true,locOptions:["bulb","2nd portion","end of 2nd to 3rd portion","3rd portion"],locDefault:"2nd portion",procedures:["biopsy_a","biopsy_b"]},
    {id:"du_angio",label:"Angiodysplasia",diagText:"Duodenal angiodysplasia, {loc}",finding:"Angiodysplasia was noticed at {loc}.",hasLocParam:true,locOptions:["bulb","2nd portion","3rd portion"],locDefault:"2nd portion",procedures:["hemoclip","apc"],allowMultiple:true},
    {id:"du_deform",label:"Deformed bulb",diagText:"Deformed duodenal bulb",finding:"Deformed duodenal bulb was noticed."},
    {id:"du_polyp",label:"Duo polyp",diagText:"Duodenal polyp, {loc}",finding:"A polyp was noticed at {loc}.",hasLocParam:true,locOptions:["bulb","2nd portion"],locDefault:"2nd portion",procedures:["biopsy_a","polypectomy"],allowMultiple:true},
  ]},
  other:{label:"Other / Special",items:[
    {id:"incomplete",label:"Incomplete study",diagText:"Incomplete study *",finding:"",pinTop:true},
    {id:"nj_insertion",label:"s/p NJ insertion",diagText:"s/p NJ insertion, tip placed at proximal jejunum",finding:"",procedures:["nj"]},
    {id:"ng_insertion",label:"s/p NG insertion",diagText:"s/p NG tube insertion",finding:""},
    {id:"nd_insertion",label:"s/p ND insertion",diagText:"s/p ND tube insertion",finding:""},
  ]},
};

// ═══════════════════════════════════════════════════════════════════════════
// PROCEDURES
// ═══════════════════════════════════════════════════════════════════════════
const PROCEDURE_CATALOG = {
  clo:{id:"clo",label:"CLO test",suffix:"s/p CLO test",findingAppend:"We performed rapid HP urease test at antrum to detect HP.",organ:"stomach"},
  biopsy_a:{id:"biopsy_a",label:"Biopsy (A)",suffix:"s/p biopsy (A)",findingAppend:"We performed biopsy (A)."},
  biopsy_b:{id:"biopsy_b",label:"Biopsy (B)",suffix:"s/p biopsy (B)",findingAppend:"We also performed biopsy (B)."},
  biopsy_c:{id:"biopsy_c",label:"Biopsy (C)",suffix:"s/p biopsy (C)",findingAppend:"We also performed biopsy (C)."},
  biopsy_d:{id:"biopsy_d",label:"Biopsy (D)",suffix:"s/p biopsy (D)",findingAppend:"We also performed biopsy (D)."},
  hemoclip:{id:"hemoclip",label:"Hemoclip",suffix:"s/p hemoclip",findingAppend:"We applied hemoclip.",hasClipCount:true},
  epi_inj:{id:"epi_inj",label:"Epi inj.",suffix:"s/p epinephrine injection",findingAppend:"We used diluted epinephrine injection (1:10000)."},
  bipolar:{id:"bipolar",label:"Bipolar",suffix:"s/p bipolar",findingAppend:"thermocoagulation with bipolar electrocoagulation.",hasBipolarW:true},
  apc:{id:"apc",label:"APC",suffix:"s/p APC",findingAppend:"We applied argon plasma coagulation (APC)."},
  heatprobe:{id:"heatprobe",label:"Heatprobe",suffix:"s/p heatprobe thermocoagulation",findingAppend:"We performed golden probe thermocoagulation for hemostasis."},
  evl:{id:"evl",label:"EVL",suffix:"s/p EVL",findingAppend:"We performed rubber band ligations with Superseven.",hasCount:true,hasEvlType:true},
  histoacryl:{id:"histoacryl",label:"Histoacryl",suffix:"s/p endoscopic injection sclerotherapy with Histoacryl",findingAppend:"We performed endoscopic injection sclerotherapy with Histoacryl."},
  polypectomy:{id:"polypectomy",label:"Polypectomy",suffix:"s/p polypectomy",findingAppend:"We performed polypectomy."},
  emr:{id:"emr",label:"EMR",suffix:"s/p EMR",findingAppend:"We performed endoscopic mucosal resection."},
  nj:{id:"nj",label:"NJ tube",suffix:"",findingAppend:"we advanced the scope and placed the tip of NG tube at jejunum successfully."},
  hemostasis_fail:{id:"hemostasis_fail",label:"Hemostasis failed",suffix:"failed hemostasis",findingAppend:"Hemostasis was not achieved. Active bleeding persisted despite the intervention."},
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const FORREST=["Ia","Ib","IIa","IIb","IIc","III"];
const HILL_GRADES=["I","II","III","IV"];
const KODSI_GRADES=["I","II","III","IV"];
const EV_F=["F1","F2","F3","F0-1","F1-2","F2-3"];
const EV_COLOR=["Cb","Cw"];
const EV_LOC=["Li","Lm","Ls","Lm-i","Ls-m","Ls-i"];
const EV_RCS=["+","−"];
const EVL_TYPE=["prophylactic","therapeutic"];

const INDICATIONS=["tarry stool","hematemesis","melena","hematochezia","suspect UGIB","epigastric pain","dysphagia","anemia workup","coffee-ground vomitus","variceal surveillance","screening EGD","follow-up EGD","health examination","suspected GERD/PUD","foreign body ingestion","weight loss","abnormal imaging finding","PEG tube dislodgement","for ND insertion"];
const PREMED="1. Gascon: 10 cc po 2. Hyoscine: 20 mg iv, 3. Xylocaine spray: 0.5 cc oral Informed Consent obtained.";
const PREMED_HC="1. Gascon: 10 cc po  2. Hyoscine: 20 mg iv\nInformed Consent obtained.";
const SUGGESTIONS=[
  {id:"sug_oral_ppi",label:"Oral PPI",text:"oral PPI"},
  {id:"sug_oral_ppi_sucra",label:"Oral PPI + Sucralfate",text:"oral PPI with +/- self-paid sucralfate 1PK TID"},
  {id:"sug_iv_ppi",label:"IV PPI",text:"IV PPI"},
  {id:"sug_iv_ppi_high",label:"High-dose IV PPI",text:"High dose IV PPI"},
  {id:"sug_npo",label:"NPO",text:"NPO"},
  {id:"sug_npo_2_3d",label:"NPO 2-3 days",text:"NPO for 2-3 days"},
  {id:"sug_terli",label:"Terlipressin",text:"initiate terlipressin 1mg Q6H IV, may titrate to Q4H, watch out for bradycardia"},
  {id:"sug_nsbb",label:"NSBB",text:"initiate NSBB for portal-hypertension reduction"},
  {id:"sug_abx",label:"Prophylactic Abx",text:"prophylactic antibiotics use for 2-5 days"},
  {id:"sug_bt",label:"Restrictive BT",text:"restrictive blood transfusion to maintain Hb 7-8 g/dL; correct coagulopathy as indicated"},
  {id:"sug_colo",label:"Colonoscopy",text:"arrange colonoscopy"},
  {id:"sug_repeat",label:"Repeat EGD",text:"repeat EGD for follow-up"},
  {id:"sug_evl_post",label:"Post-EVL care",text:"NPO with fluid supplement, avoid NG use for 48-72 hours post-EVL; repeat EGD after 5-7 days"},
  {id:"sug_hp",label:"HP eradication",text:"HP eradication therapy if CLO (+)"},
  {id:"sug_no_bleeder",label:"No active bleeders",text:"no active bleeders could be identified in this study; further examinations should be considered if GI hemorrhage is still a concern"},
  {id:"sug_anemia_wkup",label:"Anemia workup",text:"check reticulocyte count, TIBC, ferritin, iron level for anemia d/d"},
  {id:"sug_fluconazole",label:"Fluconazole",text:"if esophageal candidiasis is histologically confirmed, consider oral fluconazole for 14-21 days"},
];
const INCOMPLETE_REASONS=["nil","blood clot retained in fundus","food debris remained in fundus and upper body","too much residual food and fluid","food stasis","patient intolerance","unstable hemodynamics"];

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const C={bg:"#0b1120",panel:"#111a2e",panelAlt:"#162033",border:"#1e2d4a",borderHi:"#3b82f6",text:"#e2e8f0",dim:"#94a3b8",muted:"#64748b",accent:"#3b82f6",accentSoft:"rgba(59,130,246,0.1)",green:"#22c55e",greenSoft:"rgba(34,197,94,0.10)",amber:"#f59e0b",amberSoft:"rgba(245,158,11,0.10)",red:"#ef4444",violet:"#8b5cf6",violetSoft:"rgba(139,92,246,0.10)"};
const mkTag=(a,c="accent")=>({padding:"5px 10px",borderRadius:5,fontSize:12,cursor:"pointer",border:`1px solid ${a?(c==="green"?C.green:c==="amber"?C.amber:c==="violet"?C.violet:C.borderHi):C.border}`,background:a?(c==="green"?C.greenSoft:c==="amber"?C.amberSoft:c==="violet"?C.violetSoft:C.accentSoft):C.panel,color:a?(c==="green"?C.green:c==="amber"?C.amber:c==="violet"?C.violet:"#93c5fd"):C.dim,fontWeight:a?600:400,fontFamily:"inherit",lineHeight:"1.4",transition:"all 0.15s",userSelect:"none"});
const inputSt={width:"100%",padding:"7px 10px",borderRadius:5,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
const selectSt={...inputSt,width:"auto",padding:"4px 8px",fontSize:11};

// ═══════════════════════════════════════════════════════════════════════════
// ANATOMY MAPS (compact)
// ═══════════════════════════════════════════════════════════════════════════
const STOMACH_REGIONS=[
  {id:"fundus",label:"Fundus",path:"M 60,30 Q 30,30 25,60 Q 20,85 35,90 L 60,85 Q 70,60 60,30 Z"},
  {id:"cardia",label:"Cardia",path:"M 60,30 Q 70,20 85,25 L 90,40 Q 80,50 70,50 L 60,40 Z"},
  {id:"upper body",label:"Upper body",path:"M 35,90 L 60,85 L 70,50 L 90,40 L 95,70 Q 90,100 80,110 L 30,115 Q 25,100 35,90 Z"},
  {id:"middle body",label:"Mid body",path:"M 30,115 L 80,110 Q 85,135 80,155 L 35,160 Q 25,140 30,115 Z"},
  {id:"lower body",label:"Lower body",path:"M 35,160 L 80,155 Q 82,175 78,190 L 45,192 Q 32,180 35,160 Z"},
  {id:"angularis",label:"Angularis",path:"M 78,190 Q 82,200 88,200 L 95,195 L 92,185 Q 85,188 78,190 Z"},
  {id:"antrum",label:"Antrum",path:"M 45,192 L 78,190 L 88,200 L 95,195 Q 105,200 108,210 L 105,220 Q 90,228 65,225 Q 50,222 45,210 Q 42,200 45,192 Z"},
  {id:"prepyloric region",label:"Prepyloric",path:"M 105,220 Q 112,222 118,218 L 120,208 Q 114,205 108,210 L 105,220 Z"},
  {id:"antrum beside pylorus",label:"Beside pylorus",path:"M 118,218 Q 126,216 132,212 L 134,204 Q 128,202 120,208 L 118,218 Z"},
  {id:"pylorus",label:"Pylorus",path:"M 132,212 Q 140,208 145,204 L 148,196 Q 142,194 138,198 L 134,204 L 132,212 Z"},
];
const STOMACH_WALLS=["AW","PW","GC side","LC side"];
function StomachMap({selected,onSelect}){
  const[hover,setHover]=useState(null);
  return(<div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
    <svg viewBox="10 10 150 240" width="165" height="255" style={{flexShrink:0}}>
      {STOMACH_REGIONS.map(r=>(<path key={r.id} d={r.path} fill={selected===r.id?"rgba(59,130,246,0.35)":hover===r.id?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.04)"} stroke={selected===r.id?C.accent:hover===r.id?"#60a5fa":"#334155"} strokeWidth={selected===r.id?2:1} style={{cursor:"pointer",transition:"all 0.15s"}} onClick={()=>onSelect(r.id)} onMouseEnter={()=>setHover(r.id)} onMouseLeave={()=>setHover(null)}/>))}
      {STOMACH_REGIONS.map(r=>{const pts=r.path.match(/[\d.]+/g).map(Number);const cx=pts.filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0)/(pts.length/2);const cy=pts.filter((_,i)=>i%2===1).reduce((a,b)=>a+b,0)/(pts.length/2);return <text key={r.id+"t"} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="7" fill={selected===r.id?"#93c5fd":"#64748b"} fontFamily="inherit" pointerEvents="none" fontWeight={selected===r.id?700:400}>{r.label}</text>;})}
      <line x1="75" y1="5" x2="75" y2="28" stroke="#334155" strokeWidth="1.5" strokeDasharray="3,2"/><text x="75" y="12" textAnchor="middle" fontSize="6" fill="#475569" fontFamily="inherit">Eso</text>
      <line x1="148" y1="196" x2="160" y2="190" stroke="#334155" strokeWidth="1" strokeDasharray="3,2"/><text x="160" y="188" fontSize="6" fill="#475569" fontFamily="inherit">→ Duo</text>
    </svg>
    <div style={{display:"flex",flexDirection:"column",gap:3,paddingTop:4}}>
      <div style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Quick select</div>
      {STOMACH_REGIONS.map(r=>(<button key={r.id} onClick={()=>onSelect(r.id)} style={{...mkTag(selected===r.id),fontSize:10,padding:"3px 7px"}}>{r.label}</button>))}
    </div>
  </div>);
}
const DUO_REGIONS=[
  {id:"AW of bulb",label:"AW bulb",path:"M 10,30 L 50,25 L 55,50 L 15,55 Z"},
  {id:"PW of bulb",label:"PW bulb",path:"M 50,25 L 85,22 L 88,48 L 55,50 Z"},
  {id:"SDA",label:"SDA",path:"M 85,22 L 88,48 L 100,65 L 105,40 Q 98,25 85,22 Z"},
  {id:"2nd portion",label:"2nd portion",path:"M 100,65 L 105,40 Q 115,55 115,75 Q 115,100 110,115 L 95,110 Q 98,90 100,65 Z"},
  {id:"3rd portion",label:"3rd portion",path:"M 95,110 L 110,115 Q 105,135 90,140 Q 70,145 50,140 L 55,125 Q 75,130 90,125 Q 95,118 95,110 Z"},
];
function DuodenumMap({selected,onSelect}){
  const[hover,setHover]=useState(null);
  return(<div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
    <svg viewBox="0 10 125 145" width="140" height="155" style={{flexShrink:0}}>
      {DUO_REGIONS.map(r=>(<path key={r.id} d={r.path} fill={selected===r.id?"rgba(59,130,246,0.35)":hover===r.id?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.04)"} stroke={selected===r.id?C.accent:hover===r.id?"#60a5fa":"#334155"} strokeWidth={selected===r.id?2:1} style={{cursor:"pointer",transition:"all 0.15s"}} onClick={()=>onSelect(r.id)} onMouseEnter={()=>setHover(r.id)} onMouseLeave={()=>setHover(null)}/>))}
      {DUO_REGIONS.map(r=>{const pts=r.path.match(/[\d.]+/g).map(Number);const cx=pts.filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0)/(pts.length/2);const cy=pts.filter((_,i)=>i%2===1).reduce((a,b)=>a+b,0)/(pts.length/2);return <text key={r.id+"t"} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="7" fill={selected===r.id?"#93c5fd":"#64748b"} fontFamily="inherit" pointerEvents="none" fontWeight={selected===r.id?700:400}>{r.label}</text>;})}
      <text x="5" y="22" fontSize="6" fill="#475569" fontFamily="inherit">← Pylorus</text>
    </svg>
    <div style={{display:"flex",flexDirection:"column",gap:3,paddingTop:4}}>
      <div style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Quick select</div>
      {["AW of bulb","PW of bulb","bulb","SDA","2nd portion","3rd portion"].map(loc=>(<button key={loc} onClick={()=>onSelect(loc)} style={{...mkTag(selected===loc),fontSize:10,padding:"3px 7px"}}>{loc}</button>))}
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function findItem(id){for(const c of Object.values(DIAGNOSIS_CATALOG)){const f=c.items.find(i=>i.id===id);if(f)return f;}return null;}
function findOrgan(id){const c=Object.entries(DIAGNOSIS_CATALOG).find(([,v])=>v.items.some(i=>i.id===id));return c?c[0]:"";}

function buildDiagText(entry){
  const item=findItem(entry.diagId);if(!item)return "";const p=entry.params||{};
  if(item.diagTextFn)return appendProcs(item.diagTextFn(p),entry);
  let d=item.diagText;
  if(item.isEV)d=d.replace("{evF}",p.evF||"F2").replace("{evColor}",p.evColor||"Cb").replace("{evLoc}",p.evLoc||"Li").replace("{evRcs}",p.evRcs||"−");
  if(item.hasLocParam)d=d.replace("{loc}",p.loc||item.locDefault);
  if(item.hasForrest)d=d.replace("{forrest}",p.forrest||item.forrestDefault);
  if(item.hasHillParam)d=d.replace("{hill}",p.hill||"IV");
  if(item.hasKodsiParam)d=d.replace("{kodsi}",p.kodsi||item.kodsiDefault);
  return appendProcs(d,entry);
}
function appendProcs(d,entry){
  const procs=(entry.procedures||[]).map(pid=>{const p=PROCEDURE_CATALOG[pid];if(!p)return null;let s=p.suffix;
    if(pid==="evl"){const t=entry.params?.evlType||"prophylactic";s=t==="prophylactic"?"s/p prophylactic EVL":"s/p EVL";if(entry.params?.evlCount)s+=` x${entry.params.evlCount}`;}
    if(pid==="hemoclip"){const c=entry.params?.hemoclipCount||"1";const pl=parseInt(c)>1?"hemoclips":"hemoclip";s=`s/p successful hemostasis with ${pl} x${c}`;}
    if(pid==="bipolar"){const w=entry.params?.bipolarW||"25";s=`s/p bipolar electrocoagulation (Softcoagu ${w}W)`;}
    if(pid==="hemostasis_fail")s="failed hemostasis";
    return s;}).filter(Boolean);
  if(procs.length)d+=", "+procs.join(", ");return d;
}
function buildFinding(entry,idx){
  const item=findItem(entry.diagId);if(!item)return "";const p=entry.params||{};
  if(item.findingFn)return item.findingFn(p,idx||0);
  if(item.isEV){const fk=p.evF||"F2";const base=item.findingByF[fk]||item.findingByF["F2"];const rk=p.evRcs||"−";return base+(rk==="+"?item.findingRcs["+"]:item.findingRcs["-"]);}
  let f=item.finding||"";if(item.hasLocParam)f=f.replace(/\{loc\}/g,p.loc||item.locDefault);return f;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
function Section({title,badge,defaultOpen=true,children}){
  const[open,setOpen]=useState(defaultOpen);
  return(<div style={{marginBottom:14,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
    <div onClick={()=>setOpen(!open)} style={{padding:"9px 14px",background:C.panel,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",userSelect:"none",borderBottom:open?`1px solid ${C.border}`:"none"}}>
      <span style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:C.accent,display:"flex",alignItems:"center",gap:8}}>{title}{badge&&<span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:4,background:badge.c==="green"?C.greenSoft:C.amberSoft,color:badge.c==="green"?C.green:C.amber}}>{badge.t}</span>}</span>
      <span style={{transition:"transform 0.2s",transform:open?"rotate(180deg)":"none",color:C.muted,fontSize:12}}>▼</span>
    </div>{open&&<div style={{padding:"10px 14px",background:C.bg}}>{children}</div>}
  </div>);
}

function DiagCard({entry,onRemove,onUpdate,dragHandlers,isDragOver}){
  const item=useMemo(()=>findItem(entry.diagId),[entry.diagId]);
  if(!item)return null;
  const procs=(item.procedures||[]).map(pid=>PROCEDURE_CATALOG[pid]).filter(Boolean);
  const up=(k,v)=>onUpdate({...entry,params:{...entry.params,[k]:v}});
  const tp=(pid)=>{const ps=entry.procedures||[];onUpdate({...entry,procedures:ps.includes(pid)?ps.filter(x=>x!==pid):[...ps,pid]});};
  const p=entry.params||{};const[showMap,setShowMap]=useState(false);
  return(
    <div {...dragHandlers} style={{padding:"10px 12px",border:`1px solid ${isDragOver?C.accent:C.border}`,borderRadius:6,marginBottom:8,background:C.panelAlt,transition:"border-color 0.15s",cursor:"grab"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8,flex:1}}>
          <span style={{color:C.muted,fontSize:14,cursor:"grab",userSelect:"none",flexShrink:0,marginTop:1}}>⠿</span>
          <div style={{flex:1,fontSize:12,color:C.text,lineHeight:1.5,fontWeight:500}}>- {buildDiagText(entry)}</div>
        </div>
        <button onClick={onRemove} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,fontFamily:"inherit",padding:"0 4px",flexShrink:0}}>✕</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8,paddingLeft:22}}>
        {(item.isGU||item.isDU)&&(<>
          <select value={p.ulcerDepth||"none"} onChange={e=>up("ulcerDepth",e.target.value)} style={selectSt}><option value="none">— depth —</option><option value="shallow">Shallow</option><option value="deep">Deep</option></select>
          <select value={p.ulcerNum||"single"} onChange={e=>up("ulcerNum",e.target.value)} style={selectSt}><option value="single">Single</option><option value="multiple">Multiple</option></select>
        </>)}
        {item.isEV&&(<>
          <select value={p.evF||"F2"} onChange={e=>up("evF",e.target.value)} style={selectSt}>{EV_F.map(f=><option key={f}>{f}</option>)}</select>
          <select value={p.evColor||"Cb"} onChange={e=>up("evColor",e.target.value)} style={selectSt}>{EV_COLOR.map(c=><option key={c}>{c}</option>)}</select>
          <select value={p.evLoc||"Li"} onChange={e=>up("evLoc",e.target.value)} style={selectSt}>{EV_LOC.map(l=><option key={l}>{l}</option>)}</select>
          <select value={p.evRcs||"−"} onChange={e=>up("evRcs",e.target.value)} style={selectSt}>{EV_RCS.map(r=><option key={r} value={r}>RCS ({r})</option>)}</select>
        </>)}
        {item.hasForrest&&<select value={p.forrest||item.forrestDefault} onChange={e=>up("forrest",e.target.value)} style={selectSt}>{FORREST.map(f=><option key={f} value={f}>Forrest {f}</option>)}</select>}
        {item.hasLocParam&&<select value={p.loc||item.locDefault} onChange={e=>up("loc",e.target.value)} style={selectSt}>{item.locOptions.map(l=><option key={l}>{l}</option>)}</select>}
        {item.hasHillParam&&<select value={p.hill||"IV"} onChange={e=>up("hill",e.target.value)} style={selectSt}>{HILL_GRADES.map(h=><option key={h}>Hill {h}</option>)}</select>}
        {item.hasCandidaLoc&&<select value={p.candidaLoc||"none"} onChange={e=>up("candidaLoc",e.target.value)} style={selectSt}><option value="none">— no loc —</option><option value="upper">upper</option><option value="middle">middle</option><option value="lower">lower</option><option value="whole">whole</option></select>}
        {item.hasKodsiParam&&<select value={p.kodsi||item.kodsiDefault} onChange={e=>up("kodsi",e.target.value)} style={selectSt}>{KODSI_GRADES.map(k=><option key={k} value={k}>Kodsi {k}</option>)}</select>}
        {item.hasBarrettParam&&(<>
          <select value={p.barrettType||"SSBE"} onChange={e=>up("barrettType",e.target.value)} style={selectSt}><option value="SSBE">SSBE</option><option value="LSBE">LSBE</option></select>
          <span style={{fontSize:11,color:C.dim}}>C</span><select value={p.barrettC||"1"} onChange={e=>up("barrettC",e.target.value)} style={selectSt}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select>
          <span style={{fontSize:11,color:C.dim}}>M</span><select value={p.barrettM||"1"} onChange={e=>up("barrettM",e.target.value)} style={selectSt}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select>
        </>)}
        {item.hasStrictureCm&&(<><span style={{fontSize:11,color:C.dim}}>cm:</span><input type="number" value={p.strictureCm||"25"} onChange={e=>up("strictureCm",e.target.value)} style={{...inputSt,width:50,padding:"3px 6px",fontSize:11}}/></>)}
        {item.hasMassCm&&(<><span style={{fontSize:11,color:C.dim}}>from</span><input type="number" value={p.massCmFrom||"27"} onChange={e=>up("massCmFrom",e.target.value)} style={{...inputSt,width:45,padding:"3px 6px",fontSize:11}}/><span style={{fontSize:11,color:C.dim}}>to</span><input type="number" value={p.massCm||"33"} onChange={e=>up("massCm",e.target.value)} style={{...inputSt,width:45,padding:"3px 6px",fontSize:11}}/><span style={{fontSize:11,color:C.dim}}>cm</span></>)}
        {item.hasLocMap&&(<button onClick={()=>setShowMap(!showMap)} style={{...mkTag(showMap,"amber"),fontSize:10,padding:"3px 8px"}}>{showMap?"▲ Hide map":"▼ Location map"}</button>)}
      </div>
      {(item.isGU||item.isDU)&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6,paddingLeft:22,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.muted,fontWeight:600}}>Loc:</span>
          <select value={p.loc||item.locDefault} onChange={e=>{up("loc",e.target.value);if(p.locTo===e.target.value)up("locTo","");}} style={selectSt}>
            {(item.isGU?STOMACH_REGIONS.map(r=>r.id):["AW of bulb","PW of bulb","bulb","SDA","2nd portion","3rd portion"]).map(l=><option key={l} value={l}>{l}</option>)}
          </select>
          <span style={{fontSize:10,color:C.muted}}>→</span>
          <select value={p.locTo||""} onChange={e=>up("locTo",e.target.value)} style={selectSt}>
            <option value="">— single —</option>
            {(item.isGU?STOMACH_REGIONS.map(r=>r.id):["AW of bulb","PW of bulb","bulb","SDA","2nd portion","3rd portion"]).filter(l=>l!==(p.loc||item.locDefault)).map(l=><option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}
      {item.hasLocMap&&showMap&&(
        <div style={{marginTop:8,paddingLeft:22,padding:"10px",background:"rgba(0,0,0,0.2)",borderRadius:6}}>
          {item.hasLocMap==="stomach"&&<StomachMap selected={p.loc||item.locDefault} onSelect={loc=>{up("loc",loc);if(p.locTo===loc)up("locTo","");}}/>}
          {item.hasLocMap==="duodenum"&&<DuodenumMap selected={p.loc||item.locDefault} onSelect={loc=>{up("loc",loc);if(p.locTo===loc)up("locTo","");}}/>}
          {item.hasLocMap==="stomach"&&(<div style={{marginTop:8,display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>Wall:</span>{STOMACH_WALLS.map(w=>{const full=`${w} of ${(p.loc||item.locDefault).replace(/(GC|LC|AW|PW) side of /,"")}`;return <button key={w} onClick={()=>up("loc",full)} style={{...mkTag(p.loc===full),fontSize:10,padding:"3px 7px"}}>{w}</button>;})}</div>)}
        </div>
      )}
      {procs.length>0&&(
        <div style={{marginTop:8,paddingLeft:22}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
            <span style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginRight:4}}>s/p:</span>
            {procs.map(pr=>(<button key={pr.id} onClick={()=>tp(pr.id)} style={mkTag((entry.procedures||[]).includes(pr.id),"violet")}>{pr.label}</button>))}
          </div>
          {(entry.procedures||[]).includes("evl")&&(<div style={{marginTop:6,display:"flex",flexWrap:"wrap",alignItems:"center",gap:6}}><select value={p.evlType||"prophylactic"} onChange={e=>up("evlType",e.target.value)} style={selectSt}>{EVL_TYPE.map(t=><option key={t}>{t}</option>)}</select><span style={{fontSize:11,color:C.dim}}>×</span><input type="number" value={p.evlCount||"5"} onChange={e=>up("evlCount",e.target.value)} style={{...inputSt,width:50,padding:"3px 6px",fontSize:11}}/></div>)}
          {(entry.procedures||[]).includes("hemoclip")&&(<div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:C.dim}}>Hemoclip ×</span><select value={p.hemoclipCount||"1"} onChange={e=>up("hemoclipCount",e.target.value)} style={selectSt}>{[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select></div>)}
          {(entry.procedures||[]).includes("bipolar")&&(<div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:C.dim}}>Bipolar Softcoagu</span><select value={p.bipolarW||"25"} onChange={e=>up("bipolarW",e.target.value)} style={selectSt}>{["20","25","30","35"].map(w=><option key={w} value={w}>{w}W</option>)}</select></div>)}
        </div>
      )}
    </div>
  );
}

function FreeCard({entry,onRemove,onUpdate,dragHandlers,isDragOver}){
  return(<div {...dragHandlers} style={{padding:"10px 12px",border:`1px solid ${isDragOver?C.accent:C.border}`,borderRadius:6,marginBottom:8,background:C.panelAlt,cursor:"grab"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{color:C.muted,fontSize:14,cursor:"grab",userSelect:"none",flexShrink:0}}>⠿</span>
      <span style={{fontSize:12,color:C.amber,fontWeight:600,flexShrink:0}}>*</span>
      <input style={{...inputSt,flex:1,background:C.bg,fontSize:12}} placeholder="Type diagnosis freely..." value={entry.text} onChange={e=>onUpdate({...entry,text:e.target.value})}/>
      <button onClick={onRemove} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,fontFamily:"inherit",padding:"0 4px",flexShrink:0}}>✕</button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════
const ORGAN_ORDER={esophagus:1,stomach:2,duodenum:3,other:4};
const defaultParams=()=>({loc:"",locTo:"",forrest:"III",hill:"IV",kodsi:"II",candidaLoc:"none",evF:"F2",evColor:"Cb",evLoc:"Li",evRcs:"−",evlType:"prophylactic",evlCount:"5",ulcerDepth:"none",ulcerNum:"single",hemoclipCount:"1",bipolarW:"25",barrettType:"SSBE",barrettC:"1",barrettM:"1",strictureCm:"25",massCmFrom:"27",massCm:"33"});

export default function EgdReport(){
  const[mode,setMode]=useState("ward");// "ward" = 急病房, "hc" = 健檢
  const[indication,setIndication]=useState("");const[customInd,setCustomInd]=useState("");
  const[diagList,setDiagList]=useState([]);
  const[esoExtra,setEsoExtra]=useState("");const[stExtra,setStExtra]=useState("");
  const[stMucusLake,setStMucusLake]=useState("");const[stNotExamined,setStNotExamined]=useState(false);
  const[duoExtra,setDuoExtra]=useState("");const[duoNormal,setDuoNormal]=useState("neg2");
  const[hpResult,setHpResult]=useState("nil");const[incomplete,setIncomplete]=useState("nil");
  const[suggestions,setSuggestions]=useState([]);const[sugCustom,setSugCustom]=useState("");
  const[biopsy,setBiopsy]=useState("no");const[polyp,setPolyp]=useState("no");
  const[emrDone,setEmrDone]=useState("no");const[complication,setComplication]=useState("nil");
  const[copied,setCopied]=useState(false);
  const[showNotionModal,setShowNotionModal]=useState(false);
  const[chartNo,setChartNo]=useState("");
  const[notionNotes,setNotionNotes]=useState("");
  const[notionDisease,setNotionDisease]=useState("");
  const[notionStatus,setNotionStatus]=useState("");// "saving","success","error"
  const[notionError,setNotionError]=useState("");
  const[dragIdx,setDragIdx]=useState(null);const[dragOverIdx,setDragOverIdx]=useState(null);
  const nextId=useRef(0);

  const sorted=useMemo(()=>{
    const pinned=diagList.filter(e=>{if(e.type!=="catalog")return false;return findItem(e.diagId)?.pinTop;});
    const rest=diagList.filter(e=>!pinned.includes(e));return[...pinned,...rest];
  },[diagList]);

  const addDiag=(cid)=>{
    const item=findItem(cid);if(!item)return;
    const newEntry={_key:nextId.current++,type:"catalog",diagId:cid,params:{...defaultParams(),loc:item.locDefault||""},procedures:[]};
    const organ=findOrgan(cid);const order=ORGAN_ORDER[organ]||4;
    setDiagList(prev=>{const nl=[...prev];const pc=nl.filter(e=>e.type==="catalog"&&findItem(e.diagId)?.pinTop).length;let insertIdx=nl.length;let lastSame=-1;for(let i=pc;i<nl.length;i++){const e=nl[i];if(e.type==="free")continue;if(findOrgan(e.diagId)===organ)lastSame=i;}if(lastSame>=0){insertIdx=lastSame+1;}else{for(let i=pc;i<nl.length;i++){const e=nl[i];if(e.type==="free")continue;if((ORGAN_ORDER[findOrgan(e.diagId)]||4)>order){insertIdx=i;break;}}}nl.splice(insertIdx,0,newEntry);return nl;});
  };
  const rmInstance=(cid)=>{const insts=diagList.filter(d=>d.type==="catalog"&&d.diagId===cid);if(insts.length>0){const last=insts[insts.length-1];setDiagList(p=>p.filter(d=>d._key!==last._key));}};
  const addFree=()=>setDiagList(p=>[...p,{_key:nextId.current++,type:"free",text:""}]);
  const rm=(k)=>setDiagList(p=>p.filter(d=>d._key!==k));
  const upd=(k,ne)=>setDiagList(p=>p.map(d=>d._key===k?{...ne,_key:k}:d));
  const togSug=(id)=>setSuggestions(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const ds=(i)=>(e)=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";};
  const dov=(i)=>(e)=>{e.preventDefault();const pc=sorted.filter(e2=>{if(e2.type!=="catalog")return false;return findItem(e2.diagId)?.pinTop;}).length;if(dragIdx<pc||i<pc)return;setDragOverIdx(i);};
  const dd=(i)=>(e)=>{e.preventDefault();if(dragIdx===null||dragIdx===i){setDragIdx(null);setDragOverIdx(null);return;}const fk=sorted[dragIdx]?._key;const tk=sorted[i]?._key;if(fk==null||tk==null){setDragIdx(null);setDragOverIdx(null);return;}setDiagList(p=>{const n=[...p];const fi=n.findIndex(d=>d._key===fk);const ti=n.findIndex(d=>d._key===tk);if(fi<0||ti<0)return p;const[it]=n.splice(fi,1);n.splice(ti,0,it);return n;});setDragIdx(null);setDragOverIdx(null);};
  const de=()=>{setDragIdx(null);setDragOverIdx(null);};

  const report=useMemo(()=>{
    const L=[];const isHC=mode==="hc";
    if(isHC)L.push("The procedure is performed under TIVA.");
    const ind=isHC?"health examination":(indication||customInd||"___");
    L.push(`Indication: ${ind} Premedication:`);L.push(isHC?PREMED_HC:PREMED);
    L.push(`Endoscope number: Finding:`);
    let eF=[],sF=[],dF=[];const diagIdCount={};
    sorted.filter(e=>e.type==="catalog").forEach(entry=>{
      const item=findItem(entry.diagId);if(!item)return;
      const cnt=diagIdCount[entry.diagId]||0;diagIdCount[entry.diagId]=cnt+1;
      const f=buildFinding(entry,cnt);if(f){const org=findOrgan(entry.diagId);if(org==="esophagus")eF.push(f);else if(org==="stomach")sF.push(f);else if(org==="duodenum")dF.push(f);}
      (entry.procedures||[]).forEach(pid=>{const proc=PROCEDURE_CATALOG[pid];if(!proc?.findingAppend)return;let ap=proc.findingAppend;
        if(pid==="evl"&&entry.params?.evlCount)ap+=` x${entry.params.evlCount}.`;
        if(pid==="hemoclip"){const c=entry.params?.hemoclipCount||"1";const pl=parseInt(c)>1?"hemoclips":"hemoclip";ap=`We applied ${pl} x${c} to the lesion with successful hemostasis.`;}
        if(pid==="bipolar"){const w=entry.params?.bipolarW||"25";ap=`thermocoagulation with bipolar electrocoagulation (Bipolar Softcoagu ${w}W).`;}
        if(pid==="hemostasis_fail")ap="Hemostasis was not achieved. Active bleeding persisted despite the intervention.";
        const org=findOrgan(entry.diagId);const t=proc.organ==="stomach"?sF:org==="esophagus"?eF:org==="duodenum"?dF:sF;t.push("\n"+ap);});
    });
    const smartJoin=(arr)=>arr.reduce((acc,item)=>{if(!acc)return item;if(item.startsWith(",")||item.startsWith("\n"))return acc+item;return acc+"\n"+item;},"").trim();
    let eT=smartJoin(eF);if(esoExtra)eT+=(eT?"\n":"")+esoExtra;L.push(`Esophagus: ${eT||"negative."}`);
    if(stNotExamined){L.push("Stomach: not examined.");}else{const mm={clean:"mucus lake is clean",bile:"mucus lake is bile-stained",blood:"much coffee ground content and hematin retained in fundus",food:"food residue is retained in stomach"};const mlText=mm[stMucusLake]||"";const sf=smartJoin(sF);let sT="";if(mlText&&sf){sT=mlText+(sf.startsWith(",")?sf:"\n"+sf);}else if(mlText){sT=mlText+".";}else if(sf){sT=sf.startsWith(",")?sf.slice(2).trim():sf;}else{sT="negative.";}if(stExtra)sT+="\n"+stExtra;L.push(`Stomach: ${sT}`);}
    const dm={neg2:"negative to 2nd portion.",neg3:"negative to 3rd portion.",not_examined:"not examined."};let dT=smartJoin(dF);if(!dT)dT=dm[duoNormal]||"negative to 2nd portion.";if(duoExtra)dT+="\n"+duoExtra;L.push(`Duodenum: ${dT}`);
    L.push("Diagnosis:");let hd=false;
    sorted.forEach(e=>{if(e.type==="catalog"){L.push(`- ${buildDiagText(e)}`);hd=true;}else if(e.type==="free"&&e.text?.trim()){L.push(`- ${e.text.trim()}`);hd=true;}});
    if(!hd)L.push("- ___");
    const hp=hpResult==="done"?"Rapid Hp urease test ( ): done":"Rapid Hp urease test ( ): nil";
    L.push(`Note: ${hp} Reason for incomplete EGD: ${incomplete} Suggestion of management:`);
    const sg=suggestions.map(id=>SUGGESTIONS.find(s=>s.id===id)).filter(Boolean);
    if(sg.length||sugCustom){sg.forEach(s=>L.push(`- ${s.text}`));if(sugCustom)sugCustom.split("\n").filter(Boolean).forEach(s=>L.push(`- ${s}`));}else L.push("- ___");
    const b=biopsy==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const po=polyp==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const em=emrDone==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const co=complication==="yes"?"(v) yes ( ) nil":"( ) yes (v) nil";
    L.push(`Pathological report (after EGD): (1)biopsy with removal: ${b} (2)polypectomy: ${po} (3)endoscopic mucosal resection: ${em} Complication after EGD: ${co}`);
    return L.join("\n");
  },[mode,indication,customInd,sorted,esoExtra,stExtra,stMucusLake,stNotExamined,duoExtra,duoNormal,hpResult,incomplete,suggestions,sugCustom,biopsy,polyp,emrDone,complication]);

  const copy=()=>{navigator.clipboard.writeText(report).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  const clear=()=>{setIndication("");setCustomInd("");setDiagList([]);setEsoExtra("");setStExtra("");setStMucusLake("");setStNotExamined(false);setDuoExtra("");setDuoNormal("neg2");setHpResult("nil");setIncomplete("nil");setSuggestions([]);setSugCustom("");setBiopsy("no");setPolyp("no");setEmrDone("no");setComplication("nil");};

  const PROC_MAP={"epi_inj":"Bosmin","hemoclip":"Clip","bipolar":"Probe燒","heatprobe":"Probe燒","apc":"APC燒","evl":"EVL","histoacryl":"EIS"};
  const saveToNotion=async()=>{
    if(!chartNo.trim()){setNotionError("請輸入病歷號");return;}
    setNotionStatus("saving");setNotionError("");
    try{
      // Extract procedures for multi-select
      const procSet=new Set();
      sorted.forEach(e=>{(e.procedures||[]).forEach(pid=>{if(PROC_MAP[pid])procSet.add(PROC_MAP[pid]);});});
      const payload={
        chartNo:chartNo.trim(),
        biopsy:biopsy==="yes"?"Y":"N",
        cloTest:hpResult==="done"?"Y":"N",
        cloResult:hpResult==="done"?"":"",
        disease:notionDisease.trim()||undefined,
        procedures:[...procSet],
        quote:undefined,
        notes:notionNotes.trim()||undefined,
        bodyContent:report,
      };
      const resp=await fetch("/api/notion-save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.error||"Failed to save");
      setNotionStatus("success");
      setTimeout(()=>{setShowNotionModal(false);setNotionStatus("");setChartNo("");setNotionNotes("");setNotionDisease("");},2000);
    }catch(err){setNotionStatus("error");setNotionError(err.message);}
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'SF Mono','Fira Code','JetBrains Mono','Menlo',monospace",fontSize:13,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.panel,flexShrink:0}}>
        <div><div style={{fontSize:16,fontWeight:700}}>EGD Report Builder <span style={{fontSize:11,color:C.accent,fontWeight:400}}>v6</span></div><div style={{fontSize:11,color:C.muted,marginTop:1}}>Diagnosis-first · Forrest-specific · Complete phrase library</div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <a href="https://www.notion.so/1e4106028a148035afa6f5e401bb4d3b" target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontSize:12,fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>📋 Notion</a>
          <a href="https://www.notion.so/EGD-PES-1ea106028a14809e9dcdde8b3bd3b933" target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontSize:12,fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>🔬 EGD/PES</a>
          <div style={{display:"flex",borderRadius:6,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <button onClick={()=>setMode("ward")} style={{padding:"6px 14px",fontSize:12,fontWeight:mode==="ward"?600:400,fontFamily:"inherit",background:mode==="ward"?C.accentSoft:"transparent",color:mode==="ward"?"#93c5fd":C.muted,border:"none",borderRight:`1px solid ${C.border}`,cursor:"pointer"}}>急病房</button>
            <button onClick={()=>setMode("hc")} style={{padding:"6px 14px",fontSize:12,fontWeight:mode==="hc"?600:400,fontFamily:"inherit",background:mode==="hc"?C.greenSoft:"transparent",color:mode==="hc"?C.green:C.muted,border:"none",cursor:"pointer"}}>健檢</button>
          </div>
          <button onClick={clear} style={{padding:"7px 14px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>⟲ Clear All</button>
        </div>
      </div>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px",borderRight:`1px solid ${C.border}`,maxHeight:"calc(100vh - 54px)"}}>
          <Section title="① Indication" badge={indication||customInd?{t:"✓",c:"green"}:null}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>{INDICATIONS.map(i=>(<button key={i} onClick={()=>{setIndication(indication===i?"":i);setCustomInd("");}} style={mkTag(indication===i)}>{i}</button>))}</div>
            <input style={{...inputSt,marginTop:4}} placeholder="Custom indication..." value={customInd} onChange={e=>{setCustomInd(e.target.value);setIndication("");}}/>
          </Section>
          <Section title="② Diagnosis" badge={diagList.length?{t:diagList.length,c:"green"}:null}>
            {Object.entries(DIAGNOSIS_CATALOG).map(([ck,cat])=>(
              <div key={ck} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{cat.label}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {cat.items.map(item=>{
                    const count=diagList.filter(d=>d.type==="catalog"&&d.diagId===item.id).length;
                    if(item.allowMultiple){return(<span key={item.id} style={{display:"inline-flex",alignItems:"center",gap:0}}>
                      <button onClick={()=>addDiag(item.id)} style={{...mkTag(count>0,count>0?"green":"accent"),borderRadius:count>0?"5px 0 0 5px":"5px"}}>{count>0?"✓":"+"} {item.label}{count>1?` ×${count}`:""}</button>
                      {count>0&&<span style={{display:"inline-flex"}}>{Array.from({length:count}).map((_,i)=>(<button key={i} onClick={e=>{e.stopPropagation();rmInstance(item.id);}} style={{padding:"5px 5px",fontSize:10,cursor:"pointer",border:`1px solid ${C.green}`,borderLeft:"none",background:"rgba(239,68,68,0.08)",color:C.red,fontFamily:"inherit",lineHeight:"1.4",borderRadius:i===count-1?"0 5px 5px 0":"0",fontWeight:600}}>✕</button>))}</span>}
                    </span>);}else{const added=count>0;return(<button key={item.id} onClick={()=>{if(added){const ex=diagList.find(d=>d.type==="catalog"&&d.diagId===item.id);if(ex)rm(ex._key);}else addDiag(item.id);}} style={mkTag(added,added?"green":"accent")}>{added?"✓":"+"} {item.label}</button>);}
                  })}
                </div>
              </div>
            ))}
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}><button onClick={addFree} style={{padding:"8px 16px",borderRadius:6,fontSize:12,cursor:"pointer",border:`1px dashed ${C.amber}`,background:C.amberSoft,color:C.amber,fontWeight:600,fontFamily:"inherit"}}>+ Free Text Diagnosis</button></div>
            {sorted.length>0&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Active ({diagList.length}) <span style={{color:C.muted,fontWeight:400,textTransform:"none"}}>— drag ⠿ to reorder</span></div>
                {sorted.map((entry,idx)=>{const pin=entry.type==="catalog"&&findItem(entry.diagId)?.pinTop;const dh=pin?{}:{draggable:true,onDragStart:ds(idx),onDragOver:dov(idx),onDrop:dd(idx),onDragEnd:de};return entry.type==="catalog"?<DiagCard key={entry._key} entry={entry} onRemove={()=>rm(entry._key)} onUpdate={ne=>upd(entry._key,ne)} dragHandlers={dh} isDragOver={dragOverIdx===idx}/>:<FreeCard key={entry._key} entry={entry} onRemove={()=>rm(entry._key)} onUpdate={ne=>upd(entry._key,ne)} dragHandlers={dh} isDragOver={dragOverIdx===idx}/>;
                })}
              </div>
            )}
          </Section>
          <Section title="③ Findings Override" defaultOpen={false}>
            <div style={{fontSize:11,color:C.dim,marginBottom:10}}>Auto-generated from diagnoses. Override here.</div>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Stomach — Mucus Lake</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
              {[{id:"clean",l:"Clean"},{id:"bile",l:"Bile-stained"},{id:"blood",l:"Blood/coffee-ground"},{id:"food",l:"Food residue"}].map(m=>(<button key={m.id} onClick={()=>{setStMucusLake(stMucusLake===m.id?"":m.id);setStNotExamined(false);}} style={mkTag(stMucusLake===m.id&&!stNotExamined)}>{m.l}</button>))}
              <button onClick={()=>setStNotExamined(!stNotExamined)} style={mkTag(stNotExamined,"amber")}>Not examined</button>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4,marginTop:10}}>Duodenum — Default</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {[{id:"neg2",l:"Neg to 2nd"},{id:"neg3",l:"Neg to 3rd"},{id:"not_examined",l:"Not examined"}].map(m=>(<button key={m.id} onClick={()=>setDuoNormal(m.id)} style={mkTag(duoNormal===m.id)}>{m.l}</button>))}
            </div>
            {[{l:"Extra Esophagus",v:esoExtra,s:setEsoExtra},{l:"Extra Stomach",v:stExtra,s:setStExtra},{l:"Extra Duodenum",v:duoExtra,s:setDuoExtra}].map(({l,v,s})=>(<div key={l}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4,marginTop:8}}>{l}</div><textarea style={{...inputSt,resize:"vertical",minHeight:36}} value={v} onChange={e=>s(e.target.value)} placeholder="..."/></div>))}
          </Section>
          <Section title="④ Note" defaultOpen={false}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>HP Urease Test</div>
            <div style={{display:"flex",gap:4,marginBottom:10}}>{[{id:"done",l:"Done"},{id:"nil",l:"Nil"}].map(o=>(<button key={o.id} onClick={()=>setHpResult(o.id)} style={mkTag(hpResult===o.id)}>{o.l}</button>))}</div>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Incomplete EGD</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{INCOMPLETE_REASONS.map(r=>(<button key={r} onClick={()=>setIncomplete(incomplete===r?"nil":r)} style={mkTag(incomplete===r)}>{r}</button>))}</div>
          </Section>
          <Section title="⑤ Suggestion" defaultOpen={false}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{SUGGESTIONS.map(s=>(<button key={s.id} onClick={()=>togSug(s.id)} style={mkTag(suggestions.includes(s.id),"green")}>{s.label}</button>))}</div>
            <textarea style={{...inputSt,resize:"vertical",minHeight:36}} value={sugCustom} onChange={e=>setSugCustom(e.target.value)} placeholder="Additional..."/>
          </Section>
          <Section title="⑥ Pathological Report" defaultOpen={false}>
            {[{l:"Biopsy",v:biopsy,s:setBiopsy},{l:"Polypectomy",v:polyp,s:setPolyp},{l:"EMR",v:emrDone,s:setEmrDone}].map(({l,v,s})=>(<div key={l} style={{marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>{l}</div><div style={{display:"flex",gap:4}}>{["yes","no"].map(x=>(<button key={x} onClick={()=>s(x)} style={mkTag(v===x)}>{x}</button>))}</div></div>))}
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Complication</div>
            <div style={{display:"flex",gap:4}}>{["nil","yes"].map(v=>(<button key={v} onClick={()=>setComplication(v)} style={mkTag(complication===v)}>{v}</button>))}</div>
          </Section>
          <div style={{height:24}}/>
        </div>
        <div style={{width:420,minWidth:360,overflowY:"auto",padding:"14px 18px",background:C.panelAlt,maxHeight:"calc(100vh - 54px)"}}>
          <div style={{position:"sticky",top:0}}>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:C.accent,marginBottom:10}}>Preview</div>
            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:12,marginBottom:10,maxHeight:"calc(100vh - 170px)",overflowY:"auto"}}>
              <pre style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.7,color:C.text,wordBreak:"break-word",fontFamily:"inherit"}}>{report}</pre>
            </div>
            <button onClick={copy} style={{width:"100%",padding:"11px",borderRadius:6,border:"none",background:copied?C.green:C.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{copied?"✓ Copied":"Copy Report"}</button>
            <button onClick={()=>setShowNotionModal(true)} style={{width:"100%",padding:"11px",borderRadius:6,border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8,transition:"all 0.2s"}}>📋 Save to Notion</button>
          </div>
        </div>
      </div>
      {showNotionModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10000}} onClick={()=>{if(notionStatus!=="saving"){setShowNotionModal(false);setNotionStatus("");setNotionError("");}}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:24,width:360,maxWidth:"90vw"}}>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>📋 Save to Notion</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>病歷號 *</div>
              <input value={chartNo} onChange={e=>setChartNo(e.target.value)} placeholder="e.g. 52526848" style={{...inputSt}} autoFocus/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>疾病（選填）</div>
              <textarea value={notionDisease} onChange={e=>setNotionDisease(e.target.value)} placeholder="e.g. 6BI03；之前食道癌被我做到胃鏡" style={{...inputSt,resize:"vertical",minHeight:40}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>後記/臨床狀況（選填）</div>
              <textarea value={notionNotes} onChange={e=>setNotionNotes(e.target.value)} placeholder="Additional clinical notes..." style={{...inputSt,resize:"vertical",minHeight:40}}/>
            </div>
            <div style={{fontSize:11,color:C.dim,marginBottom:12,padding:10,background:C.bg,borderRadius:6,border:`1px solid ${C.border}`}}>
              <div style={{marginBottom:4}}><span style={{color:C.muted}}>Biopsy:</span> {biopsy==="yes"?"Y":"N"} &nbsp; <span style={{color:C.muted}}>CLO:</span> {hpResult==="done"?"Y":"N"}</div>
              <div><span style={{color:C.muted}}>介入:</span> {[...new Set(sorted.flatMap(e=>(e.procedures||[]).map(p=>PROC_MAP[p]).filter(Boolean)))].join(", ")||"—"}</div>
            </div>
            {notionError&&<div style={{fontSize:12,color:C.red,marginBottom:10}}>{notionError}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowNotionModal(false);setNotionStatus("");setNotionError("");}} disabled={notionStatus==="saving"} style={{flex:1,padding:10,borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
              <button onClick={saveToNotion} disabled={notionStatus==="saving"} style={{flex:1,padding:10,borderRadius:6,border:"none",background:notionStatus==="success"?C.green:C.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{notionStatus==="saving"?"Saving...":notionStatus==="success"?"✓ Saved!":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
