import { useState, useMemo, useRef, useEffect } from "react";

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
    {id:"erythematous_gastritis",label:"Erythematous gastritis (E-)",diagText:"Erythematous gastritis",finding:",\nHyperemic mucosa is noted over the gastric body and antrum.",procedures:["clo"],appendToMucusLake:true},
    {id:"erythematous_gastritis_e",label:"Erythematous gastritis (E+)",diagText:"Erythematous gastritis with erosions",finding:",\nHyperemic mucosa with erosions is noted over the gastric body and antrum.",procedures:["clo"],appendToMucusLake:true},
    {id:"gu",label:"Gastric ulcer",isGU:true,
      diagTextFn:(p)=>{const n=p.ulcerNum==="multiple"?"Multiple gastric":"Gastric";const d=mkD(p);const dd=d?` ${d}`:"";const loc=mkLoc(p,"antrum");return `${n}${dd} ulcer${p.ulcerNum==="multiple"?"s":""}, ${loc}, Forrest ${p.forrest||"III"}`;},
      findingFn:(p,idx)=>{const loc=mkLoc(p,"antrum");const d=mkD(p);const f=p.forrest||"III";const n=p.ulcerNum==="multiple";if(n)return `Multiple ${d?d+" ":""}ulcers were noticed at ${loc}.`;const fn=FORREST_FINDING[f];return fn?fn(d?d+" ":"",loc,idx||0):`An ulcer was noticed at ${loc}.`;},
      procedures:ALL_ULCER_PROCS,hasLocMap:"stomach",hasForrest:true,forrestDefault:"III",locDefault:"antrum beside pylorus",allowMultiple:true},
    {id:"hemorrhagic_gastritis",label:"Hemorrhagic gastritis",diagText:"Hemorrhagic gastritis",finding:"\nMarked prominence of the areae gastricae, with areas of erythema and subepithelial hemorrhage.",procedures:["biopsy_a"]},
    {id:"atrophic_gastritis",label:"Atrophic gastritis",hasKimuraParam:true,
      diagTextFn:(p)=>`Atrophic gastritis, Kimura-Takemoto ${p.kimura||"C-1"}`,
      findingFn:(p)=>{const desc=KIMURA_FINDINGS[p.kimura||"C-1"];return "\n"+desc;},
      procedures:["clo","biopsy_a"]},
    {id:"antral_swelling",label:"Antral mucosal swelling",diagText:"Antral mucosal swelling with focal hyperplastic change",finding:"\nAntral mucosal swelling with focal hyperplastic change was noticed.",procedures:["biopsy_a"]},
    {id:"gv_gov1",label:"GV, GOV1",diagText:"Gastric varices, GOV1, RCS(−)",finding:"\nmultiple gastric varices were noticed at LC side of cardia.",procedures:["histoacryl"]},
    {id:"gv_gov2",label:"GV, GOV2",diagText:"Gastric varices, GOV2",finding:"\ngastric varices (GOV2) were noticed at fundus.",procedures:["histoacryl"]},
    {id:"no_gv",label:"No GV",diagText:"No gastric varices",finding:"\nno gastric varices were observed."},
    {id:"phg",label:"PHG",diagText:"c/w portal hypertensive gastropathy",finding:"\nSnake-skin mucosal pattern in the gastric body and fundus, with red spots but without active bleeding."},
    {id:"im",label:"Intestinal metaplasia",diagText:"Suspected intestinal metaplasia, {loc}",finding:"\nPatchy whitish, slightly elevated, and granular areas were observed. Light blue crest sign(+) was noticed under NBI.",hasLocParam:true,locOptions:["incisura angularis to middle body","antrum","angularis","lower body","antrum and angularis"],locDefault:"incisura angularis to middle body",procedures:["biopsy_a","biopsy_b"]},
    {id:"st_polyp",label:"Gastric polyp",diagText:"Gastric polyp, {loc}",finding:"\nA polyp was noticed at {loc}.",hasLocParam:true,locOptions:["fundus","upper body","middle body","lower body","antrum"],locDefault:"fundus",procedures:["biopsy_a","polypectomy","emr"],allowMultiple:true},
    {id:"st_thick_folds",label:"Thickened folds",diagText:"Thickened gastric folds with poor distensibility, {loc}",finding:"\nAsymmetrical thickened gastric folds with poor distensibility was noticed at {loc}.",hasLocParam:true,locOptions:["LC side of cardia to upper body","upper body","middle body","body"],locDefault:"LC side of cardia to upper body",procedures:["biopsy_a","biopsy_b"]},
    {id:"st_smt",label:"SMT",diagText:"Gastric submucosal tumor, {loc}",finding:"\nA submucosal tumor was noticed at {loc}.",hasLocParam:true,locOptions:["fundus","upper body","middle body","lower body","antrum","cardia"],locDefault:"upper body",procedures:["biopsy_a"]},
    {id:"st_angio",label:"Angiodysplasia",
      diagTextFn:(p)=>{const loc=p.loc||"antrum";const pl=p.polyNum==="multiple";return `Gastric angiodysplasi${pl?"as":"a"}, ${loc}`;},
      findingFn:(p)=>{const loc=p.loc||"antrum";const pl=p.polyNum==="multiple";return pl?`\nMultiple angiodysplasias were noticed at ${loc}.`:`\nAn angiodysplasia was noticed at ${loc}.`;},
      hasLocParam:true,locOptions:["fundus","upper body","middle body","lower body","antrum","cardia"],locDefault:"antrum",hasPolyNum:true,procedures:["hemoclip","apc"],allowMultiple:true},
    {id:"pyloric_deformity",label:"Pyloric deformity",diagText:"Pyloric deformity",finding:"\nThe pylorus appears deformed/tortuous."},
  ]},
  duodenum:{label:"Duodenum",items:[
    {id:"du",label:"Duodenal ulcer",isDU:true,
      diagTextFn:(p)=>{const n=p.ulcerNum==="multiple"?"Multiple duodenal":"Duodenal";const d=mkD(p);const dd=d?` ${d}`:"";const loc=mkLoc(p,"AW of bulb");return `${n}${dd} ulcer${p.ulcerNum==="multiple"?"s":""}, ${loc}, Forrest ${p.forrest||"III"}`;},
      findingFn:(p,idx)=>{const loc=mkLoc(p,"AW of bulb");const d=mkD(p);const f=p.forrest||"III";const n=p.ulcerNum==="multiple";if(n)return `multiple ${d?d+" ":""}ulcers were noticed at ${loc}.`;const fn=FORREST_FINDING_LC[f];return fn?fn(d?d+" ":"",loc,idx||0):`an ulcer was noticed at ${loc}.`;},
      procedures:ALL_ULCER_PROCS,hasLocMap:"duodenum",hasForrest:true,forrestDefault:"III",locDefault:"AW of bulb",allowMultiple:true},
    {id:"duo_erosion",label:"Duodenal erosion",
      diagTextFn:(p)=>`Duodenal erosion${p.loc&&p.loc!=="bulb"?", "+p.loc:"s, bulb"}`,
      findingFn:(p)=>`some small erosions are observed over ${p.loc||"bulb"}.`,
      hasLocParam:true,locOptions:["bulb","SDA","2nd portion","bulb and 2nd portion"],locDefault:"bulb",allowMultiple:true},
    {id:"du_stricture",label:"Duo stricture",diagText:"Duodenal stricture, {loc}",finding:"Prominent luminal stricture was noticed at {loc}, with erosive mucosal pattern noticed meanwhile.",hasLocParam:true,locOptions:["bulb","SDA","2nd portion","end of 2nd to 3rd portion","3rd portion"],locDefault:"2nd portion",procedures:["biopsy_a","biopsy_b"]},
    {id:"du_angio",label:"Angiodysplasia",
      diagTextFn:(p)=>{const loc=p.loc||"2nd portion";const pl=p.polyNum==="multiple";return `Duodenal angiodysplasi${pl?"as":"a"}, ${loc}`;},
      findingFn:(p)=>{const loc=p.loc||"2nd portion";const pl=p.polyNum==="multiple";return pl?`Multiple angiodysplasias were noticed at ${loc}.`:`An angiodysplasia was noticed at ${loc}.`;},
      hasLocParam:true,locOptions:["bulb","SDA","2nd portion","3rd portion"],locDefault:"2nd portion",hasPolyNum:true,procedures:["hemoclip","apc"],allowMultiple:true},
    {id:"du_deform",label:"Deformed bulb",diagText:"Deformed duodenal bulb",finding:"Deformed duodenal bulb was noticed."},
    {id:"du_polyp",label:"Duo polyp",
      diagTextFn:(p)=>{const loc=p.loc||"bulb";const pl=p.polyNum==="multiple";return `Duodenal polyp${pl?"s":""}, ${loc}`;},
      findingFn:(p)=>{const loc=p.loc||"bulb";const pl=p.polyNum==="multiple";return pl?`Multiple polyps were noticed at ${loc}.`:`A polyp was noticed at ${loc}.`;},
      hasLocParam:true,locOptions:["bulb","SDA","2nd portion"],locDefault:"bulb",hasPolyNum:true,procedures:["biopsy_a","polypectomy"],allowMultiple:true},
    {id:"du_polypoid",label:"Duo polypoid lesion",
      diagTextFn:(p)=>{const loc=p.loc||"bulb";const pl=p.polyNum==="multiple";return `Duodenal polypoid lesion${pl?"s":""}, ${loc}`;},
      findingFn:(p)=>{const loc=p.loc||"bulb";const pl=p.polyNum==="multiple";return pl?`Multiple polypoid lesions were noticed at ${loc}.`:`A polypoid lesion was noticed at ${loc}.`;},
      hasLocParam:true,locOptions:["bulb","SDA","2nd portion"],locDefault:"bulb",hasPolyNum:true,procedures:["biopsy_a","polypectomy"],allowMultiple:true},
  ]},
  other:{label:"Other / Special",items:[
    {id:"incomplete",label:"Incomplete study",diagText:"Incomplete study *",finding:"",pinTop:true},
    {id:"nj_insertion",label:"s/p NJ insertion",hasTubeTip:true,
      diagTextFn:(p)=>{const tip=p.tubeTipCm?`, tip fixed at ${p.tubeTipCm}cm`:"";return `s/p NJ insertion, tip placed at proximal jejunum${tip}`;},
      findingFn:()=>"",procedures:["nj"]},
    {id:"ng_insertion",label:"s/p NG insertion",hasTubeTip:true,
      diagTextFn:(p)=>{const tip=p.tubeTipCm?`, tip fixed at ${p.tubeTipCm}cm`:"";return `s/p NG tube insertion${tip}`;},
      findingFn:()=>""},
    {id:"nd_insertion",label:"s/p ND insertion",hasTubeTip:true,
      diagTextFn:(p)=>{const tip=p.tubeTipCm?`, tip fixed at ${p.tubeTipCm}cm`:"";return `s/p ND tube insertion${tip}`;},
      findingFn:()=>""},
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
const KIMURA_GRADES=["C-1","C-2","C-3","O-1","O-2","O-3"];
const KIMURA_FINDINGS={
  "C-1":"Pale mucosa with visible submucosal vessels in the antrum; atrophic border confined to the antrum.",
  "C-2":"Pale mucosa with visible submucosal vessels in the antrum; atrophic border reaching the incisura angularis.",
  "C-3":"Pale mucosa with visible submucosal vessels; atrophic border extending to the lesser curvature of the lower corpus.",
  "O-1":"Pale mucosa with visible submucosal vessels; atrophic border along the lesser curvature of the mid-corpus.",
  "O-2":"Pale mucosa with visible submucosal vessels; atrophic border involving both curvatures of the corpus.",
  "O-3":"Diffuse pale mucosa with visible submucosal vessels; atrophic border extending throughout the corpus and fundus.",
};
const FORREST=["Ia","Ib","IIa","IIb","IIc","III"];
const HILL_GRADES=["I","II","III","IV"];
const KODSI_GRADES=["I","II","III","IV"];
const EV_F=["F1","F2","F3","F0-1","F1-2","F2-3"];
const EV_COLOR=["Cb","Cw"];
const EV_LOC=["Li","Lm","Ls","Lm-i","Ls-m","Ls-i"];
const EV_RCS=["+","−"];
const EVL_TYPE=["prophylactic","therapeutic"];

const INDICATIONS=["tarry stool","hematemesis","melena","hematochezia","suspect UGIB","epigastric pain","dysphagia","anemia workup","coffee-ground vomitus","variceal surveillance","screening EGD","follow-up EGD","health examination","suspected GERD/PUD","foreign body ingestion","weight loss","abnormal imaging finding","PEG tube dislodgement","for ND insertion"];
const PREMED="1. Gascon: 10 cc po 2. Hyoscine: 20 mg iv, 3. Xylocaine spray: 0.5 cc oral\nInformed Consent obtained.";
const PREMED_HC="1. Gascon: 10 cc po  2. Hyoscine: 20 mg iv\nInformed Consent obtained.";
const SUGGESTIONS=[
  {id:"sug_no_bleeder",label:"No active bleeders",text:"No definite bleeding source identified in this study"},
  {id:"sug_oral_ppi",label:"Oral PPI",text:"Oral PPI"},
  {id:"sug_oral_ppi_sucra",label:"Oral PPI + Sucralfate",text:"Oral PPI with self-paid sucralfate"},
  {id:"sug_iv_ppi",label:"IV PPI",text:"IV PPI"},
  {id:"sug_iv_ppi_high",label:"High-dose IV PPI",text:"High-dose IV PPI"},
  {id:"sug_npo",label:"NPO",text:"NPO with IV fluid support for {npoDays}",hasNpoDays:true},
  {id:"sug_terli",label:"Terlipressin",text:"Terlipressin 1mg Q4-6H IV with prophylactic antibiotics for 2-5 days"},
  {id:"sug_nsbb",label:"NSBB",text:"Start NSBB after hemodynamic stabilization for secondary prophylaxis"},
  {id:"sug_bt",label:"Restrictive BT",text:"Restrictive blood transfusion to maintain Hb 7-8 g/dL; correct coagulopathy as indicated"},
  {id:"sug_delay_egd",label:"Delay EGD",text:"Repeat EGD after 7 days if possible (avoid early repeat EGD due to the risk of rubber band dislodgment)"},
  {id:"sug_colo",label:"Colonoscopy",text:"Arrange colonoscopy"},
  {id:"sug_repeat",label:"Repeat EGD",text:"Repeat EGD if rebleeding"},
  {id:"sug_evl_post",label:"Post-EVL care",text:"NPO with IV fluid support, avoid NG use for 48-72 hours post-EVL"},
  {id:"sug_hp",label:"HP eradication",text:"HP eradication therapy if rapid urease test (+) or histologically confirmed"},
  {id:"sug_ifobt",label:"iFOBT",text:"Check iFOBT"},
  {id:"sug_anemia_wkup",label:"Anemia workup",text:"Check reticulocyte count, TIBC, ferritin, iron level for anemia d/d"},
  {id:"sug_candida_tx",label:"Candidiasis Tx",text:"If esophageal candidiasis is histologically confirmed, consider oral fluconazole for 14-21 days"},
  {id:"sug_tae",label:"TAE",text:"Arrange TAE if rebleeding",hasTaeRef:true},
  {id:"sug_biopsy",label:"Biopsy-related",text:"Biopsy taken; await pathology report"},
];
const NPO_DAY_OPTIONS=["1 day","2 days","3 days","4 days","5 days","1-2 days","2-3 days","3-5 days"];
const TAE_DATA=[
  {loc:"Post. duodenal bulb",artery:"GDA",rating:"Excellent",color:"#4caf50",pearl:"Classic TAE indication"},
  {loc:"Sup. duodenal angle",artery:"GDA branches",rating:"Good",color:"#2e7d32",pearl:"Near PDA arcade"},
  {loc:"Lesser curvature",artery:"Left gastric a.",rating:"Good",color:"#2e7d32",pearl:"Easy celiac access"},
  {loc:"Pylorus",artery:"R. gastric / GDA",rating:"Good-Mod",color:"#1565c0",pearl:"May need sandwich"},
  {loc:"Fundus",artery:"Short gastric",rating:"Moderate",color:"#f57c00",pearl:"Splenic ischemia risk"},
  {loc:"Greater curvature",artery:"Gastroepiploic",rating:"Moderate",color:"#f57c00",pearl:"Dual arterial supply"},
  {loc:"Antrum",artery:"R. gastric a.",rating:"Fair",color:"#e64a19",pearl:"Small branch vessels"},
  {loc:"Ant. duodenal bulb",artery:"Small branches",rating:"Poor",color:"#616161",pearl:"Perforation > bleeding"},
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
// KIMURA-TAKEMOTO DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════
const KIMURA_BORDER_PATHS={
  "C-1":{border:"M 120,220 Q 105,225 75,222 Q 55,218 50,210",label:"Antrum only",labelPos:[62,235]},
  "C-2":{border:"M 120,220 Q 105,225 75,222 Q 50,215 50,200 Q 52,193 58,190",label:"→ Incisura angularis",labelPos:[45,185]},
  "C-3":{border:"M 120,220 Q 105,225 75,222 Q 50,215 50,200 Q 50,185 55,170 Q 60,160 65,155",label:"→ LC lower corpus",labelPos:[40,150]},
  "O-1":{border:"M 120,220 Q 105,225 75,222 Q 50,215 50,200 Q 50,175 55,155 Q 62,135 70,120",label:"→ LC mid-corpus",labelPos:[42,115]},
  "O-2":{border:"M 120,220 Q 105,225 75,222 Q 50,215 50,200 Q 50,175 55,155 Q 62,135 70,120 Q 78,105 85,95 Q 90,88 88,80 Q 82,75 70,78 Q 55,85 42,100 Q 30,120 28,140",label:"→ Both curvatures",labelPos:[18,145]},
  "O-3":{border:"M 120,220 Q 105,225 75,222 Q 50,215 50,200 Q 50,175 55,155 Q 62,135 70,120 Q 78,105 85,95 Q 90,85 85,70 Q 75,55 60,50 Q 45,48 35,58 Q 25,70 22,90 Q 20,110 25,135",label:"→ Corpus + fundus",labelPos:[12,90]},
};
function KimuraMap({selected,onSelect}){
  const[hover,setHover]=useState(null);
  const cur=KIMURA_BORDER_PATHS[selected]||KIMURA_BORDER_PATHS["C-1"];
  return(<div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
    <svg viewBox="5 20 160 230" width="180" height="260" style={{flexShrink:0}}>
      {/* Stomach outline */}
      <path d="M 70,35 Q 40,35 30,65 Q 20,95 25,135 Q 28,165 40,190 Q 50,210 55,220 Q 65,230 85,230 Q 105,228 115,222 Q 125,216 135,208 Q 145,198 148,190 L 150,185 Q 148,180 140,178 L 135,180 Q 128,188 120,195 Q 110,202 100,200 Q 92,196 88,190 L 85,180 Q 82,165 80,150 Q 78,130 80,110 Q 82,90 88,75 Q 92,65 95,58 Q 90,40 80,35 Z" fill="rgba(255,255,255,0.03)" stroke="#475569" strokeWidth="1.5" />
      {/* Pylorus marker */}
      <line x1="148" y1="190" x2="158" y2="185" stroke="#334155" strokeWidth="1" strokeDasharray="3,2"/>
      <text x="155" y="182" fontSize="6" fill="#475569" fontFamily="inherit">Pylorus</text>
      {/* Esophagus marker */}
      <line x1="75" y1="20" x2="75" y2="35" stroke="#334155" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="75" y="18" textAnchor="middle" fontSize="6" fill="#475569" fontFamily="inherit">Eso</text>
      {/* LC / GC labels */}
      <text x="92" y="120" fontSize="7" fill="#475569" fontFamily="inherit" fontWeight="600">LC</text>
      <text x="22" y="120" fontSize="7" fill="#475569" fontFamily="inherit" fontWeight="600">GC</text>
      {/* Incisura angularis */}
      <circle cx="88" cy="190" r="2" fill="#f59e0b" opacity="0.6"/>
      <text x="96" y="193" fontSize="6" fill="#f59e0b" fontFamily="inherit">IA</text>
      {/* Atrophic border line */}
      <path d={cur.border} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5,3" opacity="0.85"/>
      {/* Atrophied area - shade below/around the border */}
      {/* Label for current classification */}
      <text x={cur.labelPos[0]} y={cur.labelPos[1]} fontSize="7" fill="#ef4444" fontFamily="inherit" fontWeight="600">{cur.label}</text>
      {/* Hover preview border */}
      {hover&&hover!==selected&&KIMURA_BORDER_PATHS[hover]&&(
        <path d={KIMURA_BORDER_PATHS[hover].border} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5"/>
      )}
    </svg>
    <div style={{display:"flex",flexDirection:"column",gap:4,paddingTop:4}}>
      <div style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Kimura-Takemoto</div>
      <div style={{fontSize:8,color:C.muted,marginBottom:4}}>Closed type (C)</div>
      {["C-1","C-2","C-3"].map(k=>(<button key={k} onClick={()=>onSelect(k)} onMouseEnter={()=>setHover(k)} onMouseLeave={()=>setHover(null)} style={{...mkTag(selected===k),fontSize:11,padding:"4px 10px"}}>{k}</button>))}
      <div style={{fontSize:8,color:C.muted,marginTop:6,marginBottom:4}}>Open type (O)</div>
      {["O-1","O-2","O-3"].map(k=>(<button key={k} onClick={()=>onSelect(k)} onMouseEnter={()=>setHover(k)} onMouseLeave={()=>setHover(null)} style={{...mkTag(selected===k),fontSize:11,padding:"4px 10px"}}>{k}</button>))}
      <div style={{marginTop:8,padding:"6px 8px",background:"rgba(0,0,0,0.3)",borderRadius:4,fontSize:9,color:C.dim,lineHeight:1.5,maxWidth:140}}>
        <span style={{color:"#ef4444"}}>- - -</span> Atrophic border<br/>
        <span style={{color:"#f59e0b"}}>●</span> Incisura angularis
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// TAE SUITABILITY DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════
function TaeDiagram(){
  const[hover,setHover]=useState(null);
  const locs=[
    {id:"fundus",label:"Fundus",artery:"Short gastric",rating:"Mod",color:"#f57c00",cx:95,cy:65},
    {id:"cardia",label:"Cardia",artery:"LGA",rating:"",color:"#475569",cx:145,cy:55},
    {id:"lc_body",label:"Lesser curv.",artery:"LGA",rating:"Good",color:"#2e7d32",cx:175,cy:130},
    {id:"gc_body",label:"Greater curv.",artery:"GEA",rating:"Mod",color:"#f57c00",cx:45,cy:165},
    {id:"antrum",label:"Antrum",artery:"R. gastric",rating:"Fair",color:"#e64a19",cx:130,cy:230},
    {id:"pylorus",label:"Pylorus",artery:"R.gast/GDA",rating:"G-M",color:"#1565c0",cx:210,cy:210},
    {id:"ant_bulb",label:"Ant. bulb",artery:"Small br.",rating:"Poor",color:"#616161",cx:260,cy:190},
    {id:"post_bulb",label:"Post. bulb",artery:"GDA",rating:"Excl",color:"#4caf50",cx:265,cy:215},
    {id:"sda",label:"SDA",artery:"GDA br.",rating:"Good",color:"#2e7d32",cx:275,cy:235},
  ];
  return(
    <svg viewBox="0 0 380 320" width="100%" style={{maxWidth:460,display:"block",margin:"0 auto"}}>
      {/* Stomach outline */}
      <path d="M 140,40 Q 70,35 55,80 Q 40,130 50,180 Q 55,210 75,240 Q 95,265 115,275 Q 135,282 160,278 Q 185,274 200,260 Q 210,250 218,235 Q 225,220 230,210" fill="rgba(255,200,150,0.08)" stroke="#6b7280" strokeWidth="1.5"/>
      {/* Stomach upper curve (cardia to pylorus via LC) */}
      <path d="M 140,40 Q 155,30 170,38 Q 185,48 190,65 Q 195,90 195,115 Q 195,145 200,175 Q 205,200 215,220 Q 220,228 230,210" fill="none" stroke="#6b7280" strokeWidth="1.5"/>
      {/* Duodenum bulb */}
      <path d="M 230,210 Q 240,195 255,192 Q 275,190 282,200 Q 290,212 285,230 Q 280,248 265,255 Q 250,258 240,250" fill="rgba(255,200,150,0.05)" stroke="#6b7280" strokeWidth="1.2"/>
      {/* D2 */}
      <path d="M 265,255 Q 275,265 280,280 Q 282,295 275,305" fill="none" stroke="#6b7280" strokeWidth="1.2"/>
      <text x="280" y="310" fontSize="8" fill="#6b7280" fontFamily="inherit">D2</text>
      <text x="255" y="185" fontSize="7" fill="#6b7280" fontFamily="inherit">D1 (bulb)</text>

      {/* Arterial lines */}
      {/* Celiac trunk */}
      <path d="M 200,300 Q 200,280 200,260" fill="none" stroke="#7f1d1d" strokeWidth="1.8" opacity="0.5"/>
      <text x="188" y="308" fontSize="7" fill="#7f1d1d" fontFamily="inherit" fontWeight="600">Celiac trunk</text>
      {/* LGA - left gastric artery along LC */}
      <path d="M 200,260 Q 195,230 190,200 Q 185,170 185,140 Q 185,110 180,90" fill="none" stroke="#991b1b" strokeWidth="1.2" opacity="0.4" strokeDasharray="4,2"/>
      <text x="178" y="115" fontSize="6.5" fill="#991b1b" fontFamily="inherit" opacity="0.7">LGA</text>
      {/* R. gastric */}
      <path d="M 200,260 Q 210,250 220,240 Q 225,235 230,225" fill="none" stroke="#991b1b" strokeWidth="1" opacity="0.4" strokeDasharray="4,2"/>
      <text x="215" y="258" fontSize="6.5" fill="#991b1b" fontFamily="inherit" opacity="0.7">R. gastric</text>
      {/* GDA */}
      <path d="M 240,250 Q 255,260 270,245 Q 280,235 275,220 Q 270,205 260,200" fill="none" stroke="#991b1b" strokeWidth="1.3" opacity="0.5" strokeDasharray="4,2"/>
      <text x="278" y="250" fontSize="6.5" fill="#991b1b" fontFamily="inherit" fontWeight="600" opacity="0.7">GDA</text>
      {/* Gastroepiploic along GC */}
      <path d="M 240,250 Q 180,280 120,270 Q 80,260 60,230 Q 45,200 42,170" fill="none" stroke="#991b1b" strokeWidth="1" opacity="0.35" strokeDasharray="3,3"/>
      <text x="85" y="280" fontSize="6.5" fill="#991b1b" fontFamily="inherit" opacity="0.6">Gastroepiploic</text>
      {/* Short gastric */}
      <path d="M 60,230 Q 50,180 55,130 Q 58,100 70,75" fill="none" stroke="#991b1b" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3"/>
      <text x="35" y="105" fontSize="6.5" fill="#991b1b" fontFamily="inherit" opacity="0.5">Short gastric</text>
      {/* Splenic a. */}
      <path d="M 60,230 Q 40,260 20,280" fill="none" stroke="#991b1b" strokeWidth="1" opacity="0.3"/>
      <text x="5" y="290" fontSize="6.5" fill="#991b1b" fontFamily="inherit" opacity="0.5">Splenic a.</text>

      {/* Region labels on stomach */}
      <text x="90" y="90" fontSize="8" fill="#6b7280" fontFamily="inherit" fontStyle="italic">Fundus</text>
      <text x="120" y="155" fontSize="8" fill="#6b7280" fontFamily="inherit" fontStyle="italic">Body</text>
      <text x="130" y="245" fontSize="8" fill="#6b7280" fontFamily="inherit" fontStyle="italic">Antrum</text>

      {/* Location markers */}
      {locs.map(l=>{
        const isH=hover===l.id;
        return(<g key={l.id} onMouseEnter={()=>setHover(l.id)} onMouseLeave={()=>setHover(null)} style={{cursor:"default"}}>
          <circle cx={l.cx} cy={l.cy} r={isH?8:6} fill={l.color} opacity={isH?0.9:0.65} stroke={isH?"#fff":"none"} strokeWidth={1.5} style={{transition:"all 0.15s"}}/>
          <circle cx={l.cx} cy={l.cy} r={3} fill="none" stroke="#fff" strokeWidth={1} opacity={0.7}/>
        </g>);
      })}

      {/* Callout labels */}
      {/* Fundus - left side */}
      <rect x="2" y="42" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#f57c00" strokeWidth="0.8"/>
      <text x="8" y="53" fontSize="7.5" fill="#f57c00" fontFamily="inherit" fontWeight="600">Fundus</text>
      <text x="8" y="62" fontSize="6" fill="#94a3b8" fontFamily="inherit">Short gastric — Mod</text>
      <line x1="74" y1="54" x2={95} y2={65} stroke="#f57c00" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* GC - left side */}
      <rect x="2" y="150" width="78" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#f57c00" strokeWidth="0.8"/>
      <text x="8" y="161" fontSize="7.5" fill="#f57c00" fontFamily="inherit" fontWeight="600">Greater curv.</text>
      <text x="8" y="170" fontSize="6" fill="#94a3b8" fontFamily="inherit">GEA — Moderate</text>

      {/* Antrum - left side */}
      <rect x="2" y="222" width="78" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#e64a19" strokeWidth="0.8"/>
      <text x="8" y="233" fontSize="7.5" fill="#e64a19" fontFamily="inherit" fontWeight="600">Antrum</text>
      <text x="8" y="242" fontSize="6" fill="#94a3b8" fontFamily="inherit">R. gastric — Fair</text>
      <line x1="80" y1="234" x2={130} y2={230} stroke="#e64a19" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* LC - right side */}
      <rect x="305" y="110" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#2e7d32" strokeWidth="0.8"/>
      <text x="311" y="121" fontSize="7.5" fill="#2e7d32" fontFamily="inherit" fontWeight="600">Lesser curv.</text>
      <text x="311" y="130" fontSize="6" fill="#94a3b8" fontFamily="inherit">LGA — Good</text>
      <line x1="305" y1="122" x2={175} y2={130} stroke="#2e7d32" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* Post bulb - right side */}
      <rect x="305" y="140" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#4caf50" strokeWidth="0.8"/>
      <text x="311" y="151" fontSize="7.5" fill="#4caf50" fontFamily="inherit" fontWeight="600">Post. bulb</text>
      <text x="311" y="160" fontSize="6" fill="#94a3b8" fontFamily="inherit">GDA — Excellent</text>
      <line x1="305" y1="152" x2={265} y2={215} stroke="#4caf50" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* SDA - right side */}
      <rect x="305" y="170" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#2e7d32" strokeWidth="0.8"/>
      <text x="311" y="181" fontSize="7.5" fill="#2e7d32" fontFamily="inherit" fontWeight="600">Sup. duod. angle</text>
      <text x="311" y="190" fontSize="6" fill="#94a3b8" fontFamily="inherit">GDA br. — Good</text>
      <line x1="305" y1="182" x2={275} y2={235} stroke="#2e7d32" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* Ant bulb - right side */}
      <rect x="305" y="200" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#616161" strokeWidth="0.8"/>
      <text x="311" y="211" fontSize="7.5" fill="#9e9e9e" fontFamily="inherit">Ant. bulb</text>
      <text x="311" y="220" fontSize="6" fill="#94a3b8" fontFamily="inherit">Small br. — Poor</text>
      <line x1="305" y1="212" x2={260} y2={190} stroke="#616161" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* Pylorus - right side */}
      <rect x="305" y="230" width="72" height="24" rx="3" fill="rgba(0,0,0,0.5)" stroke="#1565c0" strokeWidth="0.8"/>
      <text x="311" y="241" fontSize="7.5" fill="#42a5f5" fontFamily="inherit" fontWeight="600">Pylorus</text>
      <text x="311" y="250" fontSize="6" fill="#94a3b8" fontFamily="inherit">R.gast/GDA — G-M</text>
      <line x1="305" y1="242" x2={210} y2={210} stroke="#1565c0" strokeWidth="0.5" opacity="0.5" strokeDasharray="2,2"/>

      {/* Legend */}
      {[{c:"#4caf50",t:"Excellent"},{c:"#2e7d32",t:"Good"},{c:"#1565c0",t:"Good-Mod"},{c:"#f57c00",t:"Moderate"},{c:"#e64a19",t:"Fair"},{c:"#616161",t:"Poor"}].map((l,i)=>(
        <g key={l.t}><circle cx={30+i*60} cy={6} r={4} fill={l.c} opacity={0.7}/><text x={37+i*60} y={9} fontSize="7" fill="#94a3b8" fontFamily="inherit">{l.t}</text></g>
      ))}

      {/* Hover tooltip */}
      {hover&&(()=>{const l=locs.find(x=>x.id===hover);if(!l)return null;return(
        <g>
          <rect x={l.cx-40} y={l.cy-28} width={80} height={18} rx={3} fill="rgba(0,0,0,0.85)" stroke={l.color} strokeWidth={1}/>
          <text x={l.cx} y={l.cy-16} textAnchor="middle" fontSize="7.5" fill="#e2e8f0" fontFamily="inherit" fontWeight="600">{l.label} — {l.artery}</text>
        </g>);})()}
    </svg>
  );
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
        {item.hasPolyNum&&<select value={p.polyNum||"single"} onChange={e=>up("polyNum",e.target.value)} style={selectSt}><option value="single">Single</option><option value="multiple">Multiple</option></select>}
        {item.hasTubeTip&&(<><span style={{fontSize:11,color:C.dim}}>tip fixed at</span><input type="text" value={p.tubeTipCm||""} onChange={e=>up("tubeTipCm",e.target.value)} placeholder="—" style={{...inputSt,width:50,padding:"3px 6px",fontSize:11}}/><span style={{fontSize:11,color:C.dim}}>cm</span></>)}
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
        {item.hasKimuraParam&&(<>
          <select value={p.kimura||"C-1"} onChange={e=>up("kimura",e.target.value)} style={selectSt}>{KIMURA_GRADES.map(k=><option key={k} value={k}>{k}</option>)}</select>
          <button onClick={()=>setShowMap(!showMap)} style={{...mkTag(showMap,"amber"),fontSize:10,padding:"3px 8px"}}>{showMap?"▲ Hide diagram":"▼ Kimura diagram"}</button>
        </>)}
      </div>
      {item.hasKimuraParam&&showMap&&(
        <div style={{marginTop:8,paddingLeft:22,padding:"10px",background:"rgba(0,0,0,0.2)",borderRadius:6}}>
          <KimuraMap selected={p.kimura||"C-1"} onSelect={k=>up("kimura",k)}/>
          <div style={{marginTop:8,padding:"6px 8px",background:"rgba(0,0,0,0.2)",borderRadius:4,fontSize:10,color:C.dim,lineHeight:1.6}}>
            {KIMURA_FINDINGS[p.kimura||"C-1"]}
          </div>
        </div>
      )}
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
  const[suggestions,setSuggestions]=useState([]);const[sugCustom,setSugCustom]=useState("");const[npoDays,setNpoDays]=useState("2-3 days");const[showTaeRef,setShowTaeRef]=useState(false);
  const[biopsy,setBiopsy]=useState("no");const[polyp,setPolyp]=useState("no");
  const[emrDone,setEmrDone]=useState("no");const[complication,setComplication]=useState("nil");
  const[copied,setCopied]=useState(false);
  const[reportEdited,setReportEdited]=useState("");const[isEdited,setIsEdited]=useState(false);
  const[panelWidth,setPanelWidth]=useState(420);const isDraggingRef=useRef(false);
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
    L.push(`Indication: ${ind}`);L.push("Premedication:");L.push(isHC?PREMED_HC:PREMED);
    L.push("");L.push("Endoscope number:");L.push("Finding:");
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
    let eT=smartJoin(eF);if(esoExtra)eT+=(eT?"\n":"")+esoExtra;L.push("");L.push("Esophagus:");L.push(eT||"negative.");
    if(stNotExamined){L.push("");L.push("Stomach:");L.push("not examined.");}else{const mm={clean:"Mucus lake is clean.",bile:"Mucus lake is bile-stained.",blood:"Much coffee ground content and hematin retained in fundus.",food:"Food residue is retained in stomach."};const mlText=mm[stMucusLake]||"";const sf=smartJoin(sF);let sT="";if(mlText&&sf){sT=mlText+(sf.startsWith(",")?sf:"\n"+sf);}else if(mlText){sT=mlText;}else if(sf){sT=sf.startsWith(",")?sf.slice(2).trim():sf;}else{sT="negative.";}if(stExtra)sT+="\n"+stExtra;L.push("");L.push("Stomach:");L.push(sT);}
    const dm={neg2:"negative to 2nd portion.",neg3:"negative to 3rd portion.",not_examined:"not examined."};let dT=smartJoin(dF);if(!dT)dT=dm[duoNormal]||"negative to 2nd portion.";if(duoExtra)dT+="\n"+duoExtra;L.push("");L.push("Duodenum:");L.push(dT);
    L.push("");L.push("Diagnosis:");let hd=false;
    sorted.forEach(e=>{if(e.type==="catalog"){L.push(`- ${buildDiagText(e)}`);hd=true;}else if(e.type==="free"&&e.text?.trim()){L.push(`- ${e.text.trim()}`);hd=true;}});
    if(!hd)L.push("- ___");
    const hp=hpResult==="done"?"Rapid Hp urease test ( ): done":"Rapid Hp urease test ( ): nil";
    L.push("");L.push(`Note: ${hp}`);L.push(`Reason for incomplete EGD: ${incomplete}`);L.push("Suggestion of management:");
    const sg=suggestions.map(id=>SUGGESTIONS.find(s=>s.id===id)).filter(Boolean);
    if(sg.length||sugCustom){sg.forEach(s=>{let t=s.text;if(s.hasNpoDays)t=t.replace("{npoDays}",npoDays);L.push(`- ${t}`);});if(sugCustom)sugCustom.split("\n").filter(Boolean).forEach(s=>L.push(`- ${s}`));}else L.push("- ___");
    const b=biopsy==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const po=polyp==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const em=emrDone==="yes"?"(v) yes ( ) no":"( ) yes (v) no";const co=complication==="yes"?"(v) yes ( ) nil":"( ) yes (v) nil";
    L.push("");L.push("Pathological report (after EGD):");L.push(`(1)biopsy with removal: ${b}`);L.push(`(2)polypectomy: ${po}`);L.push(`(3)endoscopic mucosal resection: ${em}`);L.push(`Complication after EGD: ${co}`);
    return L.join("\n");
  },[mode,indication,customInd,sorted,esoExtra,stExtra,stMucusLake,stNotExamined,duoExtra,duoNormal,hpResult,incomplete,suggestions,sugCustom,npoDays,biopsy,polyp,emrDone,complication]);

  useEffect(()=>{if(!isEdited)setReportEdited(report);},[report,isEdited]);
  const finalReport=isEdited?reportEdited:report;
  const copy=()=>{navigator.clipboard.writeText(finalReport).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  const clear=()=>{setIndication("");setCustomInd("");setDiagList([]);setEsoExtra("");setStExtra("");setStMucusLake("");setStNotExamined(false);setDuoExtra("");setDuoNormal("neg2");setHpResult("nil");setIncomplete("nil");setSuggestions([]);setSugCustom("");setBiopsy("no");setPolyp("no");setEmrDone("no");setComplication("nil");setIsEdited(false);setReportEdited("");};

  const[showQuickDx,setShowQuickDx]=useState(false);
  const[showGemini,setShowGemini]=useState(false);const[geminiMode,setGeminiMode]=useState("api");
  const[geminiChat,setGeminiChat]=useState([]);
  const[geminiInput,setGeminiInput]=useState("");
  const[geminiLoading,setGeminiLoading]=useState(false);
  const geminiEndRef=useRef(null);
  const[geminiPos,setGeminiPos]=useState({x:window.innerWidth-70,y:window.innerHeight-70});
  const[geminiWinPos,setGeminiWinPos]=useState(null);
  const geminiDragRef=useRef(false);const geminiWasDragged=useRef(false);const geminiWinDragRef=useRef(false);
  const geminiKey=import.meta.env.VITE_GEMINI_KEY||"";
  const sendGemini=async(userMsg,withReport=false)=>{
    if(!userMsg.trim()&&!withReport)return;
    const content=withReport?`以下是目前的 EGD 報告內容：\n\n${finalReport}\n\n${userMsg||"請檢查這份報告的寫法是否正確，有沒有可以精簡或改進的地方？"}`:userMsg;
    const newChat=[...geminiChat,{role:"user",text:withReport?`📄 [Report attached] ${userMsg||"請檢查報告"}`:userMsg}];
    setGeminiChat(newChat);setGeminiInput("");setGeminiLoading(true);
    try{
      const msgs=newChat.map(m=>({role:m.role==="user"?"user":"model",parts:[{text:m.text}]}));
      // Replace last user message with full content (including report if attached)
      msgs[msgs.length-1]={role:"user",parts:[{text:content}]};
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:msgs,systemInstruction:{parts:[{text:"You are a helpful medical writing assistant specializing in endoscopy (EGD) reports. Reply concisely in the same language the user uses. When reviewing reports, focus on medical accuracy, grammar, and conciseness."}]},generationConfig:{thinkingConfig:{thinkingBudget:0}}})
      });
      const data=await res.json();
      if(data?.error)throw new Error(data.error.message||JSON.stringify(data.error));
      const reply=data?.candidates?.[0]?.content?.parts?.[0]?.text||"(No response: "+JSON.stringify(data).slice(0,200)+")";
      setGeminiChat(c=>[...c,{role:"assistant",text:reply}]);
    }catch(err){
      setGeminiChat(c=>[...c,{role:"assistant",text:`Error: ${err.message}`}]);
    }finally{setGeminiLoading(false);}
  };
  useEffect(()=>{geminiEndRef.current?.scrollIntoView({behavior:"smooth"});},[geminiChat]);
  const QUICK_PRESETS=[
    {name:"正常",apply:()=>{
      clear();setIndication("suspected GERD/PUD");
      const mk=(id,procs=[],params={})=>({_key:nextId.current++,type:"catalog",diagId:id,params:{...defaultParams(),loc:findItem(id)?.locDefault||"",...params},procedures:procs});
      setDiagList([mk("re_a"),mk("erythematous_gastritis",["clo"])]);
      setHpResult("done");setSuggestions(["sug_no_bleeder","sug_oral_ppi"]);
    }},
    {name:"GU未出血",apply:()=>{
      clear();setIndication("tarry stool");
      const mk=(id,procs=[],params={})=>({_key:nextId.current++,type:"catalog",diagId:id,params:{...defaultParams(),loc:findItem(id)?.locDefault||"",...params},procedures:procs});
      setDiagList([mk("re_a"),mk("gu")]);
      setSuggestions(["sug_oral_ppi"]);setBiopsy("yes");
    }},
    {name:"GU/DU出血",apply:()=>{
      clear();setIndication("tarry stool");
      const mk=(id,procs=[],params={})=>({_key:nextId.current++,type:"catalog",diagId:id,params:{...defaultParams(),loc:findItem(id)?.locDefault||"",...params},procedures:procs});
      setDiagList([mk("re_a"),mk("gu"),mk("du")]);
      setSuggestions(["sug_iv_ppi","sug_npo"]);setBiopsy("yes");
    }},
    {name:"EV出血",apply:()=>{
      clear();setIndication("hematemesis");
      const mk=(id,procs=[],params={})=>({_key:nextId.current++,type:"catalog",diagId:id,params:{...defaultParams(),loc:findItem(id)?.locDefault||"",...params},procedures:procs});
      setDiagList([mk("re_a"),mk("ev",[],{evF:"F2",evColor:"Cb",evLoc:"Li",evRcs:"−"}),mk("gv_gov1"),mk("phg")]);
      setSuggestions(["sug_iv_ppi_high","sug_npo","sug_terli","sug_evl_post","sug_bt","sug_nsbb"]);
    }},
    {name:"EV沒出血",apply:()=>{
      clear();setIndication("variceal surveillance");
      const mk=(id,procs=[],params={})=>({_key:nextId.current++,type:"catalog",diagId:id,params:{...defaultParams(),loc:findItem(id)?.locDefault||"",...params},procedures:procs});
      setDiagList([mk("re_a"),mk("ev",[],{evF:"F2",evColor:"Cb",evLoc:"Li",evRcs:"−"}),mk("no_gv"),mk("phg")]);
      setSuggestions(["sug_oral_ppi","sug_nsbb"]);
    }},
  ];

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
        <div><div style={{fontSize:16,fontWeight:700}}>Jacky Huang and his EGD Report Builder <span style={{fontSize:11,color:C.accent,fontWeight:400}}>v6</span></div><div style={{fontSize:11,color:C.muted,marginTop:1}}>Diagnosis-first · Forrest-specific · Complete phrase library</div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{position:"relative",display:"inline-block"}}>
            <button onClick={()=>setShowQuickDx(!showQuickDx)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${showQuickDx?C.accent:C.border}`,background:showQuickDx?C.accentSoft:"transparent",color:showQuickDx?"#93c5fd":C.text,fontSize:12,fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>⚡ 快診</button>
            {showQuickDx&&(<div style={{position:"absolute",top:"100%",left:0,marginTop:6,background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:8,zIndex:100,minWidth:160,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
              {QUICK_PRESETS.map(p=>(<button key={p.name} onClick={()=>{p.apply();setShowQuickDx(false);}} style={{display:"block",width:"100%",padding:"8px 12px",borderRadius:5,border:"none",background:"transparent",color:C.text,fontSize:12,fontFamily:"inherit",cursor:"pointer",textAlign:"left",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=C.accentSoft} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{p.name}</button>))}
            </div>)}
          </div>
          <a href="https://docs.google.com/document/d/1KwEQk5On467snENWp-aE1lyAeSpE-wIsIXS17XKpZfk/edit?usp=sharing" target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontSize:12,fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>📄 模板</a>
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
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px",maxHeight:"calc(100vh - 54px)"}}>
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
            {suggestions.includes("sug_npo")&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,paddingLeft:4}}>
                <span style={{fontSize:11,color:C.dim,fontWeight:600}}>NPO days:</span>
                <select value={npoDays} onChange={e=>setNpoDays(e.target.value)} style={selectSt}>{NPO_DAY_OPTIONS.map(d=><option key={d} value={d}>{d}</option>)}</select>
              </div>
            )}
            {suggestions.includes("sug_tae")&&(
              <div style={{marginBottom:8}}>
                <button onClick={()=>setShowTaeRef(!showTaeRef)} style={{...mkTag(showTaeRef,"amber"),fontSize:10,padding:"3px 8px",marginBottom:6}}>{showTaeRef?"▲ Hide TAE reference":"▼ TAE suitability reference"}</button>
                {showTaeRef&&(
                  <div style={{background:"rgba(0,0,0,0.25)",borderRadius:6,padding:10,overflowX:"auto"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8,textAlign:"center"}}>UGI Ulcer Locations & TAE Suitability</div>
                    <TaeDiagram/>
                    <div style={{marginTop:10}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                        <thead><tr>{["Location","Target artery","TAE","Clinical pearl"].map(h=><th key={h} style={{textAlign:"left",padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.muted,fontWeight:600}}>{h}</th>)}</tr></thead>
                        <tbody>{TAE_DATA.map(r=>(
                          <tr key={r.loc}>
                            <td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.text}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:r.color,marginRight:5,verticalAlign:"middle"}}/>{r.loc}</td>
                            <td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.dim}}>{r.artery}</td>
                            <td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:r.color,fontWeight:600}}>{r.rating}</td>
                            <td style={{padding:"4px 6px",borderBottom:`1px solid ${C.border}`,color:C.dim}}>{r.pearl}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            <textarea style={{...inputSt,resize:"vertical",minHeight:36}} value={sugCustom} onChange={e=>setSugCustom(e.target.value)} placeholder="Additional..."/>
          </Section>
          <Section title="⑥ Pathological Report" defaultOpen={false}>
            {[{l:"Biopsy",v:biopsy,s:setBiopsy},{l:"Polypectomy",v:polyp,s:setPolyp},{l:"EMR",v:emrDone,s:setEmrDone}].map(({l,v,s})=>(<div key={l} style={{marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>{l}</div><div style={{display:"flex",gap:4}}>{["yes","no"].map(x=>(<button key={x} onClick={()=>s(x)} style={mkTag(v===x)}>{x}</button>))}</div></div>))}
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Complication</div>
            <div style={{display:"flex",gap:4}}>{["nil","yes"].map(v=>(<button key={v} onClick={()=>setComplication(v)} style={mkTag(complication===v)}>{v}</button>))}</div>
          </Section>
          <div style={{height:24}}/>
        </div>
        {/* Draggable divider */}
        <div style={{width:6,cursor:"col-resize",background:isDraggingRef.current?C.accent:C.border,transition:isDraggingRef.current?"none":"background 0.2s",flexShrink:0,position:"relative",zIndex:10}}
          onMouseDown={e=>{e.preventDefault();isDraggingRef.current=true;const startX=e.clientX;const startW=panelWidth;
            const onMove=ev=>{const diff=startX-ev.clientX;setPanelWidth(Math.max(280,Math.min(800,startW+diff)));};
            const onUp=()=>{isDraggingRef.current=false;document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
            document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);}}
        ><div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:2,height:32,borderRadius:1,background:C.muted,opacity:0.4}}/></div>
        <div style={{width:panelWidth,minWidth:280,maxWidth:800,overflowY:"auto",padding:"14px 18px",background:C.panelAlt,maxHeight:"calc(100vh - 54px)",flexShrink:0}}>
          <div style={{position:"sticky",top:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:C.accent}}>Preview {isEdited&&<span style={{fontSize:10,color:C.amber,fontWeight:400}}>(edited)</span>}</div>
              {isEdited&&<button onClick={()=>{setIsEdited(false);setReportEdited(report);}} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",color:C.amber,cursor:"pointer",fontFamily:"inherit"}}>↻ Reset</button>}
            </div>
            <textarea value={finalReport} onChange={e=>{setReportEdited(e.target.value);setIsEdited(true);}} style={{width:"100%",minHeight:"calc(100vh - 250px)",background:C.bg,border:`1px solid ${isEdited?C.amber:C.border}`,borderRadius:8,padding:12,marginBottom:10,fontSize:12,lineHeight:1.7,color:C.text,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
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
      {/* Gemini floating bubble */}
      <div style={{position:"fixed",left:geminiPos.x,top:geminiPos.y,zIndex:10000,cursor:geminiDragRef.current?"grabbing":"grab",userSelect:"none",touchAction:"none"}}
        onMouseDown={e=>{e.preventDefault();geminiDragRef.current=true;geminiWasDragged.current=false;const ox=e.clientX-geminiPos.x,oy=e.clientY-geminiPos.y;
          const onMove=ev=>{geminiWasDragged.current=true;setGeminiPos({x:Math.max(0,Math.min(window.innerWidth-56,ev.clientX-ox)),y:Math.max(0,Math.min(window.innerHeight-56,ev.clientY-oy))});};
          const onUp=()=>{geminiDragRef.current=false;document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);if(!geminiWasDragged.current)setShowGemini(g=>!g);};
          document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);}}>
        <div style={{width:52,height:52,borderRadius:26,background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",boxShadow:"0 4px 16px rgba(139,92,246,0.4)",display:"flex",alignItems:"center",justifyContent:"center",transition:"transform 0.15s",transform:showGemini?"scale(0.9)":"scale(1)"}}>
          <span style={{fontSize:20,lineHeight:1}}>✦</span>
        </div>
        {geminiChat.length>0&&!showGemini&&(
          <div style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:9,background:C.red,fontSize:10,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{geminiChat.filter(m=>m.role==="assistant").length}</div>
        )}
      </div>
      {/* Gemini chat window */}
      {showGemini&&(()=>{const wp=geminiWinPos||{x:Math.min(geminiPos.x-320,window.innerWidth-380),y:Math.max(10,geminiPos.y-480)};return(
        <div style={{position:"fixed",left:wp.x,top:wp.y,width:370,height:460,background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,display:"flex",flexDirection:"column",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"rgba(139,92,246,0.05)",cursor:"grab",userSelect:"none"}}
            onMouseDown={e=>{e.preventDefault();geminiWinDragRef.current=true;const cx=wp.x,cy=wp.y,ox=e.clientX,oy=e.clientY;
              const onMove=ev=>{setGeminiWinPos({x:Math.max(0,Math.min(window.innerWidth-380,cx+ev.clientX-ox)),y:Math.max(0,Math.min(window.innerHeight-100,cy+ev.clientY-oy))});};
              const onUp=()=>{geminiWinDragRef.current=false;document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
              document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);}}>
            <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>✦ Gemini</span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{display:"flex",borderRadius:4,overflow:"hidden",border:`1px solid ${C.border}`}}>
                <button onClick={()=>setGeminiMode("api")} style={{padding:"2px 8px",fontSize:9,fontWeight:geminiMode==="api"?700:400,fontFamily:"inherit",background:geminiMode==="api"?"rgba(139,92,246,0.15)":"transparent",color:geminiMode==="api"?"#a78bfa":C.muted,border:"none",borderRight:`1px solid ${C.border}`,cursor:"pointer"}}>API</button>
                <button onClick={()=>setGeminiMode("web")} style={{padding:"2px 8px",fontSize:9,fontWeight:geminiMode==="web"?700:400,fontFamily:"inherit",background:geminiMode==="web"?"rgba(139,92,246,0.15)":"transparent",color:geminiMode==="web"?"#a78bfa":C.muted,border:"none",cursor:"pointer"}}>Web</button>
              </div>
              <button onClick={()=>setGeminiChat([])} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",color:C.dim,cursor:"pointer",fontFamily:"inherit"}}>Clear</button>
              <button onClick={()=>setShowGemini(false)} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16,fontFamily:"inherit",padding:"0 2px"}}>✕</button>
            </div>
          </div>
          {geminiMode==="api"?(<>
          <div style={{flex:1,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:8}}>
            {geminiChat.length===0&&(
              <div style={{textAlign:"center",color:C.muted,fontSize:11,marginTop:40,lineHeight:1.8}}>
                問 Gemini 關於報告寫法的問題<br/>
                點「📄 附報告」帶入目前報告
              </div>
            )}
            {geminiChat.map((m,i)=>(
              <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"85%"}}>
                <div style={{padding:"8px 12px",borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.role==="user"?"rgba(139,92,246,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${m.role==="user"?"rgba(139,92,246,0.3)":C.border}`,fontSize:12,color:C.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.text}</div>
              </div>
            ))}
            {geminiLoading&&<div style={{alignSelf:"flex-start",padding:"8px 12px",borderRadius:"12px 12px 12px 2px",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,fontSize:12,color:C.muted}}>Thinking...</div>}
            <div ref={geminiEndRef}/>
          </div>
          <div style={{padding:10,borderTop:`1px solid ${C.border}`,flexShrink:0}}>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <button onClick={()=>sendGemini(geminiInput,true)} disabled={geminiLoading||!geminiKey} style={{flex:1,padding:"5px 10px",borderRadius:5,border:"1px solid rgba(139,92,246,0.3)",background:"rgba(139,92,246,0.1)",color:"#a78bfa",fontSize:11,fontWeight:600,cursor:geminiLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>📄 附報告並送出</button>
            </div>
            <div style={{display:"flex",gap:6}}>
              <textarea value={geminiInput} onChange={e=>setGeminiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendGemini(geminiInput);}}} placeholder={geminiKey?"輸入問題... (Enter 送出)":"請設定 VITE_GEMINI_KEY"} disabled={!geminiKey} style={{...inputSt,flex:1,resize:"none",minHeight:36,maxHeight:80,fontSize:12}} rows={2}/>
              <button onClick={()=>sendGemini(geminiInput)} disabled={geminiLoading||!geminiInput.trim()||!geminiKey} style={{padding:"0 12px",borderRadius:5,border:"none",background:geminiLoading||!geminiInput.trim()?"#334155":"#8b5cf6",color:"#fff",fontSize:12,fontWeight:700,cursor:geminiLoading?"not-allowed":"pointer",fontFamily:"inherit",flexShrink:0}}>→</button>
            </div>
          </div>
          </>):(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
            <div style={{fontSize:11,color:C.muted,textAlign:"center",lineHeight:1.8}}>
              點下方按鈕會複製報告到剪貼簿，<br/>並開啟 Gemini 網頁版。<br/>在網頁版直接 Ctrl+V 貼上即可。
            </div>
            <button onClick={()=>{navigator.clipboard.writeText(finalReport);window.open("https://gemini.google.com/app","_blank");}} style={{padding:"12px 24px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 12px rgba(139,92,246,0.3)"}}>📄 複製報告 & 開啟 Gemini</button>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={()=>{navigator.clipboard.writeText(finalReport);window.open("https://chatgpt.com","_blank");}} style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>ChatGPT</button>
              <button onClick={()=>{navigator.clipboard.writeText(finalReport);window.open("https://claude.ai","_blank");}} style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Claude</button>
            </div>
          </div>
          )}
        </div>
      );})()}
    </div>
  );
}
